import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withExamSession } from "@/lib/withExamSession";
import { invalidateSessionCache } from "@/lib/withExamSession";
import { redis, cacheDel } from "@/lib/redis";
import { CacheKeys } from "@/lib/cacheKeys";
import { examResultWhatsappMessage, queueWhatsapp } from "@/lib/whatsapp";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

async function flushHeartbeatCounters(sessionId: string): Promise<{ tabSwitchCount: number; fullscreenExitCount: number }> {
  if (!redis) return { tabSwitchCount: 0, fullscreenExitCount: 0 };
  try {
    const [tab, fs] = await redis.mget(CacheKeys.hbTab(sessionId), CacheKeys.hbFs(sessionId));
    const tabSwitchCount = parseInt(String(tab ?? "0")) || 0;
    const fullscreenExitCount = parseInt(String(fs ?? "0")) || 0;
    await cacheDel(CacheKeys.hbTab(sessionId), CacheKeys.hbFs(sessionId), CacheKeys.hbLastFlush(sessionId));
    return { tabSwitchCount, fullscreenExitCount };
  } catch {
    return { tabSwitchCount: 0, fullscreenExitCount: 0 };
  }
}

async function runScoring(
  sessionId: string,
  examFormId: string,
  studentId: string,
  startedAt: Date,
  status: "submitted" | "auto_submitted",
  sessionToken: string,
  tabSwitchCount: number,
  fullscreenExitCount: number
): Promise<void> {
  try {
    const exam = await prisma.examForm.findUnique({
      where: { id: examFormId },
      select: {
        slug: true,
        title: true,
        showResultImmediately: true,
        questions: {
          select: {
            id: true,
            marks: true,
            questionType: true,
            options: { select: { id: true, isCorrect: true } },
            responses: {
              where: { sessionId },
              select: {
                id: true,
                isSkipped: true,
                selectedOptions: { select: { optionId: true } },
              },
            },
          },
        },
        passingScorePercent: true,
      },
    });

    if (!exam) return;

    type Question = typeof exam.questions[number];
    type Option = Question["options"][number];
    type ResponseOption = Question["responses"][number]["selectedOptions"][number];

    let totalScore = 0;
    const totalMarks = exam.questions.reduce((sum: number, q: Question) => sum + Number(q.marks), 0);
    const responseUpdates: Promise<unknown>[] = [];

    for (const question of exam.questions) {
      const response = question.responses[0];
      if (!response || response.isSkipped) continue;

      const correctOptionIds = new Set(
        question.options.filter((o: Option) => o.isCorrect).map((o: Option) => o.id)
      );
      const selectedIds = new Set(
        response.selectedOptions.map((o: ResponseOption) => o.optionId)
      );

      let isCorrect = false;
      if (question.questionType === "single_choice") {
        isCorrect = selectedIds.size === 1 && correctOptionIds.has([...selectedIds][0]);
      } else {
        isCorrect =
          selectedIds.size === correctOptionIds.size &&
          [...selectedIds].every((id) => correctOptionIds.has(id));
      }

      const marksAwarded = isCorrect ? Number(question.marks) : 0;
      totalScore += marksAwarded;
      responseUpdates.push(
        prisma.examResponse.update({
          where: { id: response.id },
          data: { isCorrect, marksAwarded },
        })
      );
    }

    await Promise.all(responseUpdates);

    const percentage = totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0;
    const isPassed = percentage >= (exam.passingScorePercent ?? 0);
    const timeTakenSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const resultShareToken = crypto.randomUUID();

    await prisma.examSession.update({
      where: { id: sessionId },
      data: {
        status,
        submittedAt: new Date(),
        score: totalScore,
        totalMarks,
        percentage,
        isPassed,
        timeTakenSeconds,
        resultShareToken,
        ...(tabSwitchCount > 0 ? { tabSwitchCount } : {}),
        ...(fullscreenExitCount > 0 ? { fullscreenExitCount } : {}),
      },
    });

    // Send WhatsApp result notification if enabled
    if (exam.showResultImmediately) {
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, email: true, name: true, whatsappNumber: true },
      });

      if (student?.whatsappNumber) {
        const enrollment = await prisma.examEnrollment.findUnique({
          where: { examFormId_studentId: { examFormId, studentId } },
          select: { id: true, whatsappNumber: true },
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const resultPageUrl = `${appUrl}/exam/${exam.slug}/result?session=${sessionId}&token=${resultShareToken}`;
        const studentName = student.name ?? student.email;

        const whatsappSent = await queueWhatsapp({
          to: enrollment?.whatsappNumber ?? student.whatsappNumber,
          contactName: studentName,
          campaignName: process.env.SANDESHAI_EXAM_RESULT_CAMPAIGN_NAME ?? "Exam Result",
          body: examResultWhatsappMessage({ studentName, examTitle: exam.title, score: totalScore, totalMarks, percentage, isPassed, resultUrl: resultPageUrl }),
          templateVariables: [studentName, exam.title, String(totalScore), String(totalMarks), percentage.toFixed(1), isPassed ? "PASSED" : "FAILED", resultPageUrl],
          attributes: { Source: "ExamForge", Exam: exam.title, Result: isPassed ? "PASSED" : "FAILED" },
          recipientType: "student",
          recipientId: student.id,
          notificationType: "student_exam_result",
          relatedExamId: examFormId,
        });

        if (whatsappSent && enrollment) {
          await prisma.examEnrollment.update({
            where: { id: enrollment.id },
            data: { examResultWhatsappSentAt: new Date() },
          });
        }
      }
    }
  } catch (err) {
    console.error("[submit] Background scoring failed for session", sessionId, err);
  } finally {
    // Remove pending marker regardless of success/failure
    if (redis) {
      await redis.del(CacheKeys.scoringPending(sessionId)).catch(() => {});
    }
    await invalidateSessionCache(sessionToken);
  }
}

export function POST(req: NextRequest, ctx: RouteContext) {
  return withExamSession(async (req, { session }) => {
    const sessionToken = req.headers.get("x-session-token")!;

    // Flush Redis heartbeat counters synchronously before releasing the session
    const { tabSwitchCount, fullscreenExitCount } = await flushHeartbeatCounters(session.id);

    // Mark session submitted immediately so no further answers can be saved
    await prisma.examSession.update({
      where: { id: session.id },
      data: { status: "submitted" },
    });

    // Invalidate cache so subsequent requests see the submitted status
    await invalidateSessionCache(sessionToken);

    // Mark scoring as pending in Redis (TTL 120s as a safety net)
    if (redis) {
      await redis.set(CacheKeys.scoringPending(session.id), "1", { ex: 120 }).catch(() => {});
    }

    // Fire scoring in the background — does not block the HTTP response
    setImmediate(() => {
      runScoring(
        session.id,
        session.examFormId,
        session.studentId,
        session.startedAt,
        "submitted",
        sessionToken,
        tabSwitchCount,
        fullscreenExitCount
      );
    });

    return NextResponse.json({
      submitted: true,
      sessionId: session.id,
      scorePending: true,
    });
  })(req, ctx);
}

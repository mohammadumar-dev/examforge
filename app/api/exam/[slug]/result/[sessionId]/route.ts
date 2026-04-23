import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { CacheKeys } from "@/lib/cacheKeys";

type RouteContext = { params: Promise<{ slug: string; sessionId: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { slug, sessionId } = await ctx.params;

  const exam = await prisma.examForm.findUnique({
    where: { slug },
    select: { id: true, showResultImmediately: true, allowReviewAnswers: true },
  });

  if (!exam) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const [session, sectionResponses] = await Promise.all([
    prisma.examSession.findFirst({
      where: { id: sessionId, examFormId: exam.id },
      include: {
        student: { select: { email: true, name: true } },
        ...(exam.allowReviewAnswers
          ? {
              responses: {
                include: {
                  question: {
                    include: { options: { orderBy: { orderIndex: "asc" } } },
                  },
                  selectedOptions: {
                    include: {
                      option: { select: { id: true, optionText: true, isCorrect: true } },
                    },
                  },
                },
                orderBy: { question: { orderIndex: "asc" } },
              },
            }
          : {}),
      },
    }),
    prisma.examResponse.findMany({
      where: { sessionId },
      select: {
        isCorrect: true,
        isSkipped: true,
        marksAwarded: true,
        question: {
          select: {
            marks: true,
            section: { select: { id: true, name: true, orderIndex: true } },
          },
        },
      },
    }),
  ]);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status === "in_progress") {
    return NextResponse.json({ error: "Exam not yet submitted" }, { status: 400 });
  }

  // Check if background scoring is still in progress
  let scoringPending = session.score === null;
  if (scoringPending && redis) {
    const marker = await redis.get(CacheKeys.scoringPending(sessionId)).catch(() => null);
    scoringPending = marker !== null;
  }

  if (scoringPending) {
    return NextResponse.json({ scorePending: true });
  }

  if (!exam.showResultImmediately) {
    return NextResponse.json({
      submitted: true,
      message: "Your submission has been recorded. Results will be shared later.",
    });
  }

  interface SectionBreakdownEntry {
    sectionId: string | null;
    sectionName: string | null;
    orderIndex: number;
    score: number;
    totalMarks: number;
    correct: number;
    total: number;
    skipped: number;
  }

  // Build section breakdown (only when at least one response has a section)
  const hasSections = sectionResponses.some((r) => r.question.section !== null);
  let sectionBreakdown: SectionBreakdownEntry[] | undefined;

  if (hasSections) {
    const map = new Map<string, SectionBreakdownEntry>();
    for (const r of sectionResponses) {
      const sec = r.question.section;
      const key = sec?.id ?? "__none__";
      if (!map.has(key)) {
        map.set(key, {
          sectionId: sec?.id ?? null,
          sectionName: sec?.name ?? null,
          orderIndex: sec?.orderIndex ?? 9999,
          score: 0,
          totalMarks: 0,
          correct: 0,
          total: 0,
          skipped: 0,
        });
      }
      const entry = map.get(key)!;
      entry.total += 1;
      entry.totalMarks += Number(r.question.marks);
      if (r.isSkipped) {
        entry.skipped += 1;
      } else if (r.isCorrect) {
        entry.correct += 1;
        entry.score += Number(r.marksAwarded ?? 0);
      }
    }
    sectionBreakdown = [...map.values()].sort((a, b) => a.orderIndex - b.orderIndex);
  }

  return NextResponse.json({
    result: {
      sessionId: session.id,
      status: session.status,
      score: session.score,
      totalMarks: session.totalMarks,
      percentage: session.percentage,
      isPassed: session.isPassed,
      timeTakenSeconds: session.timeTakenSeconds,
      submittedAt: session.submittedAt,
      resultShareToken: session.resultShareToken,
      student: session.student,
      responses: (session as typeof session & { responses?: unknown[] }).responses ?? undefined,
      sectionBreakdown,
    },
  });
}

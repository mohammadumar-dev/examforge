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

  const session = await prisma.examSession.findFirst({
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
  });

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
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withExamSession } from "@/lib/withExamSession";
import { cacheWrap } from "@/lib/redis";
import { CacheKeys } from "@/lib/cacheKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function GET(req: NextRequest, ctx: RouteContext) {
  return withExamSession(async (req, { session }) => {
    // Cache exam config and question bank — both are immutable during an exam
    const [exam, rawQuestions] = await Promise.all([
      cacheWrap(CacheKeys.examById(session.examFormId), 300, () =>
        prisma.examForm.findUnique({
          where: { id: session.examFormId },
          select: { shuffleQuestions: true, shuffleOptions: true, timeLimitMinutes: true },
        })
      ),
      cacheWrap(CacheKeys.questions(session.examFormId), 300, () =>
        prisma.examQuestion.findMany({
          where: { examFormId: session.examFormId },
          orderBy: { orderIndex: "asc" },
          include: {
            options: {
              orderBy: { orderIndex: "asc" },
              select: { id: true, optionText: true, orderIndex: true },
              // Never include isCorrect — server-only until submit
            },
          },
        })
      ),
    ]);

    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    // Shuffle is per-session (non-deterministic), not cached
    let questions = [...rawQuestions];
    if (exam.shuffleQuestions) questions = shuffleArray(questions);
    if (exam.shuffleOptions) {
      questions = questions.map((q) => ({ ...q, options: shuffleArray(q.options) }));
    }

    // Per-session: existing responses for resumption (never cached)
    const responses = await prisma.examResponse.findMany({
      where: { sessionId: session.id },
      include: { selectedOptions: { select: { optionId: true } } },
    });
    const responseMap = Object.fromEntries(
      responses.map((r) => [r.questionId, r.selectedOptions.map((o) => o.optionId)])
    );

    let remainingSeconds: number | null = null;
    if (exam.timeLimitMinutes) {
      const elapsed = (Date.now() - session.startedAt.getTime()) / 1000;
      remainingSeconds = Math.max(0, exam.timeLimitMinutes * 60 - elapsed);
    }

    return NextResponse.json({ questions, savedAnswers: responseMap, remainingSeconds });
  })(req, ctx);
}

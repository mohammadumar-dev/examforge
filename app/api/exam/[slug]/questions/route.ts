import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withExamSession } from "@/lib/withExamSession";

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
    const exam = await prisma.examForm.findUnique({
      where: { id: session.examFormId },
      select: { shuffleQuestions: true, shuffleOptions: true, timeLimitMinutes: true },
    });

    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    let questions = await prisma.examQuestion.findMany({
      where: { examFormId: session.examFormId },
      orderBy: { orderIndex: "asc" },
      include: {
        options: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, optionText: true, orderIndex: true },
          // Never include isCorrect — that's server-only until submit
        },
      },
    });

    if (exam.shuffleQuestions) {
      questions = shuffleArray(questions);
    }
    if (exam.shuffleOptions) {
      questions = questions.map((q: typeof questions[number]) => ({ ...q, options: shuffleArray(q.options) }));
    }

    // Fetch existing responses for this session (for resumption)
    const responses = await prisma.examResponse.findMany({
      where: { sessionId: session.id },
      include: { selectedOptions: { select: { optionId: true } } },
    });
    const responseMap = Object.fromEntries(
      responses.map((r: typeof responses[number]) => [
        r.questionId,
        r.selectedOptions.map((o: { optionId: string }) => o.optionId),
      ])
    );

    // Calculate remaining time
    let remainingSeconds: number | null = null;
    if (exam.timeLimitMinutes) {
      const elapsed = (Date.now() - session.startedAt.getTime()) / 1000;
      remainingSeconds = Math.max(0, exam.timeLimitMinutes * 60 - elapsed);
    }

    return NextResponse.json({
      questions,
      savedAnswers: responseMap,
      remainingSeconds,
    });
  })(req, ctx);
}

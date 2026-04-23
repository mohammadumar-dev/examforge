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
    const [exam, rawQuestions, sections, responses] = await Promise.all([
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
      cacheWrap(CacheKeys.sections(session.examFormId), 300, () =>
        prisma.examSection.findMany({
          where: { examFormId: session.examFormId },
          orderBy: { orderIndex: "asc" },
          select: { id: true, name: true, orderIndex: true },
        })
      ),
      // Per-session responses for resumption — never cached
      prisma.examResponse.findMany({
        where: { sessionId: session.id },
        include: { selectedOptions: { select: { optionId: true } } },
      }),
    ]);

    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const responseMap = Object.fromEntries(
      responses.map((r) => [r.questionId, r.selectedOptions.map((o) => o.optionId)])
    );

    let remainingSeconds: number | null = null;
    if (exam.timeLimitMinutes) {
      const elapsed = (Date.now() - session.startedAt.getTime()) / 1000;
      remainingSeconds = Math.max(0, exam.timeLimitMinutes * 60 - elapsed);
    }

    type RawQuestion = (typeof rawQuestions)[number];
    const applyShuffles = (qs: RawQuestion[]) => {
      let result = [...qs];
      if (exam.shuffleQuestions) result = shuffleArray(result);
      if (exam.shuffleOptions) result = result.map((q) => ({ ...q, options: shuffleArray(q.options) }));
      return result;
    };

    if (sections.length === 0) {
      return NextResponse.json({
        questions: applyShuffles(rawQuestions),
        savedAnswers: responseMap,
        remainingSeconds,
      });
    }

    // Group questions into sections and shuffle per-section
    const buckets = new Map<string, RawQuestion[]>(sections.map((s) => [s.id, []]));
    const unsectioned: RawQuestion[] = [];

    for (const q of rawQuestions) {
      if (q.sectionId && buckets.has(q.sectionId)) {
        buckets.get(q.sectionId)!.push(q);
      } else {
        unsectioned.push(q);
      }
    }

    type SectionResult = { id: string | null; name: string | null; orderIndex: number; questions: RawQuestion[] };
    const sectionedResult: SectionResult[] = sections.map((s) => ({
      id: s.id,
      name: s.name,
      orderIndex: s.orderIndex,
      questions: applyShuffles(buckets.get(s.id) ?? []),
    }));

    if (unsectioned.length > 0) {
      sectionedResult.push({ id: null, name: null, orderIndex: Number.MAX_SAFE_INTEGER, questions: applyShuffles(unsectioned) });
    }

    return NextResponse.json({ sections: sectionedResult, savedAnswers: responseMap, remainingSeconds });
  })(req, ctx);
}

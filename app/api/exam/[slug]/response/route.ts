import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withExamSession } from "@/lib/withExamSession";
import { cacheWrap } from "@/lib/redis";
import { CacheKeys } from "@/lib/cacheKeys";
import { saveResponseSchema } from "@/lib/validators/examTakingSchemas";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export function POST(req: NextRequest, ctx: RouteContext) {
  return withExamSession(async (req, { session }) => {
    let body: z.infer<typeof saveResponseSchema>;
    try {
      body = saveResponseSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    // Use cached question bank to verify question belongs to this exam (avoids per-save DB read)
    const questions = await cacheWrap(CacheKeys.questions(session.examFormId), 300, () =>
      prisma.examQuestion.findMany({
        where: { examFormId: session.examFormId },
        orderBy: { orderIndex: "asc" },
        include: {
          options: { orderBy: { orderIndex: "asc" }, select: { id: true, optionText: true, orderIndex: true } },
        },
      })
    );

    const question = questions.find((q) => q.id === body.questionId);
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Use cached exam config to check time limit
    const exam = await cacheWrap(CacheKeys.examById(session.examFormId), 300, () =>
      prisma.examForm.findUnique({
        where: { id: session.examFormId },
        select: { timeLimitMinutes: true },
      })
    );
    if (exam?.timeLimitMinutes) {
      const elapsed = (Date.now() - session.startedAt.getTime()) / 1000 / 60;
      if (elapsed >= exam.timeLimitMinutes) {
        return NextResponse.json({ error: "Time has expired" }, { status: 403 });
      }
    }

    // Upsert response
    const response = await prisma.examResponse.upsert({
      where: { sessionId_questionId: { sessionId: session.id, questionId: body.questionId } },
      update: { isSkipped: body.isSkipped, answeredAt: new Date() },
      create: {
        sessionId: session.id,
        questionId: body.questionId,
        isSkipped: body.isSkipped,
      },
    });

    // Replace selected options
    await prisma.examResponseOption.deleteMany({ where: { responseId: response.id } });

    if (!body.isSkipped && body.optionIds.length > 0) {
      // Validate option IDs against cached question options
      const validIds = question.options
        .filter((o) => body.optionIds.includes(o.id))
        .map((o) => o.id);

      if (validIds.length > 0) {
        await prisma.examResponseOption.createMany({
          data: validIds.map((optionId) => ({ responseId: response.id, optionId })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({ saved: true, responseId: response.id });
  })(req, ctx);
}

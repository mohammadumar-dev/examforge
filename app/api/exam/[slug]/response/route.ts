import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withExamSession } from "@/lib/withExamSession";
import { saveResponseSchema } from "@/lib/validators/examTakingSchemas";
import { z } from "zod";

type RouteContext = { params: Promise<{ slug: string }> };

export function POST(req: NextRequest, ctx: RouteContext) {
  return withExamSession(async (req, { session }) => {
    let body: z.infer<typeof saveResponseSchema>;
    try {
      body = saveResponseSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    // Verify question belongs to this exam
    const question = await prisma.examQuestion.findFirst({
      where: { id: body.questionId, examFormId: session.examFormId },
    });
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Check time hasn't expired
    const exam = await prisma.examForm.findUnique({
      where: { id: session.examFormId },
      select: { timeLimitMinutes: true },
    });
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
      // Verify options belong to this question
      const validOptions = await prisma.examQuestionOption.findMany({
        where: { id: { in: body.optionIds }, questionId: body.questionId },
        select: { id: true },
      });
      const validIds = validOptions.map((o: { id: string }) => o.id);

      if (validIds.length > 0) {
        await prisma.examResponseOption.createMany({
          data: validIds.map((optionId: string) => ({ responseId: response.id, optionId })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({ saved: true, responseId: response.id });
  })(req, ctx);
}

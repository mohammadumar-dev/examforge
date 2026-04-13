import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { updateQuestionSchema } from "@/lib/validators/examSchemas";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string; qid: string }> };

export function PATCH(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    const qid = params?.qid;
    if (!examId || !qid) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId, adminId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const question = await prisma.examQuestion.findFirst({
      where: { id: qid, examFormId: examId },
    });
    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

    let body: z.infer<typeof updateQuestionSchema>;
    try {
      body = updateQuestionSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    const { options, ...questionFields } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await prisma.$transaction(async (tx: any) => {
      const q = await tx.examQuestion.update({
        where: { id: qid },
        data: questionFields,
      });

      if (options) {
        if (!options.some((o) => o.isCorrect)) {
          throw new Error("At least one option must be correct");
        }
        // Replace all options
        await tx.examQuestionOption.deleteMany({ where: { questionId: qid } });
        await tx.examQuestionOption.createMany({
          data: options.map((o) => ({
            questionId: qid,
            optionText: o.optionText!,
            isCorrect: o.isCorrect ?? false,
            orderIndex: o.orderIndex ?? 0,
          })),
        });
      }

      return tx.examQuestion.findUnique({
        where: { id: qid },
        include: { options: { orderBy: { orderIndex: "asc" } } },
      });
    });

    // Recalculate total marks
    if (body.marks !== undefined) {
      const allQuestions = await prisma.examQuestion.findMany({
        where: { examFormId: examId },
        select: { marks: true },
      });
      const totalMarks = allQuestions.reduce((sum: number, q: { marks: unknown }) => sum + Number(q.marks), 0);
      await prisma.examForm.update({ where: { id: examId }, data: { totalMarks } });
    }

    return NextResponse.json({ question: updated });
  })(req, ctx);
}

export function DELETE(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    const qid = params?.qid;
    if (!examId || !qid) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId, adminId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const question = await prisma.examQuestion.findFirst({
      where: { id: qid, examFormId: examId },
    });
    if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

    await prisma.examQuestion.delete({ where: { id: qid } });

    // Recalculate total marks
    const allQuestions = await prisma.examQuestion.findMany({
      where: { examFormId: examId },
      select: { marks: true },
    });
    const totalMarks = allQuestions.reduce((sum, q) => sum + Number(q.marks), 0);
    await prisma.examForm.update({ where: { id: examId }, data: { totalMarks } });

    return NextResponse.json({ message: "Question deleted" });
  })(req, ctx);
}

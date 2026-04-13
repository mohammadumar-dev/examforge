import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { createQuestionSchema } from "@/lib/validators/examSchemas";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId, adminId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const questions = await prisma.examQuestion.findMany({
      where: { examFormId: examId },
      orderBy: { orderIndex: "asc" },
      include: { options: { orderBy: { orderIndex: "asc" } } },
    });

    return NextResponse.json({ questions });
  })(req, ctx);
}

export function POST(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId, adminId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    let body: z.infer<typeof createQuestionSchema>;
    try {
      body = createQuestionSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    // Validate at least one correct option
    const hasCorrect = body.options.some((o) => o.isCorrect);
    if (!hasCorrect) {
      return NextResponse.json(
        { error: "At least one option must be marked as correct" },
        { status: 400 }
      );
    }

    // Get next order index
    const lastQuestion = await prisma.examQuestion.findFirst({
      where: { examFormId: examId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    const orderIndex = (lastQuestion?.orderIndex ?? -1) + 1;

    const question = await prisma.examQuestion.create({
      data: {
        examFormId: examId,
        questionText: body.questionText,
        questionType: body.questionType,
        marks: body.marks,
        orderIndex,
        explanation: body.explanation,
        isRequired: body.isRequired,
        options: {
          create: body.options.map((o) => ({
            optionText: o.optionText,
            isCorrect: o.isCorrect,
            orderIndex: o.orderIndex,
          })),
        },
      },
      include: { options: { orderBy: { orderIndex: "asc" } } },
    });

    // Recalculate total marks
    const allQuestions = await prisma.examQuestion.findMany({
      where: { examFormId: examId },
      select: { marks: true },
    });
    const totalMarks = allQuestions.reduce((sum: number, q: { marks: unknown }) => sum + Number(q.marks), 0);
    await prisma.examForm.update({ where: { id: examId }, data: { totalMarks } });

    return NextResponse.json({ question }, { status: 201 });
  })(req, ctx);
}

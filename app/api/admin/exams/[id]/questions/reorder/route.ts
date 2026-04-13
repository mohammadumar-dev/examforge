import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { reorderQuestionsSchema } from "@/lib/validators/examSchemas";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export function PATCH(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId, adminId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    let body: z.infer<typeof reorderQuestionsSchema>;
    try {
      body = reorderQuestionsSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    // Verify all questions belong to this exam
    const questions = await prisma.examQuestion.findMany({
      where: { examFormId: examId },
      select: { id: true },
    });
    const existingIds = new Set(questions.map((q: { id: string }) => q.id));
    const allValid = body.questionIds.every((id) => existingIds.has(id));

    if (!allValid || body.questionIds.length !== questions.length) {
      return NextResponse.json({ error: "Invalid question IDs" }, { status: 400 });
    }

    // Update order indices
    await prisma.$transaction(
      body.questionIds.map((id, index) =>
        prisma.examQuestion.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    return NextResponse.json({ message: "Questions reordered" });
  })(req, ctx);
}

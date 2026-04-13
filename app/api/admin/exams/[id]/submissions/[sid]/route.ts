import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

type RouteContext = { params: Promise<{ id: string; sid: string }> };

export function GET(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    const sid = params?.sid;
    if (!examId || !sid) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId, adminId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const session = await prisma.examSession.findFirst({
      where: { id: sid, examFormId: examId },
      include: {
        student: { select: { id: true, email: true, name: true } },
        responses: {
          include: {
            question: {
              include: { options: { orderBy: { orderIndex: "asc" } } },
            },
            selectedOptions: {
              include: { option: { select: { id: true, optionText: true, isCorrect: true } } },
            },
          },
          orderBy: { question: { orderIndex: "asc" } },
        },
      },
    });

    if (!session) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

    return NextResponse.json({ session });
  })(req, ctx);
}

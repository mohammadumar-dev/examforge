import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

type RouteContext = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 50)));
    const skip = (page - 1) * limit;

    const [sessions, total] = await prisma.$transaction([
      prisma.examSession.findMany({
        where: { examFormId: examId },
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
        include: {
          student: { select: { id: true, email: true, name: true } },
        },
      }),
      prisma.examSession.count({ where: { examFormId: examId } }),
    ]);

    return NextResponse.json({ sessions, total, page, limit });
  })(req, ctx);
}

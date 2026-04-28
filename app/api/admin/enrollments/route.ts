import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

export const GET = withAdminAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 50)));
  const skip = (page - 1) * limit;
  const examId = searchParams.get("examId") ?? undefined;

  const where = examId ? { examFormId: examId } : {};

  const [sessions, total] = await prisma.$transaction([
    prisma.examSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
      include: {
        student: { select: { id: true, email: true, name: true, mobileNumber: true, whatsappNumber: true } },
        examForm: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.examSession.count({ where }),
  ]);

  return NextResponse.json({ sessions, total, page, limit });
});

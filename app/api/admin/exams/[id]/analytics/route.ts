import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

type RouteContext = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId, adminId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const sessions = await prisma.examSession.findMany({
      where: {
        examFormId: examId,
        status: { in: ["submitted", "auto_submitted"] },
      },
      select: {
        score: true,
        totalMarks: true,
        percentage: true,
        isPassed: true,
        timeTakenSeconds: true,
        status: true,
      },
    });

    const total = sessions.length;
    const inProgress = await prisma.examSession.count({
      where: { examFormId: examId, status: "in_progress" },
    });

    type SessionRow = typeof sessions[number];

    const avgScore =
      total > 0
        ? sessions.reduce((sum: number, s: SessionRow) => sum + Number(s.percentage ?? 0), 0) / total
        : 0;

    const passCount = sessions.filter((s: SessionRow) => s.isPassed).length;
    const passRate = total > 0 ? (passCount / total) * 100 : 0;

    const completedWithTime = sessions.filter((s: SessionRow) => s.timeTakenSeconds != null);
    const avgTimeSeconds =
      completedWithTime.length > 0
        ? completedWithTime.reduce((sum: number, s: SessionRow) => sum + (s.timeTakenSeconds ?? 0), 0) /
          completedWithTime.length
        : null;

    const autoSubmitted = sessions.filter((s: SessionRow) => s.status === "auto_submitted").length;

    return NextResponse.json({
      analytics: {
        total,
        inProgress,
        passed: passCount,
        failed: total - passCount,
        passRate: Number(passRate.toFixed(1)),
        avgScore: Number(avgScore.toFixed(1)),
        avgTimeSeconds: avgTimeSeconds ? Math.round(avgTimeSeconds) : null,
        autoSubmitted,
      },
    });
  })(req, ctx);
}

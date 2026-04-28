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

  const [enrollments, total] = await prisma.$transaction([
    prisma.examEnrollment.findMany({
      where,
      orderBy: { registeredAt: "desc" },
      skip,
      take: limit,
      include: {
        student: {
          select: { id: true, email: true, name: true, mobileNumber: true, whatsappNumber: true },
        },
        examForm: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.examEnrollment.count({ where }),
  ]);

  // Fetch sessions for all enrollments in one query then merge
  const sessions =
    enrollments.length > 0
      ? await prisma.examSession.findMany({
          where: {
            OR: enrollments.map((e) => ({
              examFormId: e.examFormId,
              studentId: e.studentId,
            })),
          },
          select: {
            examFormId: true,
            studentId: true,
            status: true,
            startedAt: true,
            submittedAt: true,
            timeTakenSeconds: true,
            score: true,
            totalMarks: true,
            percentage: true,
            isPassed: true,
          },
        })
      : [];

  const sessionMap = new Map(
    sessions.map((s) => [`${s.examFormId}:${s.studentId}`, s])
  );

  const result = enrollments.map((e) => {
    const session = sessionMap.get(`${e.examFormId}:${e.studentId}`);
    return {
      id: e.id,
      registeredAt: e.registeredAt,
      status: session?.status ?? "registered",
      startedAt: session?.startedAt ?? null,
      submittedAt: session?.submittedAt ?? null,
      timeTakenSeconds: session?.timeTakenSeconds ?? null,
      score: session?.score ?? null,
      totalMarks: session?.totalMarks ?? null,
      percentage: session?.percentage ?? null,
      isPassed: session?.isPassed ?? null,
      student: e.student,
      examForm: e.examForm,
    };
  });

  return NextResponse.json({ sessions: result, total, page, limit });
});

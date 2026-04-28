import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const examId = searchParams.get("examId") ?? undefined;

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const record = await prisma.enrollmentShareToken.findUnique({
    where: { token },
    select: { id: true, label: true, expiresAt: true, revokedAt: true },
  });

  if (!record || record.revokedAt !== null || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const enrollments = await prisma.examEnrollment.findMany({
    where: examId ? { examFormId: examId } : {},
    orderBy: { registeredAt: "desc" },
    take: 200,
    include: {
      student: {
        select: { id: true, email: true, name: true, mobileNumber: true, whatsappNumber: true },
      },
      examForm: { select: { id: true, title: true, slug: true } },
    },
  });

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
            timeTakenSeconds: true,
            score: true,
            totalMarks: true,
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
      timeTakenSeconds: session?.timeTakenSeconds ?? null,
      score: session?.score ?? null,
      totalMarks: session?.totalMarks ?? null,
      isPassed: session?.isPassed ?? null,
      student: e.student,
      examForm: e.examForm,
    };
  });

  return NextResponse.json({
    sessions: result,
    expiresAt: record.expiresAt,
    label: record.label,
  });
}

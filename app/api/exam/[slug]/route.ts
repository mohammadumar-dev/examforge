import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;

  const exam = await prisma.examForm.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      instructions: true,
      timeLimitMinutes: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      passingScorePercent: true,
      totalMarks: true,
      showResultImmediately: true,
      isPublished: true,
      status: true,
      accessRule: { select: { accessType: true } },
      _count: { select: { questions: true } },
    },
  });

  if (!exam || !exam.isPublished || exam.status !== "published") {
    return NextResponse.json({ error: "Exam not found or not available" }, { status: 404 });
  }

  const now = new Date();
  if (exam.scheduledStartAt && exam.scheduledStartAt > now) {
    return NextResponse.json(
      {
        error: "Exam has not started yet",
        startsAt: exam.scheduledStartAt,
      },
      { status: 403 }
    );
  }
  if (exam.scheduledEndAt && exam.scheduledEndAt < now) {
    return NextResponse.json({ error: "Exam has ended" }, { status: 403 });
  }

  return NextResponse.json({ exam });
}

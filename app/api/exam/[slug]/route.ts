import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cacheWrap } from "@/lib/redis";
import { CacheKeys } from "@/lib/cacheKeys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;

  const exam = await cacheWrap(CacheKeys.examBySlug(slug), 300, () =>
    prisma.examForm.findUnique({
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
    })
  );

  if (!exam || !exam.isPublished || exam.status !== "published") {
    return NextResponse.json({ error: "Exam not found or not available" }, { status: 404 });
  }

  const now = new Date();
  if (exam.scheduledStartAt && new Date(exam.scheduledStartAt) > now) {
    return NextResponse.json(
      { error: "Exam has not started yet", startsAt: exam.scheduledStartAt },
      { status: 403 }
    );
  }
  if (exam.scheduledEndAt && new Date(exam.scheduledEndAt) < now) {
    return NextResponse.json({ error: "Exam has ended" }, { status: 403 });
  }

  return NextResponse.json({ exam });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessSchema } from "@/lib/validators/examTakingSchemas";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import crypto from "crypto";
import { z } from "zod";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const ip = getClientIp(req);

  const { success } = rateLimit(`verify:${ip}`, 20, 5 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: z.infer<typeof verifyAccessSchema>;
  try {
    body = verifyAccessSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
  }

  const email = body.email.toLowerCase();

  const exam = await prisma.examForm.findUnique({
    where: { slug },
    include: { accessRule: true },
  });

  if (!exam || !exam.isPublished || exam.status !== "published") {
    return NextResponse.json({ error: "Exam not found or not available" }, { status: 404 });
  }

  const now = new Date();
  if (exam.scheduledStartAt && exam.scheduledStartAt > now) {
    return NextResponse.json({ error: "Exam has not started yet" }, { status: 403 });
  }
  if (exam.scheduledEndAt && exam.scheduledEndAt < now) {
    return NextResponse.json({ error: "Exam has ended" }, { status: 403 });
  }

  // Check access type
  if (exam.accessRule?.accessType === "specific_emails") {
    const allowed = await prisma.examAllowedEmail.findUnique({
      where: { examFormId_email: { examFormId: exam.id, email } },
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "You are not authorized to take this exam" },
        { status: 403 }
      );
    }
  }

  // Upsert student
  const student = await prisma.student.upsert({
    where: { email },
    update: { name: body.name ?? undefined },
    create: { email, name: body.name },
  });

  // Check for existing session
  const existing = await prisma.examSession.findUnique({
    where: { examFormId_studentId: { examFormId: exam.id, studentId: student.id } },
  });

  if (existing) {
    if (existing.status === "submitted" || existing.status === "auto_submitted") {
      return NextResponse.json(
        { error: "You have already submitted this exam", status: existing.status },
        { status: 409 }
      );
    }
    if (existing.status === "in_progress") {
      // Rotate the session token so any other open window is immediately invalidated
      const newToken = crypto.randomUUID();
      await prisma.examSession.update({
        where: { id: existing.id },
        data: { sessionToken: newToken },
      });
      return NextResponse.json({
        sessionToken: newToken,
        sessionId: existing.id,
        resumed: true,
        startedAt: existing.startedAt,
      });
    }
  }

  // Create new session
  const sessionToken = crypto.randomUUID();
  const session = await prisma.examSession.create({
    data: {
      examFormId: exam.id,
      studentId: student.id,
      sessionToken,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
      status: "in_progress",
    },
    select: { id: true, startedAt: true },
  });

  return NextResponse.json({
    sessionToken,
    sessionId: session.id,
    resumed: false,
    startedAt: session.startedAt,
  });
}

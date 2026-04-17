import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessSchema } from "@/lib/validators/examTakingSchemas";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { cacheWrap, cacheSet, cacheDel } from "@/lib/redis";
import { CacheKeys } from "@/lib/cacheKeys";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const ip = getClientIp(req);

  const { success } = await rateLimit(`verify:${ip}`, 20, 5 * 60 * 1000);
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

  // Cache exam + access rule (read-through, 5 min TTL)
  const exam = await cacheWrap(CacheKeys.examBySlug(slug), 300, () =>
    prisma.examForm.findUnique({
      where: { slug },
      include: { accessRule: true },
    })
  );

  if (!exam || !exam.isPublished || exam.status !== "published") {
    return NextResponse.json({ error: "Exam not found or not available" }, { status: 404 });
  }

  const now = new Date();
  if (exam.scheduledStartAt && new Date(exam.scheduledStartAt) > now) {
    return NextResponse.json({ error: "Exam has not started yet" }, { status: 403 });
  }
  if (exam.scheduledEndAt && new Date(exam.scheduledEndAt) < now) {
    return NextResponse.json({ error: "Exam has ended" }, { status: 403 });
  }

  // Check specific-email access (cache allowed email list per exam)
  if (exam.accessRule?.accessType === "specific_emails") {
    const accessKey = `${CacheKeys.access(exam.id)}:email:${email}`;
    const allowed = await cacheWrap(accessKey, 300, () =>
      prisma.examAllowedEmail.findUnique({
        where: { examFormId_email: { examFormId: exam.id, email } },
      })
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "You are not authorized to take this exam" },
        { status: 403 }
      );
    }
  }

  const student = await prisma.student.findUnique({ where: { email } });

  if (!student) {
    return NextResponse.json(
      { error: "Please enroll for this exam before starting" },
      { status: 403 }
    );
  }

  const enrollment = await prisma.examEnrollment.findUnique({
    where: { examFormId_studentId: { examFormId: exam.id, studentId: student.id } },
  });

  if (!enrollment) {
    return NextResponse.json(
      { error: "Please complete registration before starting this exam" },
      { status: 403 }
    );
  }

  const validPassword = await bcrypt.compare(body.password, enrollment.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "Invalid email or exam password" }, { status: 401 });
  }

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
      const newToken = crypto.randomUUID();
      await prisma.examSession.update({
        where: { id: existing.id },
        data: { sessionToken: newToken },
      });
      // Invalidate old session cache; new token will populate on first use
      await cacheDel(CacheKeys.session(existing.sessionToken));

      // Set Redis owner lock
      await cacheSet(CacheKeys.owner(exam.id, student.id), existing.id, 60);

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

  // Set Redis owner lock
  await cacheSet(CacheKeys.owner(exam.id, student.id), session.id, 60);

  return NextResponse.json({
    sessionToken,
    sessionId: session.id,
    resumed: false,
    startedAt: session.startedAt,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { examRegistrationSchema } from "@/lib/validators/examTakingSchemas";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { cacheWrap } from "@/lib/redis";
import { CacheKeys } from "@/lib/cacheKeys";
import { queueWhatsapp } from "@/lib/whatsapp";
import { buildExamRegistrationTemplate } from "@/lib/whatsapp-templates";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const ip = getClientIp(req);

  const { success } = await rateLimit(`register:${ip}`, 20, 5 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: z.infer<typeof examRegistrationSchema>;
  try {
    body = examRegistrationSchema.parse(await req.json());
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

  if (exam.accessRule?.accessType === "specific_emails") {
    const accessKey = `${CacheKeys.access(exam.id)}:email:${email}`;
    const allowed = await cacheWrap(accessKey, 300, () =>
      prisma.examAllowedEmail.findUnique({
        where: { examFormId_email: { examFormId: exam.id, email } },
      })
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "You are not authorized to register for this exam" },
        { status: 403 }
      );
    }
  }

  const student = await prisma.student.upsert({
    where: { email },
    update: {
      name: body.name,
      mobileNumber: body.mobileNumber,
      whatsappNumber: body.whatsappNumber,
    },
    create: {
      email,
      name: body.name,
      mobileNumber: body.mobileNumber,
      whatsappNumber: body.whatsappNumber,
    },
  });

  // Block if the same mobile or WhatsApp number already submitted this exam
  const phoneFilters: ({ mobileNumber: string } | { whatsappNumber: string })[] = [];
  if (body.mobileNumber) phoneFilters.push({ mobileNumber: body.mobileNumber });
  if (body.whatsappNumber) phoneFilters.push({ whatsappNumber: body.whatsappNumber });

  if (phoneFilters.length > 0) {
    const duplicate = await prisma.examEnrollment.findFirst({
      where: {
        examFormId: exam.id,
        studentId: { not: student.id },
        OR: phoneFilters,
        student: {
          examSessions: {
            some: {
              examFormId: exam.id,
              status: { in: ["submitted", "auto_submitted"] },
            },
          },
        },
      },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: "This mobile number has already been used to submit this exam" },
        { status: 409 }
      );
    }
  }

  const examPassword = crypto.randomBytes(4).toString("hex").toUpperCase();
  const passwordHash = await bcrypt.hash(examPassword, 10);

  const enrollment = await prisma.examEnrollment.upsert({
    where: { examFormId_studentId: { examFormId: exam.id, studentId: student.id } },
    update: {
      mobileNumber: body.mobileNumber,
      whatsappNumber: body.whatsappNumber,
      passwordHash,
      examInfoWhatsappSentAt: null,
    },
    create: {
      examFormId: exam.id,
      studentId: student.id,
      mobileNumber: body.mobileNumber,
      whatsappNumber: body.whatsappNumber,
      passwordHash,
    },
  });

  const { body: msgBody, templateVariables } = buildExamRegistrationTemplate({
    studentName: body.name,
    examTitle: exam.title,
    examSlug: exam.slug,
    studentEmail: email,
    examPassword,
    scheduledStartAt: exam.scheduledStartAt,
    timeLimitMinutes: exam.timeLimitMinutes,
  });

  const whatsappSent = await queueWhatsapp({
    to: body.whatsappNumber,
    contactName: body.name,
    campaignName: process.env.SANDESHAI_EXAM_INFO_CAMPAIGN_NAME ?? "Exam Enrollment",
    body: msgBody,
    templateVariables,
    attributes: {
      Source: "ExamForge",
      Exam: exam.title,
      Email: email,
    },
    recipientType: "student",
    recipientId: student.id,
    notificationType: "student_exam_registration",
    relatedExamId: exam.id,
  });

  if (whatsappSent) {
    await prisma.examEnrollment.update({
      where: { id: enrollment.id },
      data: { examInfoWhatsappSentAt: new Date() },
    });
  }

  return NextResponse.json({
    registered: true,
    enrollmentId: enrollment.id,
    studentId: student.id,
    examPassword,
    whatsappSent,
  });
}

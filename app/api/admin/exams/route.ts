import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { createExamSchema } from "@/lib/validators/examSchemas";
import { generateSlug } from "@/lib/slugify";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const GET = withAdminAuth(async (req, { adminId }) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;

  const [exams, total] = await prisma.$transaction([
    prisma.examForm.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        isPublished: true,
        totalMarks: true,
        timeLimitMinutes: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { questions: true, sessions: true } },
      },
    }),
    prisma.examForm.count({ where: { adminId } }),
  ]);

  return NextResponse.json({ exams, total, page, limit });
});

export const POST = withAdminAuth(async (req, { adminId }) => {
  let body: z.infer<typeof createExamSchema>;
  try {
    body = createExamSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
  }

  const slug = generateSlug(body.title);

  const exam = await prisma.examForm.create({
    data: {
      adminId,
      slug,
      ...body,
      scheduledStartAt: body.scheduledStartAt ? new Date(body.scheduledStartAt) : null,
      scheduledEndAt: body.scheduledEndAt ? new Date(body.scheduledEndAt) : null,
      // Create default access rule
      accessRule: {
        create: { accessType: "specific_emails" },
      },
    },
    include: {
      accessRule: true,
      _count: { select: { questions: true, sessions: true } },
    },
  });

  await writeAuditLog({ actorType: "admin", actorId: adminId, action: "exam.created", targetType: "exam", targetId: exam.id });
  return NextResponse.json({ exam }, { status: 201 });
});

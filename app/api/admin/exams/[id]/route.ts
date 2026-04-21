import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { invalidateExamCaches } from "@/lib/examCacheInvalidation";
import { updateExamSchema } from "@/lib/validators/examSchemas";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({
      where: { id },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
          include: { options: { orderBy: { orderIndex: "asc" } } },
        },
        accessRule: true,
        _count: { select: { sessions: true } },
      },
    });

    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    return NextResponse.json({ exam });
  })(req, ctx);
}

export function PATCH(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    let body: z.infer<typeof updateExamSchema>;
    try {
      body = updateExamSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    const exam = await prisma.examForm.findFirst({ where: { id } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const updated = await prisma.examForm.update({
      where: { id },
      data: {
        ...body,
        scheduledStartAt: body.scheduledStartAt ? new Date(body.scheduledStartAt) : body.scheduledStartAt,
        scheduledEndAt: body.scheduledEndAt ? new Date(body.scheduledEndAt) : body.scheduledEndAt,
      },
    });

    await invalidateExamCaches(id, exam.slug);
    return NextResponse.json({ exam: updated });
  })(req, ctx);
}

export function DELETE(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    // Soft delete — archive
    await prisma.examForm.update({
      where: { id },
      data: { status: "archived", isPublished: false },
    });

    return NextResponse.json({ message: "Exam archived" });
  })(req, ctx);
}

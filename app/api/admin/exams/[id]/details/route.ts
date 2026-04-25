import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { invalidateExamCaches } from "@/lib/examCacheInvalidation";
import { updateExamDetailsSchema } from "@/lib/validators/examSchemas";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export function PATCH(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    let body: z.infer<typeof updateExamDetailsSchema>;
    try {
      body = updateExamDetailsSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    const exam = await prisma.examForm.findFirst({ where: { id } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    if (exam.status === "archived") {
      return NextResponse.json({ error: "Cannot update an archived exam" }, { status: 400 });
    }

    // Validate schedule consistency against existing values when only one side is updated
    const startAt = "scheduledStartAt" in body ? body.scheduledStartAt : exam.scheduledStartAt?.toISOString() ?? null;
    const endAt = "scheduledEndAt" in body ? body.scheduledEndAt : exam.scheduledEndAt?.toISOString() ?? null;
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      return NextResponse.json(
        { error: "scheduledEndAt must be after scheduledStartAt" },
        { status: 400 }
      );
    }

    const updated = await prisma.examForm.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.instructions !== undefined && { instructions: body.instructions }),
        ...("timeLimitMinutes" in body && { timeLimitMinutes: body.timeLimitMinutes }),
        ...("scheduledStartAt" in body && {
          scheduledStartAt: body.scheduledStartAt ? new Date(body.scheduledStartAt) : null,
        }),
        ...("scheduledEndAt" in body && {
          scheduledEndAt: body.scheduledEndAt ? new Date(body.scheduledEndAt) : null,
        }),
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        instructions: true,
        timeLimitMinutes: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        updatedAt: true,
      },
    });

    await invalidateExamCaches(id, exam.slug);
    return NextResponse.json({ exam: updated });
  })(req, ctx);
}

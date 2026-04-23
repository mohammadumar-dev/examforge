import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { invalidateExamCaches } from "@/lib/examCacheInvalidation";
import { createSectionSchema } from "@/lib/validators/examSchemas";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const sections = await prisma.examSection.findMany({
      where: { examFormId: examId },
      orderBy: { orderIndex: "asc" },
    });
    return NextResponse.json({ sections });
  })(req, ctx);
}

export function POST(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    let body: z.infer<typeof createSectionSchema>;
    try {
      body = createSectionSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    const last = await prisma.examSection.findFirst({
      where: { examFormId: examId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    const orderIndex = (last?.orderIndex ?? -1) + 1;

    const section = await prisma.examSection.create({
      data: { examFormId: examId, name: body.name, description: body.description, orderIndex },
    });

    await invalidateExamCaches(examId);
    return NextResponse.json({ section }, { status: 201 });
  })(req, ctx);
}

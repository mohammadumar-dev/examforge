import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { invalidateExamCaches } from "@/lib/examCacheInvalidation";
import { updateAccessRuleSchema } from "@/lib/validators/accessSchemas";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const rule = await prisma.examAccessRule.findUnique({ where: { examFormId: examId } });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    return NextResponse.json({
      rule: rule ?? { accessType: "specific_emails" },
      examLink: `${appUrl}/exam/${exam.slug}`,
    });
  })(req, ctx);
}

export function PATCH(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    let body: z.infer<typeof updateAccessRuleSchema>;
    try {
      body = updateAccessRuleSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.accessType !== undefined) updateData.accessType = body.accessType;
    if ("registrationStartAt" in body) {
      updateData.registrationStartAt = body.registrationStartAt
        ? new Date(body.registrationStartAt)
        : null;
    }
    if ("registrationEndAt" in body) {
      updateData.registrationEndAt = body.registrationEndAt
        ? new Date(body.registrationEndAt)
        : null;
    }

    const rule = await prisma.examAccessRule.upsert({
      where: { examFormId: examId },
      update: updateData,
      create: {
        examFormId: examId,
        accessType: body.accessType ?? "specific_emails",
        ...(updateData.registrationStartAt !== undefined && {
          registrationStartAt: updateData.registrationStartAt as Date | null,
        }),
        ...(updateData.registrationEndAt !== undefined && {
          registrationEndAt: updateData.registrationEndAt as Date | null,
        }),
      },
    });

    await invalidateExamCaches(examId, exam.slug);
    return NextResponse.json({ rule });
  })(req, ctx);
}

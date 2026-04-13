import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { addEmailsSchema } from "@/lib/validators/accessSchemas";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export function GET(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId, adminId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const emails = await prisma.examAllowedEmail.findMany({
      where: { examFormId: examId },
      orderBy: { invitedAt: "desc" },
      select: { id: true, email: true, invitedAt: true, inviteSentAt: true },
    });

    return NextResponse.json({ emails, total: emails.length });
  })(req, ctx);
}

export function POST(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId, adminId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    let body: z.infer<typeof addEmailsSchema>;
    try {
      body = addEmailsSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    // Bulk upsert — skip duplicates
    await prisma.examAllowedEmail.createMany({
      data: body.emails.map((email) => ({ examFormId: examId, email })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      message: `${body.emails.length} email(s) added`,
      added: body.emails.length,
    });
  })(req, ctx);
}

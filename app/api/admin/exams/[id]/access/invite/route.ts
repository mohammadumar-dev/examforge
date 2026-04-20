import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

type RouteContext = { params: Promise<{ id: string }> };

export function POST(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({
      where: { id: examId, adminId },
      include: {
        allowedEmails: { where: { inviteSentAt: null } },
      },
    });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    if (!exam.isPublished) {
      return NextResponse.json({ error: "Publish the exam before sending invites" }, { status: 400 });
    }

    const now = new Date();
    let marked = 0;

    for (const allowed of exam.allowedEmails) {
      await prisma.examAllowedEmail.update({
        where: { id: allowed.id },
        data: { inviteSentAt: now },
      });
      marked++;
    }

    // Email is disabled — inviteSentAt is marked but no emails are sent.
    return NextResponse.json({ message: `Marked ${marked} invite(s) as sent`, sent: marked });
  })(req, ctx);
}

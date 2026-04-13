import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { queueEmail } from "@/lib/mailer";
import { examInviteEmail } from "@/lib/email-templates";

type RouteContext = { params: Promise<{ id: string }> };

export function POST(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({
      where: { id: examId, adminId },
      include: {
        // Only fetch emails that have never been invited
        allowedEmails: { where: { inviteSentAt: null } },
      },
    });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    if (!exam.isPublished) {
      return NextResponse.json({ error: "Publish the exam before sending invites" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const examLink = `${appUrl}/exam/${exam.slug}`;

    let sent = 0;
    const now = new Date();

    for (const allowed of exam.allowedEmails) {
      // Find or create a placeholder student record for logging
      const student = await prisma.student.upsert({
        where: { email: allowed.email },
        update: {},
        create: { email: allowed.email },
      });

      await queueEmail({
        to: allowed.email,
        subject: `You've been invited to take: ${exam.title}`,
        html: examInviteEmail(
          allowed.email,
          exam.title,
          examLink,
          exam.instructions ?? undefined
        ),
        recipientType: "student",
        recipientId: student.id,
        notificationType: "student_exam_invite",
        relatedExamId: examId,
      });

      await prisma.examAllowedEmail.update({
        where: { id: allowed.id },
        data: { inviteSentAt: now },
      });

      sent++;
    }

    return NextResponse.json({ message: `Invites sent to ${sent} student(s)`, sent });
  })(req, ctx);
}

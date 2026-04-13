import nodemailer from "nodemailer";
import { prisma } from "./prisma";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface QueueEmailOptions extends SendEmailOptions {
  recipientType: "admin" | "student";
  recipientId: string;
  notificationType: string;
  relatedExamId?: string;
}

/** Queue an email: logs to DB then attempts delivery immediately */
export async function queueEmail(opts: QueueEmailOptions): Promise<void> {
  const notification = await prisma.emailNotification.create({
    data: {
      recipientType: opts.recipientType,
      recipientId: opts.recipientId,
      recipientEmail: opts.to,
      notificationType: opts.notificationType,
      subject: opts.subject,
      bodyHtml: opts.html,
      status: "pending",
      relatedExamId: opts.relatedExamId,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    await prisma.emailNotification.update({
      where: { id: notification.id },
      data: { status: "sent", sentAt: new Date() },
    });
  } catch (err) {
    await prisma.emailNotification.update({
      where: { id: notification.id },
      data: {
        status: "failed",
        attempts: { increment: 1 },
        failedReason: err instanceof Error ? err.message : String(err),
      },
    });
    // Non-fatal: log but don't throw — email failure shouldn't break the request
    console.error("[mailer] Failed to send email to", opts.to, err);
  }
}

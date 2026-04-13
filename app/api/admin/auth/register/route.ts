import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { generateToken, hashToken } from "@/lib/auth";
import { queueEmail } from "@/lib/mailer";
import { verificationEmail } from "@/lib/email-templates";
import { registerAdminSchema } from "@/lib/validators/adminAuthSchemas";
import { z } from "zod";

export const POST = withAdminAuth(async (req, { adminId }) => {
  let body: z.infer<typeof registerAdminSchema>;
  try {
    body = registerAdminSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
  }

  const existing = await prisma.admin.findUnique({ where: { email: body.email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  // Create admin with a random temporary password — must reset via email verification
  const tempPassword = generateToken(16);
  const { hashSync } = await import("bcryptjs");
  const passwordHash = hashSync(tempPassword, 12);

  const newAdmin = await prisma.admin.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      role: "admin",
      isActive: false,
      isEmailVerified: false,
      createdByAdminId: adminId,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  // Create email verification token
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await prisma.emailVerificationToken.create({
    data: { adminId: newAdmin.id, tokenHash, expiresAt },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const verifyLink = `${appUrl}/admin/verify-email?token=${rawToken}`;

  await queueEmail({
    to: newAdmin.email,
    subject: "Verify your ExamForge account",
    html: verificationEmail(newAdmin.name, verifyLink),
    recipientType: "admin",
    recipientId: newAdmin.id,
    notificationType: "admin_email_verification",
  });

  return NextResponse.json({ admin: newAdmin }, { status: 201 });
});

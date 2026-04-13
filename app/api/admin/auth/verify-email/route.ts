import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken, generateToken } from "@/lib/auth";
import { verifyEmailSchema } from "@/lib/validators/adminAuthSchemas";

export async function POST(req: NextRequest) {
  let body: { token: string };
  try {
    body = verifyEmailSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
  }

  const tokenHash = hashToken(body.token);

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { admin: { select: { id: true, name: true, email: true, isEmailVerified: true } } },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  if (record.usedAt) {
    return NextResponse.json({ error: "Token already used" }, { status: 400 });
  }

  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Token has expired" }, { status: 400 });
  }

  // Mark token as used and activate admin
  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.admin.update({
      where: { id: record.adminId },
      data: { isActive: true, isEmailVerified: true },
    }),
  ]);

  // Admin now needs to set their password — send a password reset link
  const rawToken = generateToken();
  const resetTokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await prisma.passwordResetToken.create({
    data: { adminId: record.adminId, tokenHash: resetTokenHash, expiresAt },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetLink = `${appUrl}/admin/reset-password?token=${rawToken}`;

  return NextResponse.json({
    message: "Email verified. Please set your password.",
    resetLink,
  });
}

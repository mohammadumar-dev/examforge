import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validators/adminAuthSchemas";
import bcrypt from "bcryptjs";
import { getClientIp } from "@/lib/rateLimit";
import { z } from "zod";

export async function POST(req: NextRequest) {
  let body: z.infer<typeof resetPasswordSchema>;
  try {
    body = resetPasswordSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
  }

  const tokenHash = hashToken(body.token);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { admin: { select: { id: true, name: true, email: true } } },
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

  const passwordHash = await bcrypt.hash(body.password, 12);
  const ip = getClientIp(req);

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.admin.update({
      where: { id: record.adminId },
      data: { passwordHash, isActive: true },
    }),
    prisma.passwordResetHistory.create({
      data: {
        adminId: record.adminId,
        resetIp: ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    }),
    // Revoke all refresh tokens for this admin on password change
    prisma.refreshToken.updateMany({
      where: { adminId: record.adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ message: "Password reset successfully. You can now log in." });
}

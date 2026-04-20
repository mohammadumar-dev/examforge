import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { generateToken, hashToken } from "@/lib/auth";
import { registerAdminSchema } from "@/lib/validators/adminAuthSchemas";
import { z } from "zod";

export const POST = withAdminAuth(async (req: NextRequest, { adminId }: { adminId: string }) => {
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

  const tempPassword = generateToken(16);
  const { hashSync } = await import("bcryptjs");
  const passwordHash = hashSync(tempPassword, 12);

  const newAdmin = await prisma.admin.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      role: "admin",
      isActive: true,
      isEmailVerified: true,
      createdByAdminId: adminId,
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  // Create a password reset token so the new admin can set their own password
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await prisma.passwordResetToken.create({
    data: { adminId: newAdmin.id, tokenHash, expiresAt },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const setupLink = `${appUrl}/admin/reset-password?token=${rawToken}`;

  // Email is disabled — return the setup link directly for the caller to share
  return NextResponse.json({ admin: newAdmin, setupLink }, { status: 201 });
});

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/auth";
import { forgotPasswordSchema } from "@/lib/validators/adminAuthSchemas";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { success } = await rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body: { email: string };
  try {
    body = forgotPasswordSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({ where: { email: body.email } });
  if (!admin || !admin.isActive) {
    return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await prisma.passwordResetToken.create({
    data: {
      adminId: admin.id,
      tokenHash,
      expiresAt,
      requestedIp: ip,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetLink = `${appUrl}/admin/reset-password?token=${rawToken}`;

  // Email is disabled — return the reset link directly in the response
  return NextResponse.json({ message: "Reset link generated.", resetLink });
}

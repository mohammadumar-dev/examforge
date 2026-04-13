import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken, hashToken, generateToken } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { loginSchema } from "@/lib/validators/adminAuthSchemas";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(req: NextRequest) {
  // Rate limit: 10 attempts per 15 minutes per IP
  const ip = getClientIp(req);
  const { success } = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!success) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  let body: z.infer<typeof loginSchema>;
  try {
    body = loginSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({ where: { email: body.email } });

  if (!admin || !admin.isActive || !admin.isEmailVerified) {
    return NextResponse.json(
      { error: "Invalid credentials or account not active" },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(body.password, admin.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Issue tokens
  const accessToken = signAccessToken(admin.id);
  const rawRefresh = generateToken();
  const refreshHash = hashToken(rawRefresh);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        adminId: admin.id,
        tokenHash: refreshHash,
        expiresAt,
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    }),
    prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    }),
  ]);

  await writeAuditLog({ actorType: "admin", actorId: admin.id, action: "admin.login", ipAddress: ip });

  const response = NextResponse.json({
    accessToken,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  });

  response.cookies.set("refresh_token", rawRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_MS / 1000,
  });

  return response;
}

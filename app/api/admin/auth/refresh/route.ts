import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signAccessToken, hashToken, generateToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { getClientIp } from "@/lib/rateLimit";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const rawRefresh = cookieStore.get("refresh_token")?.value;

  if (!rawRefresh) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  // Validate against DB — the hash lookup IS the verification
  const tokenHash = hashToken(rawRefresh);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    const response = NextResponse.json({ error: "Refresh token expired or revoked" }, { status: 401 });
    response.cookies.delete("refresh_token");
    return response;
  }

  // Rotate: revoke old, issue new
  const newRawRefresh = generateToken();
  const newRefreshHash = hashToken(newRawRefresh);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const ip = getClientIp(req);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        adminId: stored.adminId,
        tokenHash: newRefreshHash,
        expiresAt,
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    }),
  ]);

  const accessToken = signAccessToken(stored.adminId);

  const response = NextResponse.json({ accessToken });
  response.cookies.set("refresh_token", newRawRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_MS / 1000,
  });

  return response;
}

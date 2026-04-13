import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const rawRefresh = cookieStore.get("refresh_token")?.value;

  if (rawRefresh) {
    const tokenHash = hashToken(rawRefresh);
    await prisma.refreshToken
      .update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      })
      .catch(() => {
        // Token not found — already revoked or invalid, that's fine
      });
  }

  const response = NextResponse.json({ message: "Logged out" });
  response.cookies.delete("refresh_token");
  return response;
}

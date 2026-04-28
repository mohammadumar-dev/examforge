import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import crypto from "crypto";

export const GET = withAdminAuth(async (_req, { adminId }) => {
  const tokens = await prisma.enrollmentShareToken.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, expiresAt: true, revokedAt: true, createdAt: true },
  });
  return NextResponse.json({ tokens });
});

export const POST = withAdminAuth(async (req: NextRequest, { adminId }) => {
  const body = await req.json().catch(() => ({}));
  const label =
    typeof body.label === "string" ? body.label.trim() || null : null;

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

  const record = await prisma.enrollmentShareToken.create({
    data: { token, label, adminId, expiresAt },
    select: { id: true, token: true, label: true, expiresAt: true, createdAt: true },
  });

  return NextResponse.json({ token: record }, { status: 201 });
});

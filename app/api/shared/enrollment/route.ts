import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const record = await prisma.enrollmentShareToken.findUnique({
    where: { token },
    select: { id: true, label: true, expiresAt: true, revokedAt: true },
  });

  if (!record || record.revokedAt !== null || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const sessions = await prisma.examSession.findMany({
    orderBy: { startedAt: "desc" },
    take: 200,
    include: {
      student: {
        select: {
          id: true,
          email: true,
          name: true,
          mobileNumber: true,
          whatsappNumber: true,
        },
      },
      examForm: { select: { id: true, title: true, slug: true } },
    },
  });

  return NextResponse.json({
    sessions,
    expiresAt: record.expiresAt,
    label: record.label,
  });
}

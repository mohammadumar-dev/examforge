import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { updateProfileSchema } from "@/lib/validators/adminAuthSchemas";
import { z } from "zod";

export const GET = withAdminAuth(async (req, { adminId }) => {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      isEmailVerified: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!admin) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  return NextResponse.json({ admin });
});

export const PATCH = withAdminAuth(async (req, { adminId }) => {
  let body: z.infer<typeof updateProfileSchema>;
  try {
    body = updateProfileSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
  }

  if (body.email) {
    const existing = await prisma.admin.findFirst({
      where: { email: body.email, id: { not: adminId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const admin = await prisma.admin.update({
    where: { id: adminId },
    data: body,
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ admin });
});

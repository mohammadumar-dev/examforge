import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

type RouteContext = { params: Promise<{ id: string }> };

export function DELETE(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (_req, { adminId, params }) => {
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const updated = await prisma.enrollmentShareToken.updateMany({
      where: { id, adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  })(req, ctx);
}

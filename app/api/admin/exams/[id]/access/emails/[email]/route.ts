import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

type RouteContext = { params: Promise<{ id: string; email: string }> };

export function DELETE(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const examId = params?.id;
    const email = params?.email ? decodeURIComponent(params.email).toLowerCase() : null;
    if (!examId || !email) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId, adminId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    const deleted = await prisma.examAllowedEmail.deleteMany({
      where: { examFormId: examId, email },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Email not found in list" }, { status: 404 });
    }

    return NextResponse.json({ message: "Email removed" });
  })(req, ctx);
}

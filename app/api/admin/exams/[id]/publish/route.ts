import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";

type RouteContext = { params: Promise<{ id: string }> };

export function PATCH(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { adminId, params }) => {
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    if (exam.status === "archived") {
      return NextResponse.json({ error: "Cannot publish an archived exam" }, { status: 400 });
    }

    // Ensure exam has at least 1 question before publishing
    if (!exam.isPublished) {
      const questionCount = await prisma.examQuestion.count({ where: { examFormId: id } });
      if (questionCount === 0) {
        return NextResponse.json(
          { error: "Cannot publish exam with no questions" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.examForm.update({
      where: { id },
      data: {
        isPublished: !exam.isPublished,
        status: !exam.isPublished ? "published" : "draft",
      },
      select: { id: true, isPublished: true, status: true, slug: true },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.json({
      exam: updated,
      examLink: updated.isPublished ? `${appUrl}/exam/${updated.slug}` : null,
    });
  })(req, ctx);
}

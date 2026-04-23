import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { invalidateExamCaches } from "@/lib/examCacheInvalidation";
import { reorderSectionsSchema } from "@/lib/validators/examSchemas";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

export function PATCH(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { params }) => {
    const examId = params?.id;
    if (!examId) return NextResponse.json({ error: "Missing exam id" }, { status: 400 });

    const exam = await prisma.examForm.findFirst({ where: { id: examId } });
    if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    let body: z.infer<typeof reorderSectionsSchema>;
    try {
      body = reorderSectionsSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    const existing = await prisma.examSection.findMany({
      where: { examFormId: examId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((s: { id: string }) => s.id));
    if (
      body.sectionIds.length !== existing.length ||
      !body.sectionIds.every((id) => existingIds.has(id))
    ) {
      return NextResponse.json({ error: "Invalid section IDs" }, { status: 400 });
    }

    await prisma.$transaction(
      body.sectionIds.map((id, index) =>
        prisma.examSection.update({ where: { id }, data: { orderIndex: index } })
      )
    );

    await invalidateExamCaches(examId);
    return NextResponse.json({ message: "Sections reordered" });
  })(req, ctx);
}

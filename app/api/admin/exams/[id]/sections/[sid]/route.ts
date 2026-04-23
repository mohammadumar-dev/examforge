import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdminAuth } from "@/lib/withAdminAuth";
import { invalidateExamCaches } from "@/lib/examCacheInvalidation";
import { updateSectionSchema } from "@/lib/validators/examSchemas";

type RouteContext = { params: Promise<{ id: string; sid: string }> };

export function PATCH(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { params }) => {
    const examId = params?.id;
    const sid = params?.sid;
    if (!examId || !sid) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const section = await prisma.examSection.findFirst({ where: { id: sid, examFormId: examId } });
    if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

    let body;
    try {
      body = updateSectionSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    const updated = await prisma.examSection.update({ where: { id: sid }, data: body });
    await invalidateExamCaches(examId);
    return NextResponse.json({ section: updated });
  })(req, ctx);
}

export function DELETE(req: NextRequest, ctx: RouteContext) {
  return withAdminAuth(async (req, { params }) => {
    const examId = params?.id;
    const sid = params?.sid;
    if (!examId || !sid) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const section = await prisma.examSection.findFirst({ where: { id: sid, examFormId: examId } });
    if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

    // Questions in this section get sectionId = null via OnDelete: SetNull
    await prisma.examSection.delete({ where: { id: sid } });
    await invalidateExamCaches(examId);
    return NextResponse.json({ message: "Section deleted" });
  })(req, ctx);
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withExamSession } from "@/lib/withExamSession";
import { heartbeatSchema } from "@/lib/validators/examTakingSchemas";
import { z } from "zod";

type RouteContext = { params: Promise<{ slug: string }> };

export function POST(req: NextRequest, ctx: RouteContext) {
  return withExamSession(async (req, { session }) => {
    let body: z.infer<typeof heartbeatSchema>;
    try {
      body = heartbeatSchema.parse(await req.json());
    } catch (err) {
      return NextResponse.json({ error: "Invalid input", details: err }, { status: 400 });
    }

    const exam = await prisma.examForm.findUnique({
      where: { id: session.examFormId },
      select: { timeLimitMinutes: true },
    });

    // Check for time expiry — auto-submit if needed
    if (exam?.timeLimitMinutes) {
      const elapsed = (Date.now() - session.startedAt.getTime()) / 1000 / 60;
      if (elapsed >= exam.timeLimitMinutes) {
        // Import scoreAndSubmit logic inline to avoid circular dep
        await prisma.examSession.update({
          where: { id: session.id },
          data: {
            status: "auto_submitted",
            submittedAt: new Date(),
            timeTakenSeconds: exam.timeLimitMinutes * 60,
          },
        });
        return NextResponse.json({ expired: true, autoSubmitted: true });
      }
    }

    // Update security counters
    const updateData: Record<string, unknown> = {};
    if (body.event === "tab_switch") {
      updateData.tabSwitchCount = { increment: 1 };
    } else if (body.event === "fullscreen_exit") {
      updateData.fullscreenExitCount = { increment: 1 };
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.examSession.update({
        where: { id: session.id },
        data: updateData,
      });
    }

    const remainingSeconds = exam?.timeLimitMinutes
      ? Math.max(0, exam.timeLimitMinutes * 60 - (Date.now() - session.startedAt.getTime()) / 1000)
      : null;

    return NextResponse.json({
      ok: true,
      tabSwitchCount: body.event === "tab_switch" ? session.tabSwitchCount + 1 : session.tabSwitchCount,
      fullscreenExitCount:
        body.event === "fullscreen_exit"
          ? session.fullscreenExitCount + 1
          : session.fullscreenExitCount,
      remainingSeconds,
    });
  })(req, ctx);
}

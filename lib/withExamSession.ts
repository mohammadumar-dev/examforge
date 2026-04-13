import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";

export type SessionHandler = (
  req: NextRequest,
  context: {
    session: {
      id: string;
      examFormId: string;
      studentId: string;
      startedAt: Date;
      tabSwitchCount: number;
      fullscreenExitCount: number;
    };
    params?: Record<string, string>;
  }
) => Promise<NextResponse> | NextResponse;

export function withExamSession(handler: SessionHandler) {
  return async (
    req: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const sessionToken = req.headers.get("x-session-token");

    if (!sessionToken) {
      return NextResponse.json({ error: "Session token required" }, { status: 401 });
    }

    const session = await prisma.examSession.findUnique({
      where: { sessionToken },
      select: {
        id: true,
        examFormId: true,
        studentId: true,
        startedAt: true,
        status: true,
        tabSwitchCount: true,
        fullscreenExitCount: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
    }

    if (session.status !== "in_progress") {
      return NextResponse.json(
        { error: "Session is no longer active", status: session.status },
        { status: 403 }
      );
    }

    const resolvedParams = context?.params ? await context.params : undefined;
    return await handler(req, { session, params: resolvedParams });
  };
}

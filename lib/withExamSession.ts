import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./prisma";
import { cacheWrap, cacheDel } from "./redis";
import { CacheKeys } from "./cacheKeys";

export type SessionData = {
  id: string;
  examFormId: string;
  studentId: string;
  startedAt: Date;
  tabSwitchCount: number;
  fullscreenExitCount: number;
  status: string;
};

export type SessionHandler = (
  req: NextRequest,
  context: {
    session: SessionData;
    params?: Record<string, string>;
  }
) => Promise<NextResponse> | NextResponse;

async function loadSession(sessionToken: string): Promise<SessionData | null> {
  const raw = await cacheWrap(CacheKeys.session(sessionToken), 10, () =>
    prisma.examSession.findUnique({
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
    })
  );
  if (!raw) return null;
  // Deserialize Date (JSON.parse gives string)
  return { ...raw, startedAt: new Date(raw.startedAt) };
}

export async function invalidateSessionCache(sessionToken: string): Promise<void> {
  await cacheDel(CacheKeys.session(sessionToken));
}

export function withExamSession(handler: SessionHandler) {
  return async (
    req: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const sessionToken = req.headers.get("x-session-token");

    if (!sessionToken) {
      return NextResponse.json({ error: "Session token required" }, { status: 401 });
    }

    const session = await loadSession(sessionToken);

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

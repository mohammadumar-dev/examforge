import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "./auth";

export type AuthenticatedHandler = (
  req: NextRequest,
  context: { adminId: string; params?: Record<string, string> }
) => Promise<NextResponse> | NextResponse;

export function withAdminAuth(handler: AuthenticatedHandler) {
  return async (
    req: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const resolvedParams = context?.params ? await context.params : undefined;
    return await handler(req, { adminId: payload.adminId, params: resolvedParams });
  };
}

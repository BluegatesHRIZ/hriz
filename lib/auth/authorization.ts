import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { hasAnyPermission, parsePermissionMask } from "@/lib/auth/permissions";
import { getRouteRequiredMask } from "@/lib/services/authorization.service";

export type AuthorizationResult =
  | { ok: true; payload: Awaited<ReturnType<typeof verifyToken>> }
  | { ok: false; response: NextResponse };

export async function authorizeApiRequest(
  request: NextRequest,
  routeKey: string,
): Promise<AuthorizationResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(authHeader.substring(7));
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ message: "Invalid token" }, { status: 401 }),
    };
  }

  const requiredMask = await getRouteRequiredMask(routeKey);
  const userMask = parsePermissionMask(payload.permissions);
  if (!hasAnyPermission(userMask, requiredMask)) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, payload };
}


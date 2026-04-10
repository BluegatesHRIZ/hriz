import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { getApiRouteKey, getPageRouteKey } from "@/lib/auth/routePermissions";
import { PERMISSIONS, hasAnyPermission, parsePermissionMask } from "@/lib/auth/permissions";
const BIGINT_ZERO = BigInt(0);

const COARSE_ROUTE_PERMISSIONS: Record<string, bigint> = {
  requestLeave: PERMISSIONS.AccessLeave | PERMISSIONS.AllAccess,
  requestAttendanceChange: PERMISSIONS.AccessAttendanceChange | PERMISSIONS.AllAccess,
  requestOvertime: PERMISSIONS.AccessOvertime | PERMISSIONS.AllAccess,
  requestUndertime: PERMISSIONS.AccessUndertime | PERMISSIONS.AllAccess,
  requestScheduleChange: PERMISSIONS.AccessScheduleAdjustment | PERMISSIONS.AllAccess,
  requestLoan: PERMISSIONS.AccessLoan | PERMISSIONS.AllAccess,
  apiLeave: PERMISSIONS.AccessLeave | PERMISSIONS.AllAccess,
  apiAttendanceChange: PERMISSIONS.AccessAttendanceChange | PERMISSIONS.AllAccess,
  apiOvertime: PERMISSIONS.AccessOvertime | PERMISSIONS.AllAccess,
  apiUndertime: PERMISSIONS.AccessUndertime | PERMISSIONS.AllAccess,
  apiScheduleChange: PERMISSIONS.AccessScheduleAdjustment | PERMISSIONS.AllAccess,
  apiLoan: PERMISSIONS.AccessLoan | PERMISSIONS.AllAccess,
};

/**
 * Middleware for route protection
 * Uses edge-compatible JWT verification for Cloudflare
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/unauthorized",
    "/api/auth/login",
    "/api/auth/login-qr",
  ];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Get token from Authorization header (for API routes) or cookie (for page routes)
  const authHeader = request.headers.get("authorization");
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;
  const tokenFromCookie = request.cookies.get("auth_token")?.value || null;
  const token = tokenFromHeader || tokenFromCookie;

  if (!token) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    // For pages, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify token
  try {
    const payload = await verifyToken(token);
    const routeKey = pathname.startsWith("/api/")
      ? getApiRouteKey(pathname)
      : getPageRouteKey(pathname);
    if (routeKey) {
      const requiredMask = COARSE_ROUTE_PERMISSIONS[routeKey] ?? BIGINT_ZERO;
      const userMask = parsePermissionMask(payload.permissions);
      if (!hasAnyPermission(userMask, requiredMask)) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
    }
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

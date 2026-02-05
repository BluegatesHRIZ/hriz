import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt"

/**
 * Proxy for route protection
 * Replaces deprecated middleware.ts convention in Next.js 16+
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/api/auth/login"]
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Get token from Authorization header (for API routes) or cookie (for page routes)
  const authHeader = request.headers.get("authorization")
  const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null
  const tokenFromCookie = request.cookies.get("auth_token")?.value || null
  const token = tokenFromHeader || tokenFromCookie

  if (!token) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }
    // For pages, redirect to login
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify token
  try {
    verifyToken(token)
    return NextResponse.next()
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 })
    }
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
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
}

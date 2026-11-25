import { NextResponse } from "next/server"
import { clearSessionCookies } from "@/lib/auth/session-cookies"

/**
 * POST /api/auth/logout
 * Logout user and clear cookies. The device key stays, so the device remains registered.
 */
export async function POST() {
  const response = NextResponse.json({ success: true })
  clearSessionCookies(response)
  return response
}

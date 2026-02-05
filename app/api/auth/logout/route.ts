import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/auth/logout
 * Logout user and clear cookies
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  
  // Clear auth cookies
  response.cookies.delete("auth_token")
  response.cookies.delete("auth_refresh_token")
  
  return response
}

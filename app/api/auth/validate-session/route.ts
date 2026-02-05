import { NextRequest, NextResponse } from "next/server"
import { verifyToken } from "@/lib/auth/jwt"
import { prisma } from "@/lib/db/prisma"

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { valid: false, message: "No token provided" },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    // Verify token
    let payload
    try {
      payload = verifyToken(token)
    } catch {
      return NextResponse.json(
        { valid: false, message: "Invalid token" },
        { status: 401 }
      )
    }

    const username = payload.name

    // Get refresh token from cookie
    const refreshToken = request.cookies.get("auth_refresh_token")?.value

    if (!refreshToken) {
      return NextResponse.json(
        { valid: false, message: "No refresh token" },
        { status: 401 }
      )
    }

    // Check if token exists in database and is valid
    const empToken = await prisma.emptoken.findUnique({
      where: {
        tkn_emp: username,
      },
    })

    if (!empToken) {
      return NextResponse.json(
        { valid: false, message: "Token not found" },
        { status: 401 }
      )
    }

    // Check if token is expired
    if (empToken.tkn_dateexpires && empToken.tkn_dateexpires < new Date()) {
      return NextResponse.json(
        { valid: false, message: "Token expired" },
        { status: 401 }
      )
    }

    // Check if refresh token matches
    if (empToken.tkn_refresh !== refreshToken) {
      return NextResponse.json(
        { valid: false, message: "Invalid refresh token" },
        { status: 401 }
      )
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error("Session validation error:", error)
    return NextResponse.json(
      { valid: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}

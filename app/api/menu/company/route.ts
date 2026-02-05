import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { verifyToken } from "@/lib/auth/jwt"

/**
 * GET /api/menu/company
 * Get company information
 * Ported from MenuController.GetCompany
 */
export async function GET(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    try {
      verifyToken(authHeader.substring(7))
    } catch {
      return NextResponse.json(
        { message: "Invalid token" },
        { status: 401 }
      )
    }

    const company = await prisma.company.findFirst()

    if (!company) {
      return NextResponse.json(
        { message: "Company not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error("Get company error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

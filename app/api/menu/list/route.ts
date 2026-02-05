import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { verifyToken } from "@/lib/auth/jwt-edge"

/**
 * GET /api/menu/list
 * Get menu list
 * Ported from MenuController.GetMenuList
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
      await verifyToken(authHeader.substring(7))
    } catch {
      return NextResponse.json(
        { message: "Invalid token" },
        { status: 401 }
      )
    }

    const menus = await prisma.menu.findMany({
      where: {
        mnu_status: 1,
      },
      orderBy: {
        mnu_id: "asc",
      },
      select: {
        mnu_id: true,
        mnu_desc: true,
        mnu_status: true,
        mnu_http: true,
        mnu_ctr: true,
      },
    })

    return NextResponse.json(menus)
  } catch (error) {
    console.error("Get menu list error:", error)
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

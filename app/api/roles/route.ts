import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/roles
 * Get list of all roles (excluding SUPERADMIN)
 * Ported from RolesAndPermissionController.GetRole
 */
export async function GET(request: NextRequest) {
  try {
    // Check authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const roles = await prisma.accrole.findMany({
      where: {
        rol_id: { not: "SUPERADMIN" },
      },
      select: {
        rol_id: true,
        rol_name: true,
        rol_desc: true,
      },
      orderBy: {
        rol_name: "asc",
      },
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error("Get roles error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

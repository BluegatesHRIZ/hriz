import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { getAuthorizationConfig } from "@/lib/services/authorization.service";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const config = await getAuthorizationConfig();
    return NextResponse.json({
      routePermissions: Object.fromEntries(
        Object.entries(config.routePermissions).map(([key, value]) => [key, value.toString()]),
      ),
      menuPermissions: Object.fromEntries(
        Object.entries(config.menuPermissions).map(([key, value]) => [key, value.toString()]),
      ),
    });
  } catch (error) {
    console.error("Permissions map error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}


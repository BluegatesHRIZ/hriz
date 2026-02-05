import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { serializeForJson } from "@/lib/utils";

/**
 * GET /api/biolog
 * Get user biolog/attendance data
 * Ported from AttendanceController.GetUserAttendance
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded = await verifyToken(authHeader.substring(7));
    const empId = decoded.name;

    if (!empId) {
      return NextResponse.json(
        { message: "Employee ID not found" },
        { status: 400 }
      );
    }

    const { getAttendance } = await import("@/lib/services/attendance.service");
    const result = await getAttendance(empId);

    return NextResponse.json(serializeForJson(result));
  } catch (error) {
    console.error("Get biolog error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

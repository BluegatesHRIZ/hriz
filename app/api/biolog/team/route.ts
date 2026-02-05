import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { getTeamAttendance } from "@/lib/services/attendance.service";
import { serializeForJson } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded = verifyToken(authHeader.substring(7));
    const empId = decoded.name;

    if (!empId) {
      return NextResponse.json(
        { message: "Employee ID not found" },
        { status: 400 }
      );
    }

    const rows = await getTeamAttendance(empId);
    return NextResponse.json(serializeForJson(rows));
  } catch (error) {
    console.error("Error fetching team attendance:", error);
    return NextResponse.json(
      { error: "Failed to fetch team attendance" },
      { status: 500 }
    );
  }
}

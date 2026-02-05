import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { insertUserAttendance } from "@/lib/services/attendance.service";
import { getCurrentTimeString } from "@/lib/utils/time";

/**
 * POST /api/attendance/clock
 * Clock in/out or break in/out
 * Ported from AttendanceController.InsertUserAttendance
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { attendanceType, forYesterday } = body;

    // Validate attendance type
    const validTypes = ["I", "O", "BI", "BO"]; // In, Out, Break In, Break Out
    if (!validTypes.includes(attendanceType)) {
      return NextResponse.json(
        {
          message: `Invalid attendance type. Must be one of: ${validTypes.join(
            ", "
          )}`,
        },
        { status: 400 }
      );
    }

    // Generate bio_id: yyyyMMdd + empId
    const now = new Date();
    const bioId = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}${String(now.getDate()).padStart(2, "0")}${empId}`;
    const bioDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(now.getDate()).padStart(2, "0")}`;
    // Use utility function for consistent time formatting
    // Note: For attendance clocking, we use LOCAL time (actual clock time)
    const bioTime = getCurrentTimeString();

    // Get IP address and location from request
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "";

    // Insert attendance record
    await insertUserAttendance({
      bioId,
      bioEmp: empId,
      bioDate,
      bioType: attendanceType,
      bioTime,
      forYesterday: forYesterday || false,
      ipAddress,
      location: "",
      local: "",
    });

    const messages: Record<string, string> = {
      I: "Successfully Clocked IN",
      O: "Successfully Clocked OUT",
      BI: "Successfully Break IN",
      BO: "Successfully Break OUT",
    };

    return NextResponse.json({
      success: true,
      message: messages[attendanceType] || "Attendance recorded",
    });
  } catch (error) {
    console.error("Clock attendance error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

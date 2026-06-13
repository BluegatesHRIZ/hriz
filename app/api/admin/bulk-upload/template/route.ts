import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { generateEmployeeTemplate, generateScheduleTemplate } from "@/lib/services/bulkUpload.service";

/**
 * GET /api/admin/bulk-upload/template?type=employees|schedules
 * Download an Excel template file.
 */
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

    const type = request.nextUrl.searchParams.get("type") ?? "employees";
    const buffer = type === "schedules"
      ? await generateScheduleTemplate()
      : await generateEmployeeTemplate();

    const filename = type === "schedules" ? "schedule_template.xlsx" : "employee_template.xlsx";

    return new Response(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Template download error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

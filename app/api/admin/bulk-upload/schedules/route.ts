import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { parseScheduleExcel, bulkAssignSchedules } from "@/lib/services/bulkUpload.service";

/**
 * POST /api/admin/bulk-upload/schedules
 * Accepts a multipart .xlsx file, validates employee schedule assignments.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeApiRequest(request, "apiAdminBulkUpload");
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ message: "No file provided." }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json({ message: "Only .xlsx files are accepted." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = await parseScheduleExcel(buffer);

    if (rows.length === 0) {
      return NextResponse.json({ message: "No data rows found in file." }, { status: 400 });
    }

    const results = await bulkAssignSchedules(rows);
    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return NextResponse.json({ results, successCount, errorCount });
  } catch (error) {
    console.error("Bulk upload schedules error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

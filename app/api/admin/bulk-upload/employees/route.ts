import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { parseEmployeeExcel, bulkCreateEmployees } from "@/lib/services/bulkUpload.service";

export const config = { api: { bodyParser: false } };

/**
 * POST /api/admin/bulk-upload/employees
 * Accepts a multipart .xlsx file, parses employee rows, creates records.
 * Returns per-row results: { row, status, error?, empId? }[]
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

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith(".xlsx")) {
      return NextResponse.json({ message: "Only .xlsx files are accepted." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rows = await parseEmployeeExcel(buffer);
    if (rows.length === 0) {
      return NextResponse.json({ message: "No data rows found in file." }, { status: 400 });
    }

    const results = await bulkCreateEmployees(rows, auth.payload.name ?? "");

    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return NextResponse.json({ results, successCount, errorCount });
  } catch (error) {
    console.error("Bulk upload employees error:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

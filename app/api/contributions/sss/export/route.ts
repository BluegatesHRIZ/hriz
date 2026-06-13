import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { buildSssContributionXlsx } from "@/lib/services/contributions.excel";
import type { SssContributionRow } from "@/lib/services/contributions.service";

interface ExportBody {
  rows: SssContributionRow[];
  filename?: string;
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiContributionSss");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as ExportBody;
    if (!Array.isArray(body.rows)) {
      return NextResponse.json({ message: "rows is required" }, { status: 400 });
    }
    const buffer = await buildSssContributionXlsx(body.rows);
    const filename = body.filename || "SSS Contributions.xlsx";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("SSS contribution export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message: "DBErr:" + message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { buildHdmfContributionXlsx } from "@/lib/services/contributions.excel";
import { listHdmfContribution } from "@/lib/services/contributions.service";

interface ExportBody {
  year?: string | number;
  emp?: string;
  filename?: string;
}

/** Independent export: re-fetches the FULL HDMF contributions for the year. */
export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiContributionHdmf");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as ExportBody;
    if (!body.year) {
      return NextResponse.json({ message: "year is required" }, { status: 400 });
    }
    const rows = await listHdmfContribution(Number(body.year), body.emp ?? "All");
    const buffer = await buildHdmfContributionXlsx(rows);
    const filename = body.filename || "HDMF Contributions.xlsx";
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("HDMF contribution export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message: "DBErr:" + message }, { status: 500 });
  }
}

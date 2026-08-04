import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";

/**
 * GET /api/payroll/types — `paytypes` for the Type combo in the Run Payroll
 * dialog (Regular, Final Pay, 13th Month, Reimbursement, Commission, ...).
 */
export async function GET(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiPayrollRun");
  if (!auth.ok) return auth.response;
  try {
    const types = await prisma.paytypes.findMany({
      select: { pyt_code: true, pyt_desc: true },
      orderBy: { pyt_code: "asc" },
    });
    return NextResponse.json(types);
  } catch (e) {
    console.error("GET /api/payroll/types", e);
    return NextResponse.json({ message: "Failed to load payroll types" }, { status: 500 });
  }
}

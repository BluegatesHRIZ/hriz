import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { unpostRun } from "@/lib/services/payroll/post";

/** POST /api/payroll/runs/[code]/unpost */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const auth = await authorizeApiRequest(request, "apiPayrollRunWrite");
  if (!auth.ok) return auth.response;

  const { code } = await context.params;
  try {
    await unpostRun(code);
    return NextResponse.json({ code, status: "draft" });
  } catch (e) {
    // Engine guards (already posted, no payslips, missing period) are user
    // errors, not server faults — surface the message rather than a bare 500.
    const message = e instanceof Error ? e.message : "Payroll unpost failed";
    console.error("POST /api/payroll/runs/[code]/unpost", e);
    return NextResponse.json({ message }, { status: 400 });
  }
}

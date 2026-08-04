import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { computeRun } from "@/lib/services/payroll/post";

/** POST /api/payroll/runs/[code]/compute */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const auth = await authorizeApiRequest(request, "apiPayrollRunWrite");
  if (!auth.ok) return auth.response;

  const { code } = await context.params;
  try {
    // The Run Payroll dialog posts the selected employee ids. Omitting them
    // reuses the run's previous selection (see `computeRun`).
    let employees: string[] | undefined;
    try {
      const body = await request.json();
      if (Array.isArray(body?.employees)) employees = body.employees.map(String);
    } catch {
      // No body is fine — treat it as "reuse the previous selection".
    }

    const result = await computeRun(code, { employees });
    return NextResponse.json({
      code: result.code,
      computed: result.slips.length,
      skipped: result.skipped });
  } catch (e) {
    // Engine guards (already posted, no payslips, missing period) are user
    // errors, not server faults — surface the message rather than a bare 500.
    const message = e instanceof Error ? e.message : "Payroll compute failed";
    console.error("POST /api/payroll/runs/[code]/compute", e);
    return NextResponse.json({ message }, { status: 400 });
  }
}

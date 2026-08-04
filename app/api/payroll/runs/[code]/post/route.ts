import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { postRun } from "@/lib/services/payroll/post";
import { verifyToken } from "@/lib/auth/jwt-edge";

/** POST /api/payroll/runs/[code]/post */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const auth = await authorizeApiRequest(request, "apiPayrollRunWrite");
  if (!auth.ok) return auth.response;

  const { code } = await context.params;
  try {
    const authHeader = request.headers.get("authorization")!;
    const payload = (await verifyToken(authHeader.substring(7))) as { name?: string };
    await postRun(code, payload.name ?? "system");
    return NextResponse.json({ code, status: "posted" });
  } catch (e) {
    // Engine guards (already posted, no payslips, missing period) are user
    // errors, not server faults — surface the message rather than a bare 500.
    const message = e instanceof Error ? e.message : "Payroll post failed";
    console.error("POST /api/payroll/runs/[code]/post", e);
    return NextResponse.json({ message }, { status: 400 });
  }
}

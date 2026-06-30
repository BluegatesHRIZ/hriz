import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";
import { parsePagination, paginate } from "@/lib/pagination";

export interface UserPayslipDTO {
  pyd_pk: string;
  pyd_code: string;
  pyh_desc: string | null;
  pyh_posteddate: string | null;
  pyd_salary: number;
  pyd_comp: number;
  pyd_tadjc: number;
  pyd_deduct: number;
  pyd_tadjd: number;
  pyd_tax: number;
  pyd_sss: number;
  pyd_phic: number;
  pyd_hdmf: number;
  pyd_tloan: number;
  otherEarnings: number;
  otherDeductions: number;
}

/**
 * GET /api/payroll/payslips
 * Returns all payslip records for the currently authenticated employee.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    let payload: { name?: string };
    try {
      payload = await verifyToken(authHeader.substring(7)) as { name?: string };
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const empId = payload.name;
    if (!empId) {
      return NextResponse.json({ message: "Invalid token payload" }, { status: 401 });
    }

    const { page, limit, skip, take } = parsePagination(request.nextUrl.searchParams);

    // Fetch a page of pay_details rows for this employee
    const where = { pyd_emp: empId };
    const [total, details] = await Promise.all([
      prisma.pay_details.count({ where }),
      prisma.pay_details.findMany({
        where,
        orderBy: { pyd_code: "desc" },
        skip,
        take,
      }),
    ]);

    if (details.length === 0) {
      return NextResponse.json(paginate<UserPayslipDTO>([], total, page, limit));
    }

    // Collect all unique payroll codes to batch-fetch headers and amounts
    const codes = [...new Set(details.map((d) => d.pyd_code))];

    const [headers, amounts] = await Promise.all([
      prisma.pay_header.findMany({ where: { pyh_code: { in: codes } } }),
      prisma.pay_amounts.findMany({ where: { pya_code: { in: codes } } }),
    ]);

    const headerMap = new Map(headers.map((h) => [h.pyh_code, h]));

    // Group pay_amounts by code for O(1) lookup
    const amountsMap = new Map<string, typeof amounts>();
    for (const a of amounts) {
      const list = amountsMap.get(a.pya_code) ?? [];
      list.push(a);
      amountsMap.set(a.pya_code, list);
    }

    const result: UserPayslipDTO[] = details.map((d) => {
      const header = headerMap.get(d.pyd_code ?? "");
      const codeAmounts = amountsMap.get(d.pyd_code ?? "") ?? [];

      const otherEarnings = codeAmounts
        .filter((a) => a.pya_cd === "C")
        .reduce((sum, a) => sum + (a.pya_amt ?? 0), 0);

      const otherDeductions = codeAmounts
        .filter((a) => a.pya_cd === "D")
        .reduce((sum, a) => sum + (a.pya_amt ?? 0), 0);

      return {
        pyd_pk: d.pyd_pk,
        pyd_code: d.pyd_code ?? "",
        pyh_desc: header?.pyh_desc ?? null,
        pyh_posteddate: header?.pyh_posteddate?.toISOString() ?? null,
        pyd_salary: d.pyd_salary ?? 0,
        pyd_comp: d.pyd_comp ?? 0,
        pyd_tadjc: d.pyd_tadjc ?? 0,
        pyd_deduct: d.pyd_deduct ?? 0,
        pyd_tadjd: d.pyd_tadjd ?? 0,
        pyd_tax: d.pyd_tax ?? 0,
        pyd_sss: d.pyd_sss ?? 0,
        pyd_phic: d.pyd_phic ?? 0,
        pyd_hdmf: d.pyd_hdmf ?? 0,
        pyd_tloan: d.pyd_tloan ?? 0,
        otherEarnings,
        otherDeductions,
      };
    });

    return NextResponse.json(paginate(result, total, page, limit));
  } catch (error) {
    console.error("Payslips GET error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

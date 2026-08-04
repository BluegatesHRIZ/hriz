import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { generateRunCode, RUN_UNPOSTED, RUN_SAVED } from "@/lib/services/payroll/post";

/**
 * GET  /api/payroll/runs  — list payroll runs, newest first.
 * POST /api/payroll/runs  — create a run header (a draft; no payslips yet).
 */

export interface PayrollRunDTO {
  code: string;
  createdBy: string | null;
  description: string | null;
  month: number | null;
  year: number | null;
  period: number | null;
  from: string | null;
  to: string | null;
  status: string | null;
  postedBy: string | null;
  postedDate: string | null;
  slipCount: number;
}

export async function GET(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiPayrollRun");
  if (!auth.ok) return auth.response;

  try {
    // The legacy page filters by payroll year.
    const yearParam = request.nextUrl.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : null;

    const headers = await prisma.pay_header.findMany({
      where: year && Number.isFinite(year) ? { pyh_year: year } : undefined,
      orderBy: [{ pyh_year: "desc" }, { pyh_month: "desc" }, { pyh_code: "desc" }],
      take: 200,
    });

    // One grouped count rather than a query per run.
    const counts = await prisma.pay_details.groupBy({
      by: ["pyd_code"],
      _count: { pyd_pk: true },
    });
    const countBy = new Map(counts.map((c) => [c.pyd_code, c._count.pyd_pk]));

    const runs: PayrollRunDTO[] = headers.map((h) => ({
      code: h.pyh_code,
      createdBy: h.pyh_user,
      description: h.pyh_desc,
      month: h.pyh_month,
      year: h.pyh_year,
      period: h.pyh_per,
      from: h.pyh_from ? h.pyh_from.toISOString().slice(0, 10) : null,
      to: h.pyh_to ? h.pyh_to.toISOString().slice(0, 10) : null,
      status: h.pyh_status,
      postedBy: h.pyh_postedby,
      postedDate: h.pyh_posteddate ? h.pyh_posteddate.toISOString() : null,
      slipCount: countBy.get(h.pyh_code) ?? 0,
    }));

    return NextResponse.json({ runs });
  } catch (e) {
    console.error("GET /api/payroll/runs", e);
    return NextResponse.json({ message: "Failed to load payroll runs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiPayrollRun");
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      month, year, period, from, to, description, type,
      // Legacy Run Payroll dialog fields. Contributions are Full/Half/None
      // ('2'/'1'/'0'); tax is With/Without ('2'/'0'); loan is a checkbox.
      loan = true, tax = "2", sss = "2", philhealth = "2", pagibig = "2",
      // "save" parks the header at status 5 without computing; anything else
      // creates it unposted, ready to generate.
      action = "generate",
    } = body ?? {};

    const flag = (v: unknown, allowHalf = true) => {
      const t = String(v ?? "2");
      if (t === "0") return "0";
      if (t === "1" && allowHalf) return "1";
      return "2";
    };

    if (!month || !year || !period || !from || !to) {
      return NextResponse.json(
        { message: "month, year, period, from and to are required" },
        { status: 400 },
      );
    }
    if (new Date(from) > new Date(to)) {
      return NextResponse.json({ message: "`from` must not be after `to`" }, { status: 400 });
    }

    const code = await generateRunCode(Number(month), Number(year), Number(period));

    await prisma.pay_header.create({
      data: {
        pyh_code: code,
        pyh_month: Number(month),
        pyh_year: Number(year),
        pyh_per: Number(period),
        pyh_from: new Date(from),
        pyh_to: new Date(to),
        pyh_type: type ?? "PY1",
        pyh_desc: description ?? `Payroll ${month}/${year} period ${period}`,
        pyh_status: action === "save" ? RUN_SAVED : RUN_UNPOSTED,
        pyh_loan: loan ? "1" : "0",
        pyh_govt: "2",
        pyh_tax: flag(tax, false),
        pyh_sss: flag(sss),
        pyh_phl: flag(philhealth),
        pyh_pag: flag(pagibig),
      },
    });

    return NextResponse.json({ code }, { status: 201 });
  } catch (e) {
    console.error("POST /api/payroll/runs", e);
    return NextResponse.json({ message: "Failed to create payroll run" }, { status: 500 });
  }
}

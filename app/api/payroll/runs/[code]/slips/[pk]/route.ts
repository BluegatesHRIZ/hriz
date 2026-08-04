import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { RUN_POSTED } from "@/lib/services/payroll/post";

/**
 * One payslip's detail — the drill-in behind a register row.
 *
 * GET  returns the computed lines, the loans collected, and the keyed-in
 *      adjustments, plus the `comded` components an adjustment can be posted
 *      against.
 * PUT  replaces the adjustments. Mirrors the legacy save exactly:
 *        DELETE FROM pay_amounts WHERE pya_code = ? AND pya_adj = 1
 *      then re-insert. Adjustments are `pay_amounts` rows flagged `pya_adj = 1`
 *      — the `pay_adjust` table is unused.
 *
 * A PUT does NOT recompute. Adjustments change gross and, when taxable, the
 * withholding base — so the caller should regenerate the run afterwards for the
 * totals and tax to catch up. The response says as much.
 */

/** Computed lines are regenerated; only these are user-editable. */
const ADJUSTMENT_FLAG = 1;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string; pk: string }> },
) {
  const auth = await authorizeApiRequest(request, "apiPayrollRun");
  if (!auth.ok) return auth.response;

  try {
    const { code, pk } = await context.params;

    const detail = await prisma.pay_details.findUnique({ where: { pyd_pk: pk } });
    if (!detail || detail.pyd_code !== code) {
      return NextResponse.json({ message: "Payslip not found" }, { status: 404 });
    }

    const [header, amounts, loans, components, employee] = await Promise.all([
      prisma.pay_header.findUnique({ where: { pyh_code: code } }),
      prisma.pay_amounts.findMany({
        where: { pya_code: pk },
        orderBy: { pya_ctr: "asc" },
      }),
      prisma.pay_loan.findMany({ where: { pyl_code: pk } }),
      // Only real payslip components are selectable; `cd_slip = '0'` rows are
      // the bracket-value audit snapshots.
      prisma.comded.findMany({
        where: { cd_slip: "1" },
        select: { cd_code: true, cd_desc: true, cd_type: true, cd_tax: true },
        orderBy: [{ cd_type: "desc" }, { cd_ord: "asc" }],
      }),
      detail.pyd_emp
        ? prisma.employee.findUnique({
            where: { emp_id: detail.pyd_emp },
            select: { emp_last: true, emp_first: true },
          })
        : Promise.resolve(null),
    ]);

    const descBy = new Map(components.map((c) => [c.cd_code, c.cd_desc]));
    const onSlip = new Set(components.map((c) => c.cd_code));

    const lines = amounts
      // Hide the audit snapshots — they hold MSCs, rates and caps, not money.
      .filter((a) => onSlip.has(a.pya_def))
      .map((a) => ({
        counter: a.pya_ctr,
        code: a.pya_def,
        label: descBy.get(a.pya_def) ?? a.pya_def,
        type: a.pya_cd === "D" ? "D" : "C",
        description: a.pya_desc ?? "",
        amount: a.pya_amt ?? 0,
        employerAmount: a.pya_eramt ?? 0,
        taxable: a.pya_tax === 1,
        isAdjustment: a.pya_adj === ADJUSTMENT_FLAG,
      }));

    return NextResponse.json({
      slip: {
        pk: detail.pyd_pk,
        code: detail.pyd_code,
        employee: detail.pyd_emp,
        name:
          [employee?.emp_last, employee?.emp_first].filter(Boolean).join(", ") ||
          detail.pyd_emp,
        salary: detail.pyd_salary ?? 0,
        tax: detail.pyd_tax ?? 0,
        sss: detail.pyd_sss ?? 0,
        phic: detail.pyd_phic ?? 0,
        hdmf: detail.pyd_hdmf ?? 0,
        loans: detail.pyd_tloan ?? 0,
        posted: header?.pyh_status === RUN_POSTED,
      },
      lines,
      loans: loans.map((l) => ({
        advanceId: l.pyl_lcode,
        amount: l.pyl_amt ?? 0,
        balance: l.pyl_bal ?? 0,
      })),
      components,
    });
  } catch (e) {
    console.error("GET payslip detail", e);
    return NextResponse.json({ message: "Failed to load payslip" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ code: string; pk: string }> },
) {
  const auth = await authorizeApiRequest(request, "apiPayrollRunWrite");
  if (!auth.ok) return auth.response;

  try {
    const { code, pk } = await context.params;

    const detail = await prisma.pay_details.findUnique({ where: { pyd_pk: pk } });
    if (!detail || detail.pyd_code !== code) {
      return NextResponse.json({ message: "Payslip not found" }, { status: 404 });
    }

    const header = await prisma.pay_header.findUnique({ where: { pyh_code: code } });
    if (header?.pyh_status === RUN_POSTED) {
      return NextResponse.json(
        { message: "This run is posted — unpost it before editing adjustments" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const incoming: Array<{
      code?: string;
      type?: string;
      description?: string;
      amount?: number;
      taxable?: boolean;
    }> = Array.isArray(body?.adjustments) ? body.adjustments : [];

    // Validate against `comded` so an adjustment cannot be posted to a code the
    // engine will not recognise, or to an audit-snapshot row.
    const valid = await prisma.comded.findMany({
      where: { cd_slip: "1" },
      select: { cd_code: true, cd_type: true },
    });
    const validCodes = new Map(valid.map((c) => [c.cd_code, c.cd_type]));

    const rows = incoming
      .filter((a) => Number(a.amount) !== 0)
      .map((a) => ({
        code: String(a.code ?? ""),
        type: (a.type ?? "C").toUpperCase() === "D" ? "D" : "C",
        description: String(a.description ?? "").slice(0, 100),
        amount: Math.abs(Number(a.amount) || 0),
        taxable: a.taxable ? 1 : 0,
      }));

    const unknown = rows.filter((r) => !validCodes.has(r.code)).map((r) => r.code);
    if (unknown.length) {
      return NextResponse.json(
        { message: `Unknown pay component(s): ${[...new Set(unknown)].join(", ")}` },
        { status: 400 },
      );
    }

    // Keep adjustment counters clear of the computed lines' range.
    const existing = await prisma.pay_amounts.findMany({
      where: { pya_code: pk },
      select: { pya_ctr: true },
      orderBy: { pya_ctr: "desc" },
      take: 1,
    });
    let ctr = (existing[0]?.pya_ctr ?? 0) + 1;

    await prisma.$transaction(async (tx) => {
      await tx.pay_amounts.deleteMany({
        where: { pya_code: pk, pya_adj: ADJUSTMENT_FLAG },
      });
      for (const r of rows) {
        await tx.pay_amounts.create({
          data: {
            pya_code: pk,
            pya_ctr: ctr++,
            pya_def: r.code,
            pya_desc: r.description,
            pya_cd: r.type,
            pya_amt: r.amount,
            pya_eramt: 0,
            pya_tax: r.taxable,
            pya_adj: ADJUSTMENT_FLAG,
          },
        });
      }
    });

    return NextResponse.json({
      pk,
      saved: rows.length,
      // Totals and tax only move once the run is recomputed.
      needsRegenerate: true,
    });
  } catch (e) {
    console.error("PUT payslip adjustments", e);
    return NextResponse.json(
      { message: "Failed to save adjustments" },
      { status: 500 },
    );
  }
}

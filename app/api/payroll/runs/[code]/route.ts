import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { RUN_POSTED } from "@/lib/services/payroll/post";

/**
 * GET /api/payroll/runs/[code] — a run header plus its computed payslips.
 *
 * This is the preview shown before posting. Employee names are joined in so the
 * register is readable without a second round trip.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const auth = await authorizeApiRequest(request, "apiPayrollRun");
  if (!auth.ok) return auth.response;

  try {
    const { code } = await context.params;

    const header = await prisma.pay_header.findUnique({ where: { pyh_code: code } });
    if (!header) {
      return NextResponse.json({ message: "Payroll run not found" }, { status: 404 });
    }

    const details = await prisma.pay_details.findMany({
      where: { pyd_code: code },
      orderBy: { pyd_pk: "asc" },
    });

    // "Other" earnings/deductions are the ad-hoc pay_amounts lines — anything
    // that is not the basic, the statutory trio, tax or a loan. The CD10xx/
    // CD11xx/CD12xx/CD13xx audit snapshots are excluded: they hold bracket
    // values, not money (cd_slip = '0').
    const CORE_CODES = new Set(["CD1", "CD7", "CD8", "CD9", "CD10", "CD11", "CD12", "CD13"]);
    const amounts = details.length
      ? await prisma.pay_amounts.findMany({
          where: { pya_code: { in: details.map((d) => d.pyd_pk) } },
          select: { pya_code: true, pya_def: true, pya_cd: true, pya_amt: true },
        })
      : [];
    const slipCodes = [...new Set(amounts.map((a) => a.pya_def))];
    const comded = slipCodes.length
      ? await prisma.comded.findMany({
          where: { cd_code: { in: slipCodes } },
          select: { cd_code: true, cd_slip: true },
        })
      : [];
    const onSlip = new Map(comded.map((c) => [c.cd_code, c.cd_slip === "1"]));

    const otherBy = new Map<string, { earnings: number; deductions: number }>();
    for (const a of amounts) {
      if (CORE_CODES.has(a.pya_def)) continue;
      if (onSlip.get(a.pya_def) !== true) continue;
      const acc = otherBy.get(a.pya_code) ?? { earnings: 0, deductions: 0 };
      if (a.pya_cd === "D") acc.deductions += a.pya_amt ?? 0;
      else acc.earnings += a.pya_amt ?? 0;
      otherBy.set(a.pya_code, acc);
    }

    const employees = await prisma.employee.findMany({
      where: { emp_id: { in: details.map((d) => d.pyd_emp ?? "") } },
      select: { emp_id: true, emp_last: true, emp_first: true },
    });
    const nameBy = new Map(
      employees.map((e) => [e.emp_id, [e.emp_last, e.emp_first].filter(Boolean).join(", ")]),
    );

    const slips = details.map((d) => {
      const other = otherBy.get(d.pyd_pk) ?? { earnings: 0, deductions: 0 };
      const salary = d.pyd_salary ?? 0;
      const premiums = d.pyd_comp ?? 0;
      const timeDeductions = d.pyd_deduct ?? 0;
      const statutory = (d.pyd_sss ?? 0) + (d.pyd_phic ?? 0) + (d.pyd_hdmf ?? 0);

      // Legacy `ub_netearnings`: pay actually earned, before deductions.
      const netEarnings = salary + premiums - timeDeductions;
      const gross = salary + premiums + other.earnings + (d.pyd_tadjc ?? 0);
      const deductions =
        timeDeductions + statutory + (d.pyd_tax ?? 0) + (d.pyd_tloan ?? 0) +
        other.deductions + (d.pyd_tadjd ?? 0);

      return {
        pk: d.pyd_pk,
        employee: d.pyd_emp,
        name: nameBy.get(d.pyd_emp ?? "") ?? d.pyd_emp,
        basic: salary,
        premiums,
        timeDeductions,
        tax: d.pyd_tax ?? 0,
        sss: d.pyd_sss ?? 0,
        phic: d.pyd_phic ?? 0,
        hdmf: d.pyd_hdmf ?? 0,
        loans: d.pyd_tloan ?? 0,
        netEarnings,
        otherEarnings: other.earnings,
        otherDeductions: other.deductions,
        gross,
        deductions,
        net: gross - deductions,
      };
    });

    return NextResponse.json({
      run: {
        code: header.pyh_code,
        description: header.pyh_desc,
        from: header.pyh_from ? header.pyh_from.toISOString().slice(0, 10) : null,
        to: header.pyh_to ? header.pyh_to.toISOString().slice(0, 10) : null,
        status: header.pyh_status,
        postedBy: header.pyh_postedby,
        postedDate: header.pyh_posteddate ? header.pyh_posteddate.toISOString() : null,
      },
      slips,
      totals: {
        gross: slips.reduce((s, x) => s + x.gross, 0),
        deductions: slips.reduce((s, x) => s + x.deductions, 0),
        net: slips.reduce((s, x) => s + x.net, 0),
      },
    });
  } catch (e) {
    console.error("GET /api/payroll/runs/[code]", e);
    return NextResponse.json({ message: "Failed to load payroll run" }, { status: 500 });
  }
}

/**
 * DELETE /api/payroll/runs/[code]
 *
 * Removes a run and everything computed under it. Matches the legacy grid,
 * which only showed the trash icon while a run was unposted — a posted run
 * must be unposted first so its loan balances and YTD totals are reversed.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const auth = await authorizeApiRequest(request, "apiPayrollRunWrite");
  if (!auth.ok) return auth.response;

  try {
    const { code } = await context.params;

    const header = await prisma.pay_header.findUnique({ where: { pyh_code: code } });
    if (!header) {
      return NextResponse.json({ message: "Payroll run not found" }, { status: 404 });
    }
    if (header.pyh_status === RUN_POSTED) {
      return NextResponse.json(
        { message: `Payroll run ${code} is posted — unpost it before deleting` },
        { status: 400 },
      );
    }

    const details = await prisma.pay_details.findMany({
      where: { pyd_code: code },
      select: { pyd_pk: true },
    });
    const pks = details.map((d) => d.pyd_pk);

    await prisma.$transaction(async (tx) => {
      await tx.pay_amounts.deleteMany({ where: { pya_code: { in: pks } } });
      await tx.pay_loan.deleteMany({ where: { pyl_code: { in: pks } } });
      await tx.pay_adjust.deleteMany({ where: { pad_pk: { in: pks } } });
      await tx.pay_details.deleteMany({ where: { pyd_code: code } });
      await tx.pay_header.delete({ where: { pyh_code: code } });
    });

    return NextResponse.json({ code, deleted: true });
  } catch (e) {
    console.error("DELETE /api/payroll/runs/[code]", e);
    return NextResponse.json({ message: "Failed to delete payroll run" }, { status: 500 });
  }
}

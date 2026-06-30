"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useUserPayslips, computeNetPay } from "@/lib/hooks/usePayslip";
import { Pagination } from "@/components/ui/Pagination";
import { useState } from "react";

function num(val: number): string {
  return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function PayslipTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useUserPayslips(page);
  const payslips = data?.data ?? [];
  const meta = data?.meta;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading payslips…</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive py-4">{error.message}</p>;
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Posted Date</TableHead>
              <TableHead className="text-right">Salary</TableHead>
              <TableHead className="text-right">Earnings</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">SSS</TableHead>
              <TableHead className="text-right">PHIC</TableHead>
              <TableHead className="text-right">HDMF</TableHead>
              <TableHead className="text-right">Other Earn</TableHead>
              <TableHead className="text-right">Other Ded</TableHead>
              <TableHead className="text-right">Loans</TableHead>
              <TableHead className="text-right font-semibold">Net Pay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payslips.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-10 text-muted-foreground">
                  No payslip records found.
                </TableCell>
              </TableRow>
            ) : (
              payslips.map((p) => {
                const { netPay } = computeNetPay(p);
                return (
                  <TableRow key={p.pyd_pk}>
                    <TableCell className="whitespace-nowrap">{p.pyh_desc ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(p.pyh_posteddate)}</TableCell>
                    <TableCell className="text-right">{num(p.pyd_salary)}</TableCell>
                    <TableCell className="text-right">{num(p.pyd_comp)}</TableCell>
                    <TableCell className="text-right">{num(p.pyd_deduct)}</TableCell>
                    <TableCell className="text-right">{num(p.pyd_tax)}</TableCell>
                    <TableCell className="text-right">{num(p.pyd_sss)}</TableCell>
                    <TableCell className="text-right">{num(p.pyd_phic)}</TableCell>
                    <TableCell className="text-right">{num(p.pyd_hdmf)}</TableCell>
                    <TableCell className="text-right">{num(p.otherEarnings)}</TableCell>
                    <TableCell className="text-right">{num(p.otherDeductions)}</TableCell>
                    <TableCell className="text-right">{num(p.pyd_tloan)}</TableCell>
                    <TableCell className="text-right font-semibold">{num(netPay)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {meta && (
          <div className="px-4 pb-4">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

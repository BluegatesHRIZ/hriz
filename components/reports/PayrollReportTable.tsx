"use client";

import { useMemo, useState } from "react";
import {
  useDownloadReportXlsx,
  usePayrollReport,
} from "@/lib/hooks/useReports";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";

export function PayrollReportTable() {
  const currentYear = new Date().getFullYear().toString();
  const [yearInput, setYearInput] = useState<string>(currentYear);
  const [appliedYear, setAppliedYear] = useState<string | null>(currentYear);

  const payroll = usePayrollReport(appliedYear);
  const downloader = useDownloadReportXlsx();

  const rows = useMemo(() => payroll.data ?? [], [payroll.data]);

  return (
    <ReportPageShell
      title="Payroll Report"
      description="Posted payroll headers for the selected year with the compensation/deduction breakdown."
      filters={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="payroll-year">Year</Label>
            <Input
              id="payroll-year"
              type="number"
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={() => setAppliedYear(yearInput || null)}
              disabled={payroll.isLoading}
            >
              Load Year
            </Button>
            <Button
              variant="outline"
              disabled={downloader.isPending || rows.length === 0}
              onClick={() =>
                downloader.mutate({
                  endpoint: "/reports/payroll/export",
                  rows,
                  filename: `Payroll Report (${appliedYear ?? "year"}).xlsx`,
                })
              }
            >
              <Download className="mr-2 h-4 w-4" />
              {downloader.isPending ? "Exporting..." : "Export Excel"}
            </Button>
          </div>
        </div>
      }
    >
      {payroll.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No data for {appliedYear}.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pay Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Base Salary</TableHead>
                <TableHead className="text-right">Compensation</TableHead>
                <TableHead className="text-right">Deduction</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">SSS</TableHead>
                <TableHead className="text-right">PhilHealth</TableHead>
                <TableHead className="text-right">HDMF</TableHead>
                <TableHead className="text-right">SSS-Er</TableHead>
                <TableHead className="text-right">PHIC-Er</TableHead>
                <TableHead className="text-right">HDMF-Er</TableHead>
                <TableHead className="text-right">Tax Adj</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.Payreport.PyhCode ?? Math.random().toString()}>
                  <TableCell>{row.Payreport.PyhCode}</TableCell>
                  <TableCell>{row.Payreport.PyhDesc}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.Payreport.BaseSalary)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.Payreport.TotalCompensation)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.Payreport.TotalDeduction)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.Payreport.Tax)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.Payreport.Sss)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.Payreport.Philhealth)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.Payreport.Hdmf)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.Payreport.SssEmployer)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.Payreport.PhilhealthEmployer)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.Payreport.HdmfEmployer)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(row.Payreport.TaxAdjusted)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportPageShell>
  );
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0.00";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

"use client";

import { useState } from "react";
import { useHdmfContribution } from "@/lib/hooks/useContributions";
import { useDownloadReportXlsx } from "@/lib/hooks/useReports";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { YearFilter } from "@/components/contributions/YearFilter";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function HdmfContributionTable() {
  const currentYear = new Date().getFullYear().toString();
  const [yearInput, setYearInput] = useState(currentYear);
  const [appliedYear, setAppliedYear] = useState<string | null>(currentYear);
  const [page, setPage] = useState(1);

  const query = useHdmfContribution(appliedYear, "All", page);
  const downloader = useDownloadReportXlsx();
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;

  const loadYear = () => {
    setAppliedYear(yearInput || null);
    setPage(1);
  };

  return (
    <ReportPageShell
      title="HDMF Contribution Report"
      description="Pag-IBIG contributions for the selected year."
      filters={
        <div className="space-y-3">
          <YearFilter
            year={yearInput}
            onYearChange={setYearInput}
            onLoad={loadYear}
            loading={query.isLoading}
          />
          <Button
            variant="outline"
            disabled={downloader.isPending || !appliedYear || rows.length === 0}
            onClick={() =>
              appliedYear &&
              downloader.mutate({
                endpoint: "/contributions/hdmf/export",
                body: { year: appliedYear },
                filename: `HDMF Contributions (${appliedYear}).xlsx`,
              })
            }
          >
            <Download className="mr-2 h-4 w-4" />
            {downloader.isPending ? "Exporting..." : "Export Excel"}
          </Button>
        </div>
      }
    >
      {query.isLoading ? (
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
                <TableHead>Month</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Pag-IBIG ID</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead className="text-right">Employee</TableHead>
                <TableHead className="text-right">Employer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row.pyh_code}-${row.emp_pagibig}-${i}`}>
                  <TableCell>{row.pyh_desc}</TableCell>
                  <TableCell>{row.emp_name}</TableCell>
                  <TableCell>{row.emp_pagibig}</TableCell>
                  <TableCell className="text-right">{fmt(row.salary)}</TableCell>
                  <TableCell className="text-right">{fmt(row.pyd_hdmf)}</TableCell>
                  <TableCell className="text-right">{fmt(row.pyd_hdmfer)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {meta && <Pagination meta={meta} onPageChange={setPage} />}
        </div>
      )}
    </ReportPageShell>
  );
}

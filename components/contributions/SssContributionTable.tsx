"use client";

import { useMemo, useState } from "react";
import { useSssContribution } from "@/lib/hooks/useContributions";
import { useDownloadReportXlsx } from "@/lib/hooks/useReports";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { YearFilter } from "@/components/contributions/YearFilter";
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

export function SssContributionTable() {
  const currentYear = new Date().getFullYear().toString();
  const [yearInput, setYearInput] = useState(currentYear);
  const [appliedYear, setAppliedYear] = useState<string | null>(currentYear);

  const query = useSssContribution(appliedYear);
  const downloader = useDownloadReportXlsx();
  const rows = useMemo(() => query.data ?? [], [query.data]);

  return (
    <ReportPageShell
      title="SSS Contribution Report"
      description="Monthly SSS contribution breakdown for the selected year."
      filters={
        <div className="space-y-3">
          <YearFilter
            year={yearInput}
            onYearChange={setYearInput}
            onLoad={() => setAppliedYear(yearInput || null)}
            loading={query.isLoading}
          />
          <Button
            variant="outline"
            disabled={downloader.isPending || rows.length === 0}
            onClick={() =>
              downloader.mutate({
                endpoint: "/contributions/sss/export",
                rows,
                filename: `SSS Contributions (${appliedYear}).xlsx`,
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
                <TableHead>SSS ID</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead className="text-right">EC</TableHead>
                <TableHead className="text-right">WISP</TableHead>
                <TableHead className="text-right">MSCT</TableHead>
                <TableHead className="text-right">RSSER</TableHead>
                <TableHead className="text-right">RSSEE</TableHead>
                <TableHead className="text-right">RSST</TableHead>
                <TableHead className="text-right">ECER</TableHead>
                <TableHead className="text-right">ECEE</TableHead>
                <TableHead className="text-right">ECT</TableHead>
                <TableHead className="text-right">WISPER</TableHead>
                <TableHead className="text-right">WIPEE</TableHead>
                <TableHead className="text-right">WISPT</TableHead>
                <TableHead className="text-right">TER</TableHead>
                <TableHead className="text-right">TEE</TableHead>
                <TableHead className="text-right">TT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row.pyh_code}-${row.emp_sss}-${i}`}>
                  <TableCell>{row.pyh_desc}</TableCell>
                  <TableCell>{row.emp_name}</TableCell>
                  <TableCell>{row.emp_sss}</TableCell>
                  <TableCell className="text-right">{fmt(row.salary)}</TableCell>
                  <TableCell className="text-right">{fmt(row.ec)}</TableCell>
                  <TableCell className="text-right">{fmt(row.wisp)}</TableCell>
                  <TableCell className="text-right">{fmt(row.msct)}</TableCell>
                  <TableCell className="text-right">{fmt(row.rsser)}</TableCell>
                  <TableCell className="text-right">{fmt(row.rssee)}</TableCell>
                  <TableCell className="text-right">{fmt(row.rsst)}</TableCell>
                  <TableCell className="text-right">{fmt(row.ecer)}</TableCell>
                  <TableCell className="text-right">{fmt(row.ecee)}</TableCell>
                  <TableCell className="text-right">{fmt(row.ect)}</TableCell>
                  <TableCell className="text-right">{fmt(row.wisper)}</TableCell>
                  <TableCell className="text-right">{fmt(row.wipee)}</TableCell>
                  <TableCell className="text-right">{fmt(row.wispt)}</TableCell>
                  <TableCell className="text-right">{fmt(row.ter)}</TableCell>
                  <TableCell className="text-right">{fmt(row.tee)}</TableCell>
                  <TableCell className="text-right">{fmt(row.tt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportPageShell>
  );
}

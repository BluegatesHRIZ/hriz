"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  useCoaReport,
  useDownloadReportXlsx,
  type CoaReportRow,
} from "@/lib/hooks/useReports";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Send } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

function firstOfMonth(): string {
  const now = new Date();
  return format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
}

function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function CoaReportTable() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<CoaReportRow[]>([]);
  const { toast } = useToast();
  const report = useCoaReport({
    onSuccess: (data) => {
      setRows(data);
      toast({ title: "Report ready", description: `${data.length} rows` });
    },
    onError: (err) => {
      toast({
        title: "Failed to load report",
        description: err.message,
        variant: "destructive",
      });
    },
  });
  const downloader = useDownloadReportXlsx();

  return (
    <ReportPageShell
      title="Attendance Change Report"
      description="Attendance change (COA) records within the selected date range."
      filters={
        <div className="space-y-3">
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            disabled={report.isPending}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => report.mutate({ from, to })} disabled={report.isPending}>
              <Send className="mr-2 h-4 w-4" /> Generate Report
            </Button>
            <Button
              variant="outline"
              disabled={downloader.isPending || rows.length === 0}
              onClick={() =>
                downloader.mutate({
                  endpoint: "/reports/attendance-change/export",
                  rows,
                  filename: `Attendance Change Report (${from} to ${to}).xlsx`,
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
      {report.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No data loaded.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Detail ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Type Detail</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.coa_did ?? Math.random().toString()}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.coa_did}</TableCell>
                  <TableCell>{row.coa_dtype}</TableCell>
                  <TableCell>{row.coa_ddate}</TableCell>
                  <TableCell>{row.coa_dtime}</TableCell>
                  <TableCell>{row.coa_stypedetail}</TableCell>
                  <TableCell>{row.coa_sreason}</TableCell>
                  <TableCell>{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ReportPageShell>
  );
}

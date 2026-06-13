"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  useDownloadReportXlsx,
  useUndertimeReport,
  type UndertimeReportRow,
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

export function UndertimeReportTable() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<UndertimeReportRow[]>([]);
  const { toast } = useToast();
  const report = useUndertimeReport({
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
      title="Undertime Report"
      description="Undertime requests within the selected date range."
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
                  endpoint: "/reports/undertime/export",
                  rows,
                  filename: `Undertime Report (${from} to ${to}).xlsx`,
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
                <TableHead>ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Applied Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.utm_id ?? Math.random().toString()}>
                  <TableCell>{row.utm_id}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.utm_date}</TableCell>
                  <TableCell>{row.utm_from}</TableCell>
                  <TableCell>{row.utm_to}</TableCell>
                  <TableCell>{row.utm_reason}</TableCell>
                  <TableCell>{row.utm_applieddate}</TableCell>
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

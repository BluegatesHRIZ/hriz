"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  useDownloadReportXlsx,
  useScheduleChangeReport,
  type ScheduleChangeReportRow,
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

export function ScheduleChangeReportTable() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<ScheduleChangeReportRow[]>([]);
  const { toast } = useToast();
  const report = useScheduleChangeReport({
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
      title="Schedule Change Report"
      description="Schedule adjustment requests within the selected date range."
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
                  endpoint: "/reports/schedule-change/export",
                  rows,
                  filename: `Schedule Change Report (${from} to ${to}).xlsx`,
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
                <TableHead>Detail ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Shift Start</TableHead>
                <TableHead>Shift End</TableHead>
                <TableHead>Break Start</TableHead>
                <TableHead>Break End</TableHead>
                <TableHead>Rest</TableHead>
                <TableHead>Sched In</TableHead>
                <TableHead>Sched Out</TableHead>
                <TableHead>Break In</TableHead>
                <TableHead>Break Out</TableHead>
                <TableHead>Rest Day</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.sca_did ?? Math.random().toString()}>
                  <TableCell>{row.sca_did}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.sca_ddate}</TableCell>
                  <TableCell>{row.sca_dshiftstart}</TableCell>
                  <TableCell>{row.sca_dshiftend}</TableCell>
                  <TableCell>{row.sca_dbreakstart}</TableCell>
                  <TableCell>{row.sca_dbreakend}</TableCell>
                  <TableCell>{row.sca_drest}</TableCell>
                  <TableCell>{row.att_schin}</TableCell>
                  <TableCell>{row.att_schout}</TableCell>
                  <TableCell>{row.att_schbin}</TableCell>
                  <TableCell>{row.att_schbout}</TableCell>
                  <TableCell>{row.att_restday}</TableCell>
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

"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  useDownloadReportXlsx,
  useOvertimeReport,
  type OvertimeReportRow,
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

export function OvertimeReportTable() {
  const [from, setFrom] = useState<string>(firstOfMonth());
  const [to, setTo] = useState<string>(today());
  const [rows, setRows] = useState<OvertimeReportRow[]>([]);

  const { toast } = useToast();
  const overtime = useOvertimeReport({
    onSuccess: (data) => {
      setRows(data);
      toast({ title: "Report ready", description: `${data.length} rows` });
    },
    onError: (err) =>
      toast({
        title: "Failed to load report",
        description: err.message,
        variant: "destructive",
      }),
  });
  const downloader = useDownloadReportXlsx();

  return (
    <ReportPageShell
      title="Overtime Report"
      description="Filed overtime requests with the corresponding day's OT/RD/SH/LH/DH breakdown."
      filters={
        <div className="space-y-3">
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            disabled={overtime.isPending}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => overtime.mutate({ from, to })}
              disabled={overtime.isPending}
            >
              <Send className="mr-2 h-4 w-4" /> Generate Report
            </Button>
            <Button
              variant="outline"
              disabled={downloader.isPending || rows.length === 0}
              onClick={() =>
                downloader.mutate({
                  endpoint: "/reports/overtime/export",
                  rows,
                  filename: `Overtime Report (${from} to ${to}).xlsx`,
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
      {overtime.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No data loaded.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OT ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.otm_id ?? Math.random().toString()}>
                  <TableCell>{row.otm_id}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>{row.location}</TableCell>
                  <TableCell>{formatDate(row.otm_date)}</TableCell>
                  <TableCell>{formatTime(row.otm_from)}</TableCell>
                  <TableCell>{formatTime(row.otm_to)}</TableCell>
                  <TableCell>{row.reason}</TableCell>
                  <TableCell>{formatDate(row.otm_applieddate)}</TableCell>
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

function formatDate(raw: string | null): string {
  if (!raw) return "";
  try {
    return format(new Date(raw), "MM/dd/yyyy");
  } catch {
    return raw;
  }
}

function formatTime(raw: string | null): string {
  if (!raw) return "";
  try {
    return format(new Date(raw), "hh:mm a");
  } catch {
    return raw;
  }
}

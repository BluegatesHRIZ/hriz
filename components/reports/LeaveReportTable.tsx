"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  useDownloadReportXlsx,
  useLeaveReport,
} from "@/lib/hooks/useReports";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { DateRangeFilter } from "@/components/reports/DateRangeFilter";
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
import { Download, Send } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

function firstOfMonth(): string {
  const now = new Date();
  return format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
}

function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function LeaveReportTable() {
  const [from, setFrom] = useState<string>(firstOfMonth());
  const [to, setTo] = useState<string>(today());
  const [submitted, setSubmitted] = useState<{ from: string; to: string } | null>(null);

  const { toast } = useToast();
  const leave = useLeaveReport({
    onError: (err) => {
      toast({
        title: "Failed to load report",
        description: err.message,
        variant: "destructive",
      });
    },
  });
  const downloader = useDownloadReportXlsx();

  const rows = leave.data?.data ?? [];
  const meta = leave.data?.meta;

  const generate = () => {
    const f = { from, to };
    setSubmitted(f);
    leave.mutate({ ...f, page: 1 });
  };
  const goToPage = (p: number) => {
    if (!submitted) return;
    leave.mutate({ ...submitted, page: p });
  };

  return (
    <ReportPageShell
      title="Leave Report"
      description="Approved, rejected, and pending leave requests within the date range."
      filters={
        <div className="space-y-3">
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            disabled={leave.isPending}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={leave.isPending}>
              <Send className="mr-2 h-4 w-4" /> Generate Report
            </Button>
            <Button
              variant="outline"
              disabled={downloader.isPending || !submitted}
              onClick={() =>
                submitted &&
                downloader.mutate({
                  endpoint: "/reports/leave/export",
                  body: submitted,
                  filename: `Leave Report (${submitted.from} to ${submitted.to}).xlsx`,
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
      {leave.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : !submitted ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No data loaded.
        </p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No rows for the selected range.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Leave Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>With Pay</TableHead>
                <TableHead>Applied Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={row.lea_sid ?? `leave-${i}`}>
                  <TableCell>{row.lea_semp}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell>{row.location}</TableCell>
                  <TableCell>{row.lev_desc}</TableCell>
                  <TableCell>{formatDate(row.lea_sfrom)}</TableCell>
                  <TableCell>{formatDate(row.lea_sto)}</TableCell>
                  <TableCell>{row.lea_sreason}</TableCell>
                  <TableCell>{row.lea_swithpay}</TableCell>
                  <TableCell>{formatDate(row.lea_sapplieddate)}</TableCell>
                  <TableCell>{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {meta && <Pagination meta={meta} onPageChange={goToPage} />}
        </>
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

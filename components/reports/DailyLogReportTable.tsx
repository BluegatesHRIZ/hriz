"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  useDailyLogReport,
  useDownloadReportXlsx,
} from "@/lib/hooks/useReports";
import { ReportPageShell } from "@/components/reports/ReportPageShell";
import { Pagination } from "@/components/ui/Pagination";
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
import { Download, Send } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function DailyLogReportTable() {
  const [date, setDate] = useState<string>(today());
  const [submitted, setSubmitted] = useState<{ date: string } | null>(null);
  const { toast } = useToast();

  const dailyLog = useDailyLogReport({
    onError: (err) =>
      toast({
        title: "Failed to load report",
        description: err.message,
        variant: "destructive",
      }),
  });
  const downloader = useDownloadReportXlsx();

  const rows = dailyLog.data?.data ?? [];
  const meta = dailyLog.data?.meta;

  const generate = () => {
    const f = { date };
    setSubmitted(f);
    dailyLog.mutate({ ...f, page: 1 });
  };
  const goToPage = (p: number) => {
    if (!submitted) return;
    dailyLog.mutate({ ...submitted, page: p });
  };

  return (
    <ReportPageShell
      title="Daily Log"
      description="Per-employee schedule and biometric time-in / time-out for the chosen day."
      filters={
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="dailylog-date">Date</Label>
            <Input
              id="dailylog-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={generate} disabled={dailyLog.isPending}>
              <Send className="mr-2 h-4 w-4" /> Generate Report
            </Button>
            <Button
              variant="outline"
              disabled={downloader.isPending || !submitted}
              onClick={() =>
                submitted &&
                downloader.mutate({
                  endpoint: "/reports/dailylog/export",
                  body: submitted,
                  filename: `Daily Log (${submitted.date}).xlsx`,
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
      {dailyLog.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : !submitted ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No data loaded.
        </p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No rows for the selected day.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Time In</TableHead>
                <TableHead>Time Out</TableHead>
                <TableHead>In Location</TableHead>
                <TableHead>Out Location</TableHead>
                <TableHead>In IP</TableHead>
                <TableHead>Out IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={(row.EmpId ?? "") + (row.AttDate ?? "")}>
                  <TableCell>{row.EmpId}</TableCell>
                  <TableCell>{row.EmpName}</TableCell>
                  <TableCell>{row.DepDesc}</TableCell>
                  <TableCell>{row.PstDesc}</TableCell>
                  <TableCell>{row.LocDesc}</TableCell>
                  <TableCell>{row.EmpSched}</TableCell>
                  <TableCell>{row.EmpTimeIn}</TableCell>
                  <TableCell>{row.EmpTimeOut}</TableCell>
                  <TableCell>{row.InLoc}</TableCell>
                  <TableCell>{row.OutLoc}</TableCell>
                  <TableCell>{row.InIp}</TableCell>
                  <TableCell>{row.OutIp}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {meta && <Pagination meta={meta} onPageChange={goToPage} />}
        </div>
      )}
    </ReportPageShell>
  );
}

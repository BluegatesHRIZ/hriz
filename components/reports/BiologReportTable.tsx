"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  useBiologReport,
  useDownloadReportXlsx,
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

export function BiologReportTable() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [submitted, setSubmitted] = useState<{ from: string; to: string } | null>(null);
  const { toast } = useToast();
  const report = useBiologReport({
    onError: (err) => {
      toast({
        title: "Failed to load report",
        description: err.message,
        variant: "destructive",
      });
    },
  });
  const downloader = useDownloadReportXlsx();

  const rows = report.data?.data ?? [];
  const meta = report.data?.meta;

  const generate = () => {
    const f = { from, to };
    setSubmitted(f);
    report.mutate({ ...f, page: 1 });
  };
  const goToPage = (p: number) => {
    if (!submitted) return;
    report.mutate({ ...submitted, page: p });
  };

  return (
    <ReportPageShell
      title="User Biolog"
      description="Your biometric clock events for the selected date range."
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
            <Button onClick={generate} disabled={report.isPending}>
              <Send className="mr-2 h-4 w-4" /> Generate Report
            </Button>
            <Button
              variant="outline"
              disabled={downloader.isPending || !submitted}
              onClick={() =>
                submitted &&
                downloader.mutate({
                  endpoint: "/reports/biolog/export",
                  body: submitted,
                  filename: `User Biolog (${submitted.from} to ${submitted.to}).xlsx`,
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
      ) : !submitted ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No data loaded.</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No rows for the selected range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row.bio_date}-${row.bio_time}-${i}`}>
                  <TableCell>{row.bio_date}</TableCell>
                  <TableCell>{row.bio_emp}</TableCell>
                  <TableCell>{row.bio_type}</TableCell>
                  <TableCell>{row.bio_time}</TableCell>
                  <TableCell>{row.bio_loc}</TableCell>
                  <TableCell>{row.bio_ip}</TableCell>
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

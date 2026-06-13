"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  useBiologReport,
  useDownloadReportXlsx,
  type BiologReportRow,
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

export function BiologReportTable() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<BiologReportRow[]>([]);
  const { toast } = useToast();
  const report = useBiologReport({
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
            <Button onClick={() => report.mutate({ from, to })} disabled={report.isPending}>
              <Send className="mr-2 h-4 w-4" /> Generate Report
            </Button>
            <Button
              variant="outline"
              disabled={downloader.isPending || rows.length === 0}
              onClick={() =>
                downloader.mutate({
                  endpoint: "/reports/biolog/export",
                  rows,
                  filename: `User Biolog (${from} to ${to}).xlsx`,
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
        </div>
      )}
    </ReportPageShell>
  );
}

"use client";

import { useMemo } from "react";
import { useOvertimeList } from "@/lib/hooks/useRequestManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

interface OvertimeRequestTableProps {
  onApply: () => void;
  onSelectRequest: (otId: string) => void;
}

function formatDate(value?: Date | string | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "MM/dd/yyyy");
}

function formatType(type?: number | string): string {
  const v = typeof type === "string" ? type : String(type ?? "0");
  switch (v) {
    case "0":
      return "Normal OT";
    case "1":
      return "Early OT";
    case "2":
      return "Special OT";
    default:
      return v;
  }
}

function formatStatus(status?: number): string {
  switch (status) {
    case 0:
      return "Pending";
    case 1:
      return "Approved";
    case 2:
      return "Rejected";
    case 3:
      return "Cancelled";
    case 4:
      return "Resubmitted";
    default:
      return "";
  }
}

export function OvertimeRequestTable({
  onApply,
  onSelectRequest,
}: OvertimeRequestTableProps) {
  const { data, isLoading } = useOvertimeList();

  const rows = useMemo(() => data ?? [], [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Overtime Requests</CardTitle>
        <Button size="sm" onClick={onApply}>
          Apply for Overtime
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading overtime...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No overtime requests found.
          </p>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Date</TableHead>
                  <TableHead className="w-[140px]">Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.otm_id}
                    className="cursor-pointer"
                    onClick={() => row.otm_id && onSelectRequest(row.otm_id)}
                  >
                    <TableCell>{formatDate(row.otm_date)}</TableCell>
                    <TableCell>{formatType(row.otm_type ?? "0")}</TableCell>
                    <TableCell>{row.otm_reason}</TableCell>
                    <TableCell>{formatStatus(row.otm_status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


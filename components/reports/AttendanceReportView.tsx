"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useDepartments, useLocations, usePositions } from "@/lib/hooks/useEmployeeDetail";
import {
  useAttendanceReport,
  useDownloadReportXlsx,
  type AttendanceEmployeeHeaderDTO,
  type AttendanceReportFilters,
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Download, Filter, RefreshCw, Send } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";

function firstOfMonth(): string {
  const now = new Date();
  return format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
}

function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function AttendanceReportView() {
  const [from, setFrom] = useState<string>(firstOfMonth());
  const [to, setTo] = useState<string>(today());
  const [location, setLocation] = useState<string[]>([]);
  const [department, setDepartment] = useState<string[]>([]);
  const [position, setPosition] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [submitted, setSubmitted] = useState<AttendanceReportFilters | null>(null);
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  const { data: departments } = useDepartments();
  const { data: positions } = usePositions();
  const { data: locations } = useLocations();
  const { toast } = useToast();

  const attendance = useAttendanceReport({
    onError: (err) => {
      toast({
        title: "Failed to load report",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const downloader = useDownloadReportXlsx();

  const rows = attendance.data?.data ?? [];
  const meta = attendance.data?.meta;

  const filters: AttendanceReportFilters = useMemo(
    () => ({ from, to, location, department, position }),
    [from, to, location, department, position],
  );

  // "Apply Request" runs the mutating generate proc once; "Refresh from data"
  // and page navigation use the read-only list endpoint.
  const handleGenerate = () => {
    setSubmitted(filters);
    attendance.mutate({ filters, mode: "generate", page: 1 });
  };
  const handleList = () => {
    setSubmitted(filters);
    attendance.mutate({ filters, mode: "list", page: 1 });
  };
  const goToPage = (p: number) => {
    if (!submitted) return;
    attendance.mutate({ filters: submitted, mode: "list", page: p });
  };
  const handleExport = () => {
    if (!submitted) {
      toast({ title: "Nothing to export", variant: "destructive" });
      return;
    }
    downloader.mutate({
      endpoint: "/reports/attendance/export",
      body: submitted as unknown as Record<string, unknown>,
      filename: `Attendance Report (${submitted.from} to ${submitted.to}).xlsx`,
    });
  };

  return (
    <ReportPageShell
      title="Attendance Report"
      description="Aggregate per-employee attendance with the per-day breakdown."
      filters={
        <div className="space-y-3">
          <DateRangeFilter
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            disabled={attendance.isPending}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={attendance.isPending}>
              <Send className="mr-2 h-4 w-4" /> Apply Request
            </Button>
            <Button
              variant="secondary"
              onClick={handleList}
              disabled={attendance.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh from data
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowFilters(true)}
              disabled={attendance.isPending}
            >
              <Filter className="mr-2 h-4 w-4" /> Advanced Filter
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={downloader.isPending || !submitted}
            >
              <Download className="mr-2 h-4 w-4" />
              {downloader.isPending ? "Exporting..." : "Export Excel"}
            </Button>
          </div>
        </div>
      }
    >
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advanced Filter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <MultiSelect
              label="Location"
              options={(locations ?? []).map((l) => ({
                id: l.loc_id,
                label: l.loc_desc ?? l.loc_id,
              }))}
              selected={location}
              onChange={setLocation}
            />
            <MultiSelect
              label="Department"
              options={(departments ?? []).map((d) => ({
                id: d.dep_id,
                label: d.dep_desc ?? d.dep_id,
              }))}
              selected={department}
              onChange={setDepartment}
            />
            <MultiSelect
              label="Position"
              options={(positions ?? []).map((p) => ({
                id: p.pst_id,
                label: p.pst_desc ?? p.pst_id,
              }))}
              selected={position}
              onChange={setPosition}
            />
          </div>
        </DialogContent>
      </Dialog>

      {attendance.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading report...</p>
      ) : !submitted ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No data loaded. Click <strong>Apply Request</strong> to generate the report.
        </p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No employees for the selected range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>ID</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-center">Workday</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-center">Absent</TableHead>
                <TableHead className="text-center">Restday</TableHead>
                <TableHead className="text-center">Leave</TableHead>
                <TableHead className="text-center">Holiday</TableHead>
                <TableHead className="text-center">Hours Worked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => {
                const isExpanded = expandedEmpId === row.EmpId;
                return (
                  <AttendanceRow
                    key={row.EmpId ?? `att-${i}`}
                    row={row}
                    isExpanded={isExpanded}
                    onToggle={() =>
                      setExpandedEmpId(isExpanded ? null : (row.EmpId ?? null))
                    }
                  />
                );
              })}
            </TableBody>
          </Table>
          {meta && <Pagination meta={meta} onPageChange={goToPage} />}
        </div>
      )}
    </ReportPageShell>
  );
}

function AttendanceRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: AttendanceEmployeeHeaderDTO;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow>
        <TableCell>
          <button
            type="button"
            onClick={onToggle}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </TableCell>
        <TableCell>{row.EmpId}</TableCell>
        <TableCell>{row.EmpFullname}</TableCell>
        <TableCell>{row.EmpDepartment}</TableCell>
        <TableCell>{row.EmpPosition}</TableCell>
        <TableCell>{row.EmpLocation}</TableCell>
        <TableCell className="text-center">{row.EmpWorkday ?? 0}</TableCell>
        <TableCell className="text-center">{row.EmpPresent ?? 0}</TableCell>
        <TableCell className="text-center">{row.EmpAbsent ?? 0}</TableCell>
        <TableCell className="text-center">{row.EmpRestday ?? 0}</TableCell>
        <TableCell className="text-center">{row.EmpLeave ?? 0}</TableCell>
        <TableCell className="text-center">{row.EmpHoliday ?? 0}</TableCell>
        <TableCell className="text-center">
          {typeof row.EmpHoursworked === "number"
            ? row.EmpHoursworked.toFixed(2)
            : (row.EmpHoursworked ?? 0)}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={13} className="bg-muted/30 p-2">
            <div className="w-full max-w-full overflow-x-auto">
              <AttendanceDetailGrid row={row} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

const DETAIL_PAGE_SIZE = 5;

function AttendanceDetailGrid({ row }: { row: AttendanceEmployeeHeaderDTO }) {
  const [page, setPage] = useState(0);
  const details = row.AttendanceDetails;
  const totalPages = Math.max(1, Math.ceil(details.length / DETAIL_PAGE_SIZE));
  const paged = details.slice(
    page * DETAIL_PAGE_SIZE,
    (page + 1) * DETAIL_PAGE_SIZE,
  );

  if (details.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No detail rows for this employee.</p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="py-1.5">Date</TableHead>
              <TableHead className="py-1.5">Day</TableHead>
              <TableHead className="py-1.5">Shift</TableHead>
              <TableHead className="py-1.5">Schedule</TableHead>
              <TableHead className="py-1.5">Clock In/Out</TableHead>
              <TableHead className="py-1.5 text-center">Clocked Hrs</TableHead>
              <TableHead className="py-1.5 text-center">Late (min)</TableHead>
              <TableHead className="py-1.5 text-center">Reg Hrs</TableHead>
              <TableHead className="py-1.5 text-center">UT (min)</TableHead>
              <TableHead className="py-1.5 text-center">OT (min)</TableHead>
              <TableHead className="py-1.5 text-center">Paid Hrs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((detail) => (
              <TableRow key={`${detail.EmpId}-${detail.EmpDate}`}>
                <TableCell className="py-1.5">{formatDate(detail.EmpDate)}</TableCell>
                <TableCell className="py-1.5">{detail.EmpDay}</TableCell>
                <TableCell className="py-1.5">{detail.EmpShift}</TableCell>
                <TableCell className="py-1.5">{detail.EmpSchedule}</TableCell>
                <TableCell className="py-1.5">{detail.EmpClockedinandout}</TableCell>
                <TableCell className="py-1.5 text-center">
                  {typeof detail.EmpClockedhours === "number"
                    ? detail.EmpClockedhours.toFixed(2)
                    : (detail.EmpClockedhours ?? 0)}
                </TableCell>
                <TableCell className="py-1.5 text-center">{detail.EmpLate ?? 0}</TableCell>
                <TableCell className="py-1.5 text-center">
                  {typeof detail.EmpRegularhours === "number"
                    ? detail.EmpRegularhours.toFixed(2)
                    : (detail.EmpRegularhours ?? 0)}
                </TableCell>
                <TableCell className="py-1.5 text-center">{detail.EmpUndertime ?? 0}</TableCell>
                <TableCell className="py-1.5 text-center">{detail.EmpOvertime ?? 0}</TableCell>
                <TableCell className="py-1.5 text-center">
                  {typeof detail.EmpPaidHours === "number"
                    ? detail.EmpPaidHours.toFixed(2)
                    : (detail.EmpPaidHours ?? 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page + 1} of {totalPages} ({details.length} days)
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-sm">
        {options.length === 0 ? (
          <p className="text-muted-foreground">No options</p>
        ) : (
          options.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <label
                key={opt.id}
                className="flex cursor-pointer items-center gap-2 py-1"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selected, opt.id]);
                    } else {
                      onChange(selected.filter((id) => id !== opt.id));
                    }
                  }}
                />
                <span>{opt.label}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
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

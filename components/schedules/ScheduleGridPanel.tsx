"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/Pagination";
import { Pencil } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import {
  useSchedulesList,
  useSaveScheduleGrid,
  type EmployeeScheduleRow,
} from "@/lib/hooks/useSchedules";
import {
  ScheduleFilterBar,
  EMPTY_FILTERS,
  type ScheduleFilters,
} from "./ScheduleFilterBar";
import { ScheduleDayEditor } from "./ScheduleDayEditor";
import {
  DAYS,
  shortDayName,
  toFullWeek,
  toScheduleForm,
  type ScheduleDayValue,
} from "./scheduleDays";

/** Compact cell label for one day in the grid overview. */
function dayLabel(day: ScheduleDayValue | undefined): string {
  if (!day) return "—";
  if (day.sch_rest) return "Rest";
  if (day.sch_shift === "E") return "Exempt";
  return `${day.sch_in}–${day.sch_out}`;
}

export function ScheduleGridPanel() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const listQuery = useSchedulesList({ ...filters, page, limit: 10 });
  const saveGrid = useSaveScheduleGrid();

  const handleFilterChange = (next: ScheduleFilters) => {
    setFilters(next);
    setPage(1);
  };

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  // Inline edit dialog for one employee.
  const [editing, setEditing] = useState<EmployeeScheduleRow | null>(null);
  const [editDays, setEditDays] = useState<ScheduleDayValue[]>([]);

  const openEdit = (row: EmployeeScheduleRow) => {
    setEditing(row);
    setEditDays(toFullWeek(row.days));
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const res = await saveGrid.mutateAsync({
        employees: [{ empId: editing.emp_id, days: toScheduleForm(editDays) }],
      });
      toast({ title: "Saved", description: res.message });
      setEditing(null);
    } catch (error) {
      toast({
        title: "Couldn't save",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const dayByName = (row: EmployeeScheduleRow, day: string) =>
    toFullWeek(row.days).find((d) => d.sch_day === day);

  return (
    <div className="space-y-4">
      <ScheduleFilterBar value={filters} onChange={handleFilterChange} />

      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="border-b p-2 text-left min-w-[180px]">Employee</th>
                {DAYS.map((d) => (
                  <th key={d} className="border-b p-2 text-center min-w-[92px]">
                    {shortDayName(d)}
                  </th>
                ))}
                <th className="border-b p-2 text-center w-[70px]" />
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={9} className="p-4 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : listQuery.isError ? (
                <tr>
                  <td colSpan={9} className="p-4 text-red-500">
                    Failed to load employees.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-4 text-muted-foreground">
                    No employees found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.emp_id} className="hover:bg-muted/40">
                    <td className="border-b p-2">
                      <div className="font-medium">
                        {row.emp_name || row.emp_id}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.emp_id}
                        {row.emp_dept_desc ? ` · ${row.emp_dept_desc}` : ""}
                      </div>
                    </td>
                    {DAYS.map((d) => {
                      const day = dayByName(row, d);
                      const isRest = day?.sch_rest;
                      return (
                        <td
                          key={d}
                          className={`border-b p-2 text-center text-xs ${
                            isRest ? "text-muted-foreground" : ""
                          }`}
                        >
                          {dayLabel(day)}
                        </td>
                      );
                    })}
                    <td className="border-b p-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(row)}
                        title="Edit schedule"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {meta && (
          <div className="px-3">
            <Pagination meta={meta} onPageChange={setPage} />
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Edit schedule — {editing?.emp_name || editing?.emp_id}
            </DialogTitle>
            <DialogDescription>
              Adjust this employee&apos;s weekly schedule, then save.
            </DialogDescription>
          </DialogHeader>
          <ScheduleDayEditor days={editDays} onChange={setEditDays} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveGrid.isPending}>
              {saveGrid.isPending ? "Saving…" : "Save schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

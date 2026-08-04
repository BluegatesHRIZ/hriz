"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/Pagination";
import { Users, CalendarClock, Save, CheckCircle2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import {
  useSchedulesList,
  useMatchingEmployeeIds,
  useBulkApplySchedule,
} from "@/lib/hooks/useSchedules";
import {
  useScheduleTemplates,
  useScheduleTemplate,
} from "@/lib/hooks/useScheduleTemplates";
import {
  ScheduleFilterBar,
  EMPTY_FILTERS,
  type ScheduleFilters,
} from "./ScheduleFilterBar";
import { ScheduleDayEditor } from "./ScheduleDayEditor";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import {
  emptyWeek,
  toFullWeek,
  toScheduleForm,
  summariseWeek,
  applyDayUpdate,
  type ScheduleDayValue,
} from "./scheduleDays";

const NONE = "__none__";

/** Preset builders — quick starting points for non-technical users. */
function presetOfficeWeek(): ScheduleDayValue[] {
  return emptyWeek().map((d) => {
    const weekend = d.sch_day === "SATURDAY" || d.sch_day === "SUNDAY";
    return applyDayUpdate(d, {
      sch_in: "08:00",
      sch_out: "17:00",
      sch_rest: weekend,
    });
  });
}

function presetAllRest(): ScheduleDayValue[] {
  return emptyWeek().map((d) => applyDayUpdate(d, { sch_rest: true }));
}

export function BulkApplyPanel() {
  const { toast } = useToast();

  // Step 1 — employee selection
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const listQuery = useSchedulesList({ ...filters, page, limit: 10 });
  const matchingIds = useMatchingEmployeeIds(filters);

  const handleFilterChange = (next: ScheduleFilters) => {
    setFilters(next);
    setPage(1);
  };

  const rows = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta;

  const toggleOne = (empId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(empId);
      else next.delete(empId);
      return next;
    });
  };

  const pageAllChecked = rows.length > 0 && rows.every((r) => selected.has(r.emp_id));
  const togglePage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      rows.forEach((r) => (checked ? next.add(r.emp_id) : next.delete(r.emp_id)));
      return next;
    });
  };

  const selectAllMatching = async () => {
    const result = await matchingIds.refetch();
    const ids = result.data?.ids ?? [];
    if (!ids.length) {
      toast({ title: "No matching employees", description: "Adjust your filters." });
      return;
    }
    setSelected(new Set(ids));
    toast({
      title: "Selected",
      description: `${ids.length} employee${ids.length === 1 ? "" : "s"} selected.`,
    });
  };

  // Step 2 — schedule builder
  const [days, setDays] = useState<ScheduleDayValue[]>(presetOfficeWeek);
  const [templateId, setTemplateId] = useState<string>(NONE);
  const [saveOpen, setSaveOpen] = useState(false);
  const templatesQuery = useScheduleTemplates();
  const templateDetail = useScheduleTemplate(
    templateId === NONE ? null : templateId
  );

  useEffect(() => {
    if (templateId !== NONE && templateDetail.data) {
      setDays(toFullWeek(templateDetail.data.days));
      toast({
        title: "Template loaded",
        description: `"${templateDetail.data.name}" — review then apply.`,
      });
    }
    // Only react to a newly-fetched template.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateDetail.data]);

  // Step 3 — apply
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bulkApply = useBulkApplySchedule();

  const selectedCount = selected.size;
  const weekSummary = useMemo(() => summariseWeek(days), [days]);

  const handleApply = async () => {
    try {
      const res = await bulkApply.mutateAsync({
        empIds: Array.from(selected),
        days: toScheduleForm(days),
      });
      toast({ title: "Schedule applied", description: res.message });
      setSelected(new Set());
      setConfirmOpen(false);
    } catch (error) {
      toast({
        title: "Couldn't apply schedule",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Step 1 — pick employees */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
            1
          </span>
          <h3 className="font-semibold flex items-center gap-1.5">
            <Users className="h-4 w-4" /> Choose employees
          </h3>
        </div>

        <ScheduleFilterBar value={filters} onChange={handleFilterChange} />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAllMatching}
            disabled={matchingIds.isFetching}
          >
            {matchingIds.isFetching
              ? "Selecting…"
              : `Select all${meta ? ` ${meta.total}` : ""} matching`}
          </Button>
          {selectedCount > 0 && (
            <>
              <Badge variant="secondary">{selectedCount} selected</Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </>
          )}
        </div>

        <div className="rounded-lg border">
          <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm font-medium">
            <Checkbox
              checked={pageAllChecked}
              onCheckedChange={(c) => togglePage(c === true)}
              aria-label="Select all on this page"
            />
            <span>Employee</span>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {listQuery.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : listQuery.isError ? (
              <p className="p-4 text-sm text-red-500">Failed to load employees.</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No employees found.
              </p>
            ) : (
              rows.map((r) => (
                <label
                  key={r.emp_id}
                  className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={selected.has(r.emp_id)}
                    onCheckedChange={(c) => toggleOne(r.emp_id, c === true)}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {r.emp_name || r.emp_id}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.emp_id}
                      {r.emp_dept_desc ? ` · ${r.emp_dept_desc}` : ""}
                      {r.emp_loc_desc ? ` · ${r.emp_loc_desc}` : ""}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
          {meta && (
            <div className="px-3">
              <Pagination meta={meta} onPageChange={setPage} />
            </div>
          )}
        </div>
      </section>

      {/* Step 2 — build the schedule */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
            2
          </span>
          <h3 className="font-semibold flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4" /> Set the weekly schedule
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Load a saved template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Start from scratch</SelectItem>
              {templatesQuery.data?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDays(presetOfficeWeek())}
          >
            Office 8–5, Mon–Fri
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDays(presetAllRest())}
          >
            All rest days
          </Button>
        </div>

        <ScheduleDayEditor days={days} onChange={setDays} />

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{weekSummary}</p>
          <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
            <Save className="mr-2 h-4 w-4" /> Save as template
          </Button>
        </div>

        {/* Step 3 — apply */}
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              3
            </span>
            <h3 className="font-semibold">Review &amp; apply</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            This will replace the weekly schedule for{" "}
            <span className="font-semibold text-foreground">
              {selectedCount} employee{selectedCount === 1 ? "" : "s"}
            </span>
            .
          </p>
          <Button
            className="mt-3 w-full"
            disabled={selectedCount === 0 || bulkApply.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Apply to {selectedCount} employee{selectedCount === 1 ? "" : "s"}
          </Button>
        </div>
      </section>

      <SaveTemplateDialog open={saveOpen} onOpenChange={setSaveOpen} days={days} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply this schedule?</DialogTitle>
            <DialogDescription>
              You&apos;re about to replace the weekly schedule for{" "}
              <span className="font-semibold text-foreground">
                {selectedCount} employee{selectedCount === 1 ? "" : "s"}
              </span>
              . Their current weekly schedule will be overwritten with:
              <br />
              <span className="mt-1 block font-medium text-foreground">
                {weekSummary}
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={bulkApply.isPending}>
              {bulkApply.isPending ? "Applying…" : "Yes, apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

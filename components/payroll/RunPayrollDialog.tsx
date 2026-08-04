"use client";

import { useMemo, useRef, useState } from "react";
import { Search, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/Pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  usePayrollEmployees,
  useAllMatchingEmployeeIds,
  usePayrollTypes,
  type ContributionFlag,
  type CreateRunInput,
} from "@/lib/hooks/usePayrollRuns";

/**
 * The Run Payroll dialog, ported from the legacy Blazor page
 * (`HRIZ_Payroll.razor`). Two columns: the run form on the left, employee
 * selection on the right.
 *
 * Contributions are Full / Half / None ('2' / '1' / '0') — NOT on/off. "Half"
 * splits the monthly contribution across the month's two cutoffs, which is how
 * semi-monthly payroll collects SSS/PHIC/HDMF. Tax is With/Without only.
 *
 * Types PY3 (13th Month) and PY4 (Reimbursement) hide the attendance date
 * range, matching the legacy behaviour — they are not computed from timekeeping.
 *
 * The employee grid is paginated SERVER-side (`/api/payroll/employees`), so the
 * selection has to be tracked as a set of ids that outlives the visible page.
 * "Select all N matching" fetches ids through `idsOnly=1` rather than walking
 * every page.
 */

/** Types that are not derived from an attendance period. */
const NO_ATTENDANCE_TYPES = ["PY3", "PY4"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PAGE_SIZE = 10;

export interface RunPayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of cutoffs a month, from `period_types.pyt_count`. */
  periodCount?: number;
  saving?: boolean;
  onSubmit: (
    input: CreateRunInput,
    employees: string[],
    action: "save" | "generate",
  ) => Promise<void> | void;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Legacy default: the current month, first cutoff, 1st-15th. */
function defaultForm() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    type: "PY1",
    month,
    year,
    period: 1,
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-15`,
    description: "",
    loan: true,
    tax: "2" as "2" | "0",
    sss: "2" as ContributionFlag,
    philhealth: "2" as ContributionFlag,
    pagibig: "2" as ContributionFlag,
  };
}

/** Full / Half / None as a segmented control. */
function ModeToggle({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="grid grid-cols-3 items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="col-span-2 flex overflow-hidden rounded-md border bg-background">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 px-2 py-1.5 text-xs font-medium transition-colors",
              value === o.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RunPayrollDialog({ open, ...props }: RunPayrollDialogProps) {
  // The body mounts only while the dialog is open, so every open starts from
  // `defaultForm()` without an effect resetting state after the fact.
  return (
    <Dialog open={open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-[min(96vw,1100px)] sm:max-w-[min(96vw,1100px)]">
        {open && <RunPayrollForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function RunPayrollForm({
  onOpenChange,
  periodCount = 2,
  saving = false,
  onSubmit,
}: Omit<RunPayrollDialogProps, "open">) {
  const [form, setForm] = useState(defaultForm);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [descTouched, setDescTouched] = useState(false);

  // `searchInput` is what the user sees; `search` is the debounced value the
  // server actually queries on.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filters = { page, limit: PAGE_SIZE, search };
  const employees = usePayrollEmployees(filters);
  const allIds = useAllMatchingEmployeeIds();
  const types = usePayrollTypes();

  const rows = employees.data?.data ?? [];
  const meta = employees.data?.meta;
  const needsAttendance = !NO_ATTENDANCE_TYPES.includes(form.type);

  const onSearchChange = (v: string) => {
    setSearchInput(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setSearch(v);
      setPage(1);
    }, 300);
  };

  // Legacy `ChangeDesc()`: the description tracks month/year and the date
  // range until the user types their own.
  const autoDescription = useMemo(
    () => `${MONTHS[form.month - 1]} ${form.year} Payroll: ${form.from}-${form.to}`,
    [form.month, form.year, form.from, form.to],
  );
  const description = descTouched ? form.description : autoDescription;

  const pageAllSelected = rows.length > 0 && rows.every((e) => selected.has(e.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = (checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of rows) {
        if (checked) next.add(e.id);
        else next.delete(e.id);
      }
      return next;
    });

  const selectAllMatching = async () => {
    const ids = await allIds.mutateAsync(filters);
    setSelected((prev) => new Set([...prev, ...ids]));
  };

  const submit = (action: "save" | "generate") =>
    onSubmit(
      {
        month: form.month,
        year: form.year,
        period: form.period,
        from: form.from,
        to: form.to,
        description,
        type: form.type,
        loan: form.loan,
        tax: form.tax,
        sss: form.sss,
        philhealth: form.philhealth,
        pagibig: form.pagibig,
      },
      [...selected],
      action,
    );

  const periodOptions = Array.from({ length: Math.max(periodCount, 1) }, (_, i) => i + 1);
  const ordinal = (p: number) =>
    `${p}${p === 1 ? "st" : p === 2 ? "nd" : p === 3 ? "rd" : "th"} Period`;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Run Payroll</DialogTitle>
        <DialogDescription>
          Set the period and deductions, choose who to include, then generate.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* ---------------- left: the run form ---------------- */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rp-type">Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger id="rp-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(types.data ?? [{ pyt_code: "PY1", pyt_desc: "Regular" }]).map((t) => (
                  <SelectItem key={t.pyt_code} value={t.pyt_code}>
                    {t.pyt_desc ?? t.pyt_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="rp-month">Month</Label>
              <Select
                value={String(form.month)}
                onValueChange={(v) => setForm((f) => ({ ...f, month: Number(v) }))}
              >
                <SelectTrigger id="rp-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-year">Year</Label>
              <Input
                id="rp-year"
                type="number"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rp-period">Period</Label>
            <Select
              value={String(form.period)}
              onValueChange={(v) => setForm((f) => ({ ...f, period: Number(v) }))}
            >
              <SelectTrigger id="rp-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    {ordinal(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsAttendance && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="rp-from">Attendance from</Label>
                <Input
                  id="rp-from"
                  type="date"
                  value={form.from}
                  onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-to">Attendance to</Label>
                <Input
                  id="rp-to"
                  type="date"
                  min={form.from}
                  value={form.to}
                  onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rp-desc">Description</Label>
            <Input
              id="rp-desc"
              value={description}
              onChange={(e) => {
                setDescTouched(true);
                setForm((f) => ({ ...f, description: e.target.value }));
              }}
            />
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Loan Deduction
            </h3>
            <div className="flex items-center gap-2">
              <Checkbox
                id="rp-loan"
                checked={form.loan}
                onCheckedChange={(v) => setForm((f) => ({ ...f, loan: v === true }))}
              />
              <Label htmlFor="rp-loan" className="cursor-pointer font-normal">
                Load Loan
              </Label>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Government Contributions
            </h3>
            <div className="space-y-2">
              <ModeToggle
                label="Tax"
                value={form.tax}
                onChange={(v) => setForm((f) => ({ ...f, tax: v as "2" | "0" }))}
                options={[
                  { value: "2", label: "With" },
                  { value: "0", label: "Without" },
                ]}
              />
              {(
                [
                  ["SSS", "sss"],
                  ["PHIC", "philhealth"],
                  ["HDMF", "pagibig"],
                ] as const
              ).map(([label, key]) => (
                <ModeToggle
                  key={key}
                  label={label}
                  value={form[key]}
                  onChange={(v) => setForm((f) => ({ ...f, [key]: v as ContributionFlag }))}
                  options={[
                    { value: "2", label: "Full" },
                    { value: "1", label: "Half" },
                    { value: "0", label: "None" },
                  ]}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ---------------- right: employee selection ---------------- */}
        <div className="flex min-w-0 flex-col">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Employee Selection</h3>
              {selected.size > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {selected.size} selected
                </span>
              )}
            </div>
            <div className="relative w-60">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8 pr-8"
                placeholder="Search id, name…"
                value={searchInput}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => onSearchChange("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox
                      checked={pageAllSelected}
                      onCheckedChange={(v) => togglePage(v === true)}
                      aria-label="Select all on this page"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">Id</th>
                  <th className="px-3 py-2.5 text-left font-medium">Employee</th>
                  <th className="px-3 py-2.5 text-left font-medium">Location</th>
                  <th className="px-3 py-2.5 text-left font-medium">Department</th>
                  <th className="px-3 py-2.5 text-left font-medium">Position</th>
                </tr>
              </thead>
              <tbody>
                {employees.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td colSpan={6} className="px-3 py-2.5">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    </tr>
                  ))
                ) : employees.isError ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-destructive">
                      Could not load employees.
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                      {search ? `No employees match “${search}”.` : "No active employees."}
                    </td>
                  </tr>
                ) : (
                  rows.map((e) => {
                    const isSelected = selected.has(e.id);
                    return (
                      <tr
                        key={e.id}
                        onClick={() => toggle(e.id)}
                        className={cn(
                          "cursor-pointer border-b transition-colors last:border-0",
                          isSelected ? "bg-primary/5" : "hover:bg-muted/40",
                        )}
                      >
                        <td className="px-3 py-2">
                          <Checkbox checked={isSelected} aria-label={`Select ${e.name}`} />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {e.id}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {e.name}
                          {!e.payable && (
                            <span
                              className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-normal text-amber-600 dark:text-amber-400"
                              title="No active salary record — this employee will be skipped"
                            >
                              no salary
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{e.location ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{e.department ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{e.position ?? "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {meta && (
            <Pagination meta={meta} onPageChange={setPage} className="mt-3 pt-3" />
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {meta && meta.total > rows.length && (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs"
                disabled={allIds.isPending}
                onClick={selectAllMatching}
              >
                {allIds.isPending
                  ? "Selecting…"
                  : `Select all ${meta.total} matching`}
              </Button>
            )}
            {selected.size > 0 && (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </Button>
            )}
            <span>Select none to include every payable employee.</span>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button variant="secondary" disabled={saving} onClick={() => submit("save")}>
          Save
        </Button>
        <Button disabled={saving} onClick={() => submit("generate")}>
          {saving ? "Working…" : "Generate"}
        </Button>
      </DialogFooter>
    </>
  );
}

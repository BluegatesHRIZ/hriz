"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Pagination } from "@/components/ui/Pagination";
import { Save, Undo2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  useSchedulesList,
  useSaveScheduleGrid,
} from "@/lib/hooks/useSchedules";
import type {
  DatedScheduleDay,
  DatedScheduleEntry,
  DatedScheduleGridEmployee,
} from "@/lib/types";
import {
  ScheduleFilterBar,
  EMPTY_FILTERS,
  type ScheduleFilters,
} from "./ScheduleFilterBar";
import { ScheduleCellForm, type CellStatus } from "./ScheduleCellForm";
import {
  DateRangeFields,
  rangeError,
  weekRange,
  type DateRange,
} from "./DateRangeFields";
import {
  CELL_HELP,
  cellText,
  dayFromCell,
  parseCellText,
  sameDay,
  toDatedDay,
  toDayValue,
  weeklyFor,
} from "./scheduleDates";
import {
  formatShortDate,
  listDates,
  weekdayOf,
} from "@/lib/utils/scheduleDates";

/** An unsaved cell. `day: null` clears the date's saved entry. */
interface Draft {
  empId: string;
  date: string;
  day: DatedScheduleDay | null;
}

const draftKey = (empId: string, date: string) => `${empId}|${date}`;

type CommitResult = { text: string } | { error: string };

// ---------------------------------------------------------------------------
// One editable cell
// ---------------------------------------------------------------------------

interface ScheduleCellProps {
  row: number;
  col: number;
  text: string;
  /** Grey hint shown when the cell is empty (the weekly schedule). */
  placeholder: string;
  hint?: string;
  locked: boolean;
  dirty: boolean;
  muted: boolean;
  /** This cell's form is open. */
  active: boolean;
  /** The form, rendered only for the active cell. */
  form: ReactNode;
  onCommit: (row: number, col: number, text: string) => CommitResult;
  onPasteBlock: (row: number, col: number, data: string) => void;
  onMove: (row: number, col: number) => void;
  onActivate: (row: number, col: number) => void;
  onClose: () => void;
}

const ScheduleCell = memo(function ScheduleCell({
  row,
  col,
  text,
  placeholder,
  hint,
  locked,
  dirty,
  muted,
  active,
  form,
  onCommit,
  onPasteBlock,
  onMove,
  onActivate,
  onClose,
}: ScheduleCellProps) {
  const [value, setValue] = useState(text);
  const [error, setError] = useState<string | null>(null);

  // Show the new value when the cell changes from outside (paste, editor,
  // save, discard). Adjusting state during render avoids an extra effect pass.
  const [shownText, setShownText] = useState(text);
  if (text !== shownText) {
    setShownText(text);
    setValue(text);
    setError(null);
  }

  /** Returns false when the typed text could not be read. */
  const commit = (): boolean => {
    if (locked || value === text) return true;
    const result = onCommit(row, col, value);
    if ("error" in result) {
      setError(result.error);
      return false;
    }
    setError(null);
    setValue(result.text);
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd =
      el.selectionStart === el.value.length &&
      el.selectionEnd === el.value.length;
    let move: [number, number] | null = null;
    if (e.key === "Enter") move = [e.shiftKey ? -1 : 1, 0];
    else if (e.key === "ArrowDown") move = [1, 0];
    else if (e.key === "ArrowUp") move = [-1, 0];
    else if (e.key === "ArrowLeft" && atStart) move = [0, -1];
    else if (e.key === "ArrowRight" && atEnd) move = [0, 1];
    else if (e.key === "Escape") {
      setValue(text);
      setError(null);
      return;
    }
    if (!move) return;
    e.preventDefault();
    if (commit()) onMove(row + move[0], col + move[1]);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const data = e.clipboardData.getData("text/plain");
    if (!/[\t\n]/.test(data.trim())) return; // single value: normal paste
    e.preventDefault();
    onPasteBlock(row, col, data);
  };

  const state = error
    ? "ring-2 ring-inset ring-red-500"
    : dirty
      ? "bg-amber-500/15"
      : "";

  return (
    <Popover open={active} onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor asChild>
        <td
          className={`border-b border-r p-0 ${state} ${active ? "ring-2 ring-inset ring-primary" : ""}`}
        >
          <input
            data-cell={`${row}:${col}`}
            value={value}
            readOnly={locked}
            placeholder={placeholder}
            title={
              error ??
              (locked
                ? "From the employee's approved schedule change request"
                : hint)
            }
            aria-invalid={!!error}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onClick={() => !locked && onActivate(row, col)}
            onBlur={commit}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            className={`h-10 w-full min-w-[104px] cursor-pointer bg-transparent px-2 text-center text-xs outline-none placeholder:text-muted-foreground/40 focus:cursor-text focus:ring-2 focus:ring-inset focus:ring-primary ${
              locked
                ? "cursor-default italic text-muted-foreground underline decoration-dotted"
                : muted
                  ? "text-muted-foreground"
                  : ""
            }`}
          />
        </td>
      </PopoverAnchor>
      {active && (
        <PopoverContent
          align="start"
          className="w-72"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {form}
        </PopoverContent>
      )}
    </Popover>
  );
});

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export function ScheduleGridPanel() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [range, setRange] = useState<DateRange>(() => weekRange(0, 2));
  const rangeInvalid = rangeError(range);

  const listQuery = useSchedulesList({ ...filters, page, limit: 10 }, range);
  const saveGrid = useSaveScheduleGrid();

  const handleFilterChange = (next: ScheduleFilters) => {
    setFilters(next);
    setPage(1);
  };

  const dates = useMemo(
    () => (rangeInvalid ? [] : listDates(range.from, range.to)),
    [range, rangeInvalid],
  );
  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
  const meta = listQuery.data?.meta;

  // Saved entries for the visible page, by employee and date.
  const saved = useMemo(() => {
    const map = new Map<string, DatedScheduleEntry>();
    rows.forEach((r) =>
      r.days.forEach((d) => map.set(draftKey(r.emp_id, d.date), d)),
    );
    return map;
  }, [rows]);

  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const draftCount = drafts.size;

  // What a cell holds right now: its unsaved draft, else what is saved.
  const effective = useCallback(
    (empId: string, date: string): DatedScheduleDay | undefined => {
      const key = draftKey(empId, date);
      const draft = drafts.get(key);
      if (draft) return draft.day ?? undefined;
      return saved.get(key);
    },
    [drafts, saved],
  );

  useEffect(() => {
    if (!draftCount) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftCount]);

  /** Record a new value for one cell, dropping the draft if it matches what is saved. */
  const putDraft = useCallback(
    (
      next: Map<string, Draft>,
      empId: string,
      date: string,
      day: DatedScheduleDay | null,
    ) => {
      const key = draftKey(empId, date);
      const savedEntry = saved.get(key);
      if (day === null) {
        if (savedEntry) next.set(key, { empId, date, day: null });
        else next.delete(key);
      } else if (savedEntry && sameDay(savedEntry, day)) {
        next.delete(key);
      } else {
        next.set(key, { empId, date, day });
      }
    },
    [saved],
  );

  /** Parse typed text for a cell into a draft. */
  const commitText = useCallback(
    (
      next: Map<string, Draft>,
      rowIndex: number,
      colIndex: number,
      text: string,
    ): CommitResult => {
      const row = rows[rowIndex];
      const date = dates[colIndex];
      if (!row || !date) return { error: "Out of range" };
      const key = draftKey(row.emp_id, date);
      if (saved.get(key)?.source === "request") {
        return { error: "Set by the employee's approved request" };
      }
      const input = parseCellText(text);
      if (input.kind === "error") return { error: input.message };
      if (input.kind === "clear") {
        putDraft(next, row.emp_id, date, null);
        return { text: "" };
      }
      const current = next.has(key)
        ? next.get(key)!.day
        : (saved.get(key) ?? null);
      const day = dayFromCell(
        input,
        date,
        current ?? weeklyFor(row.weekly, date) ?? null,
      );
      putDraft(next, row.emp_id, date, day);
      return { text: cellText(day) };
    },
    [rows, dates, saved, putDraft],
  );

  const onCommit = useCallback(
    (rowIndex: number, colIndex: number, text: string): CommitResult => {
      const next = new Map(drafts);
      const result = commitText(next, rowIndex, colIndex, text);
      if (!("error" in result)) setDrafts(next);
      return result;
    },
    [drafts, commitText],
  );

  const tableRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<{ row: number; col: number } | null>(
    null,
  );
  const onActivate = useCallback(
    (row: number, col: number) => setActive({ row, col }),
    [],
  );
  const onClose = useCallback(() => setActive(null), []);

  const onMove = useCallback((row: number, col: number) => {
    setActive(null);
    const el = tableRef.current?.querySelector<HTMLInputElement>(
      `[data-cell="${row}:${col}"]`,
    );
    el?.focus();
  }, []);

  /** Paste a block copied from a spreadsheet, starting at this cell. */
  const onPasteBlock = useCallback(
    (rowIndex: number, colIndex: number, data: string) => {
      const lines = data.replace(/\r/g, "").split("\n");
      if (lines[lines.length - 1] === "") lines.pop();
      const next = new Map(drafts);
      let filled = 0;
      let failed = 0;
      lines.forEach((line, i) => {
        line.split("\t").forEach((cell, j) => {
          const r = rowIndex + i;
          const c = colIndex + j;
          if (r >= rows.length || c >= dates.length) return;
          if (
            saved.get(draftKey(rows[r].emp_id, dates[c]))?.source === "request"
          )
            return;
          const result = commitText(next, r, c, cell);
          if ("error" in result) failed += 1;
          else filled += 1;
        });
      });
      setDrafts(next);
      toast({
        title: `Pasted ${filled} cell${filled === 1 ? "" : "s"}`,
        description: failed
          ? `${failed} cell${failed === 1 ? "" : "s"} couldn't be read and ${failed === 1 ? "was" : "were"} skipped. ${CELL_HELP}`
          : "Review, then save changes.",
        variant: failed ? "destructive" : undefined,
      });
    },
    [drafts, rows, dates, saved, commitText, toast],
  );

  const discard = async () => {
    const ok = await confirm({
      title: "Discard unsaved changes?",
      description: `${draftCount} changed cell${draftCount === 1 ? "" : "s"} will go back to what is saved.`,
      confirmText: "Discard",
    });
    if (ok) setDrafts(new Map());
  };

  const save = async () => {
    const byEmp = new Map<string, DatedScheduleGridEmployee>();
    for (const d of drafts.values()) {
      const entry = byEmp.get(d.empId) ?? {
        empId: d.empId,
        days: [],
        clearDates: [],
      };
      if (d.day) entry.days.push(d.day);
      else entry.clearDates.push(d.date);
      byEmp.set(d.empId, entry);
    }
    const employees = [...byEmp.values()];
    const cleared = employees.reduce((n, e) => n + e.clearDates.length, 0);
    const ok = await confirm({
      title: `Save ${draftCount} change${draftCount === 1 ? "" : "s"}?`,
      description: `${employees.length} employee${employees.length === 1 ? "" : "s"}: ${draftCount - cleared} date${draftCount - cleared === 1 ? "" : "s"} set${cleared ? `, ${cleared} cleared` : ""}.`,
      confirmText: "Save changes",
    });
    if (!ok) return;
    try {
      const res = await saveGrid.mutateAsync({ employees });
      setDrafts(new Map());
      toast({ title: "Saved", description: res.message });
    } catch (error) {
      toast({
        title: "Couldn't save",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  /** The form for the open cell. Every change goes straight into the drafts. */
  const renderForm = (rowIndex: number, colIndex: number): ReactNode => {
    const row = rows[rowIndex];
    const date = dates[colIndex];
    if (!row || !date) return null;
    const key = draftKey(row.emp_id, date);
    const current = effective(row.emp_id, date);
    const weekly = weeklyFor(row.weekly, date);
    const status: CellStatus =
      drafts.has(key) && current
        ? "unsaved"
        : current
          ? "set"
          : weekly
            ? "weekly"
            : "none";
    const value = toDayValue(current ?? weekly, date);
    const write = (day: DatedScheduleDay | null) => {
      const next = new Map(drafts);
      putDraft(next, row.emp_id, date, day);
      setDrafts(next);
    };
    return (
      <ScheduleCellForm
        date={date}
        value={value}
        status={status}
        onChange={(v) => write(toDatedDay({ ...v, date }))}
        onClear={() => write(null)}
        onDone={() => {
          if (!current) write(toDatedDay({ ...value, date }));
          setActive(null);
        }}
      />
    );
  };

  const columns = dates.length + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFields value={range} onChange={setRange} />
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <Badge variant="secondary">
              {draftCount} unsaved change{draftCount === 1 ? "" : "s"}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={discard}
            disabled={!draftCount || saveGrid.isPending}
          >
            <Undo2 className="mr-2 h-4 w-4" /> Discard
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={!draftCount || saveGrid.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveGrid.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
      <ScheduleFilterBar value={filters} onChange={handleFilterChange} />

      <div className="rounded-lg border" ref={tableRef}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="sticky left-0 z-20 border-b border-r bg-muted p-2 text-left min-w-[200px]">
                  Employee
                </th>
                {dates.map((date) => {
                  const weekday = weekdayOf(date);
                  const weekend =
                    weekday === "SATURDAY" || weekday === "SUNDAY";
                  return (
                    <th
                      key={date}
                      className={`border-b border-r p-2 text-center font-medium whitespace-nowrap ${
                        weekend ? "text-muted-foreground" : ""
                      }`}
                    >
                      {formatShortDate(date)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rangeInvalid ? (
                <tr>
                  <td colSpan={columns} className="p-4 text-muted-foreground">
                    Pick a valid date range.
                  </td>
                </tr>
              ) : listQuery.isLoading ? (
                <tr>
                  <td colSpan={columns} className="p-4 text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : listQuery.isError ? (
                <tr>
                  <td colSpan={columns} className="p-4 text-red-500">
                    Failed to load employees.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns} className="p-4 text-muted-foreground">
                    No employees found.
                  </td>
                </tr>
              ) : (
                rows.map((row, r) => (
                  <tr key={row.emp_id} className="hover:bg-muted/20">
                    <td className="sticky left-0 z-10 border-b border-r bg-card px-2 py-1.5">
                      <div className="truncate font-medium">
                        {row.emp_name || row.emp_id}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {row.emp_id}
                        {row.emp_dept_desc ? ` · ${row.emp_dept_desc}` : ""}
                      </div>
                    </td>
                    {dates.map((date, c) => {
                      const key = draftKey(row.emp_id, date);
                      const value = effective(row.emp_id, date);
                      const weekly = weeklyFor(row.weekly, date);
                      const isActive = active?.row === r && active?.col === c;
                      return (
                        <ScheduleCell
                          key={date}
                          row={r}
                          col={c}
                          text={cellText(value)}
                          placeholder={weekly ? cellText(weekly) : "Not set"}
                          hint={
                            value
                              ? "Click to change"
                              : weekly
                                ? "Weekly schedule. Click to set something else for this date."
                                : "No schedule. Click to set one."
                          }
                          locked={saved.get(key)?.source === "request"}
                          dirty={drafts.has(key)}
                          muted={!!value?.sch_rest}
                          active={isActive}
                          form={isActive ? renderForm(r, c) : null}
                          onCommit={onCommit}
                          onPasteBlock={onPasteBlock}
                          onMove={onMove}
                          onActivate={onActivate}
                          onClose={onClose}
                        />
                      );
                    })}
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
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          Click a cell to set time in, time out, rest day, break and shift for
          that date. Faint grey times are the employee&apos;s weekly schedule,
          which applies when nothing is set for the date.
        </p>
        <p>
          You can also type straight into a cell: {CELL_HELP} Enter or the arrow
          keys move between cells, Esc undoes what you typed, and you can paste
          a block copied from Excel.
        </p>
        <p>
          <span className="rounded bg-amber-500/15 px-1">Highlighted</span>{" "}
          cells aren&apos;t saved yet.{" "}
          <span className="italic underline decoration-dotted">Italic</span>{" "}
          dates come from the employee&apos;s own approved schedule change
          request and can&apos;t be changed here.
        </p>
      </div>
    </div>
  );
}

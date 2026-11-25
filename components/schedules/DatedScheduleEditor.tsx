"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Clipboard } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SHIFTS, applyDayUpdate, formatDayName } from "./scheduleDays";
import type { DatedDayValue } from "./scheduleDates";
import { formatShortDate } from "@/lib/utils/scheduleDates";

interface DatedScheduleEditorProps {
  days: DatedDayValue[];
  onChange: (days: DatedDayValue[]) => void;
  /**
   * Show a "Set" column so a date can be left without an entry. Used when
   * editing one employee; unset dates are cleared on save.
   */
  allowUnset?: boolean;
}

type CopyTarget = "all" | "weekday" | "weekdays" | "weekends";

const WEEKEND = new Set(["SATURDAY", "SUNDAY"]);

function matchesTarget(
  target: CopyTarget,
  source: DatedDayValue,
  day: DatedDayValue
): boolean {
  switch (target) {
    case "all":
      return true;
    case "weekday":
      return day.sch_day === source.sch_day;
    case "weekdays":
      return !WEEKEND.has(day.sch_day);
    case "weekends":
      return WEEKEND.has(day.sch_day);
  }
}

const dash = <span className="text-muted-foreground">-</span>;

/**
 * One row per date: rest/break toggles, times, auto-calculated hours, shift,
 * and a "copy this date to..." menu. Dates covered by the employee's own
 * approved request are shown read-only.
 */
export function DatedScheduleEditor({
  days,
  onChange,
  allowUnset = false,
}: DatedScheduleEditorProps) {
  const [copyOpen, setCopyOpen] = useState<string | null>(null);

  const update = (index: number, updates: Partial<DatedDayValue>) => {
    const next = [...days];
    next[index] = applyDayUpdate(next[index], updates);
    onChange(next);
  };

  const setRow = (index: number, set: boolean) => {
    const next = [...days];
    next[index] = { ...next[index], set };
    onChange(next);
  };

  const copyTo = (source: DatedDayValue, target: CopyTarget) => {
    onChange(
      days.map((d) =>
        d.date !== source.date && !d.locked && matchesTarget(target, source, d)
          ? {
              ...d,
              sch_in: source.sch_in,
              sch_out: source.sch_out,
              sch_bin: source.sch_bin,
              sch_bout: source.sch_bout,
              sch_hrs: source.sch_hrs,
              sch_rest: source.sch_rest,
              sch_shift: source.sch_shift,
              have_break: source.have_break,
              set: true,
            }
          : d
      )
    );
    setCopyOpen(null);
  };

  const columns = allowUnset ? 11 : 10;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {allowUnset && (
                <th className="border p-2 text-center min-w-[44px]">Set</th>
              )}
              <th className="border p-2 text-left min-w-[110px]">Date</th>
              <th className="border p-2 text-center min-w-[50px]">Rest</th>
              <th className="border p-2 text-center min-w-[50px]">Break</th>
              <th className="border p-2 text-center min-w-[110px]">In</th>
              <th className="border p-2 text-center min-w-[110px]">Break In</th>
              <th className="border p-2 text-center min-w-[110px]">Break Out</th>
              <th className="border p-2 text-center min-w-[110px]">Out</th>
              <th className="border p-2 text-center min-w-[60px]">Hours</th>
              <th className="border p-2 text-center min-w-[130px]">Shift</th>
              <th className="border p-2 text-center w-[56px]" />
            </tr>
          </thead>
          <tbody>
            {days.length === 0 && (
              <tr>
                <td colSpan={columns} className="p-4 text-muted-foreground">
                  Pick a date range to see its dates.
                </td>
              </tr>
            )}
            {days.map((sched, index) => {
              const weekend = WEEKEND.has(sched.sch_day);
              const dateCell = (
                <td className="border p-2 font-medium whitespace-nowrap">
                  <span className={weekend ? "text-muted-foreground" : ""}>
                    {formatShortDate(sched.date)}
                  </span>
                </td>
              );

              if (sched.locked) {
                return (
                  <tr key={sched.date} className="bg-muted/30">
                    {allowUnset && (
                      <td className="border p-2 text-center">{dash}</td>
                    )}
                    {dateCell}
                    <td colSpan={columns - (allowUnset ? 2 : 1)} className="border p-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="secondary">Employee request</Badge>
                        <span className="text-muted-foreground">
                          {sched.sch_rest
                            ? "Rest day"
                            : `${sched.sch_in}-${sched.sch_out}`}
                          {" · "}
                          set by an approved schedule change; not changed here
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }

              if (!sched.set) {
                return (
                  <tr key={sched.date} className="hover:bg-muted/40">
                    <td className="border p-2 text-center">
                      <Checkbox
                        checked={false}
                        onCheckedChange={(c) => setRow(index, c === true)}
                        aria-label={`Set ${sched.date}`}
                      />
                    </td>
                    {dateCell}
                    <td
                      colSpan={columns - 2}
                      className="border p-2 text-xs text-muted-foreground"
                    >
                      Not set
                    </td>
                  </tr>
                );
              }

              const exempt = sched.sch_shift === "E";
              const working = !exempt && !sched.sch_rest;
              const showBreak = working && sched.have_break;
              const timeInput = (
                field: "sch_in" | "sch_bin" | "sch_bout" | "sch_out",
                show: boolean
              ) => (
                <td className="border p-2">
                  {show ? (
                    <Input
                      type="time"
                      value={sched[field]}
                      onChange={(e) =>
                        update(index, {
                          [field]: e.target.value,
                        } as Partial<DatedDayValue>)
                      }
                      className="w-full"
                    />
                  ) : (
                    dash
                  )}
                </td>
              );

              return (
                <tr key={sched.date} className="hover:bg-muted/40">
                  {allowUnset && (
                    <td className="border p-2 text-center">
                      <Checkbox
                        checked
                        onCheckedChange={(c) => setRow(index, c === true)}
                        aria-label={`Unset ${sched.date}`}
                      />
                    </td>
                  )}
                  {dateCell}
                  <td className="border p-2 text-center">
                    <Checkbox
                      checked={sched.sch_rest}
                      onCheckedChange={(c) =>
                        update(index, { sch_rest: c === true })
                      }
                    />
                  </td>
                  <td className="border p-2 text-center">
                    {working ? (
                      <Checkbox
                        checked={sched.have_break}
                        onCheckedChange={(c) =>
                          update(index, { have_break: c === true })
                        }
                      />
                    ) : (
                      dash
                    )}
                  </td>
                  {timeInput("sch_in", working)}
                  {timeInput("sch_bin", showBreak)}
                  {timeInput("sch_bout", showBreak)}
                  {timeInput("sch_out", working)}
                  <td className="border p-2 text-center">
                    {!exempt ? sched.sch_hrs.toFixed(2) : dash}
                  </td>
                  <td className="border p-2">
                    <Select
                      value={sched.sch_shift}
                      onValueChange={(v) => update(index, { sch_shift: v })}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIFTS.map((shift) => (
                          <SelectItem key={shift.id} value={shift.id}>
                            {shift.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border p-2 text-center">
                    <Popover
                      open={copyOpen === sched.date}
                      onOpenChange={(open) =>
                        setCopyOpen(open ? sched.date : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" title="Copy this date to…">
                          <Clipboard className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2">
                        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                          Copy {formatShortDate(sched.date)} to
                        </p>
                        {(
                          [
                            ["weekday", `Every ${formatDayName(sched.sch_day)}`],
                            ["weekdays", "Every Mon-Fri"],
                            ["weekends", "Every Sat-Sun"],
                            ["all", "All dates"],
                          ] as [CopyTarget, string][]
                        ).map(([target, label]) => (
                          <Button
                            key={target}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => copyTo(sched, target)}
                          >
                            {label}
                          </Button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

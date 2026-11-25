"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  MAX_SCHEDULE_RANGE_DAYS,
  addDays,
  rangeLength,
  startOfWeek,
} from "@/lib/utils/scheduleDates";

export interface DateRange {
  from: string;
  to: string;
}

/** Today in the browser's local calendar, as YYYY-MM-DD. */
export function todayIso(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** Monday to Sunday of the week `weeksAhead` weeks from this one. */
export function weekRange(weeksAhead = 0, weeks = 1): DateRange {
  const from = addDays(startOfWeek(todayIso()), weeksAhead * 7);
  return { from, to: addDays(from, weeks * 7 - 1) };
}

/** Null when the range is usable, otherwise why not. */
export function rangeError(range: DateRange): string | null {
  if (!range.from || !range.to) return "Pick a start and end date.";
  const n = rangeLength(range.from, range.to);
  if (n === 0) return "The end date is before the start date.";
  if (n > MAX_SCHEDULE_RANGE_DAYS) {
    return `Pick ${MAX_SCHEDULE_RANGE_DAYS} days or fewer.`;
  }
  return null;
}

interface DateRangeFieldsProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

/** From / To date inputs with quick week shortcuts. */
export function DateRangeFields({ value, onChange }: DateRangeFieldsProps) {
  const error = rangeError(value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="sched-from" className="text-xs">
            From
          </Label>
          <Input
            id="sched-from"
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sched-to" className="text-xs">
            To
          </Label>
          <Input
            id="sched-to"
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="w-40"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => onChange(weekRange(0))}>
          This week
        </Button>
        <Button variant="outline" size="sm" onClick={() => onChange(weekRange(1))}>
          Next week
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(weekRange(0, 2))}
        >
          2 weeks
        </Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

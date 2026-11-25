"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SHIFTS, applyDayUpdate, type ScheduleDayValue } from "./scheduleDays";
import { formatShortDate } from "@/lib/utils/scheduleDates";

/** Where the values shown in the form come from. */
export type CellStatus = "unsaved" | "set" | "weekly" | "none";

const STATUS_LABEL: Record<CellStatus, string> = {
  unsaved: "Not saved yet",
  set: "Set for this date",
  weekly: "From the weekly schedule",
  none: "Not set",
};

interface ScheduleCellFormProps {
  date: string;
  value: ScheduleDayValue;
  status: CellStatus;
  /** Called with the whole day whenever a field changes. */
  onChange: (value: ScheduleDayValue) => void;
  /** Remove this date's entry (back to the weekly schedule). */
  onClear: () => void;
  onDone: () => void;
}

/**
 * Small form opened from a grid cell: time in, time out, rest day, break and
 * shift for one employee on one date.
 */
export function ScheduleCellForm({
  date,
  value,
  status,
  onChange,
  onClear,
  onDone,
}: ScheduleCellFormProps) {
  const update = (updates: Partial<ScheduleDayValue>) =>
    onChange(applyDayUpdate(value, updates));

  const exempt = value.sch_shift === "E";
  const working = !value.sch_rest && !exempt;
  const isSet = status === "set" || status === "unsaved";

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{formatShortDate(date)}</span>
        <span className="text-xs text-muted-foreground">
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="cell-rest" className="text-sm">
          Rest day
        </Label>
        <Switch
          id="cell-rest"
          checked={value.sch_rest}
          onCheckedChange={(c) => update({ sch_rest: c })}
        />
      </div>

      {!value.sch_rest && (
        <>
          {working && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Time in
                  </Label>
                  <Input
                    type="time"
                    value={value.sch_in}
                    onChange={(e) => update({ sch_in: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Time out
                  </Label>
                  <Input
                    type="time"
                    value={value.sch_out}
                    onChange={(e) => update({ sch_out: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="cell-break" className="text-sm">
                  Break
                </Label>
                <Switch
                  id="cell-break"
                  checked={value.have_break}
                  onCheckedChange={(c) => update({ have_break: c })}
                />
              </div>
              {value.have_break && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Break start
                    </Label>
                    <Input
                      type="time"
                      value={value.sch_bin}
                      onChange={(e) => update({ sch_bin: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Break end
                    </Label>
                    <Input
                      type="time"
                      value={value.sch_bout}
                      onChange={(e) => update({ sch_bout: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {value.sch_hrs.toFixed(2)} working hours
              </p>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Shift</Label>
            <div className="grid grid-cols-4 gap-1">
              {SHIFTS.map((s) => (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={value.sch_shift === s.id ? "default" : "outline"}
                  className="h-7 px-1 text-xs"
                  onClick={() => update({ sch_shift: s.id })}
                  title={s.name}
                >
                  {s.name.split(" ")[0]}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={!isSet}
          title="Go back to the weekly schedule for this date"
        >
          Clear date
        </Button>
        <Button type="button" size="sm" onClick={onDone}>
          {isSet ? "Done" : "Set this date"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DAYS,
  SHIFTS,
  type ScheduleDayValue,
  applyDayUpdate,
  formatDayName,
} from "./scheduleDays";

interface ScheduleDayEditorProps {
  days: ScheduleDayValue[];
  onChange: (days: ScheduleDayValue[]) => void;
}

/**
 * The shared 7-day weekly schedule editor: per-day rest/break toggles, time
 * inputs, auto-calculated hours, shift selector, and a "copy this day to other
 * days" popover. Driven entirely by `days` + `onChange` so it can be reused for
 * the bulk template builder and (in future) the employee Work Schedule tab.
 */
export function ScheduleDayEditor({ days, onChange }: ScheduleDayEditorProps) {
  const [copyDayOpen, setCopyDayOpen] = useState<string | null>(null);
  const [copyTargets, setCopyTargets] = useState<Record<string, boolean>>({});

  const update = (index: number, updates: Partial<ScheduleDayValue>) => {
    const next = [...days];
    next[index] = applyDayUpdate(next[index], updates);
    onChange(next);
  };

  const copyDayTo = (sourceDay: string) => {
    const source = days.find((d) => d.sch_day === sourceDay);
    if (!source) return;
    const next = days.map((d) =>
      copyTargets[d.sch_day] && d.sch_day !== sourceDay
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
          }
        : d
    );
    onChange(next);
    setCopyDayOpen(null);
    setCopyTargets({});
  };

  const allChecked = DAYS.every((d) => copyTargets[d]);
  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    DAYS.forEach((d) => (next[d] = checked));
    setCopyTargets(next);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="border p-2 text-left min-w-[90px]">Day</th>
              <th className="border p-2 text-center min-w-[50px]">Rest</th>
              <th className="border p-2 text-center min-w-[50px]">Break</th>
              <th className="border p-2 text-center min-w-[110px]">In</th>
              <th className="border p-2 text-center min-w-[110px]">Break In</th>
              <th className="border p-2 text-center min-w-[110px]">Break Out</th>
              <th className="border p-2 text-center min-w-[110px]">Out</th>
              <th className="border p-2 text-center min-w-[60px]">Hours</th>
              <th className="border p-2 text-center min-w-[140px]">Shift</th>
              <th className="border p-2 text-center w-[56px]" />
            </tr>
          </thead>
          <tbody>
            {days.map((sched, index) => {
              const exempt = sched.sch_shift === "E";
              const showBreak = !exempt && sched.have_break && !sched.sch_rest;
              return (
                <tr key={sched.sch_day} className="hover:bg-muted/40">
                  <td className="border p-2 font-medium">
                    {formatDayName(sched.sch_day)}
                  </td>
                  <td className="border p-2 text-center">
                    <Checkbox
                      checked={sched.sch_rest}
                      onCheckedChange={(c) =>
                        update(index, { sch_rest: c === true })
                      }
                    />
                  </td>
                  <td className="border p-2 text-center">
                    {!exempt && !sched.sch_rest ? (
                      <Checkbox
                        checked={sched.have_break}
                        onCheckedChange={(c) =>
                          update(index, { have_break: c === true })
                        }
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2">
                    {!exempt && !sched.sch_rest ? (
                      <Input
                        type="time"
                        value={sched.sch_in}
                        onChange={(e) =>
                          update(index, { sch_in: e.target.value })
                        }
                        className="w-full"
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2">
                    {showBreak ? (
                      <Input
                        type="time"
                        value={sched.sch_bin}
                        onChange={(e) =>
                          update(index, { sch_bin: e.target.value })
                        }
                        className="w-full"
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2">
                    {showBreak ? (
                      <Input
                        type="time"
                        value={sched.sch_bout}
                        onChange={(e) =>
                          update(index, { sch_bout: e.target.value })
                        }
                        className="w-full"
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2">
                    {!exempt && !sched.sch_rest ? (
                      <Input
                        type="time"
                        value={sched.sch_out}
                        onChange={(e) =>
                          update(index, { sch_out: e.target.value })
                        }
                        className="w-full"
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2 text-center">
                    {!exempt ? (
                      <span>{sched.sch_hrs.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2">
                    <div className="flex items-center gap-2">
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
                      {sched.sch_shift === "F" && (
                        <Input
                          type="number"
                          value={sched.sch_hrs}
                          onChange={(e) =>
                            update(index, {
                              sch_hrs: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-16"
                          min="0"
                          max="24"
                          step="0.5"
                        />
                      )}
                    </div>
                  </td>
                  <td className="border p-2 text-center">
                    <Popover
                      open={copyDayOpen === sched.sch_day}
                      onOpenChange={(open) => {
                        setCopyDayOpen(open ? sched.sch_day : null);
                        if (!open) setCopyTargets({});
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" title="Copy this day to…">
                          <Clipboard className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            Copy {formatDayName(sched.sch_day)} to:
                          </Label>
                          {DAYS.filter((d) => d !== sched.sch_day).map((day) => (
                            <div
                              key={day}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`copy-${sched.sch_day}-${day}`}
                                checked={!!copyTargets[day]}
                                onCheckedChange={(c) =>
                                  setCopyTargets((prev) => ({
                                    ...prev,
                                    [day]: c === true,
                                  }))
                                }
                              />
                              <Label
                                htmlFor={`copy-${sched.sch_day}-${day}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {formatDayName(day)}
                              </Label>
                            </div>
                          ))}
                          <div className="flex items-center space-x-2 pt-2 border-t">
                            <Checkbox
                              id={`copy-all-${sched.sch_day}`}
                              checked={allChecked}
                              onCheckedChange={(c) => toggleAll(c === true)}
                            />
                            <Label
                              htmlFor={`copy-all-${sched.sch_day}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              All days
                            </Label>
                          </div>
                          <Button
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => copyDayTo(sched.sch_day)}
                          >
                            Apply
                          </Button>
                        </div>
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

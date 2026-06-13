"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  SchedAdjustDetailDTO,
  SchedAdjustRequestDTO,
  useCreateScheduleAdjust,
  useScheduleAdjustById,
  useUpdateScheduleAdjust,
  useUserLeaveScheduleList,
} from "@/lib/hooks/useRequestManagement";
import { useSettings } from "@/lib/hooks/useSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/hooks/use-toast";
import { beforeAfter } from "@/lib/utils/requestLimit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const schema = z.object({
  ScaSdatefrom: z.date({ message: "From date is required" }),
  ScaSdateto: z.date({ message: "To date is required" }),
  ScaSreason: z.string().max(200, "Reason must be less than 200 characters"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  empId: string;
  scaId?: string;
  onSuccess: () => void;
}

type LocalDetail = SchedAdjustDetailDTO & {
  ScaDrest?: number;
  ScaDbreak?: number;
  ScaDShift?: string;
};

function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatHHmm(d?: Date | string): string {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return `${String(dt.getHours()).padStart(2, "0")}:${String(
    dt.getMinutes(),
  ).padStart(2, "0")}`;
}

function combineDateTime(baseDate: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((x) => Number(x || 0));
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    h || 0,
    m || 0,
    0,
    0,
  );
}

function datesBetween(start: Date, end: Date): Date[] {
  const from = dateOnly(start);
  const to = dateOnly(end);
  if (from > to) return [from];
  const result: Date[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    result.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function midpointBreak(
  shiftStart: Date,
  shiftEnd: Date,
): { breakStart: Date; breakEnd: Date } {
  const avgMs = (shiftStart.getTime() + shiftEnd.getTime()) / 2;
  const diffMs = shiftEnd.getTime() - shiftStart.getTime();
  if (diffMs >= 3 * 60 * 60 * 1000) {
    return {
      breakStart: new Date(avgMs - 30 * 60 * 1000),
      breakEnd: new Date(avgMs + 30 * 60 * 1000),
    };
  }
  return {
    breakStart: new Date(avgMs),
    breakEnd: new Date(avgMs),
  };
}

export function ScheduleAdjustRequestForm({ empId, scaId, onSuccess }: Props) {
  const { toast } = useToast();
  const { data: settings } = useSettings();
  const { data: scheduleDays } = useUserLeaveScheduleList();
  const { data: existing } = useScheduleAdjustById(scaId || "");
  const createMutation = useCreateScheduleAdjust();
  const updateMutation = useUpdateScheduleAdjust(scaId || "");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ScaSdatefrom: new Date(),
      ScaSdateto: new Date(),
      ScaSreason: "",
    },
  });

  const [details, setDetails] = useState<LocalDetail[]>([]);

  const buildDetailForDate = (date: Date): LocalDetail => {
    const dayName = date
      .toLocaleDateString("en-US", { weekday: "long" })
      .toUpperCase();
    const sched = scheduleDays?.find((s) => s.sch_day === dayName);
    const shiftIn = sched?.sch_in ?? "07:00";
    const breakIn = sched?.sch_bin ?? "11:00";
    const breakOut = sched?.sch_bout ?? "12:00";
    const shiftOut = sched?.sch_out ?? "16:00";
    const isRest = sched?.sch_rest === 1;

    return {
      ScaDdate: date,
      ScaDshiftstart: combineDateTime(date, shiftIn),
      ScaDbreakstart: combineDateTime(date, breakIn),
      ScaDbreakend: combineDateTime(date, breakOut),
      ScaDshiftend: combineDateTime(date, shiftOut),
      ScaDrest: isRest ? 1 : 0,
      ScaDbreak: isRest ? 0 : 1,
      ScaDShift: (sched?.sch_shift as string) || "R",
    };
  };

  const fromDate = form.watch("ScaSdatefrom");
  const toDate = form.watch("ScaSdateto");

  // Generate details when date range changes (new request only)
  useEffect(() => {
    if (scaId) return;
    if (!fromDate || !toDate) return;
    const range = datesBetween(fromDate, toDate);
    setDetails(range.map((d) => buildDetailForDate(d)));
  }, [scaId, fromDate, toDate, scheduleDays]);

  // Edit hydration
  useEffect(() => {
    if (!existing || !scaId) return;
    form.reset({
      ScaSdatefrom: existing.ScaSdatefrom
        ? new Date(existing.ScaSdatefrom)
        : new Date(),
      ScaSdateto: existing.ScaSdateto ? new Date(existing.ScaSdateto) : new Date(),
      ScaSreason: existing.ScaSreason || "",
    });
    const loaded: LocalDetail[] =
      existing.SchedDetail?.map((d) => ({
        ...d,
        ScaDShift: typeof d.ScaDShift === "string" ? d.ScaDShift : "R",
      })) ?? [];
    setDetails(loaded);
  }, [existing, scaId, form]);

  const updateDetail = (
    index: number,
    field: keyof LocalDetail,
    value: Date | string | number,
  ) => {
    setDetails((prev) => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };

      const isNightShift = current.ScaDShift === "N";
      const isRest = current.ScaDrest === 1;
      const hasBreak = current.ScaDbreak === 1;

      const shiftStart = current.ScaDshiftstart
        ? new Date(current.ScaDshiftstart)
        : null;
      const shiftEnd = current.ScaDshiftend ? new Date(current.ScaDshiftend) : null;
      const breakStart = current.ScaDbreakstart
        ? new Date(current.ScaDbreakstart)
        : null;
      const breakEnd = current.ScaDbreakend ? new Date(current.ScaDbreakend) : null;

      // Rest day: disable all time fields and clear values (legacy behavior).
      if (isRest) {
        current.ScaDbreak = 0;
        current.ScaDshiftstart = current.ScaDdate
          ? combineDateTime(new Date(current.ScaDdate), "00:00")
          : undefined;
        current.ScaDbreakstart = current.ScaDdate
          ? combineDateTime(new Date(current.ScaDdate), "00:00")
          : undefined;
        current.ScaDbreakend = current.ScaDdate
          ? combineDateTime(new Date(current.ScaDdate), "00:00")
          : undefined;
        current.ScaDshiftend = current.ScaDdate
          ? combineDateTime(new Date(current.ScaDdate), "00:00")
          : undefined;
      } else if (!isNightShift && shiftStart && shiftEnd) {
        // Shift bounds normalization
        if (shiftStart.getTime() > shiftEnd.getTime()) {
          if (field === "ScaDshiftstart") {
            current.ScaDshiftend = new Date(shiftStart);
            toast({
              title: "Adjusted time",
              description:
                "Shift start cannot be greater than shift end. Value has been adjusted.",
            });
          } else if (field === "ScaDshiftend") {
            current.ScaDshiftstart = new Date(shiftEnd);
            toast({
              title: "Adjusted time",
              description:
                "Shift end cannot be less than shift start. Value has been adjusted.",
            });
          }
        }

        if (hasBreak) {
          const sStart = new Date(current.ScaDshiftstart as Date | string);
          const sEnd = new Date(current.ScaDshiftend as Date | string);
          let bStart = new Date(current.ScaDbreakstart as Date | string);
          let bEnd = new Date(current.ScaDbreakend as Date | string);

          // Keep break inside shift window and preserve order.
          if (bStart.getTime() < sStart.getTime()) bStart = new Date(sStart);
          if (bStart.getTime() > sEnd.getTime()) bStart = new Date(sEnd);
          if (bEnd.getTime() < sStart.getTime()) bEnd = new Date(sStart);
          if (bEnd.getTime() > sEnd.getTime()) bEnd = new Date(sEnd);

          if (bStart.getTime() > bEnd.getTime()) {
            if (field === "ScaDbreakstart") bEnd = new Date(bStart);
            else bStart = new Date(bEnd);
            toast({
              title: "Adjusted break time",
              description: "Break range was adjusted to keep valid ordering.",
            });
          }

          current.ScaDbreakstart = bStart;
          current.ScaDbreakend = bEnd;

          if (
            (field === "ScaDshiftstart" || field === "ScaDshiftend") &&
            bStart.getTime() === 0 &&
            bEnd.getTime() === 0
          ) {
            const mid = midpointBreak(sStart, sEnd);
            current.ScaDbreakstart = mid.breakStart;
            current.ScaDbreakend = mid.breakEnd;
          }
        } else if (
          (field === "ScaDbreak" && Number(value) === 1) ||
          (field === "ScaDrest" && Number(value) === 0)
        ) {
          const mid = midpointBreak(shiftStart, shiftEnd);
          current.ScaDbreakstart = mid.breakStart;
          current.ScaDbreakend = mid.breakEnd;
          current.ScaDbreak = 1;
        } else {
          // No break
          current.ScaDbreakstart = current.ScaDdate
            ? combineDateTime(new Date(current.ScaDdate), "00:00")
            : undefined;
          current.ScaDbreakend = current.ScaDdate
            ? combineDateTime(new Date(current.ScaDdate), "00:00")
            : undefined;
        }
      }

      // If rest is toggled off, reseed from schedule defaults for the row date.
      if (field === "ScaDrest" && Number(value) === 0 && current.ScaDdate) {
        const seeded = buildDetailForDate(new Date(current.ScaDdate));
        current.ScaDshiftstart = seeded.ScaDshiftstart;
        current.ScaDbreakstart = seeded.ScaDbreakstart;
        current.ScaDbreakend = seeded.ScaDbreakend;
        current.ScaDshiftend = seeded.ScaDshiftend;
        current.ScaDbreak = seeded.ScaDbreak;
        current.ScaDShift = seeded.ScaDShift;
      }

      // Break toggle explicit handling
      if (field === "ScaDbreak" && Number(value) === 0 && current.ScaDdate) {
        current.ScaDbreakstart = combineDateTime(new Date(current.ScaDdate), "00:00");
        current.ScaDbreakend = combineDateTime(new Date(current.ScaDdate), "00:00");
      }

      updated[index] = current;
      return updated;
    });
  };

  const addDetail = () => {
    const base = toDate || fromDate || new Date();
    const nextDate = new Date(base);
    nextDate.setDate(nextDate.getDate() + 1);
    setDetails((prev) => [...prev, buildDetailForDate(nextDate)]);
  };

  const removeDetail = (index: number) => {
    setDetails((prev) => prev.filter((_, i) => i !== index));
  };

  const isDateDisabled = (date: Date): boolean => {
    if (!settings) return false;
    return beforeAfter(date, 0, settings.set_scaafter ?? 0);
  };

  async function onSubmit(values: FormValues) {
    if (!empId) {
      toast({
        variant: "destructive",
        title: "Missing employee",
        description: "You must be logged in to file schedule change.",
      });
      return;
    }

    if (values.ScaSdatefrom > values.ScaSdateto) {
      toast({
        variant: "destructive",
        title: "Invalid range",
        description: "Date from cannot be after date to.",
      });
      return;
    }

    const payload: SchedAdjustRequestDTO = {
      ScaSid: scaId,
      ScaSemp: empId,
      ScaSdatefrom: values.ScaSdatefrom,
      ScaSdateto: values.ScaSdateto,
      ScaSreason: values.ScaSreason || "",
      SchedDetail: details,
    };

    try {
      if (scaId) {
        await updateMutation.mutateAsync(payload);
        toast({ title: "Schedule change updated" });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: "Schedule change submitted" });
      }
      onSuccess();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error submitting request",
        description:
          error instanceof Error ? error.message : "Please try again later.",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{scaId ? "Edit Schedule Change" : "Apply Schedule Change"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="flex flex-col gap-2">
              <Label>Date From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(form.watch("ScaSdatefrom"), "MM/dd/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("ScaSdatefrom")}
                    onSelect={(date) => {
                      if (!date) return;
                      const currentTo = form.getValues("ScaSdateto");
                      if (date > currentTo) {
                        form.setValue("ScaSdatefrom", date, { shouldDirty: true });
                        form.setValue("ScaSdateto", date, { shouldDirty: true });
                        toast({
                          title: "Adjusted date range",
                          description:
                            "Effectivity date start cannot be greater than date end. Value has been adjusted.",
                        });
                        return;
                      }
                      form.setValue("ScaSdatefrom", date, { shouldDirty: true });
                    }}
                    disabled={isDateDisabled}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Date To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(form.watch("ScaSdateto"), "MM/dd/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("ScaSdateto")}
                    onSelect={(date) => {
                      if (!date) return;
                      const currentFrom = form.getValues("ScaSdatefrom");
                      if (date < currentFrom) {
                        form.setValue("ScaSdatefrom", date, { shouldDirty: true });
                        form.setValue("ScaSdateto", date, { shouldDirty: true });
                        toast({
                          title: "Adjusted date range",
                          description:
                            "Effectivity date end cannot be less than date start. Value has been adjusted.",
                        });
                        return;
                      }
                      form.setValue("ScaSdateto", date, { shouldDirty: true });
                    }}
                    disabled={isDateDisabled}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={addDetail}>
                <Plus className="w-4 h-4 mr-2" />
                Add Detail
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={form.watch("ScaSreason")}
              onChange={(e) =>
                form.setValue("ScaSreason", e.target.value, { shouldDirty: true })
              }
              rows={3}
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Shift Start</TableHead>
                  <TableHead>Break Start</TableHead>
                  <TableHead>Break End</TableHead>
                  <TableHead>Shift End</TableHead>
                  <TableHead>Rest</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.map((d, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{d.ScaDdate ? format(new Date(d.ScaDdate), "MM/dd/yyyy") : "-"}</TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        step={60}
                        value={formatHHmm(d.ScaDshiftstart)}
                        onChange={(e) =>
                          d.ScaDdate &&
                          updateDetail(
                            idx,
                            "ScaDshiftstart",
                            combineDateTime(new Date(d.ScaDdate), e.target.value),
                          )
                        }
                        disabled={d.ScaDrest === 1}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        step={60}
                        value={formatHHmm(d.ScaDbreakstart)}
                        onChange={(e) =>
                          d.ScaDdate &&
                          updateDetail(
                            idx,
                            "ScaDbreakstart",
                            combineDateTime(new Date(d.ScaDdate), e.target.value),
                          )
                        }
                        disabled={d.ScaDrest === 1 || d.ScaDbreak === 0}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        step={60}
                        value={formatHHmm(d.ScaDbreakend)}
                        onChange={(e) =>
                          d.ScaDdate &&
                          updateDetail(
                            idx,
                            "ScaDbreakend",
                            combineDateTime(new Date(d.ScaDdate), e.target.value),
                          )
                        }
                        disabled={d.ScaDrest === 1 || d.ScaDbreak === 0}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        step={60}
                        value={formatHHmm(d.ScaDshiftend)}
                        onChange={(e) =>
                          d.ScaDdate &&
                          updateDetail(
                            idx,
                            "ScaDshiftend",
                            combineDateTime(new Date(d.ScaDdate), e.target.value),
                          )
                        }
                        disabled={d.ScaDrest === 1}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={d.ScaDrest === 1}
                        onChange={(e) => updateDetail(idx, "ScaDrest", e.target.checked ? 1 : 0)}
                      />
                    </TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={d.ScaDbreak === 1}
                        onChange={(e) => updateDetail(idx, "ScaDbreak", e.target.checked ? 1 : 0)}
                        disabled={d.ScaDrest === 1}
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        className="border rounded-md px-2 py-1 text-sm"
                        value={d.ScaDShift != null ? String(d.ScaDShift) : "R"}
                        onChange={(e) => updateDetail(idx, "ScaDShift", e.target.value)}
                      >
                        <option value="R">Regular</option>
                        <option value="N">Night</option>
                        <option value="F">Flexible</option>
                        <option value="E">Exempt</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDetail(idx)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : scaId
                  ? "Update Request"
                  : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


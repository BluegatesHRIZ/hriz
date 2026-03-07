"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  OvertimeRequestDTO,
  useCreateOvertime,
  useUpdateOvertime,
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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/hooks/use-toast";
import { beforeAfter } from "@/lib/utils/requestLimit";

const overtimeSchema = z.object({
  otm_type: z.string().min(1, "Overtime type is required"),
  otm_date: z.date({ required_error: "Date is required" }),
  otm_from_time: z.string().min(1, "From time is required"),
  otm_to_time: z.string().min(1, "To time is required"),
  otm_reason: z
    .string()
    .min(1, "Reason is required")
    .max(200, "Reason must be less than 200 characters"),
});

type OvertimeFormValues = z.infer<typeof overtimeSchema>;

interface OvertimeRequestFormProps {
  empId: string;
  otId?: string;
  existing?: OvertimeRequestDTO | null;
  onSuccess: () => void;
}

const OT_TYPES = [
  { value: "0", label: "Normal Overtime" },
  { value: "1", label: "Early Overtime" },
  { value: "2", label: "Special Overtime" },
];

function combineDateAndTime(date: Date, time: string): Date {
  const [hoursStr, minutesStr] = time.split(":");
  const hours = parseInt(hoursStr || "0", 10);
  const minutes = parseInt(minutesStr || "0", 10);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0,
  );
}

export function OvertimeRequestForm({
  empId,
  otId,
  existing,
  onSuccess,
}: OvertimeRequestFormProps) {
  const { toast } = useToast();
  const { data: settings } = useSettings();

  const createMutation = useCreateOvertime();
  const updateMutation = useUpdateOvertime(otId || "");

  const form = useForm<OvertimeFormValues>({
    resolver: zodResolver(overtimeSchema),
    mode: "onSubmit",
    reValidateMode: "onBlur",
    defaultValues: {
      otm_type: "0",
      otm_date: new Date(),
      otm_from_time: "",
      otm_to_time: "",
      otm_reason: "",
    },
  });

  // Initialize form when editing
  useEffect(() => {
    if (!existing) return;

    const dateValue =
      existing.otm_date instanceof Date
        ? existing.otm_date
        : existing.otm_date
          ? new Date(existing.otm_date)
          : new Date();

    // Extract HH:mm from existing from/to if present
    const fromTime = existing.otm_from
      ? (() => {
          const d =
            existing.otm_from instanceof Date
              ? existing.otm_from
              : new Date(existing.otm_from);
          return `${String(d.getHours()).padStart(2, "0")}:${String(
            d.getMinutes(),
          ).padStart(2, "0")}`;
        })()
      : "";

    const toTime = existing.otm_to
      ? (() => {
          const d =
            existing.otm_to instanceof Date
              ? existing.otm_to
              : new Date(existing.otm_to);
          return `${String(d.getHours()).padStart(2, "0")}:${String(
            d.getMinutes(),
          ).padStart(2, "0")}`;
        })()
      : "";

    form.reset({
      otm_type: String(existing.otm_type ?? "0"),
      otm_date: dateValue,
      otm_from_time: fromTime,
      otm_to_time: toTime,
      otm_reason: existing.otm_reason ?? "",
    });
  }, [existing, form]);

  async function onSubmit(values: OvertimeFormValues) {
    if (!empId) {
      toast({
        variant: "destructive",
        title: "Missing employee",
        description: "You must be logged in to file overtime.",
      });
      return;
    }

    const otDate = values.otm_date;

    // Respect OT before/after limits (same rule as backend)
    if (
      settings &&
      beforeAfter(
        otDate,
        settings.set_otmbefore ?? 0,
        settings.set_otmafter ?? 0,
      )
    ) {
      toast({
        variant: "destructive",
        title: "Overtime not allowed",
        description: "Overtime date is outside the allowed filing window.",
      });
      return;
    }

    const fromDate = combineDateAndTime(otDate, values.otm_from_time);
    const toDate = combineDateAndTime(otDate, values.otm_to_time);

    if (toDate <= fromDate) {
      toast({
        variant: "destructive",
        title: "Invalid time range",
        description: "End time must be later than start time.",
      });
      return;
    }

    const payload: OvertimeRequestDTO = {
      otm_id: existing?.otm_id,
      otm_emp: empId,
      otm_type: Number(values.otm_type),
      otm_date: otDate,
      otm_from: fromDate,
      otm_to: toDate,
      otm_reason: values.otm_reason,
    };

    try {
      if (otId && existing) {
        await updateMutation.mutateAsync(payload);
        toast({
          title: "Overtime updated",
          description: "Your overtime request has been updated.",
        });
      } else {
        await createMutation.mutateAsync(payload);
        toast({
          title: "Overtime submitted",
          description: "Your overtime request has been created.",
        });
      }
      onSuccess();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error submitting overtime",
        description:
          error instanceof Error ? error.message : "Please try again later.",
      });
    }
  }

  const isDateDisabled = (date: Date): boolean => {
    if (!settings) return false;
    return beforeAfter(
      date,
      settings.set_otmbefore ?? 0,
      settings.set_otmafter ?? 0,
    );
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const selectedType = form.watch("otm_type");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {otId ? "Edit Overtime Request" : "Apply for Overtime"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="flex flex-col space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !form.watch("otm_date") && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("otm_date")
                      ? format(form.watch("otm_date"), "MM/dd/yyyy")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("otm_date")}
                    onSelect={(date) =>
                      date && form.setValue("otm_date", date, { shouldDirty: true })
                    }
                    disabled={isDateDisabled}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.otm_date && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.otm_date.message}
                </p>
              )}
            </div>

            {/* Type */}
            <div className="flex flex-col space-y-2">
              <Label>Type</Label>
              <select
                className="border rounded-md px-3 py-2 text-sm"
                value={selectedType}
                onChange={(e) =>
                  form.setValue("otm_type", e.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {OT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {form.formState.errors.otm_type && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.otm_type.message}
                </p>
              )}
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col space-y-2">
                <Label>From</Label>
                <Input
                  type="time"
                  step={60}
                  value={form.watch("otm_from_time")}
                  onChange={(e) =>
                    form.setValue("otm_from_time", e.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                {form.formState.errors.otm_from_time && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.otm_from_time.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col space-y-2">
                <Label>To</Label>
                <Input
                  type="time"
                  step={60}
                  value={form.watch("otm_to_time")}
                  onChange={(e) =>
                    form.setValue("otm_to_time", e.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                {form.formState.errors.otm_to_time && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.otm_to_time.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              rows={3}
              value={form.watch("otm_reason")}
              onChange={(e) =>
                form.setValue("otm_reason", e.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              placeholder="Explain why overtime is needed"
            />
            {form.formState.errors.otm_reason && (
              <p className="text-sm text-destructive">
                {form.formState.errors.otm_reason.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : otId
                  ? "Update Request"
                  : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  UndertimeRequestDTO,
  useCreateUndertime,
  useUndertimeById,
  useUpdateUndertime,
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

const undertimeSchema = z.object({
  UtmDate: z.date({ required_error: "Date is required" }),
  UtmFromTime: z.string().min(1, "From time is required"),
  UtmToTime: z.string().min(1, "To time is required"),
  UtmReason: z
    .string()
    .max(200, "Reason must be less than 200 characters")
    .optional(),
});

type UndertimeFormValues = z.infer<typeof undertimeSchema>;

interface UndertimeRequestFormProps {
  empId: string;
  utId?: string;
  initialDate?: string;
  onSuccess: () => void;
}

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

function toHHmm(value?: Date | string | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

export function UndertimeRequestForm({
  empId,
  utId,
  initialDate,
  onSuccess,
}: UndertimeRequestFormProps) {
  const { toast } = useToast();
  const { data: settings } = useSettings();
  const { data: existing } = useUndertimeById(utId || "");

  const createMutation = useCreateUndertime(empId);
  const updateMutation = useUpdateUndertime(utId || "");

  const form = useForm<UndertimeFormValues>({
    resolver: zodResolver(undertimeSchema),
    mode: "onSubmit",
    reValidateMode: "onBlur",
    defaultValues: {
      UtmDate: initialDate ? new Date(initialDate) : new Date(),
      UtmFromTime: "",
      UtmToTime: "",
      UtmReason: "",
    },
  });

  useEffect(() => {
    if (!existing || !utId) return;
    form.reset({
      UtmDate: existing.UtmDate ? new Date(existing.UtmDate) : new Date(),
      UtmFromTime: toHHmm(existing.UtmFrom),
      UtmToTime: toHHmm(existing.UtmTo),
      UtmReason: existing.UtmReason || "",
    });
  }, [existing, utId, form]);

  async function onSubmit(values: UndertimeFormValues) {
    if (!empId) {
      toast({
        variant: "destructive",
        title: "Missing employee",
        description: "You must be logged in to file undertime.",
      });
      return;
    }

    const fromDate = combineDateAndTime(values.UtmDate, values.UtmFromTime);
    const toDate = combineDateAndTime(values.UtmDate, values.UtmToTime);
    if (toDate <= fromDate) {
      toast({
        variant: "destructive",
        title: "Invalid time range",
        description: "End time must be later than start time.",
      });
      return;
    }

    const payload: UndertimeRequestDTO = {
      UtmId: utId,
      UtmEmp: empId,
      UtmDate: values.UtmDate,
      UtmFrom: fromDate,
      UtmTo: toDate,
      UtmReason: values.UtmReason || "",
    };

    try {
      if (utId) {
        await updateMutation.mutateAsync(payload);
        toast({
          title: "Undertime updated",
          description: "Your undertime request has been updated.",
        });
      } else {
        await createMutation.mutateAsync(payload);
        toast({
          title: "Undertime submitted",
          description: "Your undertime request has been created.",
        });
      }
      onSuccess();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error submitting undertime",
        description:
          error instanceof Error ? error.message : "Please try again later.",
      });
    }
  }

  const isDateDisabled = (date: Date): boolean => {
    if (!settings) return false;
    return beforeAfter(date, settings.set_utmlead ?? 0, settings.set_utmafter ?? 0);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{utId ? "Edit Undertime Request" : "Apply for Undertime"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="flex flex-col space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !form.watch("UtmDate") && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("UtmDate")
                      ? format(form.watch("UtmDate"), "MM/dd/yyyy")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("UtmDate")}
                    onSelect={(date) =>
                      date && form.setValue("UtmDate", date, { shouldDirty: true })
                    }
                    disabled={isDateDisabled}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col space-y-2">
              <Label>From</Label>
              <Input
                type="time"
                step={60}
                value={form.watch("UtmFromTime")}
                onChange={(e) =>
                  form.setValue("UtmFromTime", e.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>

            <div className="flex flex-col space-y-2">
              <Label>To</Label>
              <Input
                type="time"
                step={60}
                value={form.watch("UtmToTime")}
                onChange={(e) =>
                  form.setValue("UtmToTime", e.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              rows={3}
              value={form.watch("UtmReason") || ""}
              onChange={(e) =>
                form.setValue("UtmReason", e.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              placeholder="Explain your undertime request"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : utId ? "Update Request" : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}


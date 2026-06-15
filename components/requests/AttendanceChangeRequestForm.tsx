"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCoaTypes,
  useCoaById,
  useCreateCOA,
  useUpdateCOA,
  CoaDetailDTO,
  useUserLeaveScheduleList,
} from "@/lib/hooks/useRequestManagement";
import { useSettings } from "@/lib/hooks/useSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { beforeAfter } from "@/lib/utils/requestLimit";
import { formatTimeForInput } from "@/lib/utils/time";

const attendanceChangeSchema = z.object({
  CoaStype: z.string().min(1, "Type of change is required"),
  CoaSreason: z
    .string()
    .min(1, "Explanation is required")
    .max(200, "Explanation must be less than 200 characters"),
});

interface AttendanceChangeRequestFormProps {
  empId: string;
  coaId?: string;
  onSuccess: () => void;
  initialDate?: string;
  initialType?: string;
  initialSched?: string;
}

const REQUEST_TYPES = [
  { typeid: "I", coatype: "IN" },
  { typeid: "O", coatype: "OUT" },
];

export function AttendanceChangeRequestForm({
  empId,
  coaId,
  onSuccess,
  initialDate,
  initialType,
  initialSched,
}: AttendanceChangeRequestFormProps) {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [coaDetails, setCoaDetails] = useState<CoaDetailDTO[]>([]);
  const [selectedCoaType, setSelectedCoaType] = useState<string>("");
  const [isOthers, setIsOthers] = useState(false);
  const [customTypeDetail, setCustomTypeDetail] = useState<string>("");

  const { data: coaTypes } = useCoaTypes();
  const { data: existingCoa } = useCoaById(coaId || "");
  const { data: settings } = useSettings();
  const { data: scheduleDays } = useUserLeaveScheduleList();
  const createMutation = useCreateCOA();
  const updateMutation = useUpdateCOA(coaId || "");

  const form = useForm<z.infer<typeof attendanceChangeSchema>>({
    resolver: zodResolver(attendanceChangeSchema),
    mode: "onSubmit",
    reValidateMode: "onBlur",
    defaultValues: {
      CoaStype: "",
      CoaSreason: "",
    },
  });

  // Ensure component only renders Select on client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Helper function to get schedule time for a date and type (IN/OUT)
  const getScheduleTime = useCallback(
    (date: Date, type: "I" | "O"): Date | null => {
      if (!scheduleDays || scheduleDays.length === 0) return null;
      if (!date || isNaN(date.getTime())) return null;

      // Get day of week name (e.g., "THURSDAY")
      const dayOfWeek = date
        .toLocaleDateString("en-US", { weekday: "long" })
        .toUpperCase();

      // Find schedule for this day
      const scheduleDay = scheduleDays.find((s) => s.sch_day === dayOfWeek);
      if (!scheduleDay) return null;

      // Get the appropriate time (IN or OUT) - API now returns HH:mm strings
      const timeStr = type === "I" ? scheduleDay.sch_in : scheduleDay.sch_out;
      if (!timeStr) return null;

      // Parse time string (format: "HH:mm" from API)
      const timeParts = typeof timeStr === "string" ? timeStr.split(":") : null;
      if (!timeParts || timeParts.length < 2) return null;

      const hours = parseInt(timeParts[0]) || 0;
      const minutes = parseInt(timeParts[1]) || 0;

      // Create Date object with UTC time to match MySQL TIME field format
      return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
    },
    [scheduleDays],
  );

  // Load existing COA data for editing
  useEffect(() => {
    if (existingCoa && coaId) {
      // Reset form with existing data
      form.reset({
        CoaStype: existingCoa.CoaStype || "",
        CoaSreason: existingCoa.CoaSreason || "",
      });

      // Set COA type and custom type detail - wait for coaTypes to be loaded
      if (existingCoa.CoaStype && coaTypes) {
        const type = coaTypes.find((t) => t.coa_tid === existingCoa.CoaStype);
        if (type) {
          setSelectedCoaType(type.coa_tid);
          setIsOthers(type.coa_ttag === 1);
          if (type.coa_ttag === 1) {
            setCustomTypeDetail(existingCoa.CoaStypedetail || "");
          } else {
            setCustomTypeDetail(type.coa_tdesc || "");
          }
        } else {
          // Fallback if type not found in coaTypes
          setSelectedCoaType(existingCoa.CoaStype);
          setCustomTypeDetail(existingCoa.CoaStypedetail || "");
        }
      } else if (existingCoa.CoaStype) {
        // Set basic values even if coaTypes not loaded yet
        setSelectedCoaType(existingCoa.CoaStype);
        setCustomTypeDetail(existingCoa.CoaStypedetail || "");
      }

      // Load details
      if (
        existingCoa.CoaDetails &&
        Array.isArray(existingCoa.CoaDetails) &&
        existingCoa.CoaDetails.length > 0
      ) {
        const loadedDetails = existingCoa.CoaDetails.map(
          (detail: CoaDetailDTO) => {
            let date = new Date();
            if (detail.CoaDdate) {
              date =
                typeof detail.CoaDdate === "string"
                  ? new Date(detail.CoaDdate)
                  : new Date(detail.CoaDdate);
            }

            const type = detail.CoaDtype || "I";

            // When editing, use existing time from database first
            // API now returns TIME fields as "HH:mm" strings
            let time: Date | null = null;
            if (detail.CoaDtime) {
              if (typeof detail.CoaDtime === "string") {
                // API returns "HH:mm" format string
                const [hours, minutes] = detail.CoaDtime.split(":").map(Number);
                time = new Date(
                  Date.UTC(1970, 0, 1, hours || 0, minutes || 0, 0),
                );
              } else if (detail.CoaDtime instanceof Date) {
                // Fallback: if it's still a Date object, extract UTC time
                const hours = detail.CoaDtime.getUTCHours();
                const minutes = detail.CoaDtime.getUTCMinutes();
                const seconds = detail.CoaDtime.getUTCSeconds();
                time = new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
              }
            }

            // Only use schedule time as fallback if no existing time
            if (!time) {
              time = getScheduleTime(date, type as "I" | "O");
            }

            // Default time if nothing available
            if (!time) {
              time = new Date(Date.UTC(1970, 0, 1, 0, 0, 0));
            }

            return {
              CoaDdate: date,
              CoaDtime: time,
              CoaDtype: type,
            };
          },
        );

        setCoaDetails(loadedDetails);
      } else {
        // If no details, add one empty row
        addCoaDetail();
      }

      setTimeout(() => {
        form.clearErrors();
      }, 0);
    } else if (initialDate && initialType && initialSched) {
      // Handle initial data from Biolog component
      const initialDateObj = new Date(initialDate);
      const scheduleTime = getScheduleTime(
        initialDateObj,
        initialType as "I" | "O",
      );
      const initialDetail: CoaDetailDTO = {
        CoaDdate: initialDateObj,
        CoaDtime:
          scheduleTime ||
          (initialSched ? new Date(`1970-01-01T${initialSched}`) : new Date()),
        CoaDtype: initialType,
      };
      setCoaDetails([initialDetail]);
    } else if (!coaId) {
      // Default: add one empty detail row (only if not editing)
      addCoaDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addCoaDetail intentionally omitted to avoid re-running when coaDetails changes
  }, [
    existingCoa,
    coaId,
    form,
    initialDate,
    initialType,
    initialSched,
    scheduleDays,
    getScheduleTime,
    coaTypes,
  ]);

  // Handle COA type change when coaTypes loads (for editing mode)
  useEffect(() => {
    if (
      existingCoa &&
      existingCoa.CoaStype &&
      coaTypes &&
      coaTypes.length > 0 &&
      !selectedCoaType
    ) {
      const type = coaTypes.find((t) => t.coa_tid === existingCoa.CoaStype);
      if (type) {
        setSelectedCoaType(type.coa_tid);
        setIsOthers(type.coa_ttag === 1);
        if (type.coa_ttag === 1) {
          setCustomTypeDetail(existingCoa.CoaStypedetail || "");
        } else {
          setCustomTypeDetail(type.coa_tdesc || "");
        }
        form.setValue("CoaStype", type.coa_tid, { shouldValidate: false });
      }
    }
  }, [existingCoa, coaTypes, selectedCoaType, form]);

  const handleCoaTypeChange = (value: string) => {
    const type = coaTypes?.find((t) => t.coa_tid === value);
    if (type) {
      setSelectedCoaType(type.coa_tid);
      setIsOthers(type.coa_ttag === 1);
      if (type.coa_ttag === 1) {
        setCustomTypeDetail("");
      } else {
        setCustomTypeDetail(type.coa_tdesc || "");
      }
      form.setValue("CoaStype", type.coa_tid, { shouldValidate: false });
    }
  };

  const addCoaDetail = () => {
    const lastDetail = coaDetails[coaDetails.length - 1];
    const newDate = new Date();
    const newType =
      lastDetail?.CoaDtype === "O"
        ? "I"
        : lastDetail?.CoaDtype === "I"
          ? "O"
          : "I";

    // Auto-populate time from schedule if available
    const scheduleTime = getScheduleTime(newDate, newType as "I" | "O");

    const newDetail: CoaDetailDTO = {
      CoaDdate: newDate,
      CoaDtime: scheduleTime || new Date(Date.UTC(1970, 0, 1, 0, 0, 0)),
      CoaDtype: newType,
    };
    setCoaDetails([...coaDetails, newDetail]);
  };

  const removeCoaDetail = (index: number) => {
    if (coaDetails.length > 1) {
      setCoaDetails(coaDetails.filter((_, i) => i !== index));
    }
  };

  // Auto-populate times from schedule when scheduleDays loads
  useEffect(() => {
    if (!scheduleDays || scheduleDays.length === 0 || coaDetails.length === 0)
      return;

    // Update times for any details that have a date and type but might need schedule time
    const updatedDetails = coaDetails.map((detail) => {
      if (!detail.CoaDdate || !detail.CoaDtype) return detail;

      const date =
        detail.CoaDdate instanceof Date
          ? detail.CoaDdate
          : detail.CoaDdate
            ? new Date(detail.CoaDdate)
            : null;

      if (!date || isNaN(date.getTime())) return detail;

      const scheduleTime = getScheduleTime(date, detail.CoaDtype as "I" | "O");
      if (scheduleTime) {
        return { ...detail, CoaDtime: scheduleTime };
      }

      return detail;
    });

    // Only update if something changed
    const hasChanges = updatedDetails.some((updated, index) => {
      const original = coaDetails[index];
      const updatedTime =
        updated.CoaDtime instanceof Date ? updated.CoaDtime.getTime() : null;
      const originalTime =
        original.CoaDtime instanceof Date ? original.CoaDtime.getTime() : null;
      return updatedTime !== originalTime;
    });

    if (hasChanges) {
      setCoaDetails(updatedDetails);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDays, getScheduleTime]);

  const updateCoaDetail = (
    index: number,
    field: keyof CoaDetailDTO,
    value: Date | string,
  ) => {
    const updated = [...coaDetails];
    const currentDetail = updated[index];

    // Ensure CoaDdate is a Date object
    const currentDate =
      currentDetail.CoaDdate instanceof Date
        ? currentDetail.CoaDdate
        : currentDetail.CoaDdate
          ? new Date(currentDetail.CoaDdate)
          : null;

    // If date is being updated, auto-populate time based on schedule
    if (
      field === "CoaDdate" &&
      value instanceof Date &&
      currentDetail.CoaDtype
    ) {
      const scheduleTime = getScheduleTime(
        value,
        currentDetail.CoaDtype as "I" | "O",
      );
      if (scheduleTime) {
        updated[index] = {
          ...currentDetail,
          [field]: value,
          CoaDtime: scheduleTime,
        } as CoaDetailDTO;
      } else {
        updated[index] = { ...currentDetail, [field]: value } as CoaDetailDTO;
      }
    }
    // If type (IN/OUT) is being updated, auto-populate time based on schedule
    else if (field === "CoaDtype" && currentDate) {
      const scheduleTime = getScheduleTime(currentDate, value as "I" | "O");
      if (scheduleTime) {
        updated[index] = {
          ...currentDetail,
          [field]: value,
          CoaDtime: scheduleTime,
        } as CoaDetailDTO;
      } else {
        updated[index] = { ...currentDetail, [field]: value } as CoaDetailDTO;
      }
    }
    // Otherwise, just update the field
    else {
      updated[index] = { ...currentDetail, [field]: value } as CoaDetailDTO;
    }

    setCoaDetails(updated);
  };

  const isDateDisabled = (date: Date): boolean => {
    if (!settings) return false;
    return beforeAfter(
      date,
      settings.set_coabefore ?? 0,
      settings.set_coaafter ?? 0,
    );
  };

  const handleSubmit = async (data: z.infer<typeof attendanceChangeSchema>) => {
    if (coaDetails.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one attendance change detail",
        variant: "destructive",
      });
      return;
    }

    if (isOthers && !customTypeDetail.trim()) {
      toast({
        title: "Error",
        description: "Custom type detail is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedType = coaTypes?.find((t) => t.coa_tid === selectedCoaType);
      const typeDesc = selectedType?.coa_tdesc ?? "";

      const coaRequest = {
        CoaStype: selectedCoaType,
        CoaStypedetail: isOthers ? customTypeDetail : typeDesc,
        CoaSreason: data.CoaSreason || "",
        CoaSemp: empId,
        CoaDetails: coaDetails.map((detail) => ({
          CoaDdate: detail.CoaDdate,
          CoaDtime: detail.CoaDtime,
          CoaDtype: detail.CoaDtype || "I",
        })),
      };

      if (coaId) {
        await updateMutation.mutateAsync(coaRequest);
        toast({
          title: "Success",
          description: "Attendance change request updated successfully",
        });
      } else {
        await createMutation.mutateAsync(coaRequest);
        toast({
          title: "Success",
          description: "Attendance change request submitted successfully",
        });
      }

      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to submit attendance change request",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Change Request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Type of Change */}
            <div className="space-y-2">
              <Label htmlFor="coa_type">Type of Change</Label>
              {mounted ? (
                <Select
                  value={selectedCoaType}
                  onValueChange={handleCoaTypeChange}
                >
                  <SelectTrigger id="coa_type">
                    <SelectValue placeholder="Select type of change" />
                  </SelectTrigger>
                  <SelectContent>
                    {coaTypes?.map((type) => (
                      <SelectItem key={type.coa_tid} value={type.coa_tid}>
                        {type.coa_tdesc ?? type.coa_tid}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                  Select type of change
                </div>
              )}
              {form.formState.errors.CoaStype && form.formState.isSubmitted && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.CoaStype.message}
                </p>
              )}
            </div>

            {/* Custom Type Detail (if Others) */}
            {isOthers && (
              <div className="space-y-2">
                <Label htmlFor="custom_type">Custom Type Detail</Label>
                <Input
                  id="custom_type"
                  value={customTypeDetail}
                  onChange={(e) => setCustomTypeDetail(e.target.value)}
                  placeholder="Enter custom type detail"
                />
              </div>
            )}
          </div>

          {/* Explanation */}
          <div className="space-y-2">
            <Label htmlFor="explanation">Explanation</Label>
            <Textarea
              id="explanation"
              {...form.register("CoaSreason")}
              rows={3}
              placeholder="Enter explanation (max 200 characters)"
              className={cn(
                form.formState.errors.CoaSreason && "border-red-500",
              )}
            />
            {form.formState.errors.CoaSreason && form.formState.isSubmitted && (
              <p className="text-sm text-red-500">
                {form.formState.errors.CoaSreason.message}
              </p>
            )}
            {form.watch("CoaSreason") && (
              <p className="text-xs text-muted-foreground">
                {form.watch("CoaSreason")?.length || 0}/200 characters
              </p>
            )}
          </div>

          {/* COA Details Table */}
          <div className="space-y-2">
            <Label>Attendance Change Details</Label>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>In/Out</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coaDetails.map((detail, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !detail.CoaDdate && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {detail.CoaDdate ? (
                                format(
                                  detail.CoaDdate instanceof Date
                                    ? detail.CoaDdate
                                    : new Date(detail.CoaDdate),
                                  "PPP",
                                )
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                detail.CoaDdate instanceof Date
                                  ? detail.CoaDdate
                                  : detail.CoaDdate
                                    ? new Date(detail.CoaDdate)
                                    : undefined
                              }
                              onSelect={(date) =>
                                date && updateCoaDetail(index, "CoaDdate", date)
                              }
                              disabled={(date) => isDateDisabled(date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={
                            formatTimeForInput(
                              detail.CoaDtime instanceof Date
                                ? detail.CoaDtime
                                : detail.CoaDtime
                                  ? new Date(detail.CoaDtime)
                                  : null,
                            ) || ""
                          }
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(":");
                            if (hours && minutes) {
                              // Create a Date object with UTC time to match MySQL TIME field format
                              const time = new Date(
                                Date.UTC(
                                  1970,
                                  0,
                                  1,
                                  parseInt(hours),
                                  parseInt(minutes),
                                  0,
                                ),
                              );
                              updateCoaDetail(index, "CoaDtime", time);
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={detail.CoaDtype || "I"}
                          onValueChange={(value) =>
                            updateCoaDetail(index, "CoaDtype", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REQUEST_TYPES.map((type) => (
                              <SelectItem key={type.typeid} value={type.typeid}>
                                {type.coatype}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCoaDetail(index)}
                            disabled={coaDetails.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {index === coaDetails.length - 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={addCoaDetail}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onSuccess}>
              Close
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Submitting..."
                : coaId
                  ? "Update"
                  : "Submit"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

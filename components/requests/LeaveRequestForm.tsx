"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useEmployeeLeaveTypes,
  useLeaveCredits,
  useCreateLeaveSummary,
  useLeaveSummary,
  useUpdateLeaveSummary,
  LeaveDetailDTO,
  useUserLeaveScheduleList,
  useHolidaysForSched,
  useSchedAdjustedDate,
  useLeaveRequestCredit,
} from "@/lib/hooks/useRequestManagement";
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
import { format, eachDayOfInterval } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
import { FileUpload } from "@/components/upload/FileUpload";
import { beforeAfterLead } from "@/lib/utils/requestLimit";

const leaveRequestSchema = z.object({
  LeaStype: z.string().min(1, "Leave type is required"),
  LeaSfrom: z.date({ error: "Start date is required" }),
  LeaSto: z.date({ error: "End date is required" }),
  LeaSreason: z.string().min(1, "Reason is required"),
});

interface LeaveRequestFormProps {
  empId: string;
  leaveId?: string;
  onSuccess: () => void;
}

const LEAVE_DAY_OPTIONS = [
  { optionid: "W", optionname: "Whole Day", optioncount: 1 },
  { optionid: "H1", optionname: "Half Day (AM)", optioncount: 0.5 },
  { optionid: "H2", optionname: "Half Day (PM)", optioncount: 0.5 },
];

export function LeaveRequestForm({
  empId,
  leaveId,
  onSuccess,
}: LeaveRequestFormProps) {
  const { toast } = useToast();
  const [leaveDetails, setLeaveDetails] = useState<LeaveDetailDTO[]>([]);
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("");
  const [availableCredit, setAvailableCredit] = useState(0);
  const [countLeave, setCountLeave] = useState(0);
  const [withPay, setWithPay] = useState(0);
  const [withoutPay, setWithoutPay] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [leaveCredit, setLeaveCredit] = useState(0);
  const [leaveUsed, setLeaveUsed] = useState(0);

  const { data: leaveTypes } = useEmployeeLeaveTypes(empId);
  const { data: leaveCredits } = useLeaveCredits(empId);
  const { data: existingLeave } = useLeaveSummary(leaveId || "");
  const { data: scheduleDays } = useUserLeaveScheduleList();
  const { data: holidays } = useHolidaysForSched();
  const { data: leaveCreditRequest } = useLeaveRequestCredit(
    empId,
    selectedLeaveType
  );

  const createMutation = useCreateLeaveSummary(empId);
  const updateMutation = useUpdateLeaveSummary(leaveId || "");

  const form = useForm<z.infer<typeof leaveRequestSchema>>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      LeaStype: "",
      LeaSfrom: undefined,
      LeaSto: undefined,
      LeaSreason: "",
    },
  });

  const dateFrom = form.watch("LeaSfrom");
  const dateTo = form.watch("LeaSto");
  
  // Hook that depends on dateFrom and dateTo must be after they're defined
  const { data: schedAdjusted } = useSchedAdjustedDate(dateFrom, dateTo);

  // Load existing leave data for editing
  useEffect(() => {
    if (existingLeave && leaveId) {
      form.reset({
        LeaStype: existingLeave.LeaStype || "",
        LeaSfrom: existingLeave.LeaSfrom
          ? new Date(existingLeave.LeaSfrom)
          : undefined,
        LeaSto: existingLeave.LeaSto
          ? new Date(existingLeave.LeaSto)
          : undefined,
        LeaSreason: existingLeave.LeaSreason || "",
      });
      setSelectedLeaveType(existingLeave.LeaStype || "");
      if (existingLeave.leavedetail) {
        setLeaveDetails(existingLeave.leavedetail);
      }
      if (existingLeave.files) {
        setUploadedFiles(existingLeave.files);
      }
    }
  }, [existingLeave, leaveId, form]);

  // Get leave credit for selected type (matches C# LeaveType method)
  useEffect(() => {
    if (selectedLeaveType && leaveCreditRequest) {
      const credit = leaveCreditRequest.EmlLeacredit || 0;
      const used = leaveCreditRequest.EmlUsed || 0;
      const available = credit - used;
      
      setLeaveCredit(credit);
      setLeaveUsed(used);
      setAvailableCredit(available);
    } else if (selectedLeaveType && leaveCredits) {
      // Fallback to leaveCredits if leaveCreditRequest not available
      const credit = leaveCredits.find(
        (lc) => lc.EmlLeave === selectedLeaveType
      );
      if (credit) {
        const creditVal = credit.EmlLeacredit || 0;
        const usedVal = credit.EmlUsed || 0;
        const available = creditVal - usedVal;
        
        setLeaveCredit(creditVal);
        setLeaveUsed(usedVal);
        setAvailableCredit(available);
      }
    }
  }, [selectedLeaveType, leaveCreditRequest, leaveCredits]);

  // Generate leave details when date range changes (matches C# GenerateDetailForms)
  useEffect(() => {
    if (
      dateFrom &&
      dateTo &&
      dateFrom <= dateTo &&
      scheduleDays &&
      holidays &&
      schedAdjusted !== undefined
    ) {
      const details: LeaveDetailDTO[] = [];
      const days = eachDayOfInterval({ start: dateFrom, end: dateTo });

      for (const day of days) {
        const dayOfWeek = day.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
        const scheduleDay = scheduleDays.find((s) => s.sch_day === dayOfWeek);
        const isWorkingDay = scheduleDay?.sch_rest === 0;
        
        // Compare dates by date only (ignore time)
        const dayDateOnly = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const isHoliday = holidays.some((h) => {
          if (!h.hol_date) return false;
          const holidayDate = new Date(h.hol_date);
          return (
            holidayDate.getFullYear() === dayDateOnly.getFullYear() &&
            holidayDate.getMonth() === dayDateOnly.getMonth() &&
            holidayDate.getDate() === dayDateOnly.getDate()
          );
        });
        const isSchedAdjusted = schedAdjusted.some((s) => {
          if (!s.sca_ddate) return false;
          const adjustedDate = new Date(s.sca_ddate);
          return (
            adjustedDate.getFullYear() === dayDateOnly.getFullYear() &&
            adjustedDate.getMonth() === dayDateOnly.getMonth() &&
            adjustedDate.getDate() === dayDateOnly.getDate()
          );
        });

        // Include day if:
        // 1. It's a working day (not rest day), not a holiday, and not schedule-adjusted, OR
        // 2. It's schedule-adjusted (even if it's a holiday or rest day)
        if (
          (isWorkingDay && !isHoliday && !isSchedAdjusted) ||
          isSchedAdjusted
        ) {
          details.push({
            LeaDdate: day,
            LeaDtype: "W", // Default to whole day
            LeaDampm: "",
          });
        }
      }

      setLeaveDetails(details);
    } else if (dateFrom && dateTo && dateFrom <= dateTo) {
      // Fallback: generate all days if schedules/holidays not loaded yet
      const days = eachDayOfInterval({ start: dateFrom, end: dateTo });
      const details: LeaveDetailDTO[] = days.map((day) => ({
        LeaDdate: day,
        LeaDtype: "W",
        LeaDampm: "",
      }));
      setLeaveDetails(details);
    } else {
      setLeaveDetails([]);
    }
  }, [dateFrom, dateTo, scheduleDays, holidays, schedAdjusted]);

  // Calculate day count (matches C# CalculateDayType)
  useEffect(() => {
    const totalDays = leaveDetails.reduce((sum, detail) => {
      const option = LEAVE_DAY_OPTIONS.find(
        (opt) => opt.optionid === detail.LeaDtype
      );
      return sum + (option?.optioncount || 0);
    }, 0);
    setCountLeave(totalDays);
  }, [leaveDetails]);

  // Calculate pay based on credits (matches C# CalculatePay exactly)
  useEffect(() => {
    // C# logic: if availablecredit == countleave || availablecredit >= countleave
    if (availableCredit === countLeave || availableCredit >= countLeave) {
      setWithPay(countLeave);
      setWithoutPay(0);
    } else if (availableCredit <= countLeave) {
      setWithPay(availableCredit);
      setWithoutPay(countLeave - availableCredit);
    } else {
      setWithPay(countLeave);
      setWithoutPay(0);
    }
  }, [countLeave, availableCredit]);



  const handleLeaveTypeChange = (value: string) => {
    setSelectedLeaveType(value);
    form.setValue("LeaStype", value);
  };

  const handleDayTypeChange = (index: number, dayType: string) => {
    const updated = [...leaveDetails];
    const option = LEAVE_DAY_OPTIONS.find((opt) => opt.optionid === dayType);

    updated[index] = {
      ...updated[index],
      LeaDtype: option?.optionid === "W" ? "W" : "H",
      LeaDampm:
        option?.optionid === "H1" ? "A" : option?.optionid === "H2" ? "P" : "",
    };

    setLeaveDetails(updated);
    // Recalculate will happen in useEffect
  };

  const handleSubmit = async (data: z.infer<typeof leaveRequestSchema>) => {
    if (leaveDetails.length === 0) {
      toast({
        title: "Error",
        description: "Please select a date range",
        variant: "destructive",
      });
      return;
    }

    try {
      const leaveRequest = {
        ...data,
        leavedetail: leaveDetails.map((detail) => ({
          LeaDdate: detail.LeaDdate,
          LeaDtype: detail.LeaDtype,
          LeaDampm: detail.LeaDampm,
        })),
        LeaSwithpay: withPay,
        LeaSwithoutpay: withoutPay,
      };

      if (leaveId) {
        await updateMutation.mutateAsync(leaveRequest as any);
      } else {
        await createMutation.mutateAsync(leaveRequest as any);
      }

      toast({
        title: "Success",
        description: `Leave request ${
          leaveId ? "updated" : "submitted"
        } successfully`,
      });
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to submit leave request",
        variant: "destructive",
      });
    }
  };

  const selectedCredit = leaveCredits?.find(
    (lc) => lc.EmlLeave === selectedLeaveType
  );
  const selectedLeaveTypeRecord = leaveTypes?.find(
    (lt) => lt.lev_id === selectedLeaveType
  );
  const levBefore = selectedLeaveTypeRecord?.lev_before ?? 0;
  const levAfter = selectedLeaveTypeRecord?.lev_after ?? 0;
  const levLead = selectedLeaveTypeRecord?.lev_lead ?? 0;

  const isDateDisabled = (date: Date) =>
    beforeAfterLead(date, levBefore, levAfter, levLead);

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Leave Balance – table layout to match C# exactly */}
      {selectedLeaveType && leaveCreditRequest && (
        <div className="space-y-2">
          <h4 className="text-lg font-semibold text-foreground">
            Leave Balance
          </h4>
          <table className="credits-table table w-auto border-collapse mb-0 [&_th]:text-left [&_th]:font-medium [&_th]:pe-4 [&_td]:pe-4 [&_th]:min-w-[80px] [&_td]:min-w-[80px]">
            <thead>
              <tr>
                <th>Available</th>
                <th>Leave</th>
                <th>With Pay</th>
                <th>Without Pay</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{availableCredit.toFixed(1)}</td>
                <td>{countLeave.toFixed(1)}</td>
                <td>{withPay.toFixed(1)}</td>
                <td>{withoutPay.toFixed(1)}</td>
              </tr>
            </tbody>
          </table>
          {/* Additional info: Credit and Used (for reference, matching C# structure) */}
          <div className="text-sm text-muted-foreground mt-2">
            <p>
              Credit: {leaveCredit.toFixed(1)} | Used: {leaveUsed.toFixed(1)} | Available:{" "}
              {availableCredit.toFixed(1)}
            </p>
          </div>
        </div>
      )}

      {/* Leave Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Leave Type */}
            <div className="space-y-2">
              <Label htmlFor="leave_type">Type of Leave</Label>
              <Select
                value={selectedLeaveType}
                onValueChange={handleLeaveTypeChange}
              >
                <SelectTrigger id="leave_type">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes?.map((lt) => (
                    <SelectItem key={lt.lev_id} value={lt.lev_id || ""}>
                      {lt.lev_desc || lt.lev_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.LeaStype && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.LeaStype.message}
                </p>
              )}
            </div>

            {/* Date Start */}
            <div className="space-y-2">
              <Label>Date Start</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? (
                      format(dateFrom, "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => {
                      if (date) form.setValue("LeaSfrom", date);
                    }}
                    disabled={isDateDisabled}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.LeaSfrom && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.LeaSfrom.message}
                </p>
              )}
            </div>

            {/* Date End */}
            <div className="space-y-2">
              <Label>Date End</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => {
                      if (date) form.setValue("LeaSto", date);
                    }}
                    disabled={(date) =>
                      isDateDisabled(date) || (!!dateFrom && date < dateFrom)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.LeaSto && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.LeaSto.message}
                </p>
              )}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Explanation</Label>
            <Textarea
              id="reason"
              {...form.register("LeaSreason")}
              rows={3}
              placeholder="Enter reason for leave"
            />
            {form.formState.errors.LeaSreason && (
              <p className="text-sm text-red-500">
                {form.formState.errors.LeaSreason.message}
              </p>
            )}
          </div>

          {/* File Attachments */}
          <div className="space-y-2">
            <Label>Supports Attached</Label>
            <FileUpload
              path="leaves"
              fk={leaveId || ""}
              type="lea_files"
              onUploadComplete={(files) => setUploadedFiles(files)}
              existingFiles={uploadedFiles}
            />
          </div>

          {/* Leave Details Table */}
          {leaveDetails.length > 0 && (
            <div className="space-y-2">
              <Label>Leave Details</Label>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveDetails.map((detail, index) => {
                      // Calculate if this day is paid
                      // Sum up all previous days' option counts
                      let cumulativeCount = 0;
                      for (let i = 0; i < index; i++) {
                        const option = LEAVE_DAY_OPTIONS.find(
                          (opt) =>
                            opt.optionid ===
                            (leaveDetails[i].LeaDtype === "W"
                              ? "W"
                              : leaveDetails[i].LeaDampm === "A"
                              ? "H1"
                              : "H2")
                        );
                        cumulativeCount += option?.optioncount || 0;
                      }
                      
                      // Get current day's option count
                      const currentOption = LEAVE_DAY_OPTIONS.find(
                        (opt) =>
                          opt.optionid ===
                          (detail.LeaDtype === "W"
                            ? "W"
                            : detail.LeaDampm === "A"
                            ? "H1"
                            : "H2")
                      );
                      const currentCount = currentOption?.optioncount || 0;
                      
                      // Check if this day (or part of it) is paid
                      const isPaid = cumulativeCount + currentCount <= availableCredit;
                      const isPartiallyPaid = 
                        cumulativeCount < availableCredit && 
                        cumulativeCount + currentCount > availableCredit;
                      
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            {detail.LeaDdate
                              ? format(new Date(detail.LeaDdate), "MMM dd, yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {detail.LeaDdate
                              ? format(new Date(detail.LeaDdate), "EEEE")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={
                                detail.LeaDtype === "W"
                                  ? "W"
                                  : detail.LeaDampm === "A"
                                  ? "H1"
                                  : "H2"
                              }
                              onValueChange={(value) =>
                                handleDayTypeChange(index, value)
                              }
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LEAVE_DAY_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.optionid}
                                    value={option.optionid}
                                  >
                                    {option.optionname}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {isPaid ? (
                              <span className="text-green-600 font-medium">Yes</span>
                            ) : isPartiallyPaid ? (
                              <span className="text-yellow-600 font-medium">
                                Partial ({(availableCredit - cumulativeCount).toFixed(1)} days)
                              </span>
                            ) : (
                              <span className="text-red-600 font-medium">No</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.history.back()}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {createMutation.isPending || updateMutation.isPending
            ? "Submitting..."
            : leaveId
            ? "Update Leave"
            : "Submit Leave"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState, useMemo, useRef } from "react";
import {
  EmployeeDetail,
  SalaryHistoryData,
  useSaveSalaryHistory,
} from "@/lib/hooks/useEmployeeDetail";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  applyPresent,
  countPresent,
  supersededEndDate,
  SALARY_ENDED,
} from "@/lib/utils/salaryHistory";
import { formatAmount, formatDate } from "@/lib/utils/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAYROLL_TYPES = [
  { value: "D", label: "Daily" },
  { value: "W", label: "Weekly" },
  { value: "S", label: "Semi Monthly" },
  { value: "M", label: "Monthly" },
] as const;

const SALARY_STATUSES = [
  { value: 0, label: "Ended" },
  { value: 1, label: "Present" },
] as const;

/** Wage types the payroll engine pays; any other type is skipped by payroll. */
const PAYABLE_TYPES = new Set(["D", "S", "M"]);

/**
 * The row payroll would use on `asOf` — mirrors `loadSalaries` in
 * `lib/services/payroll/repository.ts`: the Present row with the latest
 * Date From on or before that day. Returns -1 when none applies.
 */
function activeSalaryIndex(salaries: SalaryForm[], asOf: Date): number {
  let best = -1;
  let bestFrom = -Infinity;
  salaries.forEach((sal, i) => {
    if (sal.SalStatus !== 1 || !sal.SalDateFrom) return;
    if (!PAYABLE_TYPES.has(sal.SalPayrollType.toUpperCase())) return;
    const from = new Date(sal.SalDateFrom).getTime();
    if (from > asOf.getTime() || from <= bestFrom) return;
    best = i;
    bestFrom = from;
  });
  return best;
}

interface SalaryForm {
  SalId: number;
  SalPosition: string;
  SalPayrollType: string;
  SalDateFrom: Date | null;
  SalDateTo: Date | null;
  SalAmount: number;
  SalRemarks: string;
  SalStatus: number;
}

interface SalaryHistoryTabProps {
  employee: EmployeeDetail;
  positions?: Array<{ pst_id: string; pst_desc: string | null }>;
}

export function SalaryHistoryTab({
  employee,
  positions = [],
}: SalaryHistoryTabProps) {
  const { toast } = useToast();
  const saveMutation = useSaveSalaryHistory(employee.Account.EmpId);

  // Initialize salaries from employee data
  const initialSalaries: SalaryForm[] = useMemo(() => {
    if (employee.EmpSalary && employee.EmpSalary.length > 0) {
      return employee.EmpSalary.map((sal) => ({
        SalId: sal.SalId,
        SalPosition: sal.SalPosition || "",
        SalPayrollType: sal.SalPayrollType || "S",
        SalDateFrom: sal.SalDateFrom || sal.SalDate || null,
        SalDateTo: sal.SalDateTo || null,
        SalAmount: sal.SalAmount || 0,
        SalRemarks: sal.SalRemarks || "",
        SalStatus: sal.SalStatus ?? 1,
      }));
    }
    return [];
  }, [employee]);

  const [salaries, setSalaries] = useState<SalaryForm[]>(initialSalaries);

  // Get position description from ID for initial form data
  const getPositionDesc = (posId: string | null | undefined): string => {
    if (!posId) return "";
    const pos = positions.find((p) => p.pst_id === posId);
    return pos?.pst_desc || posId;
  };

  const emptyForm = (): SalaryForm => ({
    SalId: 0,
    SalPosition: getPositionDesc(employee.Account.EmpPos) || "",
    SalPayrollType: "S",
    SalDateFrom: null,
    SalDateTo: null,
    SalAmount: 0,
    SalRemarks: "",
    SalStatus: 1,
  });

  const [formData, setFormData] = useState<SalaryForm>(emptyForm);
  // Temporary ids for unsaved rows; negative so they never clash with saved ones.
  const nextTempId = useRef(-1);
  // Index of the history row loaded into the form, or null when adding.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Sync state when employee data changes (adjusting state during render,
  // rather than in an effect, avoids a second render pass).
  const [syncedFrom, setSyncedFrom] = useState(initialSalaries);
  if (syncedFrom !== initialSalaries) {
    setSyncedFrom(initialSalaries);
    setSalaries(initialSalaries);
    setEditingIndex(null);
  }

  const handleAddSalary = () => {
    if (
      !formData.SalPosition ||
      !formData.SalDateFrom ||
      formData.SalAmount <= 0
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in Position, Date From, and Salary Amount",
        variant: "destructive",
      });
      return;
    }

    const index = editingIndex ?? salaries.length;
    const withRow =
      editingIndex !== null
        ? salaries.map((s, i) => (i === editingIndex ? formData : s))
        : [...salaries, { ...formData, SalId: nextTempId.current-- }]; // Temporary ID

    // Only one Present salary: a new one ends the salary it replaces.
    const result = applyPresent(withRow, index);
    if (!result.ok) {
      toast({
        title: "Two Present salaries",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    setSalaries(result.rows);
    for (const ended of result.ended) {
      toast({
        title: "Previous salary ended",
        description: `${
          PAYROLL_TYPES.find((t) => t.value === ended.SalPayrollType)?.label ||
          ended.SalPayrollType
        } ${formatAmount(ended.SalAmount)} now ends ${formatDate(
          ended.SalDateTo,
        )}. Click Save Changes to keep it.`,
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingIndex(null);
  };

  const handleEditSalary = (index: number) => {
    setFormData({ ...salaries[index] });
    setEditingIndex(index);
  };

  const handleRemoveSalary = (index: number) => {
    const newSalaries = salaries.filter((_, i) => i !== index);
    setSalaries(newSalaries);
    if (editingIndex === index) resetForm();
    else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const activeIndex = useMemo(
    () => activeSalaryIndex(salaries, new Date()),
    [salaries],
  );
  const active = activeIndex >= 0 ? salaries[activeIndex] : null;

  /** End a superseded Present salary the day before the next one starts. */
  const handleEndSuperseded = (index: number, end: Date) => {
    setSalaries(
      salaries.map((s, i) =>
        i === index ? { ...s, SalDateTo: end, SalStatus: SALARY_ENDED } : s,
      ),
    );
  };

  const statusBadge = (salary: SalaryForm, index: number) => {
    if (index === activeIndex) return <Badge variant="success">Active</Badge>;
    if (salary.SalStatus !== 1) {
      return (
        SALARY_STATUSES.find((s) => s.value === salary.SalStatus)?.label || "-"
      );
    }
    if (salary.SalDateFrom && new Date(salary.SalDateFrom) > new Date()) {
      return (
        <Badge variant="info" title="Payroll starts using this on its Date From">
          Upcoming
        </Badge>
      );
    }
    const end = supersededEndDate(salaries, index);
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Badge
          variant="warning"
          title="Still marked Present, but payroll uses a newer salary."
        >
          Previous
        </Badge>
        {end && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            title="Set Date To to the day before the newer salary starts"
            onClick={() => handleEndSuperseded(index, end)}
          >
            End {formatDate(end)}
          </Button>
        )}
      </span>
    );
  };

  const handleSave = async () => {
    try {
      if (salaries.length === 0) {
        toast({
          title: "No Data",
          description: "Please add at least one salary entry",
          variant: "destructive",
        });
        return;
      }

      if (countPresent(salaries) > 1) {
        toast({
          title: "Only one salary can be Present",
          description:
            "Click End on the salaries marked Previous, then save again.",
          variant: "destructive",
        });
        return;
      }

      const salariesToSave: SalaryHistoryData[] =
        salaries.map((sal) => ({
          SalId: sal.SalId,
          SalPosition: sal.SalPosition,
          SalPayrollType: sal.SalPayrollType,
          SalDateFrom: sal.SalDateFrom
            ? sal.SalDateFrom instanceof Date
              ? sal.SalDateFrom
              : new Date(sal.SalDateFrom)
            : null,
          SalDateTo: sal.SalDateTo
            ? sal.SalDateTo instanceof Date
              ? sal.SalDateTo
              : new Date(sal.SalDateTo)
            : null,
          SalAmount: sal.SalAmount,
          SalRemarks: sal.SalRemarks,
          SalStatus: sal.SalStatus,
        }));

      console.log("Saving salaries:", salariesToSave);

      await saveMutation.mutateAsync({ salaries: salariesToSave });
      toast({
        title: "Success",
        description: "Salary history saved successfully",
      });
    } catch (error) {
      console.error("Save salary error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save salary history",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Add Salary Form */}
      <div className="bg-card rounded-xl border border-border/60 p-5">
        <h4 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border/60">
          {editingIndex !== null ? "Edit Salary Entry" : "Add Salary Entry"}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="sal_position">Position</Label>
            <Select
              value={formData.SalPosition}
              onValueChange={(value) =>
                setFormData({ ...formData, SalPosition: value })
              }
            >
              <SelectTrigger id="sal_position">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((pos) => (
                  <SelectItem
                    key={pos.pst_id}
                    value={pos.pst_desc || pos.pst_id}
                  >
                    {pos.pst_desc || pos.pst_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="sal_payroll_type">Wage Type</Label>
            <Select
              value={formData.SalPayrollType}
              onValueChange={(value) =>
                setFormData({ ...formData, SalPayrollType: value })
              }
            >
              <SelectTrigger id="sal_payroll_type">
                <SelectValue placeholder="Select wage type" />
              </SelectTrigger>
              <SelectContent>
                {PAYROLL_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="sal_date_from">Date From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="sal_date_from"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.SalDateFrom && "text-muted-foreground"
                  )}
                >
                  {formData.SalDateFrom
                    ? formatDate(formData.SalDateFrom)
                    : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.SalDateFrom || undefined}
                  onSelect={(date) => {
                    setFormData({ ...formData, SalDateFrom: date || null });
                    if (formData.SalStatus === 0 && !formData.SalDateTo) {
                      setFormData({
                        ...formData,
                        SalDateFrom: date || null,
                        SalDateTo: date || null,
                      });
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="sal_amount">Salary Amount</Label>
            <Input
              id="sal_amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.SalAmount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  SalAmount: parseFloat(e.target.value) || 0,
                })
              }
              className="text-right"
            />
          </div>

          <div>
            <Label htmlFor="sal_date_to">Date To (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="sal_date_to"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.SalDateTo && "text-muted-foreground"
                  )}
                  disabled={!formData.SalDateFrom}
                >
                  {formData.SalDateTo
                    ? formatDate(formData.SalDateTo)
                    : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.SalDateTo || undefined}
                  onSelect={(date) => {
                    setFormData({
                      ...formData,
                      SalDateTo: date || null,
                      SalStatus: date ? 0 : 1,
                    });
                  }}
                  disabled={
                    formData.SalDateFrom
                      ? { before: formData.SalDateFrom }
                      : undefined
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="sal_status">Status</Label>
            <Select
              value={formData.SalStatus.toString()}
              onValueChange={(value) => {
                const status = parseInt(value);
                setFormData({
                  ...formData,
                  SalStatus: status,
                  SalDateTo:
                    status === 1
                      ? null
                      : formData.SalDateTo || formData.SalDateFrom,
                });
              }}
            >
              <SelectTrigger id="sal_status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {SALARY_STATUSES.map((status) => (
                  <SelectItem
                    key={status.value}
                    value={status.value.toString()}
                  >
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="sal_remarks">Remarks</Label>
            <Textarea
              id="sal_remarks"
              value={formData.SalRemarks}
              onChange={(e) =>
                setFormData({ ...formData, SalRemarks: e.target.value })
              }
              rows={1}
              placeholder="Enter remarks..."
            />
          </div>

          <div className="flex items-end gap-2">
            {editingIndex !== null && (
              <Button type="button" variant="outline" onClick={resetForm}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
            <Button type="button" onClick={handleAddSalary} className="flex-1">
              {editingIndex !== null ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Update Salary
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Salary
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Salary History Table */}
      <div className="bg-card rounded-xl border border-border/60 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
          <h4 className="text-base font-semibold text-foreground">Salary History</h4>
          {salaries.length > 0 &&
            (active ? (
              <p className="text-sm text-muted-foreground">
                Payroll uses{" "}
                <span className="font-medium text-foreground">
                  {PAYROLL_TYPES.find((t) => t.value === active.SalPayrollType)
                    ?.label || active.SalPayrollType}{" "}
                  · {formatAmount(active.SalAmount)}
                </span>
                {active.SalDateFrom &&
                  ` since ${formatDate(active.SalDateFrom)}`}
              </p>
            ) : (
              <p className="text-sm text-warning">
                No active salary — payroll will skip this employee.
              </p>
            ))}
        </div>
        {salaries.length === 0 ? (
          <div className="text-center py-8 border rounded-lg">
            <p className="text-muted-foreground">No salary history records found.</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Wage Type</TableHead>
                  <TableHead>Date From</TableHead>
                  <TableHead>Date To</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaries.map((salary, index) => (
                  <TableRow
                    key={`sal-${salary.SalId}-${index}`}
                    className={cn(
                      index === activeIndex && "bg-success/5",
                      editingIndex === index && "bg-muted/50",
                    )}
                  >
                    <TableCell>{salary.SalPosition}</TableCell>
                    <TableCell>
                      {PAYROLL_TYPES.find(
                        (t) => t.value === salary.SalPayrollType
                      )?.label || salary.SalPayrollType}
                    </TableCell>
                    <TableCell>
                      {formatDate(salary.SalDateFrom)}
                    </TableCell>
                    <TableCell>
                      {salary.SalDateTo
                        ? formatDate(salary.SalDateTo)
                        : index === activeIndex
                          ? "Present"
                          : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(salary.SalAmount)}
                    </TableCell>
                    <TableCell>{statusBadge(salary, index)}</TableCell>
                    <TableCell>{salary.SalRemarks || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Edit salary entry"
                        onClick={() => handleEditSalary(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove salary entry"
                        onClick={() => handleRemoveSalary(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

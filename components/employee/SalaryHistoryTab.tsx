"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Save, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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

  const [formData, setFormData] = useState<SalaryForm>({
    SalId: 0,
    SalPosition: getPositionDesc(employee.Account.EmpPos) || "",
    SalPayrollType: "S",
    SalDateFrom: null,
    SalDateTo: null,
    SalAmount: 0,
    SalRemarks: "",
    SalStatus: 1,
  });

  // Sync state when employee data changes
  useEffect(() => {
    setSalaries(initialSalaries);
  }, [initialSalaries]);

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

    const newSalary: SalaryForm = {
      ...formData,
      SalId: Date.now(), // Temporary ID
    };
    setSalaries([...salaries, newSalary]);

    // Reset form
    setFormData({
      SalId: 0,
      SalPosition: getPositionDesc(employee.Account.EmpPos) || "",
      SalPayrollType: "S",
      SalDateFrom: null,
      SalDateTo: null,
      SalAmount: 0,
      SalRemarks: "",
      SalStatus: 1,
    });
  };

  const handleRemoveSalary = (index: number) => {
    const newSalaries = salaries.filter((_, i) => i !== index);
    setSalaries(newSalaries);
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
        <h4 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border/60">Add Salary Entry</h4>
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
                    ? format(formData.SalDateFrom, "PPP")
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
                    ? format(formData.SalDateTo, "PPP")
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

          <div className="flex items-end">
            <Button type="button" onClick={handleAddSalary} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Salary
            </Button>
          </div>
        </div>
      </div>

      {/* Salary History Table */}
      <div className="bg-card rounded-xl border border-border/60 p-5">
        <h4 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border/60">Salary History</h4>
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
                  <TableRow key={`sal-${salary.SalId}-${index}`}>
                    <TableCell>{salary.SalPosition}</TableCell>
                    <TableCell>
                      {PAYROLL_TYPES.find(
                        (t) => t.value === salary.SalPayrollType
                      )?.label || salary.SalPayrollType}
                    </TableCell>
                    <TableCell>
                      {salary.SalDateFrom
                        ? format(salary.SalDateFrom, "PPP")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {salary.SalDateTo ? format(salary.SalDateTo, "PPP") : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {salary.SalAmount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {SALARY_STATUSES.find((s) => s.value === salary.SalStatus)
                        ?.label || "-"}
                    </TableCell>
                    <TableCell>{salary.SalRemarks || "-"}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
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

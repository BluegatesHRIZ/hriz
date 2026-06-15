"use client";

import { useState, useEffect, useMemo } from "react";
import { EmployeeDetail, useSaveAdvances } from "@/lib/hooks/useEmployeeDetail";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const ADVANCE_TYPES = [
  { value: "Company Loan", label: "Company Loan" },
  { value: "Salary Advance", label: "Salary Advance" },
] as const;

const MONTHLY_PAYMENTS = [
  { value: 1, label: "Once" },
  { value: 2, label: "Twice" },
] as const;

const CUTOFF_PAYMENTS = [
  { value: 1, label: "1st Cutoff" },
  { value: 2, label: "2nd Cutoff" },
] as const;

interface AdvanceForm {
  AdvId: number;
  AdvType: string;
  AdvDate: Date | null;
  AdvAmount: number;
  AddedAmount: number;
  PayPerMonth: number;
  StartDate: Date | null;
  EndDate: Date | null;
  AmountPerPay: number;
  PayCutoff: number | null;
}

interface AdvancesAndLoansTabProps {
  employee: EmployeeDetail;
}

export function AdvancesAndLoansTab({ employee }: AdvancesAndLoansTabProps) {
  const { toast } = useToast();
  const saveMutation = useSaveAdvances(employee.Account.EmpId);

  // Initialize advances from employee data
  const initialAdvances: AdvanceForm[] = useMemo(() => {
    if (employee.EmpAdvance && employee.EmpAdvance.length > 0) {
      return employee.EmpAdvance.map((adv) => ({
        AdvId: adv.AdvId,
        AdvType: adv.AdvType || "",
        AdvDate: adv.AdvDate || new Date(),
        AdvAmount: adv.AdvAmount || 0,
        AddedAmount: 0, // Not in current DTO
        PayPerMonth: 2, // Default to twice
        StartDate: adv.AdvDate || new Date(),
        EndDate: null, // Not in current DTO
        AmountPerPay: 0, // Would need to calculate
        PayCutoff: null,
      }));
    }
    return [];
  }, [employee]);

  const [advances, setAdvances] = useState<AdvanceForm[]>(initialAdvances);
  const [formData, setFormData] = useState<AdvanceForm>({
    AdvId: 0,
    AdvType: "",
    AdvDate: new Date(),
    AdvAmount: 0,
    AddedAmount: 0,
    PayPerMonth: 2,
    StartDate: new Date(),
    EndDate: null,
    AmountPerPay: 0,
    PayCutoff: null,
  });

  // Sync state when employee data changes
  useEffect(() => {
    setAdvances(initialAdvances);
  }, [initialAdvances]);

  // Calculate amount per pay when amount or pay per month changes
  useEffect(() => {
    if (formData.AdvAmount > 0 && formData.PayPerMonth > 0) {
      const amountPerPay =
        (formData.AdvAmount + formData.AddedAmount) / formData.PayPerMonth;
      setFormData({
        ...formData,
        AmountPerPay: Math.round(amountPerPay * 100) / 100,
      });
    }
  }, [formData.AdvAmount, formData.AddedAmount, formData.PayPerMonth]);

  const handleAddAdvance = () => {
    if (
      !formData.AdvType ||
      formData.AdvAmount <= 0 ||
      !formData.StartDate ||
      formData.AmountPerPay <= 0
    ) {
      toast({
        title: "Validation Error",
        description:
          "Please fill in Loan Type, Amount, Start Date, and ensure Amount Per Pay is calculated",
        variant: "destructive",
      });
      return;
    }

    const newAdvance: AdvanceForm = {
      ...formData,
      AdvId: Date.now(), // Temporary ID
    };
    setAdvances([...advances, newAdvance]);

    // Reset form
    setFormData({
      AdvId: 0,
      AdvType: "",
      AdvDate: new Date(),
      AdvAmount: 0,
      AddedAmount: 0,
      PayPerMonth: 2,
      StartDate: new Date(),
      EndDate: null,
      AmountPerPay: 0,
      PayCutoff: null,
    });
  };

  const handleRemoveAdvance = (index: number) => {
    const newAdvances = advances.filter((_, i) => i !== index);
    setAdvances(newAdvances);
  };

  const handleSave = async () => {
    try {
      // Serialize dates properly - handle both Date objects and strings
      const advancesToSave = advances.map((adv) => {
        const advDate = adv.AdvDate
          ? adv.AdvDate instanceof Date
            ? adv.AdvDate
            : new Date(adv.AdvDate)
          : null;
        const startDate = adv.StartDate
          ? adv.StartDate instanceof Date
            ? adv.StartDate
            : new Date(adv.StartDate)
          : null;
        const endDate = adv.EndDate
          ? adv.EndDate instanceof Date
            ? adv.EndDate
            : new Date(adv.EndDate)
          : null;

        return {
          ...adv,
          AdvDate: advDate,
          StartDate: startDate,
          EndDate: endDate,
        };
      });

      await saveMutation.mutateAsync({ advances: advancesToSave });
      toast({
        title: "Success",
        description: "Advances and loans saved successfully",
      });
    } catch (error) {
      console.error("Save advances error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save advances and loans",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Add Advance Form */}
      <div className="bg-card rounded-xl border border-border/60 p-5">
        <h4 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border/60">Add Advance/Loan</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="adv_type">Loan Type</Label>
            <Select
              value={formData.AdvType}
              onValueChange={(value) =>
                setFormData({ ...formData, AdvType: value })
              }
            >
              <SelectTrigger id="adv_type">
                <SelectValue placeholder="Select loan type" />
              </SelectTrigger>
              <SelectContent>
                {ADVANCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="adv_date">Date Issued</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="adv_date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.AdvDate && "text-muted-foreground"
                  )}
                >
                  {formData.AdvDate
                    ? format(formData.AdvDate, "PPP")
                    : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.AdvDate || undefined}
                  onSelect={(date) =>
                    setFormData({ ...formData, AdvDate: date || new Date() })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="adv_amount">Loan Amount</Label>
            <Input
              id="adv_amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.AdvAmount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  AdvAmount: parseFloat(e.target.value) || 0,
                })
              }
              className="text-right"
            />
          </div>

          <div>
            <Label htmlFor="adv_added_amount">Added Amount</Label>
            <Input
              id="adv_added_amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.AddedAmount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  AddedAmount: parseFloat(e.target.value) || 0,
                })
              }
              className="text-right"
            />
          </div>

          <div>
            <Label htmlFor="adv_start_date">Date Start</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="adv_start_date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.StartDate && "text-muted-foreground"
                  )}
                >
                  {formData.StartDate
                    ? format(formData.StartDate, "PPP")
                    : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.StartDate || undefined}
                  onSelect={(date) =>
                    setFormData({ ...formData, StartDate: date || new Date() })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="adv_pay_per_month">Monthly Installment</Label>
            <Select
              value={formData.PayPerMonth.toString()}
              onValueChange={(value) =>
                setFormData({ ...formData, PayPerMonth: parseInt(value) })
              }
            >
              <SelectTrigger id="adv_pay_per_month">
                <SelectValue placeholder="Select payment frequency" />
              </SelectTrigger>
              <SelectContent>
                {MONTHLY_PAYMENTS.map((pay) => (
                  <SelectItem key={pay.value} value={pay.value.toString()}>
                    {pay.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="adv_amount_per_pay">Installment Amount</Label>
            <Input
              id="adv_amount_per_pay"
              type="number"
              step="0.01"
              min="0"
              value={formData.AmountPerPay}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  AmountPerPay: parseFloat(e.target.value) || 0,
                })
              }
              className="text-right"
              readOnly
            />
          </div>

          <div>
            <Label htmlFor="adv_pay_cutoff">Pay Cutoff</Label>
            <Select
              value={formData.PayCutoff?.toString() || "none"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  PayCutoff: value === "none" ? null : parseInt(value),
                })
              }
            >
              <SelectTrigger id="adv_pay_cutoff">
                <SelectValue placeholder="Select cutoff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {CUTOFF_PAYMENTS.map((cutoff) => (
                  <SelectItem
                    key={cutoff.value}
                    value={cutoff.value.toString()}
                  >
                    {cutoff.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button type="button" onClick={handleAddAdvance} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add Advance
            </Button>
          </div>
        </div>
      </div>

      {/* Advances Table */}
      <div className="bg-card rounded-xl border border-border/60 p-5">
        <h4 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border/60">Advances &amp; Loans History</h4>
        {advances.length === 0 ? (
          <div className="text-center py-8 border rounded-lg">
            <p className="text-muted-foreground">No advances or loans found.</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan Type</TableHead>
                  <TableHead>Date Issued</TableHead>
                  <TableHead className="text-right">Loan Amount</TableHead>
                  <TableHead className="text-right">Added Amount</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Installment</TableHead>
                  <TableHead>Date Start</TableHead>
                  <TableHead>Monthly Installment</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((advance, index) => (
                  <TableRow key={advance.AdvId || index}>
                    <TableCell>{advance.AdvType}</TableCell>
                    <TableCell>
                      {advance.AdvDate ? format(advance.AdvDate, "PPP") : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {advance.AdvAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {advance.AddedAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(advance.AdvAmount + advance.AddedAmount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {advance.AmountPerPay.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {advance.StartDate
                        ? format(advance.StartDate, "PPP")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {MONTHLY_PAYMENTS.find(
                        (p) => p.value === advance.PayPerMonth
                      )?.label || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAdvance(index)}
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

"use client";

import { useState, useEffect, useMemo } from "react";
import {
  EmployeeDetail,
  useSaveWorkInformation,
} from "@/lib/hooks/useEmployeeDetail";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const EMPLOYMENT_TYPES = [
  { value: 1, label: "Regular" },
  { value: 2, label: "Contract" },
  { value: 3, label: "Probationary" },
] as const;

interface ApprovalLevelRow {
  AlLevel: number;
  AlApprv: string;
}

// Helper function to convert number to ordinal (1st, 2nd, 3rd, etc.)
function getOrdinal(num: number): string {
  if (num <= 0) return num.toString();

  const j = num % 10;
  const k = num % 100;

  if (k >= 11 && k <= 13) {
    return num + "th";
  }

  switch (j) {
    case 1:
      return num + "st";
    case 2:
      return num + "nd";
    case 3:
      return num + "rd";
    default:
      return num + "th";
  }
}

interface WorkInformationTabProps {
  employee: EmployeeDetail;
  employeeList?: Array<{ EmpId: string; TextName: string }>;
}

export function WorkInformationTab({
  employee,
  employeeList = [],
}: WorkInformationTabProps) {
  const { toast } = useToast();
  const saveMutation = useSaveWorkInformation(employee.Account.EmpId);

  const wrk = employee.EmpWrk;

  const [emp_code, setEmpCode] = useState(wrk?.emp_code ?? "");
  const [emp_type, setEmpType] = useState<number>(wrk?.emp_type ?? 1);
  const [emp_datehired, setEmpDatehired] = useState<Date | null>(
    wrk?.emp_datehired ? new Date(wrk.emp_datehired) : null
  );
  const [emp_dateexp, setEmpDateexp] = useState<Date | null>(
    wrk?.emp_dateexp ? new Date(wrk.emp_dateexp) : null
  );
  const [emp_datereg, setEmpDatereg] = useState<Date | null>(
    wrk?.emp_datereg ? new Date(wrk.emp_datereg) : null
  );
  const [emp_supervisor, setEmpSupervisor] = useState(
    wrk?.emp_supervisor ?? "None"
  );
  const [emp_remarks, setEmpRemarks] = useState(wrk?.emp_remarks ?? "");
  const [emp_sss, setEmpSss] = useState(wrk?.emp_sss ?? "");
  const [emp_philhealth, setEmpPhilhealth] = useState(
    wrk?.emp_philhealth ?? ""
  );
  const [emp_pagibig, setEmpPagibig] = useState(wrk?.emp_pagibig ?? "");
  const [emp_tin, setEmpTin] = useState(wrk?.emp_tin ?? "");
  const [emp_taxstat, setEmpTaxstat] = useState(wrk?.emp_taxstat ?? "");
  const [emp_rdo, setEmpRdo] = useState(wrk?.emp_rdo ?? "");
  const [emp_passport, setEmpPassport] = useState(wrk?.emp_passport ?? "");
  const [emp_prc, setEmpPrc] = useState(wrk?.emp_prc ?? "");

  const initialApprovalLevels: ApprovalLevelRow[] = useMemo(() => {
    if (employee.Approval && employee.Approval.length > 0) {
      return employee.Approval.map((a, index) => ({
        AlLevel: a.AlLevel ?? index + 1, // Level is implicit: index 0 = level 1, index 1 = level 2, etc.
        AlApprv: a.AlApprv ?? "",
      }));
    }
    return [];
  }, [employee.Approval]);

  const [approvalLevels, setApprovalLevels] = useState<ApprovalLevelRow[]>(
    initialApprovalLevels
  );

  useEffect(() => {
    if (wrk) {
      setEmpCode(wrk.emp_code ?? "");
      setEmpType(wrk.emp_type ?? 1);
      setEmpDatehired(wrk.emp_datehired ? new Date(wrk.emp_datehired) : null);
      setEmpDateexp(wrk.emp_dateexp ? new Date(wrk.emp_dateexp) : null);
      setEmpDatereg(wrk.emp_datereg ? new Date(wrk.emp_datereg) : null);
      setEmpSupervisor(wrk.emp_supervisor ?? "None");
      setEmpRemarks(wrk.emp_remarks ?? "");
      setEmpSss(wrk.emp_sss ?? "");
      setEmpPhilhealth(wrk.emp_philhealth ?? "");
      setEmpPagibig(wrk.emp_pagibig ?? "");
      setEmpTin(wrk.emp_tin ?? "");
      setEmpTaxstat(wrk.emp_taxstat ?? "");
      setEmpRdo(wrk.emp_rdo ?? "");
      setEmpPassport(wrk.emp_passport ?? "");
      setEmpPrc(wrk.emp_prc ?? "");
    }
  }, [wrk]);

  useEffect(() => {
    setApprovalLevels(initialApprovalLevels);
  }, [initialApprovalLevels]);

  // Sync supervisor with first approver when approval levels change
  useEffect(() => {
    if (approvalLevels.length > 0 && approvalLevels[0].AlApprv) {
      setEmpSupervisor(approvalLevels[0].AlApprv);
    }
  }, [approvalLevels]);

  const addApprovalLevel = () => {
    const lastIndex = approvalLevels.length - 1;
    // Only add if the last approver is not empty and not "None"
    if (
      lastIndex >= 0 &&
      approvalLevels[lastIndex].AlApprv &&
      approvalLevels[lastIndex].AlApprv !== "None"
    ) {
      const nextLevel = approvalLevels.length + 1;
      setApprovalLevels([
        ...approvalLevels,
        { AlLevel: nextLevel, AlApprv: "" },
      ]);
    } else if (approvalLevels.length === 0) {
      // If no approval levels exist, add the first one
      setApprovalLevels([{ AlLevel: 1, AlApprv: "" }]);
    }
  };

  const removeApprovalLevel = (index: number) => {
    if (index > 0) {
      // Can only remove rows after the first one
      const updated = approvalLevels.filter((_, i) => i !== index);
      // Recalculate levels based on index
      const recalculated = updated.map((a, i) => ({
        ...a,
        AlLevel: i + 1,
      }));
      setApprovalLevels(recalculated);
    }
  };

  const updateApprovalLevel = (
    index: number,
    field: keyof ApprovalLevelRow,
    value: number | string
  ) => {
    const next = [...approvalLevels];
    next[index] = { ...next[index], [field]: value };

    // If it's the first approver (index 0), also update supervisor
    if (index === 0 && field === "AlApprv") {
      setEmpSupervisor(value as string);
    }

    // If first approver is set to "None", remove all other approvers
    if (index === 0 && field === "AlApprv" && value === "None") {
      setApprovalLevels([{ AlLevel: 1, AlApprv: "None" }]);
      setEmpSupervisor("None");
    } else {
      setApprovalLevels(next);
    }
  };

  // Get available approvers for a given index (exclude already selected ones)
  const getAvailableApprovers = (index: number) => {
    const selectedIds = approvalLevels
      .map((a) => a.AlApprv)
      .filter((id) => id && id !== "None" && id !== approvalLevels[index]?.AlApprv);
    return supervisorOptions.filter(
      (e) => !selectedIds.includes(e.EmpId) || e.EmpId === approvalLevels[index]?.AlApprv
    );
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        emp_code: emp_code || null,
        emp_type,
        emp_datehired: emp_datehired ?? undefined,
        emp_dateexp: emp_dateexp ?? undefined,
        emp_datereg: emp_datereg ?? undefined,
        emp_supervisor: emp_supervisor || "None",
        emp_remarks: emp_remarks || null,
        emp_sss: emp_sss || null,
        emp_philhealth: emp_philhealth || null,
        emp_pagibig: emp_pagibig || null,
        emp_tin: emp_tin || null,
        emp_taxstat: emp_taxstat || null,
        emp_rdo: emp_rdo || null,
        emp_passport: emp_passport || null,
        emp_prc: emp_prc || null,
        approvalLevels: approvalLevels.map((a, index) => ({
          AlLevel: index + 1, // Level is implicit based on position
          AlApprv: a.AlApprv,
        })).filter(
          (a) => a.AlApprv && a.AlApprv !== "None"
        ),
      });
      toast({
        title: "Success",
        description: "Work information saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save work information",
        variant: "destructive",
      });
    }
  };

  const supervisorOptions = employeeList.filter(
    (e) => e.EmpId !== employee.Account.EmpId && e.EmpId !== "admin"
  );

  return (
    <div className="space-y-6">
      {/* Work Information */}
      <div>
        <h4 className="text-lg font-semibold mb-4">Work Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="emp_code">Employee Code</Label>
            <Input
              id="emp_code"
              value={emp_code}
              onChange={(e) => setEmpCode(e.target.value)}
              placeholder="Employee code"
            />
          </div>
          <div>
            <Label htmlFor="emp_type">Employment Type</Label>
            <Select
              value={String(emp_type)}
              onValueChange={(v) => setEmpType(Number(v))}
            >
              <SelectTrigger id="emp_type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={String(t.value)}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date Hired</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !emp_datehired && "text-muted-foreground"
                  )}
                >
                  {emp_datehired ? format(emp_datehired, "PPP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={emp_datehired ?? undefined}
                  onSelect={(d) => setEmpDatehired(d ?? null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Date Expiry</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !emp_dateexp && "text-muted-foreground"
                  )}
                >
                  {emp_dateexp ? format(emp_dateexp, "PPP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={emp_dateexp ?? undefined}
                  onSelect={(d) => setEmpDateexp(d ?? null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Date Regularized</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !emp_datereg && "text-muted-foreground"
                  )}
                >
                  {emp_datereg ? format(emp_datereg, "PPP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={emp_datereg ?? undefined}
                  onSelect={(d) => setEmpDatereg(d ?? null)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="emp_supervisor">Supervisor</Label>
            <Select value={emp_supervisor} onValueChange={setEmpSupervisor}>
              <SelectTrigger id="emp_supervisor">
                <SelectValue placeholder="Select supervisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="None">None</SelectItem>
                {supervisorOptions.map((e) => (
                  <SelectItem key={e.EmpId} value={e.EmpId}>
                    {e.TextName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <Label htmlFor="emp_remarks">Remarks</Label>
            <Textarea
              id="emp_remarks"
              value={emp_remarks}
              onChange={(e) => setEmpRemarks(e.target.value)}
              rows={2}
              placeholder="Remarks"
            />
          </div>
          <div>
            <Label htmlFor="emp_sss">SSS</Label>
            <Input
              id="emp_sss"
              value={emp_sss}
              onChange={(e) => setEmpSss(e.target.value)}
              placeholder="SSS number"
            />
          </div>
          <div>
            <Label htmlFor="emp_philhealth">PhilHealth</Label>
            <Input
              id="emp_philhealth"
              value={emp_philhealth}
              onChange={(e) => setEmpPhilhealth(e.target.value)}
              placeholder="PhilHealth number"
            />
          </div>
          <div>
            <Label htmlFor="emp_pagibig">Pag-IBIG</Label>
            <Input
              id="emp_pagibig"
              value={emp_pagibig}
              onChange={(e) => setEmpPagibig(e.target.value)}
              placeholder="Pag-IBIG number"
            />
          </div>
          <div>
            <Label htmlFor="emp_tin">TIN</Label>
            <Input
              id="emp_tin"
              value={emp_tin}
              onChange={(e) => setEmpTin(e.target.value)}
              placeholder="Tax identification number"
            />
          </div>
          <div>
            <Label htmlFor="emp_taxstat">Tax Status</Label>
            <Input
              id="emp_taxstat"
              value={emp_taxstat}
              onChange={(e) => setEmpTaxstat(e.target.value)}
              placeholder="e.g. S, ME1"
            />
          </div>
          <div>
            <Label htmlFor="emp_rdo">RDO</Label>
            <Input
              id="emp_rdo"
              value={emp_rdo}
              onChange={(e) => setEmpRdo(e.target.value)}
              placeholder="Revenue district office"
            />
          </div>
          <div>
            <Label htmlFor="emp_passport">Passport</Label>
            <Input
              id="emp_passport"
              value={emp_passport}
              onChange={(e) => setEmpPassport(e.target.value)}
              placeholder="Passport number"
            />
          </div>
          <div>
            <Label htmlFor="emp_prc">PRC</Label>
            <Input
              id="emp_prc"
              value={emp_prc}
              onChange={(e) => setEmpPrc(e.target.value)}
              placeholder="PRC license"
            />
          </div>
        </div>
      </div>

      {/* Approval Levels */}
      <div>
        <h4 className="text-lg font-semibold mb-4">Approval Levels</h4>
        <div className="space-y-4">
          {approvalLevels.length === 0 ? (
            <div className="text-center text-muted-foreground py-4 border rounded-lg">
              <p>The employee doesn't have an approval level assigned.</p>
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                onClick={addApprovalLevel}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add approval level
              </Button>
            </div>
          ) : (
            approvalLevels.map((row, index) => {
              const isLast = index === approvalLevels.length - 1;
              const availableApprovers = getAvailableApprovers(index);
              const levelLabel =
                index === 0
                  ? "Supervisor/1st Approver"
                  : row.AlLevel === 1
                  ? "1st Approver"
                  : `${getOrdinal(row.AlLevel)} level Approver`;

              return (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`approval-input-${index + 1}`}>
                    {levelLabel}
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={row.AlApprv}
                      onValueChange={(v) =>
                        updateApprovalLevel(index, "AlApprv", v)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select Approver.." />
                      </SelectTrigger>
                      <SelectContent>
                        {index === 0 ? (
                          // First approver can select "None"
                          <>
                            <SelectItem value="None">None</SelectItem>
                            {availableApprovers.map((e) => (
                              <SelectItem key={e.EmpId} value={e.EmpId}>
                                {e.TextName}
                              </SelectItem>
                            ))}
                          </>
                        ) : (
                          // Other approvers cannot select "None"
                          availableApprovers
                            .filter((e) => e.EmpId !== "None")
                            .map((e) => (
                              <SelectItem key={e.EmpId} value={e.EmpId}>
                                {e.TextName}
                              </SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                    {isLast && (
                      <div className="flex gap-1">
                        {index > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeApprovalLevel(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {row.AlApprv && row.AlApprv !== "None" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={addApprovalLevel}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Work Information"}
        </Button>
      </div>
    </div>
  );
}

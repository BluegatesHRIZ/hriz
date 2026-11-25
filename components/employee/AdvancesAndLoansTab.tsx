"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoanTermsFields } from "@/components/loans/LoanTermsFields";
import {
  EmployeeDetail,
  useAddAdvance,
  useDeleteAdvance,
} from "@/lib/hooks/useEmployeeDetail";
import { useToast } from "@/lib/hooks/use-toast";
import type { EmployeeAdvance, LoanTerms } from "@/lib/types";
import {
  emptyLoanTerms,
  estimatedEndDate,
  formatInputDate,
  formatMoney,
  PAY_CUTOFF_LABEL,
  PAY_PER_MONTH_LABEL,
  validateLoanTerms,
} from "@/lib/utils/loanTerms";

interface AdvancesAndLoansTabProps {
  employee: EmployeeDetail;
}

function totalOf(a: EmployeeAdvance): number {
  return (a.AdvAmount ?? 0) + (a.AdvAddedAmount ?? 0);
}

function endOf(a: EmployeeAdvance): string | null {
  if (!a.AdvDateStart || !a.AdvPayPerMonth) return null;
  return estimatedEndDate({
    loanType: a.AdvType ?? "",
    loanAmount: a.AdvAmount ?? 0,
    addedAmount: a.AdvAddedAmount,
    installmentAmount: a.AdvAmountPerPay,
    dateIssued: a.AdvDateIssued ?? "",
    dateStart: a.AdvDateStart,
    payPerMonth: a.AdvPayPerMonth === 1 ? "1" : "2",
    payCutoff: "",
  });
}

export function AdvancesAndLoansTab({ employee }: AdvancesAndLoansTabProps) {
  const { toast } = useToast();
  const empId = employee.Account.EmpId;
  const addAdvance = useAddAdvance(empId);
  const deleteAdvance = useDeleteAdvance(empId);

  const [terms, setTerms] = useState<LoanTerms>(() => emptyLoanTerms());
  const [deleteTarget, setDeleteTarget] = useState<EmployeeAdvance | null>(null);

  const advances = employee.EmpAdvance ?? [];
  const activeSalary =
    employee.EmpSalary.find((s) => (s.SalStatus ?? 1) === 1) ?? employee.EmpSalary[0];
  const totalLoan = advances.reduce((sum, a) => sum + totalOf(a), 0);
  const totalPaid = advances.reduce((sum, a) => sum + (a.AdvPaid ?? 0), 0);

  async function handleAdd() {
    const problem = validateLoanTerms(terms);
    if (problem) {
      toast({ title: "Check the loan details", description: problem, variant: "destructive" });
      return;
    }
    try {
      await addAdvance.mutateAsync({
        AdvType: terms.loanType,
        AdvDate: terms.dateIssued,
        AdvAmount: terms.loanAmount,
        AddedAmount: terms.addedAmount,
        PayPerMonth: Number(terms.payPerMonth),
        PayCutoff: terms.payPerMonth === "1" && terms.payCutoff ? Number(terms.payCutoff) : null,
        StartDate: terms.dateStart,
        AmountPerPay: terms.installmentAmount,
      });
      toast({ title: "Loan added" });
      setTerms(emptyLoanTerms());
    } catch (error) {
      toast({
        title: "Could not add the loan",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAdvance.mutateAsync(deleteTarget.AdvCode);
      toast({ title: "Loan deleted" });
    } catch (error) {
      toast({
        title: "Could not delete the loan",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <h4 className="text-base font-semibold text-foreground">Advances</h4>
        <dl className="mt-2 space-y-0.5 text-sm text-muted-foreground">
          <div>
            <dt className="inline">Base Salary: </dt>
            <dd className="inline font-mono">{formatMoney(activeSalary?.SalAmount ?? 0)}</dd>
          </div>
          <div>
            <dt className="inline">Total loan amount: </dt>
            <dd className="inline font-mono">{formatMoney(totalLoan)}</dd>
          </div>
          <div>
            <dt className="inline">Total paid amount: </dt>
            <dd className="inline font-mono">{formatMoney(totalPaid)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <LoanTermsFields value={terms} onChange={setTerms} idPrefix="adv" />
          </div>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={addAdvance.isPending}
            className="lg:mb-0.5"
          >
            <Plus className="mr-2 h-4 w-4" />
            {addAdvance.isPending ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan type</TableHead>
                <TableHead className="text-right">Loan amount</TableHead>
                <TableHead className="text-right">Added amount</TableHead>
                <TableHead className="text-right">Total amount</TableHead>
                <TableHead className="text-right">Installment amount</TableHead>
                <TableHead>Date issued</TableHead>
                <TableHead>Date start</TableHead>
                <TableHead>Monthly installment</TableHead>
                <TableHead>Installment type</TableHead>
                <TableHead>Est. date end</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {advances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="py-8 text-center text-muted-foreground">
                    No data to display
                  </TableCell>
                </TableRow>
              ) : (
                advances.map((a) => {
                  const total = totalOf(a);
                  const remaining = Math.max(total - (a.AdvPaid ?? 0), 0);
                  const perMonth = a.AdvPayPerMonth != null ? String(a.AdvPayPerMonth) : "";
                  const cutoff = a.AdvPayCutoff != null ? String(a.AdvPayCutoff) : "";
                  return (
                    <TableRow key={a.AdvCode}>
                      <TableCell>{a.AdvType ?? "-"}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(a.AdvAmount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(a.AdvAddedAmount)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(total)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(a.AdvAmountPerPay)}</TableCell>
                      <TableCell>{formatInputDate(a.AdvDateIssued)}</TableCell>
                      <TableCell>{formatInputDate(a.AdvDateStart)}</TableCell>
                      <TableCell>{PAY_PER_MONTH_LABEL[perMonth] ?? "-"}</TableCell>
                      <TableCell>
                        {perMonth === "2" ? "Every cutoff" : PAY_CUTOFF_LABEL[cutoff] ?? "Any cutoff"}
                      </TableCell>
                      <TableCell>{formatInputDate(endOf(a))}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(a.AdvPaid)}</TableCell>
                      <TableCell className="text-right font-mono">{formatMoney(remaining)}</TableCell>
                      <TableCell>
                        {a.AdvStatus === 1 ? (remaining > 0 ? "Active" : "Paid") : "Awaiting release"}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${a.AdvType ?? "loan"}`}
                          disabled={(a.AdvPaid ?? 0) > 0 || deleteAdvance.isPending}
                          title={(a.AdvPaid ?? 0) > 0 ? "Payroll has collected from this loan" : "Delete"}
                          onClick={() => setDeleteTarget(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this loan?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.AdvType ?? "Loan"} for {formatMoney(deleteTarget ? totalOf(deleteTarget) : 0)} will
              be removed and payroll will stop collecting it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

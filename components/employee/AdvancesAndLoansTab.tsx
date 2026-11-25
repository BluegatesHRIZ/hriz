"use client";

import { useState } from "react";
import { HandCoins, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/** "Twice a month" or "Once a month, 1st cutoff". */
function scheduleOf(a: EmployeeAdvance): string {
  if (a.AdvPayPerMonth === 2) return "Twice a month";
  if (a.AdvPayPerMonth === 1) {
    const cutoff = a.AdvPayCutoff != null ? PAY_CUTOFF_LABEL[String(a.AdvPayCutoff)] : null;
    return cutoff ? `Once a month, ${cutoff.toLowerCase()}` : "Once a month";
  }
  return "-";
}

function StatusBadge({ advance, remaining }: { advance: EmployeeAdvance; remaining: number }) {
  if (advance.AdvStatus !== 1) return <Badge variant="warning">Awaiting release</Badge>;
  if (remaining > 0) return <Badge variant="info">Active</Badge>;
  return <Badge variant="success">Paid</Badge>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function AdvancesAndLoansTab({ employee }: AdvancesAndLoansTabProps) {
  const { toast } = useToast();
  const empId = employee.Account.EmpId;
  const addAdvance = useAddAdvance(empId);
  const deleteAdvance = useDeleteAdvance(empId);

  const [addOpen, setAddOpen] = useState(false);
  const [terms, setTerms] = useState<LoanTerms>(() => emptyLoanTerms());
  const [deleteTarget, setDeleteTarget] = useState<EmployeeAdvance | null>(null);

  const advances = employee.EmpAdvance ?? [];
  const activeSalary =
    employee.EmpSalary.find((s) => (s.SalStatus ?? 1) === 1) ?? employee.EmpSalary[0];
  const totalLoan = advances.reduce((sum, a) => sum + totalOf(a), 0);
  const totalPaid = advances.reduce((sum, a) => sum + (a.AdvPaid ?? 0), 0);
  const activeCount = advances.filter(
    (a) => a.AdvStatus === 1 && totalOf(a) - (a.AdvPaid ?? 0) > 0,
  ).length;

  function openAdd() {
    setTerms(emptyLoanTerms());
    setAddOpen(true);
  }

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
      setAddOpen(false);
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-foreground">Advances and loans</h4>
          <p className="text-sm text-muted-foreground">
            Payroll collects each installment from the loan&apos;s date start.
          </p>
        </div>
        <Button type="button" onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add loan
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Base salary" value={`₱${formatMoney(activeSalary?.SalAmount ?? 0)}`} />
        <Stat
          label="Total loaned"
          value={`₱${formatMoney(totalLoan)}`}
          hint={`${advances.length} ${advances.length === 1 ? "loan" : "loans"}`}
        />
        <Stat label="Total paid" value={`₱${formatMoney(totalPaid)}`} />
        <Stat
          label="Outstanding"
          value={`₱${formatMoney(Math.max(totalLoan - totalPaid, 0))}`}
          hint={`${activeCount} active`}
        />
      </div>

      <div className="rounded-xl border border-border/60 bg-card">
        {advances.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <HandCoins className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No advances or loans</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Loans added here or released from Manage Loans show up in this list.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add loan
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Installment</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead className="min-w-44">Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((a) => {
                  const total = totalOf(a);
                  const paid = a.AdvPaid ?? 0;
                  const remaining = Math.max(total - paid, 0);
                  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
                  const collected = paid > 0;
                  return (
                    <TableRow key={a.AdvCode}>
                      <TableCell>
                        <p className="font-medium text-foreground">{a.AdvType ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">
                          Issued {formatInputDate(a.AdvDateIssued)}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="tabular font-medium text-foreground">₱{formatMoney(total)}</p>
                        {(a.AdvAddedAmount ?? 0) > 0 && (
                          <p className="tabular text-xs text-muted-foreground">
                            {formatMoney(a.AdvAmount)} + {formatMoney(a.AdvAddedAmount)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="tabular text-foreground">₱{formatMoney(a.AdvAmountPerPay)}</p>
                        <p className="text-xs text-muted-foreground">{scheduleOf(a)}</p>
                      </TableCell>
                      <TableCell>
                        <p className="tabular text-foreground">{formatInputDate(a.AdvDateStart)}</p>
                        <p className="tabular text-xs text-muted-foreground">
                          Ends about {formatInputDate(endOf(a))}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="tabular text-foreground">₱{formatMoney(paid)}</span>
                          <span className="tabular text-muted-foreground">
                            ₱{formatMoney(remaining)} left
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={Math.round(pct)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label="Paid so far"
                        >
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge advance={a} remaining={remaining} />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${a.AdvType ?? "loan"}`}
                          disabled={collected || deleteAdvance.isPending}
                          title={collected ? "Payroll has collected from this loan" : "Delete"}
                          onClick={() => setDeleteTarget(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={(open) => !addAdvance.isPending && setAddOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add loan</DialogTitle>
            <DialogDescription>
              The loan goes straight to this employee&apos;s advances. Payroll starts collecting it
              on the date start.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <LoanTermsFields value={terms} onChange={setTerms} idPrefix="adv" />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={addAdvance.isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAdd} disabled={addAdvance.isPending}>
              {addAdvance.isPending ? "Adding..." : "Add loan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this loan?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.AdvType ?? "Loan"} for ₱{formatMoney(deleteTarget ? totalOf(deleteTarget) : 0)} will
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

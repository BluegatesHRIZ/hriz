"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Banknote } from "lucide-react";
import {
  LoanGridManagement,
  LoanManagementDTO,
  useLoanManagementList,
  useManageLoan,
} from "@/lib/hooks/useRequestManagement";
import { useToast } from "@/lib/hooks/use-toast";
import { useAuth } from "@/lib/auth/context";
import { useAuthorizationMap } from "@/lib/hooks/useAuthorization";
import { hasAnyPermission, parsePermissionMask } from "@/lib/auth/permissions";
import { LoanTermsFields } from "@/components/loans/LoanTermsFields";
import type { LoanTerms } from "@/lib/types";
import { emptyLoanTerms, validateLoanTerms } from "@/lib/utils/loanTerms";

const STATUS_MAP: Record<number, { label: string; variant: string; className?: string }> = {
  0: { label: "Pending", variant: "outline" },
  1: { label: "Approved", variant: "default", className: "bg-blue-600 text-white" },
  2: { label: "Rejected", variant: "destructive" },
  3: { label: "Cancelled", variant: "secondary" },
  4: { label: "Resubmitted", variant: "outline", className: "border-yellow-500 text-yellow-700" },
  5: { label: "Released", variant: "default", className: "bg-green-600 text-white" },
};

function StatusBadge({ status }: { status?: number }) {
  const cfg = STATUS_MAP[status ?? -1] ?? { label: "Unknown", variant: "outline" };
  return (
    <Badge variant={cfg.variant as any} className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

function fmt(date?: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

function fmtAmt(n?: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LoanManagementTable() {
  const { data: loans = [], isLoading } = useLoanManagementList();
  const manageLoan = useManageLoan();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const { data: authMap } = useAuthorizationMap();
  const userMask = parsePermissionMask(user?.permissions ?? "0");
  const allows = (routeKey: string) =>
    hasAnyPermission(userMask, parsePermissionMask(authMap?.routePermissions?.[routeKey] ?? "0"));
  // The API enforces the same rules; this only hides buttons that would be refused.
  const canApprove = allows("apiLoanApprove");
  const canRelease = allows("apiLoanRelease");

  const [rejectTarget, setRejectTarget] = useState<LoanGridManagement | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<LoanGridManagement | null>(null);
  const [releaseTerms, setReleaseTerms] = useState<LoanTerms>(() => emptyLoanTerms());

  function openRelease(loan: LoanGridManagement) {
    setReleaseTerms(
      emptyLoanTerms({
        loanType: loan.LoaType || "Company Loan",
        loanAmount: loan.LoaAmt ?? 0,
        addedAmount: loan.EmpAdaddedamt ?? 0,
        installmentAmount: loan.EmpAdamtperpay ?? 0,
        payPerMonth: loan.EmpAdpaypermonth === 1 ? "1" : "2",
        payCutoff:
          loan.EmpAdpaypermonth === 1 && (loan.EmpAdpaycutoff === 1 || loan.EmpAdpaycutoff === 2)
            ? (String(loan.EmpAdpaycutoff) as "1" | "2")
            : "",
      }),
    );
    setReleaseTarget(loan);
  }

  async function handleApprove(loan: LoanGridManagement) {
    if (!loan.LoaId || !loan.LoaEmp) return;
    const ok = await confirm({
      title: `Approve ${loan.EmpName ?? loan.LoaEmp}'s loan?`,
      description: `Loan ${loan.LoaId}, a ${loan.LoaType ?? "loan"} of PHP ${fmtAmt(loan.LoaAmt)}, will be marked approved.`,
      confirmText: `Approve PHP ${fmtAmt(loan.LoaAmt)}`,
    });
    if (!ok) return;
    try {
      const dto: LoanManagementDTO = {
        LoaId: loan.LoaId,
        Status: "approve" as any,
        LoaEmp: loan.LoaEmp,
        EmpAdtype: loan.LoaType ?? "",
        EmpAddate: loan.LoaApplieddate ? new Date(loan.LoaApplieddate) : new Date(),
        EmpAdamt: loan.LoaAmt ?? 0,
        EmpAdaddedamt: 0,
        EmpAdpaypermonth: 0,
        EmpAdpaycutoff: null,
        EmpAdstart: new Date(),
        EmpAdamtperpay: 0,
      };
      await manageLoan.mutateAsync(dto);
      toast({ title: "Loan approved" });
    } catch (err) {
      toast({ title: "Failed to approve", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  }

  async function confirmRelease() {
    if (!releaseTarget?.LoaId || !releaseTarget.LoaEmp) return;
    const problem = validateLoanTerms(releaseTerms);
    if (problem) {
      toast({ title: "Check the loan terms", description: problem, variant: "destructive" });
      return;
    }
    const ok = await confirm({
      title: `Release PHP ${fmtAmt(releaseTerms.loanAmount)} to ${releaseTarget.EmpName ?? releaseTarget.LoaEmp}?`,
      description: `Loan ${releaseTarget.LoaId} goes into their advances, deducted at PHP ${fmtAmt(releaseTerms.installmentAmount)} per installment starting ${releaseTerms.dateStart}.`,
      confirmText: `Release PHP ${fmtAmt(releaseTerms.loanAmount)}`,
    });
    if (!ok) return;
    try {
      const once = releaseTerms.payPerMonth === "1";
      const dto: LoanManagementDTO = {
        LoaId: releaseTarget.LoaId,
        Status: "release" as any,
        LoaEmp: releaseTarget.LoaEmp,
        EmpAdtype: releaseTerms.loanType,
        EmpAddate: releaseTerms.dateIssued,
        EmpAdamt: releaseTerms.loanAmount,
        EmpAdaddedamt: releaseTerms.addedAmount,
        EmpAdpaypermonth: Number(releaseTerms.payPerMonth),
        EmpAdpaycutoff: once && releaseTerms.payCutoff ? Number(releaseTerms.payCutoff) : null,
        EmpAdstart: releaseTerms.dateStart,
        EmpAdamtperpay: releaseTerms.installmentAmount,
      };
      await manageLoan.mutateAsync(dto);
      toast({ title: "Loan released", description: "It is now in the employee's advances." });
      setReleaseTarget(null);
    } catch (err) {
      toast({ title: "Failed to release", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  }

  async function confirmReject() {
    if (!rejectTarget?.LoaId || !rejectTarget.LoaEmp) return;
    try {
      const dto: LoanManagementDTO = {
        LoaId: rejectTarget.LoaId,
        Status: "reject" as any,
        LoaEmp: rejectTarget.LoaEmp,
        EmpAdtype: rejectTarget.LoaType ?? "",
        EmpAddate: rejectTarget.LoaApplieddate ? new Date(rejectTarget.LoaApplieddate) : new Date(),
        EmpAdamt: rejectTarget.LoaAmt ?? 0,
        EmpAdaddedamt: 0,
        EmpAdpaypermonth: 0,
        EmpAdpaycutoff: null,
        EmpAdstart: new Date(),
        EmpAdamtperpay: 0,
      };
      await manageLoan.mutateAsync(dto);
      toast({ title: "Loan rejected" });
      setRejectTarget(null);
    } catch (err) {
      toast({ title: "Failed to reject", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">All Loan Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Applied Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Exp. Release</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : loans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No loan requests found.
                  </TableCell>
                </TableRow>
              ) : (
                loans.map((loan) => (
                  <TableRow key={loan.LoaId}>
                    <TableCell className="font-medium">{loan.EmpName ?? loan.LoaEmp ?? "—"}</TableCell>
                    <TableCell>{fmt(loan.LoaApplieddate)}</TableCell>
                    <TableCell>{loan.LoaType ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate" title={loan.LoaReason ?? ""}>
                      {loan.LoaReason ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmtAmt(loan.LoaAmt)}</TableCell>
                    <TableCell>{fmt(loan.LoaExprelease)}</TableCell>
                    <TableCell>
                      <StatusBadge status={loan.LoaStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canApprove && (loan.LoaStatus === 0 || loan.LoaStatus === 4) && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 h-7 px-2"
                              onClick={() => handleApprove(loan)}
                              disabled={manageLoan.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive/80 h-7 px-2"
                              onClick={() => setRejectTarget(loan)}
                              disabled={manageLoan.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {loan.LoaStatus === 1 && canRelease && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600 hover:text-green-700 h-7 px-2"
                            onClick={() => openRelease(loan)}
                            disabled={manageLoan.isPending}
                          >
                            <Banknote className="h-4 w-4 mr-1" />
                            Release
                          </Button>
                        )}
                        {loan.LoaStatus === 1 && canApprove && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive/80 h-7 px-2"
                            onClick={() => setRejectTarget(loan)}
                            disabled={manageLoan.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Release Dialog: review and edit the repayment terms before the loan is posted */}
      <Dialog open={!!releaseTarget} onOpenChange={(v) => { if (!v) setReleaseTarget(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Release Loan: {releaseTarget?.EmpName ?? releaseTarget?.LoaEmp}</DialogTitle>
            <DialogDescription>
              Review the repayment terms. Releasing adds the loan to the employee&apos;s advances and
              payroll starts collecting it from the date start.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <LoanTermsFields
              value={releaseTerms}
              onChange={setReleaseTerms}
              loanAmountReadOnly
              idPrefix="release"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRelease} disabled={manageLoan.isPending}>
              {manageLoan.isPending ? "Releasing..." : "Confirm Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(v) => { if (!v) setRejectTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Loan Request</AlertDialogTitle>
            <AlertDialogDescription>
              Reject the loan request from{" "}
              <strong>{rejectTarget?.EmpName ?? rejectTarget?.LoaEmp}</strong> for{" "}
              <strong>₱{fmtAmt(rejectTarget?.LoaAmt)}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmReject}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

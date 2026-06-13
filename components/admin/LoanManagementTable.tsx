"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Banknote } from "lucide-react";
import {
  LoanGridManagement,
  LoanManagementDTO,
  useLoanManagementList,
  useManageLoan,
} from "@/lib/hooks/useRequestManagement";
import { useToast } from "@/lib/hooks/use-toast";

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

interface ReleaseForm {
  releaseDate: string;
  loanType: string;
  loanAmt: number;
  interestAmt: number;
  payPerMonth: string;
  payCutoff: string;
  amtPerPay: number;
}

function calcTotalAmt(form: ReleaseForm) {
  return form.loanAmt + form.interestAmt;
}

export function LoanManagementTable() {
  const { data: loans = [], isLoading } = useLoanManagementList();
  const manageLoan = useManageLoan();
  const { toast } = useToast();

  const [rejectTarget, setRejectTarget] = useState<LoanGridManagement | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<LoanGridManagement | null>(null);
  const [releaseForm, setReleaseForm] = useState<ReleaseForm>({
    releaseDate: "",
    loanType: "",
    loanAmt: 0,
    interestAmt: 0,
    payPerMonth: "1",
    payCutoff: "1",
    amtPerPay: 0,
  });

  function openRelease(loan: LoanGridManagement) {
    setReleaseForm({
      releaseDate: new Date().toISOString().split("T")[0],
      loanType: loan.LoaType ?? "",
      loanAmt: loan.LoaAmt ?? 0,
      interestAmt: 0,
      payPerMonth: "1",
      payCutoff: "1",
      amtPerPay: 0,
    });
    setReleaseTarget(loan);
  }

  async function handleApprove(loan: LoanGridManagement) {
    if (!loan.LoaId || !loan.LoaEmp) return;
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
    if (!releaseForm.releaseDate) {
      toast({ title: "Release date is required", variant: "destructive" });
      return;
    }
    try {
      const dto: LoanManagementDTO = {
        LoaId: releaseTarget.LoaId,
        Status: "release" as any,
        LoaEmp: releaseTarget.LoaEmp,
        EmpAdtype: releaseForm.loanType,
        EmpAddate: releaseTarget.LoaApplieddate ? new Date(releaseTarget.LoaApplieddate) : new Date(),
        EmpAdamt: releaseForm.loanAmt,
        EmpAdaddedamt: releaseForm.interestAmt,
        EmpAdpaypermonth: parseInt(releaseForm.payPerMonth),
        EmpAdpaycutoff: releaseForm.payPerMonth === "1" ? parseInt(releaseForm.payCutoff) : null,
        EmpAdstart: new Date(releaseForm.releaseDate),
        EmpAdamtperpay: releaseForm.amtPerPay,
      };
      await manageLoan.mutateAsync(dto);
      toast({ title: "Loan released" });
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

  const totalAmt = calcTotalAmt(releaseForm);

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
                        {(loan.LoaStatus === 0 || loan.LoaStatus === 4) && (
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
                        {loan.LoaStatus === 1 && (
                          <>
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Release Dialog */}
      <Dialog open={!!releaseTarget} onOpenChange={(v) => { if (!v) setReleaseTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Release Loan — {releaseTarget?.EmpName ?? releaseTarget?.LoaEmp}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Release Date *</Label>
                <Input
                  type="date"
                  value={releaseForm.releaseDate}
                  onChange={(e) => setReleaseForm((f) => ({ ...f, releaseDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Loan Type</Label>
                <Input
                  value={releaseForm.loanType}
                  onChange={(e) => setReleaseForm((f) => ({ ...f, loanType: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Loan Amount</Label>
                <Input value={fmtAmt(releaseForm.loanAmt)} readOnly className="bg-muted" />
              </div>
              <div className="space-y-1">
                <Label>Interest Amount</Label>
                <Input
                  type="number"
                  min={0}
                  value={releaseForm.interestAmt}
                  onChange={(e) =>
                    setReleaseForm((f) => ({ ...f, interestAmt: parseFloat(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Total Amount</Label>
              <Input value={fmtAmt(totalAmt)} readOnly className="bg-muted" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monthly Instalment</Label>
                <Select
                  value={releaseForm.payPerMonth}
                  onValueChange={(v) => setReleaseForm((f) => ({ ...f, payPerMonth: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Once a Month</SelectItem>
                    <SelectItem value="2">Twice a Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {releaseForm.payPerMonth === "1" && (
                <div className="space-y-1">
                  <Label>Pay Cutoff</Label>
                  <Select
                    value={releaseForm.payCutoff}
                    onValueChange={(v) => setReleaseForm((f) => ({ ...f, payCutoff: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1st Cutoff</SelectItem>
                      <SelectItem value="2">2nd Cutoff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Instalment Amount</Label>
              <Input
                type="number"
                min={0}
                value={releaseForm.amtPerPay}
                onChange={(e) =>
                  setReleaseForm((f) => ({ ...f, amtPerPay: parseFloat(e.target.value) || 0 }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRelease} disabled={manageLoan.isPending}>
              {manageLoan.isPending ? "Releasing…" : "Confirm Release"}
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

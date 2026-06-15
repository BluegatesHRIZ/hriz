"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { LoanDTO, useCancelLoan, useLoanById } from "@/lib/hooks/useRequestManagement";
import { useToast } from "@/lib/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2 } from "lucide-react";
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

interface LoanRequestTableProps {
  loans: LoanDTO[];
  isLoading: boolean;
  status: "pending" | "approved" | "rejected";
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  try {
    return format(new Date(date), "MMM dd, yyyy");
  } catch {
    return "-";
  }
}

export function LoanRequestTable({ loans, isLoading, status }: LoanRequestTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data: selectedDetail } = useLoanById(selectedId || "");
  const cancelMutation = useCancelLoan(selectedId || "");

  const getStatusBadge = (loanStatus: number | undefined) => {
    if (loanStatus === undefined && loanStatus !== 0) return null;
    switch (loanStatus) {
      case 0:
        return <Badge variant="outline">Pending</Badge>;
      case 1:
        return <Badge className="bg-green-500">Approved</Badge>;
      case 2:
        return <Badge variant="destructive">Rejected</Badge>;
      case 3:
        return <Badge variant="secondary">Cancelled</Badge>;
      case 4:
        return <Badge variant="outline">Resubmitted</Badge>;
      default:
        return null;
    }
  };

  const handleConfirmCancel = async () => {
    if (!selectedId) return;
    try {
      await cancelMutation.mutateAsync();
      toast({ title: "Success", description: "Loan request cancelled successfully." });
      queryClient.invalidateQueries({ queryKey: ["loan"] });
      setCancelDialogOpen(false);
      setSelectedId(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to cancel loan request.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (loans.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No {status} loan requests found.</div>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[145px]">Date Applied</TableHead>
              {(status === "pending" || status === "rejected") && (
                <TableHead className="w-[100px]">Status</TableHead>
              )}
              <TableHead className="w-[140px]">Amount</TableHead>
              <TableHead className="w-[160px]">Expected Release</TableHead>
              <TableHead className="w-[170px]">Type</TableHead>
              {status === "pending" && (
                <>
                  <TableHead className="min-w-[250px]">Reason and Remarks</TableHead>
                  <TableHead className="w-[100px]">Edit</TableHead>
                </>
              )}
              {status === "approved" && (
                <>
                  <TableHead className="min-w-[200px]">Processed by</TableHead>
                  <TableHead className="w-[145px]">Date Processed</TableHead>
                </>
              )}
              {status === "rejected" && (
                <>
                  <TableHead className="min-w-[250px]">Reason</TableHead>
                  <TableHead className="w-[170px]">Processed by</TableHead>
                  <TableHead className="w-[145px]">Date Processed</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => (
              <TableRow
                key={loan.LoaId}
                className={status === "approved" ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => {
                  if (!loan.LoaId) return;
                  if (status === "pending") {
                    router.push(`/request/loan/${loan.LoaId}`);
                  } else {
                    setSelectedId(loan.LoaId);
                    setDetailDialogOpen(true);
                  }
                }}
              >
                <TableCell>{formatDate(loan.LoaApplieddate)}</TableCell>
                {(status === "pending" || status === "rejected") && (
                  <TableCell>{getStatusBadge(loan.LoaStatus)}</TableCell>
                )}
                <TableCell>{loan.LoaAmt?.toLocaleString() ?? "-"}</TableCell>
                <TableCell>{formatDate(loan.LoaExprelease)}</TableCell>
                <TableCell>{loan.LoaType || "-"}</TableCell>
                {status === "pending" && (
                  <>
                    <TableCell>
                      {loan.LoaStatus !== 0 && loan.FapReason
                        ? loan.FapReason
                        : loan.LoaReason || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!loan.LoaId) return;
                            router.push(`/request/loan/${loan.LoaId}`);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!loan.LoaId) return;
                            setSelectedId(loan.LoaId);
                            setCancelDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                )}
                {status === "approved" && (
                  <>
                    <TableCell>{loan.LoaApprovedby || "-"}</TableCell>
                    <TableCell>{formatDate(loan.LoaApproveddate)}</TableCell>
                  </>
                )}
                {status === "rejected" && (
                  <>
                    <TableCell>{loan.FapReason || loan.LoaReason || "-"}</TableCell>
                    <TableCell>{loan.LoaApprovedby || "-"}</TableCell>
                    <TableCell>{formatDate(loan.LoaApproveddate)}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Request</DialogTitle>
            <DialogDescription>Are you sure you want to cancel this loan request?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false);
                setSelectedId(null);
              }}
            >
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Cancelling..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loan Request Details</DialogTitle>
          </DialogHeader>
          {selectedDetail && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">Amount:</span>{" "}
                {selectedDetail.LoaAmt?.toLocaleString() ?? "-"}
              </p>
              <p>
                <span className="font-semibold">Type:</span> {selectedDetail.LoaType || "-"}
              </p>
              <p>
                <span className="font-semibold">Expected Release:</span>{" "}
                {formatDate(selectedDetail.LoaExprelease)}
              </p>
              <p>
                <span className="font-semibold">Reason:</span>{" "}
                {selectedDetail.FapReason || selectedDetail.LoaReason || "-"}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


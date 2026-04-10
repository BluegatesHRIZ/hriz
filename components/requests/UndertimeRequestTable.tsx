"use client";

import { useState } from "react";
import {
  UndertimeRequestDTO,
  useCancelUndertime,
  useUndertimeById,
} from "@/lib/hooks/useRequestManagement";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useToast } from "@/lib/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

interface UndertimeRequestTableProps {
  undertimes: UndertimeRequestDTO[];
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

function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  try {
    return format(new Date(date), "hh:mm aa");
  } catch {
    return "-";
  }
}

export function UndertimeRequestTable({
  undertimes,
  isLoading,
  status,
}: UndertimeRequestTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const { data: selectedDetail } = useUndertimeById(selectedId || "");

  const cancelMutation = useCancelUndertime(selectedId || "");

  const getStatusBadge = (
    utStatus: number | undefined,
    approvedBy: string | null | undefined,
  ) => {
    if (utStatus === undefined && utStatus !== 0) return null;
    switch (utStatus) {
      case 0:
        return <Badge variant="outline">Pending</Badge>;
      case 1:
        return <Badge className="bg-green-500">Approved</Badge>;
      case 2:
        return <Badge variant="destructive">Rejected</Badge>;
      case 3:
        return <Badge variant="secondary">Cancelled</Badge>;
      case 4:
        return (
          <Badge variant="outline">
            Resubmitted{approvedBy ? ` by ${approvedBy}` : ""}
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleRowClick = (ut: UndertimeRequestDTO) => {
    if (!ut.UtmId) return;
    if (status === "pending") {
      router.push(`/request/undertime/${ut.UtmId}`);
    } else {
      setSelectedId(ut.UtmId);
      setDetailDialogOpen(true);
    }
  };

  const onCancelClick = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setSelectedId(id);
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedId) return;
    try {
      await cancelMutation.mutateAsync();
      toast({
        title: "Success",
        description: "Undertime request cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["undertime", "list"] });
      setCancelDialogOpen(false);
      setSelectedId(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to cancel undertime request",
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

  if (undertimes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No {status} undertime requests found.
      </div>
    );
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
              <TableHead className="w-[145px]">Date</TableHead>
              <TableHead className="w-[145px]">From</TableHead>
              <TableHead className="w-[145px]">To</TableHead>
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
            {undertimes.map((ut) => (
              <TableRow
                key={ut.UtmId}
                className={status === "approved" ? "cursor-pointer hover:bg-gray-50" : ""}
                onClick={() => handleRowClick(ut)}
              >
                <TableCell>{formatDate(ut.UtmApplieddate)}</TableCell>
                {(status === "pending" || status === "rejected") && (
                  <TableCell>{getStatusBadge(ut.UtmStatus, ut.UtmApprovedby)}</TableCell>
                )}
                <TableCell>{formatDate(ut.UtmDate)}</TableCell>
                <TableCell>{formatTime(ut.UtmFrom)}</TableCell>
                <TableCell>{formatTime(ut.UtmTo)}</TableCell>
                {status === "pending" && (
                  <>
                    <TableCell>
                      {ut.UtmStatus !== 0 && ut.fap_reason
                        ? ut.fap_reason
                        : ut.UtmReason || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            ut.UtmId && router.push(`/request/undertime/${ut.UtmId}`);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => ut.UtmId && onCancelClick(ut.UtmId, e)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                )}
                {status === "approved" && (
                  <>
                    <TableCell>{ut.UtmApprovedby || "-"}</TableCell>
                    <TableCell>{formatDate(ut.UtmApproveddate)}</TableCell>
                  </>
                )}
                {status === "rejected" && (
                  <>
                    <TableCell>{ut.fap_reason || ut.UtmReason || "-"}</TableCell>
                    <TableCell>{ut.UtmApprovedby || "-"}</TableCell>
                    <TableCell>{formatDate(ut.UtmApproveddate)}</TableCell>
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
            <DialogDescription>
              Are you sure you want to cancel this undertime request?
            </DialogDescription>
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
            <DialogTitle>Undertime Request Details</DialogTitle>
          </DialogHeader>
          {selectedDetail && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">Date:</span> {formatDate(selectedDetail.UtmDate)}
              </p>
              <p>
                <span className="font-semibold">From:</span> {formatTime(selectedDetail.UtmFrom)}
              </p>
              <p>
                <span className="font-semibold">To:</span> {formatTime(selectedDetail.UtmTo)}
              </p>
              <p>
                <span className="font-semibold">Reason:</span> {selectedDetail.UtmReason || "-"}
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


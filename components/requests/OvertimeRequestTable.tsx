"use client";

import { useState } from "react";
import {
  OvertimeRequestDTO,
  useCancelOvertime,
  useOvertimeById,
} from "@/lib/hooks/useRequestManagement";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/lib/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface OvertimeRequestTableProps {
  overtimes: OvertimeRequestDTO[];
  isLoading: boolean;
  status: "pending" | "approved" | "rejected";
  userId: string;
}

function formatDate(value?: Date | string | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "MM/dd/yyyy");
}

function formatType(type?: number | string): string {
  const v = typeof type === "string" ? type : String(type ?? "0");
  switch (v) {
    case "0":
      return "Normal OT";
    case "1":
      return "Early OT";
    case "2":
      return "Special OT";
    default:
      return v;
  }
}

function formatStatus(status?: number): string {
  switch (status) {
    case 0:
      return "Pending";
    case 1:
      return "Approved";
    case 2:
      return "Rejected";
    case 3:
      return "Cancelled";
    case 4:
      return "Resubmitted";
    default:
      return "";
  }
}

export function OvertimeRequestTable({
  overtimes,
  isLoading,
  status,
  userId,
}: OvertimeRequestTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOtId, setSelectedOtId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const cancelMutation = useCancelOvertime(selectedOtId || "");
  const { data: selectedDetail } = useOvertimeById(userId, selectedOtId || "");

  const getStatusBadge = (
    overtimeStatus: number | undefined,
    approvedBy: string | null | undefined,
  ) => {
    if (overtimeStatus === undefined && overtimeStatus !== 0) return null;
    switch (overtimeStatus) {
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

  const onRowClick = (ot: OvertimeRequestDTO) => {
    if (!ot.otm_id) return;
    if (status === "pending") {
      router.push(`/request/overtime/${ot.otm_id}`);
      return;
    }
    setSelectedOtId(ot.otm_id);
    setDetailDialogOpen(true);
  };

  const onCancelClick = (otId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOtId(otId);
    setCancelDialogOpen(true);
  };

  const onConfirmCancel = async () => {
    if (!selectedOtId) return;
    try {
      await cancelMutation.mutateAsync();
      toast({
        title: "Success",
        description: "Overtime request cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["overtime", "list"] });
      setCancelDialogOpen(false);
      setSelectedOtId(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to cancel overtime request",
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

  if (overtimes.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No {status} overtime requests found.
      </div>
    );
  }

  return (
    <>
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[145px]">Date Applied</TableHead>
              {(status === "pending" || status === "rejected") && (
                <TableHead className="w-[120px]">Status</TableHead>
              )}
              <TableHead className="w-[150px]">Type</TableHead>
              <TableHead className="w-[160px]">Date</TableHead>
              <TableHead className="w-[140px]">From</TableHead>
              <TableHead className="w-[140px]">To</TableHead>
              {status === "pending" && (
                <>
                  <TableHead className="min-w-[240px]">Reason and Remarks</TableHead>
                  <TableHead className="w-[100px]">Edit</TableHead>
                </>
              )}
              {status === "approved" && (
                <>
                  <TableHead className="min-w-[180px]">Processed by</TableHead>
                  <TableHead className="w-[150px]">Date Processed</TableHead>
                </>
              )}
              {status === "rejected" && (
                <>
                  <TableHead className="min-w-[220px]">Reason</TableHead>
                  <TableHead className="w-[180px]">Processed by</TableHead>
                  <TableHead className="w-[150px]">Date Processed</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {overtimes.map((ot) => (
              <TableRow
                key={ot.otm_id}
                className={status !== "pending" ? "cursor-pointer hover:bg-gray-50" : ""}
                onClick={() => onRowClick(ot)}
              >
                <TableCell>{formatDate(ot.otm_date)}</TableCell>
                {(status === "pending" || status === "rejected") && (
                  <TableCell>
                    {getStatusBadge(ot.otm_status, ot.otm_approvedby)}
                  </TableCell>
                )}
                <TableCell>{formatType(ot.otm_type)}</TableCell>
                <TableCell>{formatDate(ot.otm_date)}</TableCell>
                <TableCell>
                  {ot.otm_from
                    ? format(
                        new Date(ot.otm_from),
                        "hh:mm aa",
                      )
                    : "-"}
                </TableCell>
                <TableCell>
                  {ot.otm_to ? format(new Date(ot.otm_to), "hh:mm aa") : "-"}
                </TableCell>
                {status === "pending" && (
                  <>
                    <TableCell>
                      {ot.otm_status !== 0 && ot.fap_reason
                        ? ot.fap_reason
                        : ot.otm_reason || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            ot.otm_id && router.push(`/request/overtime/${ot.otm_id}`);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => ot.otm_id && onCancelClick(ot.otm_id, e)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                )}
                {status === "approved" && (
                  <>
                    <TableCell>{ot.otm_approvedby || "-"}</TableCell>
                    <TableCell>{formatDate(ot.otm_approveddate)}</TableCell>
                  </>
                )}
                {status === "rejected" && (
                  <>
                    <TableCell>{ot.fap_reason || ot.otm_reason || "-"}</TableCell>
                    <TableCell>{ot.otm_approvedby || "-"}</TableCell>
                    <TableCell>{formatDate(ot.otm_approveddate)}</TableCell>
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
              Are you sure you want to cancel this overtime request?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false);
                setSelectedOtId(null);
              }}
            >
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmCancel}
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
            <DialogTitle>Overtime Request Details</DialogTitle>
          </DialogHeader>
          {selectedDetail && selectedDetail[0] && (
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Type:</span> {formatType(selectedDetail[0].otm_type)}</p>
              <p><span className="font-semibold">Date:</span> {formatDate(selectedDetail[0].otm_date)}</p>
              <p><span className="font-semibold">From:</span> {selectedDetail[0].otm_from ? format(new Date(selectedDetail[0].otm_from), "hh:mm aa") : "-"}</p>
              <p><span className="font-semibold">To:</span> {selectedDetail[0].otm_to ? format(new Date(selectedDetail[0].otm_to), "hh:mm aa") : "-"}</p>
              <p><span className="font-semibold">Reason:</span> {selectedDetail[0].otm_reason || "-"}</p>
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


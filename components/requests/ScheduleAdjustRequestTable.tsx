"use client";

import { useState } from "react";
import {
  SchedAdjustRequestDTO,
  useCancelScheduleAdjust,
  useScheduleAdjustById,
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

interface Props {
  schedules: SchedAdjustRequestDTO[];
  isLoading: boolean;
  status: "pending" | "approved" | "rejected";
}

function fmtDate(value?: Date | string | null): string {
  if (!value) return "-";
  try {
    return format(new Date(value), "MMM dd, yyyy");
  } catch {
    return "-";
  }
}

export function ScheduleAdjustRequestTable({ schedules, isLoading, status }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const { data: detail } = useScheduleAdjustById(selectedId || "");
  const cancelMutation = useCancelScheduleAdjust(selectedId || "");

  const getStatusBadge = (statusCode?: number, approvedBy?: string | null) => {
    if (statusCode === undefined && statusCode !== 0) return null;
    switch (statusCode) {
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

  const handleConfirmCancel = async () => {
    if (!selectedId) return;
    try {
      await cancelMutation.mutateAsync();
      toast({ title: "Success", description: "Schedule change cancelled." });
      queryClient.invalidateQueries({ queryKey: ["scheduleAdjust", "list"] });
      setCancelDialogOpen(false);
      setSelectedId(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel request",
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

  if (schedules.length === 0) {
    return <div className="p-8 text-center text-gray-500">No {status} requests found.</div>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date Applied</TableHead>
              {(status === "pending" || status === "rejected") && <TableHead>Status</TableHead>}
              <TableHead>Date From</TableHead>
              <TableHead>Date To</TableHead>
              {status === "pending" && (
                <>
                  <TableHead>Reason and Remarks</TableHead>
                  <TableHead>Edit</TableHead>
                </>
              )}
              {status === "approved" && (
                <>
                  <TableHead>Processed by</TableHead>
                  <TableHead>Date Processed</TableHead>
                </>
              )}
              {status === "rejected" && (
                <>
                  <TableHead>Reason</TableHead>
                  <TableHead>Processed by</TableHead>
                  <TableHead>Date Processed</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((sca) => (
              <TableRow
                key={sca.ScaSid}
                className={status !== "pending" ? "cursor-pointer hover:bg-gray-50" : ""}
                onClick={() => {
                  if (!sca.ScaSid) return;
                  if (status === "pending") router.push(`/request/schedule-change/${sca.ScaSid}`);
                  else {
                    setSelectedId(sca.ScaSid);
                    setDetailDialogOpen(true);
                  }
                }}
              >
                <TableCell>{fmtDate(sca.ScaSapplieddate)}</TableCell>
                {(status === "pending" || status === "rejected") && (
                  <TableCell>{getStatusBadge(sca.ScaSstatus, sca.ScaSapprovedby)}</TableCell>
                )}
                <TableCell>{fmtDate(sca.ScaSdatefrom)}</TableCell>
                <TableCell>{fmtDate(sca.ScaSdateto)}</TableCell>
                {status === "pending" && (
                  <>
                    <TableCell>
                      {sca.ScaSstatus !== 0 && sca.FapReason
                        ? sca.FapReason
                        : sca.ScaSreason || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            sca.ScaSid && router.push(`/request/schedule-change/${sca.ScaSid}`);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (sca.ScaSid) {
                              setSelectedId(sca.ScaSid);
                              setCancelDialogOpen(true);
                            }
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
                    <TableCell>{sca.ScaSapprovedby || "-"}</TableCell>
                    <TableCell>{fmtDate(sca.ScaSapproveddate)}</TableCell>
                  </>
                )}
                {status === "rejected" && (
                  <>
                    <TableCell>{sca.FapReason || sca.ScaSreason || "-"}</TableCell>
                    <TableCell>{sca.ScaSapprovedby || "-"}</TableCell>
                    <TableCell>{fmtDate(sca.ScaSapproveddate)}</TableCell>
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
              Are you sure you want to cancel this schedule change request?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
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
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Change Details</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Date From:</span> {fmtDate(detail.ScaSdatefrom)}</p>
              <p><span className="font-semibold">Date To:</span> {fmtDate(detail.ScaSdateto)}</p>
              <p><span className="font-semibold">Reason:</span> {detail.ScaSreason || "-"}</p>
              {detail.SchedDetail && detail.SchedDetail.length > 0 && (
                <div className="border rounded-md p-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>Break Start</TableHead>
                        <TableHead>Break End</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Rest</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.SchedDetail.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell>{fmtDate(d.ScaDdate)}</TableCell>
                          <TableCell>{fmtDate(d.ScaDshiftstart)}</TableCell>
                          <TableCell>{fmtDate(d.ScaDbreakstart)}</TableCell>
                          <TableCell>{fmtDate(d.ScaDbreakend)}</TableCell>
                          <TableCell>{fmtDate(d.ScaDshiftend)}</TableCell>
                          <TableCell>{(d.ScaDShift as string) || "-"}</TableCell>
                          <TableCell>{d.ScaDrest === 1 ? "Yes" : "No"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
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


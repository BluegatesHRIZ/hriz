"use client"
import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  LeaveGrid,
  useCancelLeave,
  useLeaveSummary,
  useLeaveTypes,
} from "@/lib/hooks/useRequestManagement"
import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/lib/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"

interface LeaveRequestTableProps {
  leaves: LeaveGrid[]
  isLoading: boolean
  status: "pending" | "approved" | "rejected"
}

export function LeaveRequestTable({
  leaves,
  isLoading,
  status,
}: LeaveRequestTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedLeaveForDetail, setSelectedLeaveForDetail] =
    useState<string | null>(null)

  const cancelMutation = useCancelLeave(selectedLeaveId || "")
  const { data: leaveDetail } = useLeaveSummary(selectedLeaveForDetail || "")
  const { data: leaveTypes } = useLeaveTypes()

  const getStatusBadge = (
    leaveStatus: number | undefined,
    approvedBy: string | null | undefined
  ) => {
    if (!leaveStatus && leaveStatus !== 0) return null

    switch (leaveStatus) {
      case 0:
        return <Badge variant="outline">Pending</Badge>
      case 1:
        return <Badge variant="default" className="bg-green-500">Approved</Badge>
      case 2:
        return <Badge variant="destructive">Rejected</Badge>
      case 3:
        return <Badge variant="secondary">Cancelled</Badge>
      case 4:
        return (
          <Badge variant="outline">
            Resubmitted{approvedBy ? ` by ${approvedBy}` : ""}
          </Badge>
        )
      default:
        return null
    }
  }

  const handleCancelClick = (leaveId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedLeaveId(leaveId)
    setCancelDialogOpen(true)
  }

  const handleConfirmCancel = async () => {
    if (!selectedLeaveId) return

    try {
      await cancelMutation.mutateAsync()
      toast({
        title: "Success",
        description: "Leave request cancelled successfully",
      })
      setCancelDialogOpen(false)
      setSelectedLeaveId(null)
      queryClient.invalidateQueries({ queryKey: ["leave", "grid"] })
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to cancel leave request",
        variant: "destructive",
      })
    }
  }

  const handleRowClick = (leave: LeaveGrid) => {
    if (status === "approved") {
      setSelectedLeaveForDetail(leave.LeaSid || null)
      setDetailDialogOpen(true)
    } else if (status === "pending") {
      router.push(`/request/leave/${leave.LeaSid}`)
    }
  }

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-"
    try {
      return format(new Date(date), "MMM dd, yyyy")
    } catch {
      return "-"
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (leaves.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No {status} leave requests found.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[145px]">Date Applied</TableHead>
            {status === "pending" && (
              <TableHead className="w-[130px]">Status</TableHead>
            )}
            {status === "rejected" && (
              <TableHead className="w-[90px]">Status</TableHead>
            )}
            <TableHead className="w-[140px]">Type</TableHead>
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
                <TableHead className="w-[110px]">With Pay</TableHead>
                <TableHead className="w-[110px]">Without Pay</TableHead>
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
          {leaves.map((leave) => (
            <TableRow
              key={leave.LeaSid}
              className={status === "approved" ? "cursor-pointer hover:bg-gray-50" : ""}
              onClick={() => handleRowClick(leave)}
            >
              <TableCell>{formatDate(leave.LeaSapplieddate)}</TableCell>
              {(status === "pending" || status === "rejected") && (
                <TableCell>
                  {getStatusBadge(leave.LeaSstatus, leave.LeaSapprovedby)}
                </TableCell>
              )}
              <TableCell>{leave.LevDesc || "-"}</TableCell>
              <TableCell>{formatDate(leave.LeaSfrom)}</TableCell>
              <TableCell>{formatDate(leave.LeaSto)}</TableCell>
              {status === "pending" && (
                <>
                  <TableCell>
                    {/* Show FapReason if status is not 0 (pending), otherwise show LeaSreason */}
                    {leave.LeaSstatus !== 0 && leave.FapReason
                      ? leave.FapReason
                      : leave.LeaSreason || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation()
                          router.push(`/request/leave/${leave.LeaSid}`)
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          handleCancelClick(leave.LeaSid || "", e)
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
                  <TableCell>{leave.LeaSwithpay || 0}</TableCell>
                  <TableCell>{leave.LeaSwithoutpay || 0}</TableCell>
                  <TableCell>{leave.LeaSapprovedby || "-"}</TableCell>
                  <TableCell>{formatDate(leave.LeaSapproveddate)}</TableCell>
                </>
              )}
              {status === "rejected" && (
                <>
                  <TableCell>{leave.FapReason || leave.LeaSreason || "-"}</TableCell>
                  <TableCell>{leave.LeaSapprovedby || "-"}</TableCell>
                  <TableCell>{formatDate(leave.LeaSapproveddate)}</TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Request</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this request?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelDialogOpen(false)
                setSelectedLeaveId(null)
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

      {/* Detail View Dialog for Approved Leaves */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Detail</DialogTitle>
          </DialogHeader>
          {leaveDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Leave Start:
                  </label>
                  <p className="text-sm">
                    {formatDate(leaveDetail.LeaSfrom)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Leave End:
                  </label>
                  <p className="text-sm">{formatDate(leaveDetail.LeaSto)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Days w/ Pay:
                  </label>
                  <p className="text-sm">{leaveDetail.LeaSwithpay || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Days w/o Pay:
                  </label>
                  <p className="text-sm">{leaveDetail.LeaSwithoutpay || 0}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Leave Type:
                </label>
                <p className="text-sm">
                  {leaveDetail.LeaStypeDetail?.LevDesc ||
                    leaveTypes?.find((lt) => lt.lev_id === leaveDetail.LeaStype)
                      ?.lev_desc ||
                    "-"}
                </p>
              </div>
              {leaveDetail.files && leaveDetail.files.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Files Attached:
                  </label>
                  <div className="space-y-2 mt-2">
                    {leaveDetail.files.map((file: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <p className="text-sm">{file.fil_name || "-"}</p>
                        {file.fil_path && (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => window.open(file.fil_path, "_blank")}
                          >
                            View
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Reason:
                </label>
                <p className="text-sm">
                  {leaveDetail.LeaSreason || "No Reason Given"}
                </p>
              </div>
              {leaveDetail.leavedetail && leaveDetail.leavedetail.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Leave Details:
                  </label>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaveDetail.leavedetail.map((detail: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {formatDate(detail.LeaDdate)}
                            </TableCell>
                            <TableCell>
                              {detail.LeaDtype === "W"
                                ? "Whole Day"
                                : detail.LeaDampm === "A"
                                ? "Half Day (1st Half)"
                                : "Half Day (2nd Half)"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                setDetailDialogOpen(false)
                setSelectedLeaveForDetail(null)
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

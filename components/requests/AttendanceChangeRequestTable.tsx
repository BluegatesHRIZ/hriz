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
  CoaGrid,
  useCoaById,
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

interface AttendanceChangeRequestTableProps {
  coas: CoaGrid[]
  isLoading: boolean
  status: "pending" | "approved" | "rejected"
}

export function AttendanceChangeRequestTable({
  coas,
  isLoading,
  status,
}: AttendanceChangeRequestTableProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedCoaId, setSelectedCoaId] = useState<string | null>(null)

  const { data: coaDetail } = useCoaById(selectedCoaId || "")

  const getStatusBadge = (
    coaStatus: number | undefined,
    approvedBy: string | null | undefined
  ) => {
    if (coaStatus === undefined && coaStatus !== 0) return null

    switch (coaStatus) {
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

  const handleRowClick = (coaId: string) => {
    if (status === "pending") {
      router.push(`/request/attendance-change/${coaId}`)
    } else {
      setSelectedCoaId(coaId)
      setDetailDialogOpen(true)
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

  if (coas.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No {status} attendance change requests found.
      </div>
    )
  }

  return (
    <>
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
            {coas.map((coa) => (
              <TableRow
                key={coa.coa_sid}
                className={status === "approved" ? "cursor-pointer hover:bg-gray-50" : ""}
                onClick={() => coa.coa_sid && handleRowClick(coa.coa_sid)}
              >
                <TableCell>{formatDate(coa.coa_sapplieddate)}</TableCell>
                {(status === "pending" || status === "rejected") && (
                  <TableCell>
                    {getStatusBadge(coa.coa_sstatus, coa.coa_sapprovedby)}
                  </TableCell>
                )}
                <TableCell>{coa.coa_stypedetail || coa.coa_stype || "-"}</TableCell>
                {status === "pending" && (
                  <>
                    <TableCell>
                      {/* Show FapReason if status is not 0 (pending), otherwise show coa_sreason */}
                      {coa.coa_sstatus !== 0 && coa.FapReason
                        ? coa.FapReason
                        : coa.coa_sreason || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation()
                            coa.coa_sid && router.push(`/request/attendance-change/${coa.coa_sid}`)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </>
                )}
                {status === "approved" && (
                  <>
                    <TableCell>{coa.coa_sapprovedby || "-"}</TableCell>
                    <TableCell>{formatDate(coa.coa_sapproveddate)}</TableCell>
                  </>
                )}
                {status === "rejected" && (
                  <>
                    <TableCell>{coa.FapReason || coa.coa_sreason || "-"}</TableCell>
                    <TableCell>{coa.coa_sapprovedby || "-"}</TableCell>
                    <TableCell>{formatDate(coa.coa_sapproveddate)}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attendance Change Request Details</DialogTitle>
            <DialogDescription>
              View details of the attendance change request
            </DialogDescription>
          </DialogHeader>
          {coaDetail && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Type</h4>
                <p>{coaDetail.CoaStypedetail || coaDetail.CoaStype || "N/A"}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Explanation</h4>
                <p className="whitespace-pre-wrap">
                  {coaDetail.CoaSreason || "—"}
                </p>
              </div>
              {coaDetail.CoaDetails && coaDetail.CoaDetails.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Change Details</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coaDetail.CoaDetails.map((detail: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>
                            {detail.CoaDdate
                              ? format(new Date(detail.CoaDdate), "MMM dd, yyyy")
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {detail.CoaDtime
                              ? typeof detail.CoaDtime === "string"
                                ? detail.CoaDtime
                                : format(new Date(detail.CoaDtime), "HH:mm")
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {detail.CoaDtype === "I" ? "IN" : detail.CoaDtype === "O" ? "OUT" : detail.CoaDtype || "N/A"}
                          </TableCell>
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
  )
}

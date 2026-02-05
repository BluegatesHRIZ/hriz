"use client"
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
import { Edit } from "lucide-react"
import { useRouter } from "next/navigation"
import { LeaveGrid } from "@/lib/hooks/useRequestManagement"
import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"

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

  const getStatusBadge = (leaveStatus: number | undefined) => {
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
        return <Badge variant="outline">Resubmitted</Badge>
      default:
        return null
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
                <TableHead className="w-[110px]">With Pay</TableHead>
                <TableHead className="w-[110px]">Without Pay</TableHead>
                <TableHead className="min-w-[250px]">Reason</TableHead>
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
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => {
                if (status === "approved") {
                  // Show detail view
                } else if (status === "pending") {
                  router.push(`/request/leave/${leave.LeaSid}`)
                }
              }}
            >
              <TableCell>{formatDate(leave.LeaSapplieddate)}</TableCell>
              {(status === "pending" || status === "rejected") && (
                <TableCell>{getStatusBadge(leave.LeaSstatus)}</TableCell>
              )}
              <TableCell>{leave.LevDesc || "-"}</TableCell>
              <TableCell>{formatDate(leave.LeaSfrom)}</TableCell>
              <TableCell>{formatDate(leave.LeaSto)}</TableCell>
              {status === "pending" && (
                <>
                  <TableCell>{leave.LeaSwithpay || 0}</TableCell>
                  <TableCell>{leave.LeaSwithoutpay || 0}</TableCell>
                  <TableCell>
                    {leave.LeaSstatus !== 0 && leave.FapReason
                      ? leave.FapReason
                      : leave.LeaSreason || "-"}
                  </TableCell>
                  <TableCell>
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
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useCoaGrid } from "@/lib/hooks/useRequestManagement"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus, Hourglass, CheckCircle2, XCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { AttendanceChangeRequestTable } from "@/components/requests/AttendanceChangeRequestTable"
import { useAuth } from "@/lib/auth/context"

export default function AttendanceChangeListPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { data: coaGrid, isLoading } = useCoaGrid()
  const [activeTab, setActiveTab] = useState("pending")

  const handleAddAttendanceChange = () => {
    router.push("/request/attendance-change/apply")
  }

  // Filter COAs by status - use empty array if data not loaded yet
  const pendingCoas = coaGrid ? coaGrid.filter(
    (coa) => coa.coa_sstatus === 0 || coa.coa_sstatus === 4
  ) : []
  const approvedCoas = coaGrid ? coaGrid.filter((coa) => coa.coa_sstatus === 1) : []
  const rejectedCoas = coaGrid ? coaGrid.filter(
    (coa) => coa.coa_sstatus === 2 || coa.coa_sstatus === 3
  ) : []

  // Show loading if data is not yet available
  const showLoading = coaGrid === undefined || isLoading

  return (
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-bgc-text-highlight">
              Attendance Change
            </h3>
          </div>
          <div>
            <Button onClick={handleAddAttendanceChange} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Attendance Change
            </Button>
          </div>
        </div>

        <Card className="mt-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Hourglass className="w-4 h-4" />
                Submissions Pending Approval
              </TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Approved
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Disapproved and Cancelled
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              <AttendanceChangeRequestTable
                coas={pendingCoas}
                isLoading={showLoading}
                status="pending"
              />
            </TabsContent>

            <TabsContent value="approved" className="mt-4">
              <AttendanceChangeRequestTable
                coas={approvedCoas}
                isLoading={showLoading}
                status="approved"
              />
            </TabsContent>

            <TabsContent value="rejected" className="mt-4">
              <AttendanceChangeRequestTable
                coas={rejectedCoas}
                isLoading={showLoading}
                status="rejected"
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

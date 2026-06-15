"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useLeaveGrid } from "@/lib/hooks/useRequestManagement"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus, Hourglass, CheckCircle2, XCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { LeaveRequestTable } from "@/components/requests/LeaveRequestTable"
import { useAuth } from "@/lib/auth/context"
import { ProtectedPage } from "@/components/auth/ProtectedPage"

export default function LeaveListPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { data: leaveGrid, isLoading } = useLeaveGrid()
  const [activeTab, setActiveTab] = useState("pending")

  const handleAddLeave = () => {
    router.push("/request/leave/apply")
  }

  // Filter leaves by status - use empty array if data not loaded yet
  const pendingLeaves = leaveGrid ? leaveGrid.filter(
    (lv) => lv.LeaSstatus === 0 || lv.LeaSstatus === 4
  ) : []
  const approvedLeaves = leaveGrid ? leaveGrid.filter((lv) => lv.LeaSstatus === 1) : []
  const rejectedLeaves = leaveGrid ? leaveGrid.filter(
    (lv) => lv.LeaSstatus === 2 || lv.LeaSstatus === 3
  ) : []

  // Show loading if data is not yet available
  const showLoading = leaveGrid === undefined || isLoading

  return (
    <ProtectedPage routeKey="requestLeave">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold text-bgc-text-highlight">Leave</h3>
          </div>
          <div>
            <Button onClick={handleAddLeave} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Leave
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
              <LeaveRequestTable
                leaves={pendingLeaves}
                isLoading={showLoading}
                status="pending"
              />
            </TabsContent>

            <TabsContent value="approved" className="mt-4">
              <LeaveRequestTable
                leaves={approvedLeaves}
                isLoading={showLoading}
                status="approved"
              />
            </TabsContent>

            <TabsContent value="rejected" className="mt-4">
              <LeaveRequestTable
                leaves={rejectedLeaves}
                isLoading={showLoading}
                status="rejected"
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
    </ProtectedPage>
  )
}

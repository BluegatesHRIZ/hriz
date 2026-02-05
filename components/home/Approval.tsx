"use client"

import { useState } from "react"
import { useApproval } from "@/lib/hooks/useApproval"
import { useApproveRequests, useRejectRequests, usePostApprovalReason } from "@/lib/hooks/useApprovalActions"
import { CardWithHeader } from "@/components/cards/CardWithHeader"
import { FileCheck } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/lib/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export function Approval() {
  const { data: approvals, isLoading } = useApproval()
  const approveMutation = useApproveRequests()
  const rejectMutation = useRejectRequests()
  const reasonMutation = usePostApprovalReason()
  const { toast } = useToast()
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false)
  const [remark, setRemark] = useState("")
  const [actionMode, setActionMode] = useState<"approve" | "reject" | null>(null)

  const approvalItems = approvals?.filter((a: any) => a.Fa_Status === 0) || []
  const discrepancyItems = approvals?.filter((a: any) => a.Fa_Status === 1) || []

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedItems(newSelected)
  }

  const handleApprove = async () => {
    if (selectedItems.size === 0) {
      toast({
        title: "No selection",
        description: "Please select at least one item to approve",
        variant: "destructive",
      })
      return
    }

    const selectedApprovals = Array.from(selectedItems).map((idx) => {
      const item = approvalItems[idx]
      return {
        mod_id: item.Fa_TaskId || "",
        emp_id: item.Fa_Emp || "",
        appvr_id: item.Fa_Apprv || "",
        module: item.Fa_Module || "",
      }
    })

    try {
      await approveMutation.mutateAsync(selectedApprovals)
      toast({
        title: "Success",
        description: "Successfully approved requests",
      })
      setSelectedItems(new Set())
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve requests",
        variant: "destructive",
      })
    }
  }

  const handleReject = () => {
    if (selectedItems.size === 0) {
      toast({
        title: "No selection",
        description: "Please select at least one item to reject",
        variant: "destructive",
      })
      return
    }
    setActionMode("reject")
    setRemarkDialogOpen(true)
  }

  const handleRejectConfirm = async () => {
    if (!remark.trim()) {
      toast({
        title: "Remark required",
        description: "Please provide a remark",
        variant: "destructive",
      })
      return
    }

    const selectedApprovals = Array.from(selectedItems).map((idx) => {
      const item = approvalItems[idx]
      return {
        mod_id: item.Fa_TaskId || "",
        emp_id: item.Fa_Emp || "",
        appvr_id: item.Fa_Apprv || "",
        module: item.Fa_Module || "",
      }
    })

    try {
      await rejectMutation.mutateAsync(selectedApprovals)
      
      // Post rejection reason
      if (selectedApprovals.length > 0) {
        await reasonMutation.mutateAsync({
          Fap_Appvr: selectedApprovals[0].appvr_id,
          Fap_Reason: remark,
          Fap_Type: "C", // Cancel/Reject
          Fap_TaskId: selectedApprovals[0].mod_id,
        })
      }

      toast({
        title: "Success",
        description: "Successfully rejected requests",
      })
      setSelectedItems(new Set())
      setRemark("")
      setRemarkDialogOpen(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject requests",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <CardWithHeader
        title="Resolution Center"
        icon={<FileCheck className="w-6 h-6" />}
        iconColor="#834dc4"
        className="mb-4"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <p>Loading...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Tabs defaultValue="approval" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="approval">Approval</TabsTrigger>
                <TabsTrigger value="discrepancy">Discrepancy</TabsTrigger>
              </TabsList>
              <TabsContent value="approval" className="mt-4">
                {approvalItems.length > 0 ? (
                  <div className="space-y-2">
                    {approvalItems.slice(0, 5).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 border-b pb-2">
                        <Checkbox
                          checked={selectedItems.has(idx)}
                          onCheckedChange={() => toggleSelection(idx)}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{item.Fa_Module || "N/A"}</p>
                          <p className="text-xs text-gray-600">{item.Fa_Emp || "N/A"}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setViewDialogOpen(true)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={handleApprove}
                        disabled={approveMutation.isPending || selectedItems.size === 0}
                      >
                        {approveMutation.isPending ? "Processing..." : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={handleReject}
                        disabled={rejectMutation.isPending || selectedItems.size === 0}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No pending approvals</p>
                )}
              </TabsContent>
              <TabsContent value="discrepancy" className="mt-4">
                {discrepancyItems.length > 0 ? (
                  <div className="space-y-2">
                    {discrepancyItems.slice(0, 5).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 border-b pb-2">
                        <Checkbox />
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{item.Fa_Module || "N/A"}</p>
                          <p className="text-xs text-gray-600">{item.Fa_Emp || "N/A"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No discrepancies</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardWithHeader>

      {/* Remark Dialog for Reject */}
      <Dialog open={remarkDialogOpen} onOpenChange={setRemarkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this request</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="remark">Remark</Label>
              <Textarea
                id="remark"
                placeholder="Enter rejection reason..."
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemarkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!remark.trim() || reasonMutation.isPending}
            >
              {reasonMutation.isPending ? "Processing..." : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

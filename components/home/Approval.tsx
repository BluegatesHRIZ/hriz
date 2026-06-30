"use client"

import { useState, useEffect } from "react"
import { useApproval } from "@/lib/hooks/useApproval"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  useApproveRequests,
  useRejectRequests,
  useResendRequests,
  usePostApprovalReason,
  ApprovalObject,
} from "@/lib/hooks/useApprovalActions"
import { CardWithHeader } from "@/components/cards/CardWithHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { FileCheck } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/lib/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

const ITEMS_PER_PAGE = 5

export function Approval() {
  const { data: approvals, isLoading } = useApproval()
  const approveMutation = useApproveRequests()
  const rejectMutation = useRejectRequests()
  const resendMutation = useResendRequests()
  const reasonMutation = usePostApprovalReason()
  const { toast } = useToast()
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false)
  const [remark, setRemark] = useState("")
  const [actionMode, setActionMode] = useState<"reject" | "resend" | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ApprovalDTO | null>(null)
  const [requestDetail, setRequestDetail] = useState<Record<string, unknown> | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [btnEnabled, setBtnEnabled] = useState(true)
  const [approvalPage, setApprovalPage] = useState(1)
  const [discrepancyPage, setDiscrepancyPage] = useState(1)

  interface ApprovalDTO {
    Fa_Id?: number
    Fa_TaskId?: string
    Fa_Emp?: string
    employee?: string | null
    Fa_Apprv?: string
    Fa_Appstat?: number
    Fa_Module?: string | null
    Fa_Status?: number
    Fa_Datetime?: Date | string
    Fa_Level?: number
  }

  // Sort by date descending (latest first), then filter
  const allApprovals = approvals || []
  const approvalItems = allApprovals
    .filter((a: ApprovalDTO) => a.Fa_Status === 0)
    .sort((a: ApprovalDTO, b: ApprovalDTO) => {
      const dateA = a.Fa_Datetime ? new Date(a.Fa_Datetime).getTime() : 0
      const dateB = b.Fa_Datetime ? new Date(b.Fa_Datetime).getTime() : 0
      return dateB - dateA // Descending (latest first)
    })
  const discrepancyItems = allApprovals
    .filter((a: ApprovalDTO) => a.Fa_Status === 1)
    .sort((a: ApprovalDTO, b: ApprovalDTO) => {
      const dateA = a.Fa_Datetime ? new Date(a.Fa_Datetime).getTime() : 0
      const dateB = b.Fa_Datetime ? new Date(b.Fa_Datetime).getTime() : 0
      return dateB - dateA // Descending (latest first)
    })

  // Reset to page 1 when data changes
  useEffect(() => {
    setApprovalPage(1)
  }, [approvalItems.length])
  useEffect(() => {
    setDiscrepancyPage(1)
  }, [discrepancyItems.length])

  const toggleSelection = (index: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
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
    setRemarkDialogOpen(true)
  }

  const handleRowClick = async (item: ApprovalDTO) => {
    setSelectedRequest(item)
    setDetailDialogOpen(true)
    setLoadingDetail(true)

    try {
      // Fetch request details based on module type
      const token = localStorage.getItem("auth_token")
      if (!token) {
        toast({
          title: "Error",
          description: "Authentication token not found",
          variant: "destructive",
        })
        return
      }

      let detailUrl = ""
      switch (item.Fa_Module) {
        case "Leave":
          detailUrl = `/leave/forapproval/${item.Fa_TaskId}`
          break
        case "Overtime":
          detailUrl = `/overtime/forapproval/${item.Fa_TaskId}`
          break
        case "Undertime":
          detailUrl = `/undertime/forapproval/${item.Fa_TaskId}`
          break
        case "Attendance Change":
          detailUrl = `/coa/forapproval/${item.Fa_TaskId}`
          break
        case "Schedule Change":
          detailUrl = `/schedule-adjust/forapproval/${item.Fa_TaskId}`
          break
        default:
          toast({
            title: "Error",
            description: "Unknown request type",
            variant: "destructive",
          })
          setLoadingDetail(false)
          return
      }

      const response = await fetch(`/api${detailUrl}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch request details")
      }

      const data = await response.json()
      setRequestDetail(data)
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load request details",
        variant: "destructive",
      })
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleApproveFromDetail = async () => {
    if (!selectedRequest) return

    setBtnEnabled(false)
    const approvalObj: ApprovalObject = {
      mod_id: selectedRequest.Fa_TaskId || "",
      emp_id: selectedRequest.Fa_Emp || "",
      appvr_id: selectedRequest.Fa_Apprv || "",
      module: selectedRequest.Fa_Module || "",
    }

    try {
      await approveMutation.mutateAsync([approvalObj])
      toast({
        title: "Success",
        description: "Successfully approved request",
      })
      setDetailDialogOpen(false)
      setSelectedRequest(null)
      setRequestDetail(null)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve request",
        variant: "destructive",
      })
    } finally {
      setBtnEnabled(true)
    }
  }

  const handleRejectFromDetail = () => {
    setActionMode("reject")
    setRemarkDialogOpen(true)
  }

  const handleResendFromDetail = () => {
    setActionMode("resend")
    setRemarkDialogOpen(true)
  }

  const handleRemarkConfirm = async () => {
    if (!remark.trim()) {
      toast({
        title: "Remark required",
        description: "Please provide a remark",
        variant: "destructive",
      })
      return
    }

    if (!selectedRequest) return

    setBtnEnabled(false)
    const approvalObj: ApprovalObject = {
      mod_id: selectedRequest.Fa_TaskId || "",
      emp_id: selectedRequest.Fa_Emp || "",
      appvr_id: selectedRequest.Fa_Apprv || "",
      module: selectedRequest.Fa_Module || "",
    }

    try {
      if (actionMode === "reject") {
        await rejectMutation.mutateAsync([approvalObj])
      } else if (actionMode === "resend") {
        await resendMutation.mutateAsync([approvalObj])
      }

      // Post approval reason
      await reasonMutation.mutateAsync({
        Fap_Appvr: approvalObj.appvr_id,
        Fap_Reason: remark,
        Fap_Type: actionMode === "reject" ? "C" : "R", // C = Cancel/Reject, R = Resend
        Fap_TaskId: approvalObj.mod_id,
      })

      toast({
        title: "Success",
        description:
          actionMode === "reject"
            ? "Successfully rejected request"
            : "Successfully resent request",
      })
      setRemarkDialogOpen(false)
      setDetailDialogOpen(false)
      setSelectedRequest(null)
      setRequestDetail(null)
      setRemark("")
      setActionMode(null)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process request",
        variant: "destructive",
      })
    } finally {
      setBtnEnabled(true)
    }
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
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .detail-container {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .detail-container label {
              font-size: 13px;
            }
            .flex-container {
              display: flex;
              gap: 5rem;
              align-items: center;
            }
            .apprv-detail {
              padding: 0 4px !important;
              margin: 0 !important;
            }
            .module-name {
              font-weight: bold;
              margin: 0;
              margin-bottom: 3px;
            }
            .author {
              font-size: 13px;
              color: gray;
              font-style: italic;
            }
            .w-100 {
              width: 100%;
            }
            .flex-row {
              display: flex;
              flex-direction: row;
              gap: 1rem;
              flex-wrap: wrap;
            }
            .file-container {
              display: flex;
              justify-content: space-between;
              align-items: center;
              flex-wrap: wrap;
              width: 100%;
            }
            .btn {
              padding: 0.25rem 0.5rem;
              border-radius: 0.25rem;
              cursor: pointer;
              border: none;
              background: transparent;
            }
            .btn-link {
              color: #2563eb;
              text-decoration: underline;
            }
  .btn-sm {
    font-size: 0.875rem;
  }
  .flex-container-2 {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
          `,
        }}
      />
      <CardWithHeader
        title="Resolution Center"
        icon={<FileCheck className="w-6 h-6" />}
        iconColor="hsl(var(--primary))"
      >
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
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
                  <>
                    <div className="space-y-2">
                      {approvalItems
                        .slice(
                          (approvalPage - 1) * ITEMS_PER_PAGE,
                          approvalPage * ITEMS_PER_PAGE
                        )
                        .map((item: ApprovalDTO, idx: number) => {
                          const globalIdx = (approvalPage - 1) * ITEMS_PER_PAGE + idx
                          return (
                            <div
                              key={globalIdx}
                              className="flex items-center gap-2 border-b pb-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                              onClick={() => handleRowClick(item)}
                            >
                              <Checkbox
                                checked={selectedItems.has(globalIdx)}
                                onCheckedChange={() => toggleSelection(globalIdx)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                                <p className="text-sm font-semibold">{item.Fa_Module || "N/A"}</p>
                                <p className="text-sm text-foreground">{item.employee || item.Fa_Emp || "N/A"}</p>
                                <p className="text-sm text-muted-foreground text-right">
                                  {item.Fa_Datetime
                                    ? new Date(item.Fa_Datetime).toLocaleDateString()
                                    : "N/A"}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                    <div className="flex gap-2 mt-4">
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
                    {approvalItems.length > ITEMS_PER_PAGE && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="text-xs text-muted-foreground">
                          Showing {(approvalPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                          {Math.min(approvalPage * ITEMS_PER_PAGE, approvalItems.length)}{" "}
                          of {approvalItems.length} records
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setApprovalPage((p) => Math.max(1, p - 1))}
                            disabled={approvalPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-sm text-foreground">
                            Page {approvalPage} of{" "}
                            {Math.ceil(approvalItems.length / ITEMS_PER_PAGE)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setApprovalPage((p) =>
                                Math.min(
                                  Math.ceil(approvalItems.length / ITEMS_PER_PAGE),
                                  p + 1
                                )
                              )
                            }
                            disabled={
                              approvalPage >= Math.ceil(approvalItems.length / ITEMS_PER_PAGE)
                            }
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No pending approvals</p>
                )}
              </TabsContent>
              <TabsContent value="discrepancy" className="mt-4">
                {discrepancyItems.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {discrepancyItems
                        .slice(
                          (discrepancyPage - 1) * ITEMS_PER_PAGE,
                          discrepancyPage * ITEMS_PER_PAGE
                        )
                        .map((item: ApprovalDTO, idx: number) => {
                          const globalIdx = (discrepancyPage - 1) * ITEMS_PER_PAGE + idx
                          return (
                            <div key={globalIdx} className="flex items-center gap-2 border-b pb-2">
                              <Checkbox />
                              <div className="flex-1">
                                <p className="text-sm font-semibold">{item.Fa_Module || "N/A"}</p>
                                <p className="text-xs text-muted-foreground">{item.employee || item.Fa_Emp || "N/A"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.Fa_Datetime
                                    ? new Date(item.Fa_Datetime).toLocaleDateString()
                                    : "N/A"}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                    {discrepancyItems.length > ITEMS_PER_PAGE && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="text-xs text-muted-foreground">
                          Showing {(discrepancyPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                          {Math.min(discrepancyPage * ITEMS_PER_PAGE, discrepancyItems.length)}{" "}
                          of {discrepancyItems.length} records
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDiscrepancyPage((p) => Math.max(1, p - 1))}
                            disabled={discrepancyPage === 1}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-sm text-foreground">
                            Page {discrepancyPage} of{" "}
                            {Math.ceil(discrepancyItems.length / ITEMS_PER_PAGE)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setDiscrepancyPage((p) =>
                                Math.min(
                                  Math.ceil(discrepancyItems.length / ITEMS_PER_PAGE),
                                  p + 1
                                )
                              )
                            }
                            disabled={
                              discrepancyPage >= Math.ceil(discrepancyItems.length / ITEMS_PER_PAGE)
                            }
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No discrepancies</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardWithHeader>

      {/* Remark Dialog for Reject/Resend */}
      <Dialog
        open={remarkDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRemarkDialogOpen(false)
            setRemark("")
            setActionMode(null)
          }
        }}
      >
        <DialogContent className="max-w-[35rem] max-h-[35rem]">
          <DialogHeader>
            <DialogTitle>Approval</DialogTitle>
          </DialogHeader>
          <div className="flex-container">
            <div className="w-100">
              <Label htmlFor="remark">Remark:</Label>
              <Textarea
                id="remark"
                placeholder="Remarks..."
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={5}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <div className="flex-container">
              {actionMode === "reject" ? (
                <Button
                  variant="destructive"
                  onClick={handleRemarkConfirm}
                  disabled={!remark.trim() || !btnEnabled || reasonMutation.isPending}
                >
                  {reasonMutation.isPending ? "Processing..." : "Reject"}
                </Button>
              ) : actionMode === "resend" ? (
                <Button
                  variant="default"
                  className="bg-yellow-500 hover:bg-yellow-600"
                  onClick={handleRemarkConfirm}
                  disabled={!remark.trim() || !btnEnabled || reasonMutation.isPending}
                >
                  {reasonMutation.isPending ? "Processing..." : "Resend"}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={handleRejectConfirm}
                  disabled={!remark.trim() || reasonMutation.isPending}
                >
                  {reasonMutation.isPending ? "Processing..." : "Confirm Reject"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Detail Dialog - Matching C# structure */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-[40rem] max-h-[35rem] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approval</DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <p>Loading details...</p>
            </div>
          ) : requestDetail && selectedRequest ? (
            <div>
              <h2 className="module-name">{selectedRequest.Fa_Module || "Request"}</h2>
              <p className="author">By: {selectedRequest.employee || selectedRequest.Fa_Emp || "N/A"}</p>
              {selectedRequest.Fa_Module === "Leave" && (
                <LeaveDetailView detail={requestDetail} />
              )}
              {selectedRequest.Fa_Module === "Overtime" && (
                <OvertimeDetailView detail={requestDetail} />
              )}
              {selectedRequest.Fa_Module === "Undertime" && (
                <UndertimeDetailView detail={requestDetail} />
              )}
              {selectedRequest.Fa_Module === "Attendance Change" && (
                <CoaDetailView detail={requestDetail} />
              )}
              {selectedRequest.Fa_Module === "Schedule Change" && (
                <ScheduleDetailView detail={requestDetail} />
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No details available
            </div>
          )}
          <DialogFooter>
            <div className="flex-container-2">
              <Button
                variant="default"
                className="bg-yellow-500 hover:bg-yellow-600"
                onClick={handleResendFromDetail}
                disabled={!btnEnabled || resendMutation.isPending}
              >
                {resendMutation.isPending ? "Processing..." : "Resend"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectFromDetail}
                disabled={!btnEnabled || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? "Processing..." : "Reject"}
              </Button>
              <Button
                variant="default"
                className="bg-green-500 hover:bg-green-600 text-white"
                onClick={handleApproveFromDetail}
                disabled={!btnEnabled || approveMutation.isPending}
              >
                {approveMutation.isPending ? "Processing..." : "Approve"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Detail View Components - Matching C# structure exactly
function LeaveDetailView({ detail }: { detail: Record<string, unknown> }) {
  const leaSfrom = detail.LeaSfrom as string | Date | undefined
  const leaSto = detail.LeaSto as string | Date | undefined
  const leaSwithpay = detail.LeaSwithpay as number | undefined
  const leaSwithoutpay = detail.LeaSwithoutpay as number | undefined
  const leaStypeDetail = detail.LeaStypeDetail as { LevDesc?: string } | undefined
  const leaSreason = detail.LeaSreason as string | undefined
  const files = detail.files as Array<{ fil_name?: string; fil_path?: string }> | undefined
  const leavedetail = detail.leavedetail as Array<{
    LeaDdate?: string | Date
    LeaDtype?: string
    LeaDampm?: string
  }> | undefined

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatLongDate = (date: string | Date | undefined) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="detail-container">
      <div className="flex-container">
        <div>
          <label>Leave Start:</label>
          <p className="apprv-detail">{formatDate(leaSfrom) || "-"}</p>
        </div>
        <div>
          <label>Leave End:</label>
          <p className="apprv-detail">{formatDate(leaSto) || "-"}</p>
        </div>
      </div>
      <div className="flex-container">
        <div>
          <label>Days w/ Pay:</label>
          <p className="apprv-detail">{leaSwithpay?.toString() || "0"}</p>
        </div>
        <div>
          <label>Days w/o Pay:</label>
          <p className="apprv-detail">{leaSwithoutpay?.toString() || "0"}</p>
        </div>
      </div>
      <div className="flex-container">
        <div>
          <label>Leave Type:</label>
          <p className="apprv-detail">{leaStypeDetail?.LevDesc || "-"}</p>
        </div>
      </div>
      <div className="flex-container">
        <div>
          <label>Files Attached:</label>
          {!files || files.length <= 0 ? (
            <p className="apprv-detail">No Files Attached</p>
          ) : (
            <div className="flex-row">
              {files.map((file, idx) => (
                <div key={idx} className="file-container">
                  <p className="apprv-detail">{file.fil_name || "-"}</p>
                  {file.fil_path && (
                    <button
                      className="btn btn-link btn-sm"
                      onClick={() => window.open(file.fil_path, "_blank")}
                    >
                      View
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex-container">
        <div>
          <label>Reason:</label>
          <p className="apprv-detail">
            {leaSreason === "" || !leaSreason ? "No Reason Given" : leaSreason}
          </p>
        </div>
      </div>
      {leavedetail && leavedetail.length > 0 && (
        <div className="border rounded-md mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {leavedetail.map((d, idx: number) => (
                <tr key={idx} className="border-b">
                  <td className="p-2">{formatLongDate(d.LeaDdate) || "-"}</td>
                  <td className="p-2">
                    {d.LeaDtype === "W"
                      ? "Whole Day"
                      : d.LeaDampm === "A"
                      ? "Half Day (1st Half)"
                      : "Half Day (2nd Half)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OvertimeDetailView({ detail }: { detail: Record<string, unknown> }) {
  const otm_date = detail.otm_date as string | Date | undefined
  const otm_type = detail.otm_type as string | number | undefined
  const otm_from = detail.otm_from as string | Date | undefined
  const otm_to = detail.otm_to as string | Date | undefined
  const otm_reason = detail.otm_reason as string | undefined

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatTime = (date: string | Date | undefined) => {
    if (!date) return ""
    const d = new Date(date)
    const hours = d.getHours()
    const minutes = d.getMinutes()
    const ampm = hours >= 12 ? "PM" : "AM"
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`
  }

  return (
    <div className="detail-container">
      <div className="flex-container">
        <div>
          <label>Date:</label>
          <p className="apprv-detail">{formatDate(otm_date) || "-"}</p>
        </div>
        <div>
          <label>Type:</label>
          <p className="apprv-detail">
            {otm_type === "1" || otm_type === 1 ? "Early OT" : "Normal OT"}
          </p>
        </div>
      </div>
      <div className="flex-container">
        <div>
          <label>From:</label>
          <p className="apprv-detail">{formatTime(otm_from) || "-"}</p>
        </div>
        <div>
          <label>To:</label>
          <p className="apprv-detail">{formatTime(otm_to) || "-"}</p>
        </div>
      </div>
      <div className="flex-container">
        <div className="w-100">
          <label>Reasons:</label>
          <p className="apprv-detail">
            {otm_reason === "" || !otm_reason ? "No Reason Given" : otm_reason}
          </p>
        </div>
      </div>
    </div>
  )
}

function UndertimeDetailView({ detail }: { detail: Record<string, unknown> }) {
  const utmDate = detail.UtmDate as string | Date | undefined
  const utmFrom = detail.UtmFrom as string | undefined
  const utmTo = detail.UtmTo as string | undefined
  const utmReason = detail.UtmReason as string | undefined

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatTime12Hr = (timeStr: string | undefined) => {
    if (!timeStr) return ""
    try {
      const [hours, minutes] = timeStr.split(":")
      const h = parseInt(hours || "0", 10)
      const m = parseInt(minutes || "0", 10)
      const ampm = h >= 12 ? "PM" : "AM"
      const displayHours = h % 12 || 12
      return `${displayHours}:${m.toString().padStart(2, "0")} ${ampm}`
    } catch {
      return timeStr
    }
  }

  return (
    <div className="detail-container">
      <div className="flex-container">
        <div>
          <label>Date:</label>
          <p className="apprv-detail">{formatDate(utmDate) || "-"}</p>
        </div>
      </div>
      <div className="flex-container">
        <div>
          <label>From:</label>
          <p className="apprv-detail">{formatTime12Hr(utmFrom) || "-"}</p>
        </div>
        <div>
          <label>To:</label>
          <p className="apprv-detail">{formatTime12Hr(utmTo) || "-"}</p>
        </div>
      </div>
      <div className="flex-container">
        <div className="w-100">
          <label>Reasons:</label>
          <p className="apprv-detail">
            {utmReason === "" || !utmReason ? "No Reason Given" : utmReason}
          </p>
        </div>
      </div>
    </div>
  )
}

function CoaDetailView({ detail }: { detail: Record<string, unknown> }) {
  const coaStypeNavigation = detail.CoaStypeNavigation as
    | { CoaTdesc?: string; CoaTtag?: number }
    | undefined
  const coaStypedetail = detail.CoaStypedetail as string | undefined
  const coaSreason = detail.CoaSreason as string | undefined
  const coaDetails = detail.CoaDetails as Array<{
    CoaDdate?: string | Date
    CoaDtime?: string
    CoaDtype?: string
  }> | undefined

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return ""
    try {
      const [hours, minutes] = timeStr.split(":")
      const h = parseInt(hours || "0", 10)
      const m = parseInt(minutes || "0", 10)
      const ampm = h >= 12 ? "PM" : "AM"
      const displayHours = h % 12 || 12
      return `${displayHours}:${m.toString().padStart(2, "0")} ${ampm}`
    } catch {
      return timeStr
    }
  }

  return (
    <div className="detail-container">
      <div className="flex-container">
        <div>
          <label>Type:</label>
          <p className="apprv-detail">{coaStypeNavigation?.CoaTdesc || "-"}</p>
        </div>
        {coaStypeNavigation?.CoaTtag === 1 && (
          <div>
            <label>Type Detail:</label>
            <p className="apprv-detail">{coaStypedetail || "-"}</p>
          </div>
        )}
      </div>
      <div className="flex-container">
        <div className="w-100">
          <label>Reason:</label>
          <p className="apprv-detail">
            {coaSreason === "" || !coaSreason ? "No Reason Given" : coaSreason}
          </p>
        </div>
      </div>
      {coaDetails && coaDetails.length > 0 && (
        <div className="border rounded-md mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Time</th>
                <th className="text-left p-2 w-[120px]">In/Out</th>
              </tr>
            </thead>
            <tbody>
              {coaDetails.map((d, idx: number) => (
                <tr key={idx} className="border-b">
                  <td className="p-2">{formatDate(d.CoaDdate) || "-"}</td>
                  <td className="p-2">{formatTime(d.CoaDtime) || "-"}</td>
                  <td className="p-2">{d.CoaDtype === "I" ? "In" : "Out"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ScheduleDetailView({ detail }: { detail: Record<string, unknown> }) {
  const scaSdatefrom = detail.ScaSdatefrom as string | Date | undefined
  const scaSdateto = detail.ScaSdateto as string | Date | undefined
  const scaSreason = detail.ScaSreason as string | undefined
  const schedDetail = detail.SchedDetail as Array<{
    ScaDdate?: string | Date
    ScaDshiftstart?: string
    ScaDbreakstart?: string
    ScaDbreakend?: string
    ScaDshiftend?: string
    ScaDrest?: number
  }> | undefined

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatLongDate = (date: string | Date | undefined) => {
    if (!date) return ""
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatTime12Hr = (timeStr: string | undefined) => {
    if (!timeStr) return ""
    try {
      const [hours, minutes] = timeStr.split(":")
      const h = parseInt(hours || "0", 10)
      const m = parseInt(minutes || "0", 10)
      const ampm = h >= 12 ? "PM" : "AM"
      const displayHours = h % 12 || 12
      return `${displayHours}:${m.toString().padStart(2, "0")} ${ampm}`
    } catch {
      return timeStr
    }
  }

  return (
    <div className="detail-container">
      <div className="flex-container">
        <div>
          <label>Date Start:</label>
          <p className="apprv-detail">{formatDate(scaSdatefrom) || "-"}</p>
        </div>
        <div>
          <label>Date End:</label>
          <p className="apprv-detail">{formatDate(scaSdateto) || "-"}</p>
        </div>
      </div>
      <div className="flex-container">
        <div>
          <label>Reason:</label>
          <p className="apprv-detail">
            {scaSreason === "" || !scaSreason ? "No Reason Given" : scaSreason}
          </p>
        </div>
      </div>
      {schedDetail && schedDetail.length > 0 && (
        <div className="border rounded-md mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Shift Start</th>
                <th className="text-left p-2">Break Start</th>
                <th className="text-left p-2">Break End</th>
                <th className="text-left p-2">Shift End</th>
                <th className="text-center p-2">Rest Day</th>
              </tr>
            </thead>
            <tbody>
              {schedDetail.map((d, idx: number) => (
                <tr key={idx} className="border-b">
                  <td className="p-2">{formatLongDate(d.ScaDdate) || "-"}</td>
                  <td className="p-2">{formatTime12Hr(d.ScaDshiftstart) || "-"}</td>
                  <td className="p-2">{formatTime12Hr(d.ScaDbreakstart) || "-"}</td>
                  <td className="p-2">{formatTime12Hr(d.ScaDbreakend) || "-"}</td>
                  <td className="p-2">{formatTime12Hr(d.ScaDshiftend) || "-"}</td>
                  <td className="p-2 text-center">{d.ScaDrest === 1 ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

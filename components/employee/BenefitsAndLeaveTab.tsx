"use client"

import { useState, useEffect, useMemo } from "react"
import { EmployeeDetail, useSaveBenefitsAndLeaves } from "@/lib/hooks/useEmployeeDetail"
import { useLeaveTypes } from "@/lib/hooks/useLeaveTypes"
import { useComded } from "@/lib/hooks/useComded"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Save, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"

interface LeaveForm {
  EmlLeave: string
  EmlLeacredit: number
}

interface BenefitForm {
  EmbBcode: string
  EmbDesc: string
  EmbAmt: number
}

interface BenefitsAndLeaveTabProps {
  employee: EmployeeDetail
  isNewEmployee?: boolean
}

export function BenefitsAndLeaveTab({
  employee,
  isNewEmployee = false,
}: BenefitsAndLeaveTabProps) {
  const { toast } = useToast()
  const { data: leaveTypes } = useLeaveTypes()
  const { data: comdedList } = useComded()
  const saveMutation = useSaveBenefitsAndLeaves(employee.Account.EmpId)

  // Memoize initial values to prevent recalculation on every render
  // Depend on employee object - React Query will provide a new reference when data updates
  const initialLeaves: LeaveForm[] = useMemo(() => {
    if (!employee || !employee.EmpLeave) return []
    if (employee.EmpLeave.length > 0) {
      return employee.EmpLeave.map((lv) => ({
        EmlLeave: lv.LevType || "",
        EmlLeacredit: lv.LevCredits || 0,
      }))
    }
    return []
  }, [employee])

  const initialBenefits: BenefitForm[] = useMemo(() => {
    if (!employee || !employee.EmpBenefit) return []
    if (employee.EmpBenefit.length > 0) {
      return employee.EmpBenefit.map((ben) => ({
        EmbBcode: ben.EmbBcode || ben.BenType || "",
        EmbDesc: ben.EmbDesc || ben.BenRemarks || "",
        EmbAmt: ben.EmbAmt || 0,
      }))
    }
    return []
  }, [employee])

  const [leaves, setLeaves] = useState<LeaveForm[]>(initialLeaves)
  const [benefits, setBenefits] = useState<BenefitForm[]>(initialBenefits)

  // Sync state when employee data changes
  // Update whenever initial values change (which happens when employee data loads)
  useEffect(() => {
    setLeaves(initialLeaves)
  }, [initialLeaves])

  useEffect(() => {
    setBenefits(initialBenefits)
  }, [initialBenefits])

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        leaves: leaves.filter((l) => l.EmlLeave && l.EmlLeave !== ""),
        benefits: benefits.filter((b) => b.EmbBcode && b.EmbBcode !== ""),
      })
      toast({
        title: "Success",
        description: "Benefits and leave information saved successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save benefits and leave",
        variant: "destructive",
      })
    }
  }

  const addLeave = () => {
    setLeaves([...leaves, { EmlLeave: "", EmlLeacredit: 0 }])
  }

  const removeLeave = (index: number) => {
    const newLeaves = leaves.filter((_, i) => i !== index)
    setLeaves(newLeaves)
  }

  const updateLeave = (index: number, field: keyof LeaveForm, value: string | number) => {
    const newLeaves = [...leaves]
    newLeaves[index] = { ...newLeaves[index], [field]: value }
    
    // Auto-set leave credits when leave type is selected
    if (field === "EmlLeave" && typeof value === "string" && leaveTypes) {
      const selectedLeave = leaveTypes.find((lt) => lt.lev_id === value)
      if (selectedLeave && selectedLeave.lev_days) {
        newLeaves[index].EmlLeacredit = selectedLeave.lev_days
      }
    }
    
    setLeaves(newLeaves)
  }

  const addBenefit = () => {
    setBenefits([...benefits, { EmbBcode: "", EmbDesc: "", EmbAmt: 0 }])
  }

  const removeBenefit = (index: number) => {
    const newBenefits = benefits.filter((_, i) => i !== index)
    setBenefits(newBenefits)
  }

  const updateBenefit = (index: number, field: keyof BenefitForm, value: string | number) => {
    const newBenefits = [...benefits]
    newBenefits[index] = { ...newBenefits[index], [field]: value }
    setBenefits(newBenefits)
  }

  // Get available leave types (exclude already selected ones)
  const getAvailableLeaveTypes = () => {
    if (!leaveTypes) return []
    const selectedLeaveIds = leaves.map((l) => l.EmlLeave).filter(Boolean)
    return leaveTypes.filter((lt) => !selectedLeaveIds.includes(lt.lev_id) || selectedLeaveIds.length === 0)
  }

  return (
    <div className="space-y-4 p-4">
      {/* Leaves Section */}
      <div className="bg-card rounded-xl border border-border/60 p-5">
        <h4 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border/60">Leaves</h4>
        {leaves.length === 0 ? (
          <div className="text-center py-8 border rounded-lg">
            <p className="text-muted-foreground mb-4">
              The employee does not have a leave assigned yet.
            </p>
            <Button type="button" variant="outline" onClick={addLeave}>
              <Plus className="mr-2 h-4 w-4" />
              Add leave
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 font-medium border-b pb-2">
              <div className="col-span-5">Leave Type</div>
              <div className="col-span-5">Leave Days</div>
              <div className="col-span-2"></div>
            </div>
            {leaves.map((leave, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-5">
                  <Select
                    value={leave.EmlLeave}
                    onValueChange={(value) => updateLeave(index, "EmlLeave", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select leave type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes?.map((lt) => (
                        <SelectItem key={lt.lev_id} value={lt.lev_id}>
                          {lt.lev_desc || lt.lev_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-5">
                  <Input
                    type="number"
                    value={leave.EmlLeacredit}
                    onChange={(e) =>
                      updateLeave(index, "EmlLeacredit", parseFloat(e.target.value) || 0)
                    }
                    step="0.5"
                    min="0"
                    className="text-right"
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  {index === leaves.length - 1 && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeLeave(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={addLeave}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Benefits Section */}
      <div className="bg-card rounded-xl border border-border/60 p-5">
        <h4 className="text-base font-semibold text-foreground mb-4 pb-3 border-b border-border/60">Benefits</h4>
        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-4 font-medium border-b pb-2">
            <div className="col-span-4">Benefit Type</div>
            <div className="col-span-4">Description</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2"></div>
          </div>
          {benefits.length === 0 ? (
            <div className="text-center py-4">
              <Button type="button" variant="outline" onClick={addBenefit}>
                <Plus className="mr-2 h-4 w-4" />
                Add Benefit
              </Button>
            </div>
          ) : (
            benefits.map((benefit, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-center">
                <div className="col-span-4">
                  <Select
                    value={benefit.EmbBcode}
                    onValueChange={(value) => updateBenefit(index, "EmbBcode", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select benefit type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {comdedList?.map((cd) => (
                        <SelectItem key={cd.cd_code} value={cd.cd_code}>
                          {cd.cd_desc || cd.cd_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Input
                    value={benefit.EmbDesc}
                    onChange={(e) => updateBenefit(index, "EmbDesc", e.target.value)}
                    placeholder="Enter description"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={benefit.EmbAmt}
                    onChange={(e) =>
                      updateBenefit(index, "EmbAmt", parseFloat(e.target.value) || 0)
                    }
                    step="0.01"
                    min="0"
                    className="text-right"
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeBenefit(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {index === benefits.length - 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={addBenefit}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}

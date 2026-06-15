"use client"

import { useState, useEffect } from "react"
import { EmployeeDetail } from "@/lib/hooks/useEmployeeDetail"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Copy, Clipboard, Save } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"
import { useSaveEmployeeSchedule } from "@/lib/hooks/useEmployeeDetail"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const

const SHIFTS = [
  { id: "R", name: "Regular" },
  { id: "N", name: "Night Shift" },
  { id: "F", name: "Flexible" },
  { id: "E", name: "Exempted" },
] as const

interface ScheduleDay {
  sch_day: string
  sch_in: string // HH:mm format
  sch_out: string // HH:mm format
  sch_bin: string // HH:mm format
  sch_bout: string // HH:mm format
  sch_hrs: number
  sch_rest: boolean
  sch_shift: string
  have_break: boolean
}

interface WorkScheduleTabProps {
  employee: EmployeeDetail
  employeeList?: Array<{ EmpId: string; TextName: string; Schedules?: ScheduleDay[] }>
}

export function WorkScheduleTab({ employee, employeeList }: WorkScheduleTabProps) {
  const { toast } = useToast()
  const saveMutation = useSaveEmployeeSchedule(employee.Account.EmpId)
  const [schedules, setSchedules] = useState<ScheduleDay[]>([])
  const [copyFromEmp, setCopyFromEmp] = useState<string>("")
  const [copyDayOpen, setCopyDayOpen] = useState<string | null>(null)
  const [copyForm, setCopyForm] = useState({
    Monday: false,
    Tuesday: false,
    Wednesday: false,
    Thursday: false,
    Friday: false,
    Saturday: false,
    Sunday: false,
    SelectAll: false,
  })

  // Initialize schedules from employee data
  useEffect(() => {
    if (employee.Schedule && employee.Schedule.length > 0) {
      const scheduleMap = new Map(
        employee.Schedule.map((s) => [
          s.SchedDay?.toUpperCase() || "",
          {
            sch_day: s.SchedDay?.toUpperCase() || "",
            sch_in: s.SchedTimein || "09:00",
            sch_out: s.SchedTimeout || "18:00",
            sch_bin: s.SchedBreakin || "12:00",
            sch_bout: s.SchedBreakout || "13:00",
            sch_hrs: 8,
            sch_rest: false,
            sch_shift: s.SchedShift || "R",
            have_break: true,
          },
        ])
      )

      // Ensure all 7 days exist
      const initializedSchedules: ScheduleDay[] = DAYS.map((day) => {
        const existing = scheduleMap.get(day)
        return (
          existing || {
            sch_day: day,
            sch_in: "09:00",
            sch_out: "18:00",
            sch_bin: "12:00",
            sch_bout: "13:00",
            sch_hrs: 8,
            sch_rest: false,
            sch_shift: "R",
            have_break: true,
          }
        )
      })

      setSchedules(initializedSchedules)
    } else {
      // Initialize empty schedule for all days
      setSchedules(
        DAYS.map((day) => ({
          sch_day: day,
          sch_in: "09:00",
          sch_out: "18:00",
          sch_bin: "12:00",
          sch_bout: "13:00",
          sch_hrs: 8,
          sch_rest: false,
          sch_shift: "R",
          have_break: true,
        }))
      )
    }
  }, [employee.Schedule])

  const calculateHours = (sched: ScheduleDay): number => {
    if (sched.sch_rest || sched.sch_shift === "E") return 0

    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(":").map(Number)
      return hours * 60 + minutes
    }

    const timeIn = parseTime(sched.sch_in)
    const timeOut = parseTime(sched.sch_out)
    let totalMinutes = timeOut > timeIn ? timeOut - timeIn : timeOut + 24 * 60 - timeIn

    if (sched.have_break) {
      const breakIn = parseTime(sched.sch_bin)
      const breakOut = parseTime(sched.sch_bout)
      const breakMinutes = breakOut > breakIn ? breakOut - breakIn : breakOut + 24 * 60 - breakIn
      totalMinutes -= breakMinutes
    }

    return Math.round((totalMinutes / 60) * 100) / 100
  }

  const updateSchedule = (index: number, updates: Partial<ScheduleDay>) => {
    const newSchedules = [...schedules]
    newSchedules[index] = { ...newSchedules[index], ...updates }
    
    // Auto-calculate hours
    if (updates.sch_in || updates.sch_out || updates.sch_bin || updates.sch_bout || updates.have_break !== undefined) {
      newSchedules[index].sch_hrs = calculateHours(newSchedules[index])
    }

    // Auto-set break times when time in changes (matching C# behavior)
    // C# adds 4 hours to time in for break in, then adds 1 hour for break out
    if (updates.sch_in) {
      const [hours, minutes] = updates.sch_in.split(":").map(Number)
      // Calculate break in: time in + 4 hours
      let breakInHours = hours + 4
      if (breakInHours >= 24) breakInHours -= 24
      
      // Calculate break out: break in + 1 hour
      let breakOutHours = breakInHours + 1
      if (breakOutHours >= 24) breakOutHours -= 24
      
      newSchedules[index].sch_bin = `${breakInHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
      newSchedules[index].sch_bout = `${breakOutHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
    }

    setSchedules(newSchedules)
  }

  const handleCopyFromEmployee = (empId: string) => {
    if (!empId || !employeeList) return

    const sourceEmployee = employeeList.find((e) => e.EmpId === empId)
    if (!sourceEmployee?.Schedules) {
      toast({
        title: "Error",
        description: "Selected employee has no schedule",
        variant: "destructive",
      })
      return
    }

    const scheduleMap = new Map(
      sourceEmployee.Schedules.map((s) => [s.sch_day?.toUpperCase() || "", s])
    )

    const newSchedules = schedules.map((sched) => {
      const sourceSched = scheduleMap.get(sched.sch_day)
      if (sourceSched) {
        return {
          ...sched,
          sch_in: sourceSched.sch_in || sched.sch_in,
          sch_out: sourceSched.sch_out || sched.sch_out,
          sch_bin: sourceSched.sch_bin || sched.sch_bin,
          sch_bout: sourceSched.sch_bout || sched.sch_bout,
          sch_hrs: sourceSched.sch_hrs || sched.sch_hrs,
          sch_rest: sourceSched.sch_rest || false,
          sch_shift: sourceSched.sch_shift || sched.sch_shift,
          have_break: sourceSched.have_break || false,
        }
      }
      return sched
    })

    setSchedules(newSchedules)
    toast({
      title: "Success",
      description: "Schedule copied from employee",
    })
  }

  const handleCopyDaySchedule = (sourceDay: string) => {
    const sourceSched = schedules.find((s) => s.sch_day === sourceDay)
    if (!sourceSched) return

    const dayMap: Record<string, keyof typeof copyForm> = {
      MONDAY: "Monday",
      TUESDAY: "Tuesday",
      WEDNESDAY: "Wednesday",
      THURSDAY: "Thursday",
      FRIDAY: "Friday",
      SATURDAY: "Saturday",
      SUNDAY: "Sunday",
    }

    const newSchedules = schedules.map((sched) => {
      const dayKey = dayMap[sched.sch_day]
      if (dayKey && copyForm[dayKey] && sched.sch_day !== sourceDay) {
        return {
          ...sched,
          sch_in: sourceSched.sch_in,
          sch_out: sourceSched.sch_out,
          sch_bin: sourceSched.sch_bin,
          sch_bout: sourceSched.sch_bout,
          sch_hrs: sourceSched.sch_hrs,
          sch_rest: sourceSched.sch_rest,
          sch_shift: sourceSched.sch_shift,
          have_break: sourceSched.have_break,
        }
      }
      return sched
    })

    setSchedules(newSchedules)
    setCopyDayOpen(null)
    setCopyForm({
      Monday: false,
      Tuesday: false,
      Wednesday: false,
      Thursday: false,
      Friday: false,
      Saturday: false,
      Sunday: false,
      SelectAll: false,
    })
    toast({
      title: "Success",
      description: "Day schedule copied",
    })
  }

  const handleSelectAll = (checked: boolean) => {
    setCopyForm({
      Monday: checked,
      Tuesday: checked,
      Wednesday: checked,
      Thursday: checked,
      Friday: checked,
      Saturday: checked,
      Sunday: checked,
      SelectAll: checked,
    })
  }

  const formatDayName = (day: string) => {
    return day.charAt(0) + day.slice(1).toLowerCase()
  }

  const handleSave = async () => {
    try {
      // Transform schedules to match API format
      // Times come from HTML time inputs as "HH:mm", stored procedure expects "HH:mm:00"
      const schedulesToSave = schedules.map((sched) => ({
        sch_day: sched.sch_day,
        sch_in: sched.sch_in ? `${sched.sch_in}:00` : "00:00:00",
        sch_out: sched.sch_out ? `${sched.sch_out}:00` : "00:00:00",
        sch_bin: sched.sch_bin ? `${sched.sch_bin}:00` : "00:00:00",
        sch_bout: sched.sch_bout ? `${sched.sch_bout}:00` : "00:00:00",
        sch_hrs: sched.sch_hrs,
        sch_rest: sched.sch_rest,
        sch_shift: sched.sch_shift,
        have_break: sched.have_break,
        sch_emp: employee.Account.EmpId,
      }))

      await saveMutation.mutateAsync(schedulesToSave)
      toast({
        title: "Success",
        description: "Schedule saved successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save schedule",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Copy from Employee */}
      {employeeList && employeeList.length > 0 && (
        <div className="flex items-center gap-4">
          <Label htmlFor="copy-from" className="w-48">
            Copy from this employee:
          </Label>
          <Select value={copyFromEmp} onValueChange={handleCopyFromEmployee}>
            <SelectTrigger id="copy-from" className="w-64">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employeeList
                .filter((e) => e.EmpId !== "None" && e.EmpId !== "admin" && e.EmpId !== employee.Account.EmpId)
                .map((emp) => (
                  <SelectItem key={emp.EmpId} value={emp.EmpId}>
                    {emp.TextName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Schedule Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-muted/30">
              <tr>
                <th className="border p-2 text-left min-w-[80px]">Day</th>
                <th className="border p-2 text-center min-w-[50px]">Rest Day</th>
                <th className="border p-2 text-center min-w-[50px]">Break</th>
                <th className="border p-2 text-center min-w-[110px]">In</th>
                <th className="border p-2 text-center min-w-[110px]">Break In</th>
                <th className="border p-2 text-center min-w-[110px]">Break Out</th>
                <th className="border p-2 text-center min-w-[110px]">Out</th>
                <th className="border p-2 text-center min-w-[65px]">Hours</th>
                <th className="border p-2 text-center min-w-[140px]">Shift</th>
                <th className="border p-2 text-center w-[65px]"></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((sched, index) => (
                <tr key={sched.sch_day} className="hover:bg-muted/50">
                  <td className="border p-2 font-medium">{formatDayName(sched.sch_day)}</td>
                  <td className="border p-2 text-center">
                    <Checkbox
                      checked={sched.sch_rest}
                      onCheckedChange={(checked) =>
                        updateSchedule(index, { sch_rest: checked === true })
                      }
                    />
                  </td>
                  <td className="border p-2 text-center">
                    {sched.sch_shift !== "E" ? (
                      <Checkbox
                        checked={sched.have_break}
                        onCheckedChange={(checked) =>
                          updateSchedule(index, { have_break: checked === true })
                        }
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2">
                    {sched.sch_shift !== "E" ? (
                      <Input
                        type="time"
                        value={sched.sch_in}
                        onChange={(e) => updateSchedule(index, { sch_in: e.target.value })}
                        className="w-full"
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2">
                    {sched.sch_shift !== "E" && sched.have_break ? (
                      <Input
                        type="time"
                        value={sched.sch_bin}
                        onChange={(e) => updateSchedule(index, { sch_bin: e.target.value })}
                        className="w-full"
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2">
                    {sched.sch_shift !== "E" && sched.have_break ? (
                      <Input
                        type="time"
                        value={sched.sch_bout}
                        onChange={(e) => updateSchedule(index, { sch_bout: e.target.value })}
                        className="w-full"
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2">
                    {sched.sch_shift !== "E" ? (
                      <Input
                        type="time"
                        value={sched.sch_out}
                        onChange={(e) => updateSchedule(index, { sch_out: e.target.value })}
                        className="w-full"
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2 text-center">
                    {sched.sch_shift !== "E" ? (
                      <span className="text-sm">{sched.sch_hrs.toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="border p-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={sched.sch_shift}
                        onValueChange={(value) => updateSchedule(index, { sch_shift: value })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SHIFTS.map((shift) => (
                            <SelectItem key={shift.id} value={shift.id}>
                              {shift.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {sched.sch_shift === "F" && (
                        <Input
                          type="number"
                          value={sched.sch_hrs}
                          onChange={(e) =>
                            updateSchedule(index, { sch_hrs: parseFloat(e.target.value) || 0 })
                          }
                          className="w-16"
                          min="0"
                          max="24"
                          step="0.5"
                        />
                      )}
                    </div>
                  </td>
                  <td className="border p-2 text-center">
                    <Popover
                      open={copyDayOpen === sched.sch_day}
                      onOpenChange={(open) => setCopyDayOpen(open ? sched.sch_day : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Clipboard className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Copy to:</Label>
                          {DAYS.map((day) => {
                            const dayKey = day.charAt(0) + day.slice(1).toLowerCase() as keyof typeof copyForm
                            return (
                              <div key={day} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`copy-${day}`}
                                  checked={copyForm[dayKey]}
                                  onCheckedChange={(checked) => {
                                    setCopyForm((prev) => ({
                                      ...prev,
                                      [dayKey]: checked === true,
                                      SelectAll: false,
                                    }))
                                  }}
                                />
                                <Label
                                  htmlFor={`copy-${day}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {formatDayName(day)}
                                </Label>
                              </div>
                            )
                          })}
                          <div className="flex items-center space-x-2 pt-2 border-t">
                            <Checkbox
                              id="copy-all"
                              checked={copyForm.SelectAll}
                              onCheckedChange={(checked) => handleSelectAll(checked === true)}
                            />
                            <Label htmlFor="copy-all" className="text-sm font-normal cursor-pointer">
                              Select All
                            </Label>
                          </div>
                          <Button
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => handleCopyDaySchedule(sched.sch_day)}
                          >
                            Paste
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Schedule"}
        </Button>
      </div>
    </div>
  )
}

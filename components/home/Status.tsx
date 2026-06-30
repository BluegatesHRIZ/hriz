"use client"

import { useStatus } from "@/lib/hooks/useStatus"
import { CardWithHeader } from "@/components/cards/CardWithHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle } from "lucide-react"

export function Status() {
  const { data: status, isLoading } = useStatus()

  const statusMinutes = status?.statusMinutes || {}
  const leaveCredits = status?.leaveCredits || []

  const sectionLabel =
    "text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground mb-2.5"
  const row =
    "flex items-center justify-between py-1.5 border-b border-border/60 last:border-0 text-sm"

  return (
    <CardWithHeader
      title="My Status"
      icon={<CheckCircle className="w-6 h-6" />}
      iconColor="hsl(var(--success))"
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Attendance Summary */}
          <div>
            <h6 className={sectionLabel}>Attendance Summary</h6>
            <div>
              <div className={row}>
                <span className="text-muted-foreground">Overtime</span>
                <span className="font-medium tabular">{statusMinutes.Overtime || 0} hrs</span>
              </div>
              <div className={row}>
                <span className="text-muted-foreground">Undertime</span>
                <span className="font-medium tabular">{statusMinutes.Undertime || 0} hrs</span>
              </div>
              <div className={row}>
                <span className="text-muted-foreground">Late</span>
                <span className="font-medium tabular">{statusMinutes.Late || 0} times</span>
              </div>
              <div className={row}>
                <span className="text-muted-foreground">Absences</span>
                <span className="font-medium tabular">{statusMinutes.Absences || 0} days</span>
              </div>
            </div>
          </div>

          {/* Leave Balance */}
          {leaveCredits.length > 0 && (
            <div>
              <h6 className={sectionLabel}>Leave Balance</h6>
              <div>
                {leaveCredits.map((leave, idx) => (
                  <div key={idx} className={row}>
                    <span className="text-muted-foreground">{leave.el_leave || "N/A"}</span>
                    <span className="font-medium tabular">
                      {leave.el_balance || 0}
                      <span className="text-muted-foreground"> / {leave.el_credit || 0}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </CardWithHeader>
  )
}

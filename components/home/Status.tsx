"use client"

import { useStatus } from "@/lib/hooks/useStatus"
import { CardWithHeader } from "@/components/cards/CardWithHeader"
import { CheckCircle } from "lucide-react"

export function Status() {
  const { data: status, isLoading } = useStatus()

  const statusMinutes = status?.statusMinutes || {}
  const leaveCredits = status?.leaveCredits || []

  return (
    <CardWithHeader
      title="My Status"
      icon={<CheckCircle className="w-6 h-6" />}
      iconColor="#abdd64"
      className="mb-4"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <p>Loading...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Attendance Summary */}
          <div>
            <h6 className="font-bold mb-2">Attendance Summary</h6>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Overtime:</span>
                <span className="font-semibold">{statusMinutes.Overtime || 0} hrs</span>
              </div>
              <div className="flex justify-between">
                <span>Undertime:</span>
                <span className="font-semibold">{statusMinutes.Undertime || 0} hrs</span>
              </div>
              <div className="flex justify-between">
                <span>Late:</span>
                <span className="font-semibold">{statusMinutes.Late || 0} times</span>
              </div>
              <div className="flex justify-between">
                <span>Absences:</span>
                <span className="font-semibold">{statusMinutes.Absences || 0} days</span>
              </div>
            </div>
          </div>

          {/* Leave Balance */}
          {leaveCredits.length > 0 && (
            <div>
              <h6 className="font-bold mb-2">Leave Balance</h6>
              <div className="space-y-2 text-sm">
                {leaveCredits.map((leave, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{leave.el_leave || "N/A"}:</span>
                    <span className="font-semibold">
                      {leave.el_balance || 0} / {leave.el_credit || 0}
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

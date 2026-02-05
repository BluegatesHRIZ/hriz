"use client"

import { useRequests } from "@/lib/hooks/useRequests"
import { CardWithHeader } from "@/components/cards/CardWithHeader"
import { FileText } from "lucide-react"

export function Requests() {
  const { data: stats, isLoading } = useRequests()

  const totals = stats?.totals?.[0] || {}
  const moduleStats = stats?.moduleStats || []

  return (
    <CardWithHeader
      title="Requests"
      icon={<FileText className="w-6 h-6" />}
      iconColor="#ffb879"
      className="mb-4"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <p>Loading...</p>
        </div>
      ) : moduleStats.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No request statistics</p>
      ) : (
        <div className="space-y-3">
          {moduleStats.map((mod: any, idx: number) => (
            <div key={idx} className="border-b pb-2">
              <p className="font-semibold text-sm">{mod.Module || "N/A"}</p>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>Pending: {mod.Pending || 0}</span>
                <span>Resended: {mod.Resended || 0}</span>
              </div>
            </div>
          ))}
          {totals.TotalPending !== undefined && (
            <div className="pt-2 border-t">
              <div className="flex justify-between font-semibold">
                <span>Total Pending:</span>
                <span>{totals.TotalPending}</span>
              </div>
              {totals.TotalResended !== undefined && (
                <div className="flex justify-between font-semibold">
                  <span>Total Resended:</span>
                  <span>{totals.TotalResended}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </CardWithHeader>
  )
}

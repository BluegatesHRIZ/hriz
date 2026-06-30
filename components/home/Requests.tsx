"use client"

import { useRequests } from "@/lib/hooks/useRequests"
import { CardWithHeader } from "@/components/cards/CardWithHeader"
import { Skeleton } from "@/components/ui/skeleton"
import { FileText, Inbox } from "lucide-react"

export function Requests() {
  const { data: stats, isLoading } = useRequests()

  const totals = stats?.totals?.[0] || {}
  const moduleStats = stats?.moduleStats || []

  return (
    <CardWithHeader
      title="Requests"
      icon={<FileText className="w-6 h-6" />}
      iconColor="hsl(var(--warning))"
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : moduleStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <div className="rounded-full bg-muted p-2.5 text-muted-foreground">
            <Inbox className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-foreground">No pending requests</p>
          <p className="text-xs text-muted-foreground">You&apos;re all caught up.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {moduleStats.map((mod: { Module?: string; Pending?: number; Resended?: number }, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0"
            >
              <p className="font-medium text-sm truncate">{mod.Module || "N/A"}</p>
              <div className="flex items-center gap-3 text-xs shrink-0">
                <span className="text-warning tabular">{mod.Pending || 0} pending</span>
                <span className="text-muted-foreground tabular">{mod.Resended || 0} resent</span>
              </div>
            </div>
          ))}
          {totals.TotalPending !== undefined && (
            <div className="mt-3 pt-3 border-t space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total pending</span>
                <span className="font-semibold tabular">{totals.TotalPending}</span>
              </div>
              {totals.TotalResended !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total resent</span>
                  <span className="font-semibold tabular">{totals.TotalResended}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </CardWithHeader>
  )
}

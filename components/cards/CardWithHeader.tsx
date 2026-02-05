"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface CardWithHeaderProps {
  title: string
  icon: React.ReactNode
  iconColor?: string
  children: React.ReactNode
  className?: string
  headerActions?: React.ReactNode
}

export function CardWithHeader({
  title,
  icon,
  iconColor,
  children,
  className,
  headerActions,
}: CardWithHeaderProps) {
  return (
    <Card className={cn("shadow", className)}>
      <CardHeader className="card-header-custom p-4 border-b">
        <div className="flex items-center gap-2">
          <div style={{ color: iconColor }}>{icon}</div>
          <h6 className="font-semibold text-base m-0">{title}</h6>
        </div>
        {headerActions && <div>{headerActions}</div>}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  )
}

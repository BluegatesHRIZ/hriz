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
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg p-1.5 bg-primary/10 flex items-center justify-center"
            style={{ color: iconColor }}
          >
            {icon}
          </div>
          <h6 className="font-semibold text-base m-0">{title}</h6>
        </div>
        {headerActions && <div>{headerActions}</div>}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  )
}

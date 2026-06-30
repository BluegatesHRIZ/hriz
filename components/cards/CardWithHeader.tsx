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
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="rounded-lg p-1.5 bg-muted text-muted-foreground flex items-center justify-center shrink-0 [&_svg]:w-[18px] [&_svg]:h-[18px]"
            style={iconColor ? { color: iconColor } : undefined}
          >
            {icon}
          </div>
          <h6 className="font-semibold text-[15px] tracking-tight m-0 truncate">{title}</h6>
        </div>
        {headerActions && <div className="shrink-0">{headerActions}</div>}
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  )
}

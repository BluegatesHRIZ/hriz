"use client";

import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/lib/hooks/useNotifications";
import { cn } from "@/lib/utils";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unread = notifications.filter((n) => n.not_status === 0).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-2 text-xs"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[340px]">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No notifications</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.not_id}
                className={cn(
                  "flex gap-3 px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-muted/40 transition-colors",
                  n.not_status === 0 && "bg-blue-50/60 dark:bg-blue-950/20"
                )}
                onClick={() => {
                  if (n.not_status === 0) markRead.mutate(n.not_id);
                }}
              >
                {n.not_status === 0 && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                )}
                <div className={cn("flex-1 min-w-0", n.not_status !== 0 && "pl-5")}>
                  <p className={cn("text-sm leading-tight", n.not_status === 0 && "font-semibold")}>
                    {n.not_title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.not_desc}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{relativeTime(n.not_logdate)}</p>
                </div>
              </div>
            ))
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t">
            <Badge variant="outline" className="text-xs">
              {unread} unread of {notifications.length}
            </Badge>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

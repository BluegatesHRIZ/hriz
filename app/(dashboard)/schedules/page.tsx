"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { ScheduleManager } from "@/components/schedules/ScheduleManager";

export default function SchedulesPage() {
  return (
    <ProtectedPage routeKey="scheduleManagement">
      <ScheduleManager />
    </ProtectedPage>
  );
}

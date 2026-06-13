"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { ScheduleChangeReportTable } from "@/components/reports/ScheduleChangeReportTable";

export default function ScheduleChangeReportPage() {
  return (
    <ProtectedPage routeKey="reportScheduleChange">
      <ScheduleChangeReportTable />
    </ProtectedPage>
  );
}

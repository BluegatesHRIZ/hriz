"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { OvertimeReportTable } from "@/components/reports/OvertimeReportTable";

export default function OvertimeReportPage() {
  return (
    <ProtectedPage routeKey="reportOvertime">
      <OvertimeReportTable />
    </ProtectedPage>
  );
}

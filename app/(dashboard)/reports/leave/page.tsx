"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { LeaveReportTable } from "@/components/reports/LeaveReportTable";

export default function LeaveReportPage() {
  return (
    <ProtectedPage routeKey="reportLeave">
      <LeaveReportTable />
    </ProtectedPage>
  );
}

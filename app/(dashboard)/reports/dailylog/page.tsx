"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { DailyLogReportTable } from "@/components/reports/DailyLogReportTable";

export default function DailyLogReportPage() {
  return (
    <ProtectedPage routeKey="reportDailylog">
      <DailyLogReportTable />
    </ProtectedPage>
  );
}

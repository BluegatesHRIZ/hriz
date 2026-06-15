"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { DailyLogReportTable } from "@/components/reports/DailyLogReportTable";

export default function DailyLogReportPage() {
  return (
    <ProtectedPage routeKey="reportDailylog">
      <DailyLogReportTable />
    </ProtectedPage>
  );
}

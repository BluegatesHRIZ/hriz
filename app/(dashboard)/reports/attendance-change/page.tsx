"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { CoaReportTable } from "@/components/reports/CoaReportTable";

export default function CoaReportPage() {
  return (
    <ProtectedPage routeKey="reportCoa">
      <CoaReportTable />
    </ProtectedPage>
  );
}

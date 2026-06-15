"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { UndertimeReportTable } from "@/components/reports/UndertimeReportTable";

export default function UndertimeReportPage() {
  return (
    <ProtectedPage routeKey="reportUndertime">
      <UndertimeReportTable />
    </ProtectedPage>
  );
}

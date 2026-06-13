"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { BiologReportTable } from "@/components/reports/BiologReportTable";

export default function BiologReportPage() {
  return (
    <ProtectedPage routeKey="reportBiolog">
      <BiologReportTable />
    </ProtectedPage>
  );
}

"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { PayrollReportTable } from "@/components/reports/PayrollReportTable";

export default function PayrollReportPage() {
  return (
    <ProtectedPage routeKey="reportPayroll">
      <PayrollReportTable />
    </ProtectedPage>
  );
}

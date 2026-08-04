"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { PayrollRunManager } from "@/components/payroll/PayrollRunManager";

export default function PayrollPage() {
  return (
    <ProtectedPage routeKey="payrollRun">
      <PayrollRunManager />
    </ProtectedPage>
  );
}

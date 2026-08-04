"use client";

export const dynamic = "force-dynamic";

import { use } from "react";
import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { PayrollRegister } from "@/components/payroll/PayrollRegister";

export default function PayrollRegisterPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return (
    <ProtectedPage routeKey="payrollRun">
      <PayrollRegister code={code} />
    </ProtectedPage>
  );
}

"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { PayslipTable } from "@/components/profile/PayslipTable";

export default function PayslipPage() {
  return (
    <ProtectedPage>
      <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
        <h2 className="text-2xl font-semibold mb-6">Payslip</h2>
        <PayslipTable />
      </div>
    </ProtectedPage>
  );
}

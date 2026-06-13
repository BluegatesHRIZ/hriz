"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { LoanManagementTable } from "@/components/admin/LoanManagementTable";

export default function ManageLoansPage() {
  return (
    <ProtectedPage routeKey="adminManageLoans">
      <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
        <h2 className="text-2xl font-semibold mb-6">Manage Loans</h2>
        <LoanManagementTable />
      </div>
    </ProtectedPage>
  );
}

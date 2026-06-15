"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";
import { LoanRequestForm } from "@/components/requests/LoanRequestForm";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function LoanApplyPage() {
  const router = useRouter();

  return (
    <ProtectedPage routeKey="requestLoan">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">Loan Request</h3>
        </div>
        <LoanRequestForm onSuccess={() => router.push("/request/loan")} />
      </div>
    </div>
    </ProtectedPage>
  );
}


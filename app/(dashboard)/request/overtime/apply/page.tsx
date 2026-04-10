"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { OvertimeRequestForm } from "@/components/requests/OvertimeRequestForm";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function OvertimeApplyPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <ProtectedPage routeKey="requestOvertime">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">
            Overtime Request
          </h3>
        </div>

        <OvertimeRequestForm
          empId={user?.name || ""}
          onSuccess={() => router.push("/request/overtime")}
        />
      </div>
    </div>
    </ProtectedPage>
  );
}


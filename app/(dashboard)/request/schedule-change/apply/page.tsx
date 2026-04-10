"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { ScheduleAdjustRequestForm } from "@/components/requests/ScheduleAdjustRequestForm";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function ScheduleChangeApplyPage() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <ProtectedPage routeKey="requestScheduleChange">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">
            Schedule Change Request
          </h3>
        </div>
        <ScheduleAdjustRequestForm
          empId={user?.name || ""}
          onSuccess={() => router.push("/request/schedule-change")}
        />
      </div>
    </div>
    </ProtectedPage>
  );
}


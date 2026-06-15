"use client";

export const dynamic = "force-dynamic";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { ScheduleAdjustRequestForm } from "@/components/requests/ScheduleAdjustRequestForm";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function ScheduleChangeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = use(params);

  return (
    <ProtectedPage routeKey="requestScheduleChange">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">
            Edit Schedule Change Request
          </h3>
        </div>
        <ScheduleAdjustRequestForm
          empId={user?.name || ""}
          scaId={id}
          onSuccess={() => router.push("/request/schedule-change")}
        />
      </div>
    </div>
    </ProtectedPage>
  );
}


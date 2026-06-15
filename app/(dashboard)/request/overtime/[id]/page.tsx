"use client";

export const dynamic = "force-dynamic";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { OvertimeRequestForm } from "@/components/requests/OvertimeRequestForm";
import { useOvertimeById } from "@/lib/hooks/useRequestManagement";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function OvertimeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = use(params);
  const { data } = useOvertimeById(user?.name || "", id);
  const existing = data?.[0] ?? null;

  return (
    <ProtectedPage routeKey="requestOvertime">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">
            Edit Overtime Request
          </h3>
        </div>

        <OvertimeRequestForm
          empId={user?.name || ""}
          otId={id}
          existing={existing}
          onSuccess={() => router.push("/request/overtime")}
        />
      </div>
    </div>
    </ProtectedPage>
  );
}


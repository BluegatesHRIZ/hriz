"use client";

export const dynamic = "force-dynamic";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { UndertimeRequestForm } from "@/components/requests/UndertimeRequestForm";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function UndertimeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = use(params);

  return (
    <ProtectedPage routeKey="requestUndertime">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">
            Edit Undertime Request
          </h3>
        </div>

        <UndertimeRequestForm
          empId={user?.name || ""}
          utId={id}
          onSuccess={() => router.push("/request/undertime")}
        />
      </div>
    </div>
    </ProtectedPage>
  );
}


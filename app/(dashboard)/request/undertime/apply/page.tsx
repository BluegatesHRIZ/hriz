"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { UndertimeRequestForm } from "@/components/requests/UndertimeRequestForm";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function UndertimeApplyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const initialDate = searchParams.get("date") || undefined;

  return (
    <ProtectedPage routeKey="requestUndertime">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">
            Undertime Request
          </h3>
        </div>

        <UndertimeRequestForm
          empId={user?.name || ""}
          initialDate={initialDate}
          onSuccess={() => router.push("/request/undertime")}
        />
      </div>
    </div>
    </ProtectedPage>
  );
}


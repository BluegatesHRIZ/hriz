"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { AttendanceChangeRequestForm } from "@/components/requests/AttendanceChangeRequestForm";

export default function AttendanceChangeApplyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const initialDate = searchParams.get("date") || undefined;
  const initialType = searchParams.get("type") || undefined;
  const initialSched = searchParams.get("sched") || undefined;

  return (
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">
            Attendance Change Request
          </h3>
        </div>

        <AttendanceChangeRequestForm
          empId={user?.name || ""}
          onSuccess={() => router.push("/request/attendance-change")}
          initialDate={initialDate}
          initialType={initialType}
          initialSched={initialSched}
        />
      </div>
    </div>
  );
}

"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { AttendanceChangeRequestForm } from "@/components/requests/AttendanceChangeRequestForm";
import { ProtectedPage } from "@/components/auth/ProtectedPage";

export default function AttendanceChangeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = use(params);

  return (
    <ProtectedPage routeKey="requestAttendanceChange">
    <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
      <div className="request-section">
        <div className="header-container mb-4">
          <h3 className="text-xl font-semibold text-bgc-text-highlight">
            Edit Attendance Change Request
          </h3>
        </div>

        <AttendanceChangeRequestForm
          empId={user?.name || ""}
          coaId={id}
          onSuccess={() => router.push("/request/attendance-change")}
        />
      </div>
    </div>
    </ProtectedPage>
  );
}

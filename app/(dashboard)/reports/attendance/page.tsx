"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { AttendanceReportView } from "@/components/reports/AttendanceReportView";

export default function AttendanceReportPage() {
  return (
    <ProtectedPage routeKey="reportAttendance">
      <AttendanceReportView />
    </ProtectedPage>
  );
}

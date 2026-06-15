"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { HolidayManagementTable } from "@/components/admin/HolidayManagementTable";

export default function HolidaysAdminPage() {
  return (
    <ProtectedPage routeKey="adminHolidays">
      <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
        <HolidayManagementTable />
      </div>
    </ProtectedPage>
  );
}

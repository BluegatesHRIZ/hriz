"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { AnnouncementManagementTable } from "@/components/admin/AnnouncementManagementTable";

export default function AnnouncementsAdminPage() {
  return (
    <ProtectedPage routeKey="adminAnnouncements">
      <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
        <AnnouncementManagementTable />
      </div>
    </ProtectedPage>
  );
}

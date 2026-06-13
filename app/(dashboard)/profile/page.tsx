"use client";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { useAuth } from "@/lib/auth/context";
import { useEmployeeDetail } from "@/lib/hooks/useEmployeeDetail";
import { Skeleton } from "@/components/ui/skeleton";

function ProfileHeader({ name, empId, role }: { name: string; empId: string; role?: string }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-600 select-none">
        {name.charAt(0).toUpperCase()}
      </div>
      <div>
        <h2 className="text-2xl font-semibold">{name}</h2>
        <p className="text-sm text-muted-foreground">{empId}{role ? ` · ${role}` : ""}</p>
      </div>
    </div>
  );
}

function ProfileContent() {
  const { user } = useAuth();
  const empId = user?.name ?? "";
  const { data, isLoading, error } = useEmployeeDetail(empId, !!empId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        Failed to load profile. {error?.message}
      </p>
    );
  }

  const fullName = [data.Account.EmpFirst, data.Account.EmpMid, data.Account.EmpLast]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <ProfileHeader name={fullName || empId} empId={empId} role={data.Account.EmpRole ?? undefined} />
      <ProfileTabs data={data} />
    </>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedPage>
      <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
        <ProfileContent />
      </div>
    </ProtectedPage>
  );
}

"use client";

export const dynamic = "force-dynamic";

import { ProtectedPage } from "@/components/auth/ProtectedPage";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";

export default function ChangePasswordPage() {
  return (
    <ProtectedPage>
      <div className="container mx-auto mt-4 mb-5 pb-5 pt-4 px-4">
        <h2 className="text-2xl font-semibold mb-6">Change Password</h2>
        <ChangePasswordForm />
      </div>
    </ProtectedPage>
  );
}

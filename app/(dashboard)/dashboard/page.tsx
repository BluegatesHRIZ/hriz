"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { News } from "@/components/home/News";
import { Biolog } from "@/components/home/Biolog";
import { Approval } from "@/components/home/Approval";
import { Status } from "@/components/home/Status";
import { Requests } from "@/components/home/Requests";

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container mt-4 pb-4 w-full mx-5">
      {/* Bootstrap-like grid layout: 9 columns left, 3 columns right */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column - 9 columns */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          {/* News Component */}
          <News />

          {/* Biolog and Approval in nested grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Biolog />
            <Approval />
          </div>
        </div>

        {/* Right Column - 3 columns */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <Status />
          <Requests />
        </div>
      </div>
    </div>
  );
}

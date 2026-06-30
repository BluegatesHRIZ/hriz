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

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const now = new Date();
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const firstName = user?.Firstname?.trim();

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 pt-6 pb-10">
      {/* Greeting header */}
      <header className="mb-6 animate-rise" style={{ ["--i" as string]: 0 }}>
        <p className="text-sm text-muted-foreground tabular">{today}</p>
        <h1 className="mt-0.5 text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          {greeting(now.getHours())}{firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-9 space-y-4 lg:space-y-5">
          <div className="animate-rise" style={{ ["--i" as string]: 1 }}>
            <News />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
            <div className="animate-rise" style={{ ["--i" as string]: 2 }}>
              <Biolog />
            </div>
            <div className="animate-rise" style={{ ["--i" as string]: 3 }}>
              <Approval />
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-3 space-y-4 lg:space-y-5">
          <div className="animate-rise" style={{ ["--i" as string]: 4 }}>
            <Status />
          </div>
          <div className="animate-rise" style={{ ["--i" as string]: 5 }}>
            <Requests />
          </div>
        </div>
      </div>
    </div>
  );
}

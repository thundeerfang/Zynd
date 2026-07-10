"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  DashboardMobileNav,
  DashboardSidebar,
} from "@/components/dashboard/dashboard-sidebar";
import { DashboardNavbar } from "@/components/dashboard/dashboard-navbar";
import {
  DASHBOARD_INNER_GAP,
  DASHBOARD_MAIN_CONTENT_CLASS,
  DASHBOARD_MAIN_SCROLL_CLASS,
  DASHBOARD_SHELL_PADDING,
} from "@/components/dashboard/dashboard-layout";
import { DashboardSectionProvider } from "@/components/dashboard/dashboard-section-context";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center overflow-hidden bg-muted/40 p-6">
        <p className="text-compact text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-dvh items-center justify-center overflow-hidden bg-muted/40 p-6">
        <p className="text-compact text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <DashboardSectionProvider>
      <div className="h-dvh overflow-hidden bg-muted/40">
        <div
          className={cn(
            "flex h-full min-h-0 flex-col",
            DASHBOARD_SHELL_PADDING
          )}
        >
          <div
            className={cn(
              "flex min-h-0 flex-1",
              DASHBOARD_INNER_GAP,
              "md:items-stretch"
            )}
          >
            <DashboardSidebar className="hidden md:flex" />

            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
                DASHBOARD_INNER_GAP
              )}
            >
              <DashboardNavbar />

              <main className={DASHBOARD_MAIN_SCROLL_CLASS}>
                <div className={DASHBOARD_MAIN_CONTENT_CLASS}>{children}</div>
              </main>
            </div>
          </div>

          <DashboardMobileNav />
        </div>
      </div>
    </DashboardSectionProvider>
  );
}

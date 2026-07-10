"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Layers,
  Shield,
  UserCog,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  clearAdminSession,
  getAdminSession,
  SEED_SUPER_ADMIN,
  type AdminSession,
} from "@/lib/admin-session";

const RBAC_MODULES = [
  {
    title: "Roles",
    description: "Define admin roles such as super_admin, admin, and operator.",
    icon: Shield,
  },
  {
    title: "Permissions",
    description: "Granular permission keys mapped to platform capabilities.",
    icon: KeyRound,
  },
  {
    title: "Resources",
    description: "Protected entities — users, sessions, audit logs, settings.",
    icon: Layers,
  },
  {
    title: "Actions",
    description: "create, read, update, delete, assign, revoke.",
    icon: UserCog,
  },
  {
    title: "Role assignments",
    description: "Assign roles to admin users with scoped access.",
    icon: Users,
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminSession | null>(null);

  useEffect(() => {
    const session = getAdminSession();
    if (!session?.mfaVerified) {
      router.replace("/");
      return;
    }
    setAdmin(session);
  }, [router]);

  if (!admin) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center">
        <p className="text-compact text-muted-foreground">Loading console...</p>
      </div>
    );
  }

  const isSuperAdmin = admin.role === "super_admin";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-card shadow-zynd-low">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="font-heading text-h4 font-bold tracking-tight text-foreground">
              ZYND
            </span>
            <span className="rounded-[var(--radius-control)] border border-primary/20 bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
              Admin
            </span>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              clearAdminSession();
              router.push("/");
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <p className="text-compact font-medium text-primary">Platform Console</p>
          <h1 className="mt-1 font-heading text-h2 font-bold text-foreground">
            Welcome, {admin.displayName}
          </h1>
          <p className="mt-2 text-compact text-muted-foreground">
            Signed in as {admin.email} · Role:{" "}
            <span className="font-medium text-foreground">{admin.role}</span>
          </p>
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Session overview</CardTitle>
              <CardDescription>Current admin session (frontend dummy)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-compact text-muted-foreground">
              <p>
                <span className="text-foreground">Email:</span> {admin.email}
              </p>
              <p>
                <span className="text-foreground">Role:</span> {admin.role}
              </p>
              <p>
                <span className="text-foreground">MFA:</span> Verified
              </p>
              <p>
                <span className="text-foreground">Access scope:</span>{" "}
                {isSuperAdmin ? "Full platform (super_admin)" : "Limited admin scope"}
              </p>
            </CardContent>
          </Card>

          <Card className={isSuperAdmin ? "border-primary/30" : undefined}>
            <CardHeader>
              <CardTitle>Seeded super admin</CardTitle>
              <CardDescription>Backend RBAC seed target (Phase 1)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-compact text-muted-foreground">
              <p>
                <span className="text-foreground">Email:</span> {SEED_SUPER_ADMIN.email}
              </p>
              <p>
                <span className="text-foreground">Role:</span> {SEED_SUPER_ADMIN.role}
              </p>
              <p>
                <span className="text-foreground">Permissions:</span> All resources & actions
              </p>
              {isSuperAdmin ? (
                <p className="rounded-[var(--radius-control)] border border-success/20 bg-success/5 px-3 py-2 text-caption text-foreground">
                  You are signed in with the seeded super admin profile.
                </p>
              ) : (
                <p className="text-caption">
                  Sign in with {SEED_SUPER_ADMIN.email} to preview super admin access.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="font-heading text-h4 font-semibold text-foreground">
            RBAC modules
          </h2>
          <p className="mt-1 text-compact text-muted-foreground">
            Roles, permissions, resources, actions, and assignments — coming next.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RBAC_MODULES.map((module) => (
              <Card key={module.title}>
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
                    <module.icon className="size-4" />
                  </div>
                  <CardTitle>{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex rounded-[var(--radius-control)] bg-muted px-2 py-0.5 text-caption text-muted-foreground">
                    Coming soon
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

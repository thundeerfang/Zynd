"use client";

import { FundEligibilityBanner } from "@/components/dashboard/mfa-enroll-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { DEFAULT_COUNTRY } from "@/lib/input-rules";

export default function DashboardPage() {
  const { user, displayName } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="w-full min-w-0">
      <FundEligibilityBanner />
      <div className="mb-8">
        <h1 className="text-h2 font-bold text-foreground">
          Welcome, {user.first_name ?? "there"}
        </h1>
        <p className="mt-2 text-compact text-muted-foreground">
          Your wealth overview and account snapshot.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Net worth", value: "—", hint: "Connect assets to track" },
          { label: "Monthly savings", value: "—", hint: "Goals coming soon" },
          { label: "Portfolio health", value: "—", hint: "Insights coming soon" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-h3">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-caption text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Portfolio</CardTitle>
            <CardDescription>Unified asset view</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-[180px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-background/80">
              <p className="text-compact text-muted-foreground">
                Portfolio tracking is coming soon.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-compact text-muted-foreground">
            <p>
              <span className="text-foreground">Name:</span> {displayName || "—"}
            </p>
            <p>
              <span className="text-foreground">Email:</span> {user.email}
            </p>
            <p>
              <span className="text-foreground">Mobile:</span>{" "}
              {user.phone ? `${DEFAULT_COUNTRY.dialCode} ${user.phone}` : "—"}
            </p>
            <p>
              <span className="text-foreground">Country:</span> {DEFAULT_COUNTRY.label}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Your latest account events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-[var(--radius-card)] border border-border bg-background/80 px-4 py-3 text-compact text-muted-foreground">
              Account created successfully. Explore modules from the sidebar as they become
              available.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

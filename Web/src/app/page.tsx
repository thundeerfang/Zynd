import { SiteHeader } from "@/components/auth/auth-header-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-24">
        <div className="max-w-2xl">
          <p className="mb-4 text-compact font-medium text-primary">
            YOUR WEALTH. YOUR WAY.
          </p>
          <h1 className="text-display font-bold leading-tight tracking-tight text-foreground">
            Your financial life, unified and intelligent.
          </h1>
          <p className="mt-6 text-body text-muted-foreground">
            ZYND helps individuals and families manage, grow, and understand their
            wealth through a secure, premium experience built on trust, growth,
            and innovation.
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Portfolio", value: "Track all assets in one place" },
            { label: "Goals", value: "Plan and monitor your future" },
            { label: "Insights", value: "AI-powered financial guidance" },
          ].map((item) => (
            <Card key={item.label}>
              <CardHeader>
                <CardTitle className="text-primary">{item.label}</CardTitle>
                <CardDescription>{item.value}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

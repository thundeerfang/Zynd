"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delay={200}>
      <AuthProvider>{children}</AuthProvider>
    </TooltipProvider>
  );
}

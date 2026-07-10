import { cn } from "@/lib/utils";

export function IndiaFlagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 16"
      aria-hidden="true"
      className={cn("size-5 shrink-0 rounded-[2px] border border-border shadow-zynd-low", className)}
    >
      <rect width="24" height="16" fill="var(--india-flag-saffron)" />
      <rect y="5.33" width="24" height="5.34" fill="var(--india-flag-white)" />
      <rect y="10.67" width="24" height="5.33" fill="var(--india-flag-green)" />
      <circle cx="12" cy="8" r="2" fill="none" stroke="var(--india-flag-chakra)" strokeWidth="0.6" />
      <circle cx="12" cy="8" r="0.35" fill="var(--india-flag-chakra)" />
    </svg>
  );
}

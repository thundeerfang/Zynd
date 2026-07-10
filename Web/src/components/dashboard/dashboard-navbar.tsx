"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Info,
  Moon,
  Search,
  Sun,
} from "lucide-react";

import { DashboardSearchDialog } from "@/components/dashboard/dashboard-search-dialog";
import { DASHBOARD_HEADER_CLASS } from "@/components/dashboard/dashboard-layout";
import { DASHBOARD_TABS } from "@/components/dashboard/dashboard-top-nav";
import { useDashboardSection } from "@/components/dashboard/dashboard-section-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function NavIconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-9 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function DashboardNavbar() {
  const { activeSection, setActiveSection } = useDashboardSection();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      setSearchOpen((open) => !open);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className={cn(DASHBOARD_HEADER_CLASS, "justify-between gap-3 md:gap-4")}>
      <nav className="flex w-fit max-w-[calc(100%-12rem)] shrink-0 items-center overflow-x-auto rounded-[var(--radius-full)] bg-background p-1.5 shadow-zynd-mid [scrollbar-width:none] md:max-w-none [&::-webkit-scrollbar]:hidden">
        {DASHBOARD_TABS.map((tab) => {
          const active = activeSection === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={cn(
                "shrink-0 rounded-[var(--radius-full)] px-4 py-2 text-compact font-medium transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <div className="flex items-center gap-1 rounded-[var(--radius-full)] bg-background p-1.5 shadow-zynd-mid">
          <NavIconButton label="Search" onClick={() => setSearchOpen(true)}>
            <Search className="size-4" />
          </NavIconButton>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="relative size-9 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Notifications"
                />
              }
            >
              <Bell className="size-4" />
              <Badge className="absolute -top-0.5 -right-0.5 size-4 justify-center rounded-full bg-destructive p-0 text-[10px] text-background">
                5
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom">Notifications</TooltipContent>
          </Tooltip>

          <NavIconButton label="Help">
            <Info className="size-4" />
          </NavIconButton>
        </div>

        <div className="flex items-center rounded-[var(--radius-full)] bg-background p-1.5 shadow-zynd-mid">
          <button
            type="button"
            aria-label="Light mode"
            onClick={() => setTheme("light")}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-colors",
              theme === "light"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sun className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Dark mode"
            onClick={() => setTheme("dark")}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-colors",
              theme === "dark"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Moon className="size-4" />
          </button>
        </div>
      </div>
      </header>

      <DashboardSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

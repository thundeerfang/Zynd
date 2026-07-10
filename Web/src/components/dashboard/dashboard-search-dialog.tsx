"use client";

import {
  ArrowLeftRight,
  Landmark,
  LayoutDashboard,
  PieChart,
} from "lucide-react";

import { useDashboardSection } from "@/components/dashboard/dashboard-section-context";
import { DASHBOARD_TABS } from "@/components/dashboard/dashboard-top-nav";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const TAB_ICONS = {
  "portfolio-overview": LayoutDashboard,
  "fixed-deposits": Landmark,
  "mutual-funds": PieChart,
  transactions: ArrowLeftRight,
} as const;

type DashboardSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DashboardSearchDialog({
  open,
  onOpenChange,
}: DashboardSearchDialogProps) {
  const { setActiveSection } = useDashboardSection();

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search dashboard"
      description="Search pages across your dashboard."
    >
      <CommandInput placeholder="Search pages..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {DASHBOARD_TABS.map((tab) => {
            const Icon = TAB_ICONS[tab.id as keyof typeof TAB_ICONS];

            return (
              <CommandItem
                key={tab.id}
                value={tab.label}
                onSelect={() => {
                  setActiveSection(tab.id);
                  onOpenChange(false);
                }}
              >
                <Icon />
                <span>{tab.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

import {
  ArrowLeftRight,
  Landmark,
  LayoutDashboard,
  PieChart,
} from "lucide-react";

import { DASHBOARD_TABS } from "@/components/dashboard/dashboard-top-nav";

export type DashboardNavItem = {
  id: string;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const TAB_ICONS = {
  "portfolio-overview": LayoutDashboard,
  "fixed-deposits": Landmark,
  "mutual-funds": PieChart,
  transactions: ArrowLeftRight,
} as const;

export const DASHBOARD_NAV: DashboardNavItem[] = DASHBOARD_TABS.map((tab) => ({
  id: tab.id,
  label: tab.label,
  href: "/dashboard",
  icon: TAB_ICONS[tab.id as keyof typeof TAB_ICONS],
}));

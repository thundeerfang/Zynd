export type DashboardTab = {
  id: string;
  label: string;
};

export const DASHBOARD_TABS: DashboardTab[] = [
  { id: "portfolio-overview", label: "Portfolio Overview" },
  { id: "fixed-deposits", label: "Fixed Deposits" },
  { id: "mutual-funds", label: "Mutual Funds" },
  { id: "transactions", label: "Transactions" },
];

export const DEFAULT_DASHBOARD_SECTION = DASHBOARD_TABS[0].id;

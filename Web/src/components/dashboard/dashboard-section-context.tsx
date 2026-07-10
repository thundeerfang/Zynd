"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_DASHBOARD_SECTION } from "@/components/dashboard/dashboard-top-nav";

type DashboardSectionContextValue = {
  activeSection: string;
  setActiveSection: (section: string) => void;
};

const DashboardSectionContext = createContext<DashboardSectionContextValue | null>(
  null
);

export function DashboardSectionProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState(DEFAULT_DASHBOARD_SECTION);

  const value = useMemo(
    () => ({ activeSection, setActiveSection }),
    [activeSection]
  );

  return (
    <DashboardSectionContext.Provider value={value}>
      {children}
    </DashboardSectionContext.Provider>
  );
}

export function useDashboardSection() {
  const context = useContext(DashboardSectionContext);
  if (!context) {
    throw new Error("useDashboardSection must be used within DashboardSectionProvider");
  }
  return context;
}

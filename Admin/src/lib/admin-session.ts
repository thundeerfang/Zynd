export const ADMIN_SESSION_KEY = "zynd_admin_session";

export type AdminRole = "super_admin" | "admin" | "operator";

export type AdminSession = {
  email: string;
  role: AdminRole;
  displayName: string;
  mfaVerified: boolean;
};

/** Seeded super admin — will be replaced by backend RBAC seed data. */
export const SEED_SUPER_ADMIN = {
  email: "superadmin@zynd.co",
  role: "super_admin" as const,
  displayName: "Super Admin",
};

export function saveAdminSession(data: AdminSession) {
  sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(data));
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

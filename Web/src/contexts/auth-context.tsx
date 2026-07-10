"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  bootstrapSession,
  fetchCurrentUser,
  getDisplayName,
  isAuthenticatedResponse,
  login,
  loginWithGoogle,
  logout,
  type AuthUser,
  type LoginFlowResponse,
} from "@/lib/auth-api";
import { setAccessToken } from "@/lib/api-client";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  displayName: string;
  signIn: (email: string, password: string, turnstileToken?: string | null) => Promise<LoginFlowResponse>;
  signInWithGoogle: (idToken: string) => Promise<LoginFlowResponse>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  setUser: (user: AuthUser | null) => void;
  setAccessTokenFromAuth: (token: string) => void;
  completeAuth: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bootstrapSession()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string, turnstileToken?: string | null) => {
    const result = await login(email, password, turnstileToken);
    if (isAuthenticatedResponse(result)) {
      setUser(result.user);
    }
    return result;
  }, []);

  const signInWithGoogleToken = useCallback(async (idToken: string) => {
    const result = await loginWithGoogle(idToken);
    if (isAuthenticatedResponse(result)) {
      setUser(result.user);
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const next = await fetchCurrentUser();
      setUser(next);
      return next;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const completeAuth = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      displayName: user ? getDisplayName(user) : "",
      signIn,
      signInWithGoogle: signInWithGoogleToken,
      signOut,
      refreshUser,
      setUser,
      setAccessTokenFromAuth: setAccessToken,
      completeAuth,
    }),
    [completeAuth, loading, refreshUser, signIn, signInWithGoogleToken, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

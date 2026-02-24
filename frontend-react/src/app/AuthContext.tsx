import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthPayload, MeResponse, UserRole } from "@/types/auth";
import { clearStoredAuth, getStoredAuth, setStoredAuth } from "@/services/authStorage";
import { apiRequest, loginRequest } from "@/services/http";

interface AuthContextValue {
  loading: boolean;
  isAuthenticated: boolean;
  username: string | null;
  role: UserRole | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState<AuthPayload | null>(getStoredAuth());

  useEffect(() => {
    const bootstrap = async () => {
      const initial = getStoredAuth();
      if (!initial) {
        setLoading(false);
        return;
      }
      try {
        const me = await apiRequest<MeResponse>("/api/auth/me");
        setAuth((prev) => (prev ? { ...prev, role: me.role, username: me.username } : prev));
      } catch {
        clearStoredAuth();
        setAuth(null);
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, []);

  const login = async (username: string, password: string) => {
    const data = await loginRequest(username, password);
    setStoredAuth(data);
    setAuth(data);
  };

  const logout = () => {
    clearStoredAuth();
    setAuth(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      isAuthenticated: !!auth?.access_token,
      username: auth?.username ?? null,
      role: auth?.role ?? null,
      login,
      logout
    }),
    [loading, auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

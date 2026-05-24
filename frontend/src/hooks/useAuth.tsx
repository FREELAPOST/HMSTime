import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken } from "../api/client";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (code: string, pin: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const payload = await api<{ user: User }>("/auth/me");
      setUser(payload.user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(code: string, pin: string) {
    const payload = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { code, pin }
    });
    setToken(payload.token);
    setUser(payload.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }
  return context;
}

"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setAccessToken, apiFetch, refreshAccessToken } from "@/lib/apiClient";

interface Admin {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  admin: Admin | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  admin: null,
  loading: true,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use the shared singleton so this doesn't race with apiFetch refresh calls
    refreshAccessToken()
      .then((token) => {
        if (!token) throw new Error("no token");
        return apiFetch("/api/admin/me");
      })
      .then((res) => res.json())
      .then(({ admin }) => setAdmin(admin))
      .catch(() => {
        setAccessToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    setAccessToken(null);
    setAdmin(null);
    window.location.href = "/admin/login";
  }, []);

  return (
    <AuthContext.Provider value={{ admin, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

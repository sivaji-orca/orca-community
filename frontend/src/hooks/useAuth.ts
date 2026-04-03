import { useState, useCallback } from "react";

export interface User {
  id: number;
  username: string;
  role: "administrator" | "developer";
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("orca_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (username: string, password: string, role?: string) => {
    const body: Record<string, string> = { username, password };
    if (role) body.role = role;

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Login failed");
    }

    const data = await res.json();
    localStorage.setItem("orca_token", data.token);
    localStorage.setItem("orca_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("orca_token");
    localStorage.removeItem("orca_user");
    setUser(null);
  }, []);

  return { user, login, logout, isAuthenticated: !!user };
}

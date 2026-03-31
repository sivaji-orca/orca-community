import { useState, useCallback } from "react";

export interface User {
  id: number;
  username: string;
  role: "administrator" | "developer";
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("dhurandhar_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (username: string, password: string, role: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Login failed");
    }

    const data = await res.json();
    localStorage.setItem("dhurandhar_token", data.token);
    localStorage.setItem("dhurandhar_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("dhurandhar_token");
    localStorage.removeItem("dhurandhar_user");
    setUser(null);
  }, []);

  return { user, login, logout, isAuthenticated: !!user };
}

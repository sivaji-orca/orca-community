import { useState, useEffect, useCallback, createContext, useContext } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "teal" | "honey" | "ocean" | "indigo" | "rose" | "emerald";

const MODE_KEY = "orca_theme_mode";
const ACCENT_KEY = "orca_theme_accent";

function getSystemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return getSystemPrefersDark() ? "dark" : "light";
  return mode;
}

function applyToDOM(mode: ThemeMode, accent: AccentColor) {
  const html = document.documentElement;
  const resolved = resolveMode(mode);

  html.classList.toggle("dark", resolved === "dark");

  html.classList.remove("accent-teal", "accent-honey", "accent-ocean", "accent-indigo", "accent-rose", "accent-emerald");
  html.classList.add(`accent-${accent}`);
}

export interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentColor;
  resolvedMode: "light" | "dark";
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentColor) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeProvider(): ThemeContextValue {
  const [mode, setModeState] = useState<ThemeMode>(
    () => (localStorage.getItem(MODE_KEY) as ThemeMode) || "dark"
  );
  const [accent, setAccentState] = useState<AccentColor>(
    () => (localStorage.getItem(ACCENT_KEY) as AccentColor) || "teal"
  );

  const setMode = useCallback((m: ThemeMode) => {
    localStorage.setItem(MODE_KEY, m);
    setModeState(m);
  }, []);

  const setAccent = useCallback((a: AccentColor) => {
    localStorage.setItem(ACCENT_KEY, a);
    setAccentState(a);
  }, []);

  useEffect(() => {
    applyToDOM(mode, accent);
  }, [mode, accent]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyToDOM(mode, accent);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, accent]);

  return {
    mode,
    accent,
    resolvedMode: resolveMode(mode),
    setMode,
    setAccent,
  };
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeContext.Provider");
  return ctx;
}

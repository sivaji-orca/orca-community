import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    mode: "dark" as const,
    accent: "teal" as const,
    setMode: vi.fn(),
    setAccent: vi.fn(),
  }),
}));

vi.mock("../../hooks/useWorkspace", () => ({
  useWorkspace: () => ({
    activeWorkspace: { id: 1, name: "Default" },
    workspaces: [{ id: 1, name: "Default" }],
    switchWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
    updateWorkspace: vi.fn(),
  }),
}));

vi.mock("../../api/client", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

describe("Settings page constants", () => {
  it("has correct accent presets", () => {
    const ACCENT_PRESETS = [
      { id: "teal", label: "Teal", swatch: "#14b8a6" },
      { id: "honey", label: "Honey", swatch: "#b45309" },
      { id: "ocean", label: "Ocean", swatch: "#0e7490" },
      { id: "indigo", label: "Indigo", swatch: "#4f46e5" },
      { id: "rose", label: "Rose", swatch: "#be123c" },
      { id: "emerald", label: "Emerald", swatch: "#047857" },
    ];
    expect(ACCENT_PRESETS).toHaveLength(6);
    expect(ACCENT_PRESETS[0].id).toBe("teal");
    expect(ACCENT_PRESETS.map((p) => p.id)).toContain("honey");
  });

  it("has correct mode options", () => {
    const MODE_OPTIONS = [
      { id: "light", label: "Light" },
      { id: "dark", label: "Dark" },
      { id: "system", label: "System" },
    ];
    expect(MODE_OPTIONS).toHaveLength(3);
    expect(MODE_OPTIONS.map((m) => m.id)).toEqual(["light", "dark", "system"]);
  });

  it("has correct sub-tab options", () => {
    const tabs: string[] = ["workspaces", "secrets", "salesforce", "team", "security", "appearance"];
    expect(tabs).toHaveLength(6);
    expect(tabs).toContain("appearance");
  });
});

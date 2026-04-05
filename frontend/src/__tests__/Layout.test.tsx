import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Layout } from "../components/Layout";
import { BrandingContext } from "../hooks/useBranding";

vi.mock("../hooks/useWorkspace", () => ({
  useWorkspace: () => ({
    activeWorkspace: { id: 1, name: "Default" },
    workspaces: [{ id: 1, name: "Default" }],
    switchWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
  }),
}));

const defaultBranding = {
  branding: {
    appName: "Orca Community Edition",
    appShortName: "Orca",
    description: "MuleSoft Developer Productivity Tool",
    logoSvg: null,
    repoName: null,
    forkedAt: null,
  },
  isCustomBranded: false,
  refresh: vi.fn(),
};

const mockNav = [
  { label: "Overview", path: "/overview", active: true, onClick: vi.fn() },
  { label: "Projects", path: "/projects", active: false, onClick: vi.fn() },
];

const mockUser = { username: "testuser", role: "developer" as const, token: "test-token" };

function renderLayout() {
  return render(
    <BrandingContext.Provider value={defaultBranding}>
      <Layout user={mockUser} onLogout={vi.fn()} nav={mockNav}>
        <div data-testid="child-content">Dashboard content</div>
      </Layout>
    </BrandingContext.Provider>
  );
}

describe("Layout", () => {
  beforeEach(() => {
    vi.mocked(globalThis.fetch).mockReset();
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response);
  });

  it("renders the app short name", () => {
    renderLayout();
    expect(screen.getByText("Orca")).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderLayout();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("renders navigation items", () => {
    renderLayout();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("shows the signed-in username", () => {
    renderLayout();
    expect(screen.getByText("testuser")).toBeInTheDocument();
  });

  it("renders a sign-out option", () => {
    renderLayout();
    const logoutBtn = screen.getByText("Sign Out");
    expect(logoutBtn).toBeInTheDocument();
  });
});

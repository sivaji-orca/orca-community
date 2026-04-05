import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Login } from "../pages/Login";

beforeEach(() => {
  vi.mocked(globalThis.fetch).mockReset();
  vi.mocked(globalThis.fetch).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
  } as Response);
});

describe("Login", () => {
  it("renders the login page with Orca branding", () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByText("Orca")).toBeInTheDocument();
    expect(screen.getByText("MuleSoft Developer Productivity Tool")).toBeInTheDocument();
  });

  it("shows username and password fields directly", () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByPlaceholderText("Enter username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter password")).toBeInTheDocument();
    expect(screen.getByText("Sign In")).toBeInTheDocument();
  });

  it("shows default credentials hint", () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByText(/developer \/ developer/)).toBeInTheDocument();
    expect(screen.getByText(/admin \/ admin/)).toBeInTheDocument();
  });
});

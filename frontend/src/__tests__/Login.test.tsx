import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Login } from "../pages/Login";

describe("Login", () => {
  it("renders the login page with Orca branding", () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByText("Orca")).toBeInTheDocument();
    expect(screen.getByText("MuleSoft Developer Productivity Tool")).toBeInTheDocument();
    expect(screen.getByText("Community Edition")).toBeInTheDocument();
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

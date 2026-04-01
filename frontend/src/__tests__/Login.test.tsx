import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Login } from "../pages/Login";

describe("Login", () => {
  it("renders the login page with Orca branding", () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByText("Orca")).toBeInTheDocument();
    expect(screen.getByText("MuleSoft Developer Productivity Tool")).toBeInTheDocument();
    expect(screen.getByText("Community Edition")).toBeInTheDocument();
  });

  it("shows role selection buttons", () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByText("Sign in as Administrator")).toBeInTheDocument();
    expect(screen.getByText("Sign in as Developer")).toBeInTheDocument();
  });

  it("shows login form after selecting a role", () => {
    render(<Login onLogin={vi.fn()} />);
    fireEvent.click(screen.getByText("Sign in as Developer"));
    expect(screen.getByText("Sign in as Developer", { selector: "h2" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter password")).toBeInTheDocument();
  });

  it("allows going back to role selection", () => {
    render(<Login onLogin={vi.fn()} />);
    fireEvent.click(screen.getByText("Sign in as Developer"));
    const backButton = screen.getByText(/Back to role selection/);
    fireEvent.click(backButton);
    expect(screen.getByText("Choose your role")).toBeInTheDocument();
  });
});

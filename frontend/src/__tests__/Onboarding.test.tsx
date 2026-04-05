import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Onboarding } from "../pages/Onboarding";

beforeEach(() => {
  vi.mocked(globalThis.fetch).mockReset();
  vi.mocked(globalThis.fetch).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
  } as Response);
});

describe("Onboarding", () => {
  it("renders the brand step first", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    expect(screen.getByText("Brand Your App")).toBeInTheDocument();
  });

  it("shows step numbers in the indicator", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("has app name input in brand step", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    expect(screen.getByPlaceholderText("e.g. Dhurandhar, Apex Tools, MyOrg Integrations")).toBeInTheDocument();
  });

  it("can type into brand name field", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    const nameInput = screen.getByPlaceholderText("e.g. Dhurandhar, Apex Tools, MyOrg Integrations") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "TestApp" } });
    expect(nameInput.value).toBe("TestApp");
  });

  it("shows Continue button in brand step", () => {
    render(<Onboarding onComplete={vi.fn()} />);
    const buttons = screen.getAllByText("Continue");
    expect(buttons.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "../components/Card";

describe("Card", () => {
  it("renders title and children", () => {
    render(
      <Card title="Test Card">
        <p>Card content</p>
      </Card>
    );
    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });
});

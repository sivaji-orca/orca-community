import { describe, it, expect } from "bun:test";
import { generateDefaultAvatar } from "../../services/branding";

describe("branding - generateDefaultAvatar", () => {
  it("uses the first letter of the app name", () => {
    const svg = generateDefaultAvatar("Dhurandhar");
    expect(svg).toContain(">D<");
    expect(svg).toContain("<svg");
    expect(svg).toContain("viewBox='0 0 32 32'");
  });

  it("defaults to 'O' when app name is empty", () => {
    const svg = generateDefaultAvatar("");
    expect(svg).toContain(">O<");
  });

  it("uppercases the first letter", () => {
    const svg = generateDefaultAvatar("myApp");
    expect(svg).toContain(">M<");
  });
});

describe("branding - repo name derivation", () => {
  it("lowercases and hyphenates the app name for repo slug", () => {
    const appName = "My Cool App";
    const repoName = `${appName.toLowerCase().replace(/\s+/g, "-")}-orca`;
    expect(repoName).toBe("my-cool-app-orca");
  });

  it("handles single-word names", () => {
    const appName = "Dhurandhar";
    const repoName = `${appName.toLowerCase().replace(/\s+/g, "-")}-orca`;
    expect(repoName).toBe("dhurandhar-orca");
  });

  it("handles extra whitespace", () => {
    const appName = "  Spaces   Everywhere  ";
    const repoName = `${appName.trim().toLowerCase().replace(/\s+/g, "-")}-orca`;
    expect(repoName).toBe("spaces-everywhere-orca");
  });
});

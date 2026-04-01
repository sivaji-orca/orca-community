import { describe, it, expect, beforeAll } from "bun:test";
import { getSummary, getTimeline, getRecentErrors, getEndpointBreakdown, recordMetric } from "../services/analytics";

beforeAll(() => {
  recordMetric("/api/hello", "GET", 200, 45, "test-project");
  recordMetric("/api/hello", "GET", 200, 32, "test-project");
  recordMetric("/api/hello", "GET", 500, 120, "test-project");
  recordMetric("/api/users", "POST", 201, 85, "test-project");
  recordMetric("/api/users", "POST", 400, 15, "test-project");
});

describe("Analytics - getSummary", () => {
  it("returns summary with correct shape", () => {
    const summary = getSummary(undefined, 24);
    expect(summary).toHaveProperty("totalRequests");
    expect(summary).toHaveProperty("errorCount");
    expect(summary).toHaveProperty("successRate");
    expect(summary).toHaveProperty("avgResponseTime");
  });

  it("counts total requests", () => {
    const summary = getSummary("test-project", 24);
    expect(summary.totalRequests).toBeGreaterThanOrEqual(5);
  });

  it("identifies errors", () => {
    const summary = getSummary("test-project", 24);
    expect(summary.errorCount).toBeGreaterThanOrEqual(1);
  });
});

describe("Analytics - getTimeline", () => {
  it("returns an array of timeline entries", () => {
    const timeline = getTimeline(undefined, 24);
    expect(Array.isArray(timeline)).toBe(true);
  });
});

describe("Analytics - getRecentErrors", () => {
  it("returns error entries", () => {
    const errors = getRecentErrors("test-project", 50);
    expect(Array.isArray(errors)).toBe(true);
    if (errors.length > 0) {
      expect(errors[0].status_code).toBeGreaterThanOrEqual(400);
    }
  });
});

describe("Analytics - getEndpointBreakdown", () => {
  it("returns endpoint breakdown", () => {
    const endpoints = getEndpointBreakdown("test-project");
    expect(Array.isArray(endpoints)).toBe(true);
    if (endpoints.length > 0) {
      expect(endpoints[0]).toHaveProperty("endpoint");
      expect(endpoints[0]).toHaveProperty("method");
    }
  });
});

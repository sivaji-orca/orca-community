import { describe, it, expect } from "bun:test";
import { validateSOQL, getQueryTemplates } from "../../services/sf-nlp";

describe("sf-nlp - validateSOQL", () => {
  it("accepts a valid SELECT query", () => {
    const result = validateSOQL("SELECT Id, Name FROM Account");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a query without SELECT", () => {
    const result = validateSOQL("FROM Account");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("SELECT"))).toBe(true);
  });

  it("rejects a query without FROM", () => {
    const result = validateSOQL("SELECT Id, Name");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("FROM"))).toBe(true);
  });

  it("rejects DML statements", () => {
    for (const dml of ["INSERT INTO Account", "DELETE FROM Contact", "UPDATE Account SET", "DROP TABLE Account"]) {
      const result = validateSOQL(dml);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("rejects semicolons", () => {
    const result = validateSOQL("SELECT Id FROM Account;");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("semicolons"))).toBe(true);
  });

  it("handles complex valid queries", () => {
    const result = validateSOQL(
      "SELECT Id, Name, Industry FROM Account WHERE Industry = 'Technology' ORDER BY Name LIMIT 50"
    );
    expect(result.valid).toBe(true);
  });
});

describe("sf-nlp - getQueryTemplates", () => {
  it("returns a non-empty array of templates", () => {
    const templates = getQueryTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });

  it("each template has required fields", () => {
    for (const tpl of getQueryTemplates()) {
      expect(tpl.name).toBeTruthy();
      expect(tpl.description).toBeTruthy();
      expect(tpl.soql).toBeTruthy();
      expect(tpl.category).toBeTruthy();
    }
  });

  it("all template SOQLs pass validation", () => {
    for (const tpl of getQueryTemplates()) {
      const result = validateSOQL(tpl.soql);
      expect(result.valid).toBe(true);
    }
  });

  it("covers key categories", () => {
    const categories = new Set(getQueryTemplates().map((t) => t.category));
    expect(categories.has("accounts")).toBe(true);
    expect(categories.has("contacts")).toBe(true);
    expect(categories.has("opportunities")).toBe(true);
  });
});

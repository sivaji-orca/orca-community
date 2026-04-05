import "@testing-library/jest-dom/vitest";

globalThis.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
  } as Response)
) as any;

import { describe, it, expect } from "vitest";
import { compareVersions } from "../../src/update/check.js";

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  it("returns positive when first is greater (major)", () => {
    expect(compareVersions("2.0.0", "1.0.0")).toBeGreaterThan(0);
  });

  it("returns negative when first is lesser (major)", () => {
    expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
  });

  it("compares minor versions", () => {
    expect(compareVersions("1.2.0", "1.1.0")).toBeGreaterThan(0);
    expect(compareVersions("1.1.0", "1.2.0")).toBeLessThan(0);
  });

  it("compares patch versions", () => {
    expect(compareVersions("1.0.2", "1.0.1")).toBeGreaterThan(0);
    expect(compareVersions("1.0.1", "1.0.2")).toBeLessThan(0);
  });

  it("handles mixed version differences", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
  });
});

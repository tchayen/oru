import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { bold, dim, italic, white } from "../../src/format/colors.js";

let savedForceColor: string | undefined;
let savedNoColor: string | undefined;

beforeEach(() => {
  savedForceColor = process.env.FORCE_COLOR;
  savedNoColor = process.env.NO_COLOR;
  process.env.FORCE_COLOR = "1";
  delete process.env.NO_COLOR;
});

afterEach(() => {
  if (savedForceColor !== undefined) {
    process.env.FORCE_COLOR = savedForceColor;
  } else {
    delete process.env.FORCE_COLOR;
  }
  if (savedNoColor !== undefined) {
    process.env.NO_COLOR = savedNoColor;
  } else {
    delete process.env.NO_COLOR;
  }
});

describe("colors", () => {
  it("bold wraps text", () => {
    expect(bold("hello")).toBe("\x1b[1mhello\x1b[22m");
  });

  it("dim wraps text", () => {
    expect(dim("hello")).toBe("\x1b[2mhello\x1b[22m");
  });

  it("italic wraps text", () => {
    expect(italic("hello")).toBe("\x1b[3mhello\x1b[23m");
  });

  it("white wraps text", () => {
    expect(white("text")).toBe("\x1b[37mtext\x1b[39m");
  });

  it("styles can be nested", () => {
    expect(bold(white("important"))).toBe("\x1b[1m\x1b[37mimportant\x1b[39m\x1b[22m");
  });

  it("NO_COLOR disables output", () => {
    process.env.NO_COLOR = "";
    expect(bold("hello")).toBe("hello");
    expect(white("hello")).toBe("hello");
  });

  it("NO_COLOR takes precedence over FORCE_COLOR", () => {
    process.env.NO_COLOR = "";
    process.env.FORCE_COLOR = "1";
    expect(bold("hello")).toBe("hello");
  });
});

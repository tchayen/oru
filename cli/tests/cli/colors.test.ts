import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { bold, dim, italic, red, green, yellow, cyan } from "../../src/format/colors.js";

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

  it("red wraps text", () => {
    expect(red("error")).toBe("\x1b[31merror\x1b[39m");
  });

  it("green wraps text", () => {
    expect(green("ok")).toBe("\x1b[32mok\x1b[39m");
  });

  it("yellow wraps text", () => {
    expect(yellow("warn")).toBe("\x1b[33mwarn\x1b[39m");
  });

  it("cyan wraps text", () => {
    expect(cyan("info")).toBe("\x1b[36minfo\x1b[39m");
  });

  it("styles can be nested", () => {
    expect(bold(red("important"))).toBe("\x1b[1m\x1b[31mimportant\x1b[39m\x1b[22m");
  });

  it("NO_COLOR disables output", () => {
    process.env.NO_COLOR = "";
    expect(bold("hello")).toBe("hello");
    expect(red("hello")).toBe("hello");
  });

  it("NO_COLOR takes precedence over FORCE_COLOR", () => {
    process.env.NO_COLOR = "";
    process.env.FORCE_COLOR = "1";
    expect(bold("hello")).toBe("hello");
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { loadConfig } from "../../src/config/config.js";

describe("config", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ao-config-test-"));
    configPath = path.join(tmpDir, "config.toml");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns defaults when file does not exist", () => {
    const config = loadConfig(path.join(tmpDir, "nonexistent.toml"));
    expect(config).toEqual({
      date_format: "mdy",
      first_day_of_week: "monday",
      output_format: "text",
    });
  });

  it("returns defaults for empty file", () => {
    fs.writeFileSync(configPath, "");
    const config = loadConfig(configPath);
    expect(config).toEqual({
      date_format: "mdy",
      first_day_of_week: "monday",
      output_format: "text",
    });
  });

  it("parses date_format = dmy", () => {
    fs.writeFileSync(configPath, 'date_format = "dmy"\n');
    const config = loadConfig(configPath);
    expect(config.date_format).toBe("dmy");
  });

  it("parses date_format = mdy", () => {
    fs.writeFileSync(configPath, 'date_format = "mdy"\n');
    const config = loadConfig(configPath);
    expect(config.date_format).toBe("mdy");
  });

  it("ignores invalid date_format", () => {
    fs.writeFileSync(configPath, 'date_format = "ymd"\n');
    const config = loadConfig(configPath);
    expect(config.date_format).toBe("mdy");
  });

  it("parses first_day_of_week", () => {
    fs.writeFileSync(configPath, 'first_day_of_week = "sunday"\n');
    const config = loadConfig(configPath);
    expect(config.first_day_of_week).toBe("sunday");
  });

  it("parses first_day_of_week case-insensitively", () => {
    fs.writeFileSync(configPath, 'first_day_of_week = "Sunday"\n');
    const config = loadConfig(configPath);
    expect(config.first_day_of_week).toBe("sunday");
  });

  it("ignores invalid first_day_of_week", () => {
    fs.writeFileSync(configPath, 'first_day_of_week = "funday"\n');
    const config = loadConfig(configPath);
    expect(config.first_day_of_week).toBe("monday");
  });

  it("parses output_format = json", () => {
    fs.writeFileSync(configPath, 'output_format = "json"\n');
    const config = loadConfig(configPath);
    expect(config.output_format).toBe("json");
  });

  it("parses output_format = text", () => {
    fs.writeFileSync(configPath, 'output_format = "text"\n');
    const config = loadConfig(configPath);
    expect(config.output_format).toBe("text");
  });

  it("ignores invalid output_format", () => {
    fs.writeFileSync(configPath, 'output_format = "xml"\n');
    const config = loadConfig(configPath);
    expect(config.output_format).toBe("text");
  });

  it("parses full config file", () => {
    fs.writeFileSync(
      configPath,
      `date_format = "dmy"
first_day_of_week = "wednesday"
output_format = "json"
`,
    );
    const config = loadConfig(configPath);
    expect(config).toEqual({
      date_format: "dmy",
      first_day_of_week: "wednesday",
      output_format: "json",
    });
  });

  it("ignores unknown keys", () => {
    fs.writeFileSync(
      configPath,
      `date_format = "dmy"
unknown_key = "whatever"
`,
    );
    const config = loadConfig(configPath);
    expect(config.date_format).toBe("dmy");
    expect(config.first_day_of_week).toBe("monday");
  });

  it("uses defaults for missing keys in partial config", () => {
    fs.writeFileSync(configPath, 'output_format = "json"\n');
    const config = loadConfig(configPath);
    expect(config).toEqual({
      date_format: "mdy",
      first_day_of_week: "monday",
      output_format: "json",
    });
  });
});

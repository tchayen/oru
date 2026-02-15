import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { getConfigPath, loadConfig } from "../../src/config/config.js";

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
      next_month: "same_day",
    });
  });

  it("returns defaults for empty file", () => {
    fs.writeFileSync(configPath, "");
    const config = loadConfig(configPath);
    expect(config).toEqual({
      date_format: "mdy",
      first_day_of_week: "monday",
      output_format: "text",
      next_month: "same_day",
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
      next_month: "same_day",
    });
  });

  it("parses next_month = first", () => {
    fs.writeFileSync(configPath, 'next_month = "first"\n');
    const config = loadConfig(configPath);
    expect(config.next_month).toBe("first");
  });

  it("parses next_month = same_day", () => {
    fs.writeFileSync(configPath, 'next_month = "same_day"\n');
    const config = loadConfig(configPath);
    expect(config.next_month).toBe("same_day");
  });

  it("ignores invalid next_month", () => {
    fs.writeFileSync(configPath, 'next_month = "last"\n');
    const config = loadConfig(configPath);
    expect(config.next_month).toBe("same_day");
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
      next_month: "same_day",
    });
  });
});

describe("getConfigPath", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns default path when no env vars set", () => {
    delete process.env.AO_CONFIG_PATH;
    delete process.env.AO_CONFIG_DIR;
    expect(getConfigPath()).toBe(path.join(os.homedir(), ".ao", "config.toml"));
  });

  it("respects AO_CONFIG_PATH", () => {
    process.env.AO_CONFIG_PATH = "/tmp/custom/my-config.toml";
    delete process.env.AO_CONFIG_DIR;
    expect(getConfigPath()).toBe("/tmp/custom/my-config.toml");
  });

  it("respects AO_CONFIG_DIR", () => {
    delete process.env.AO_CONFIG_PATH;
    process.env.AO_CONFIG_DIR = "/tmp/custom-dir";
    expect(getConfigPath()).toBe(path.join("/tmp/custom-dir", "config.toml"));
  });

  it("prefers AO_CONFIG_PATH over AO_CONFIG_DIR", () => {
    process.env.AO_CONFIG_PATH = "/tmp/explicit.toml";
    process.env.AO_CONFIG_DIR = "/tmp/custom-dir";
    expect(getConfigPath()).toBe("/tmp/explicit.toml");
  });
});

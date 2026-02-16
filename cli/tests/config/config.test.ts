import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { getConfigPath, loadConfig, setConfigValue } from "../../src/config/config.js";

describe("config", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-config-test-"));
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
      auto_update_check: true,
      telemetry: true,
      telemetry_notice_shown: false,
      backup_path: null,
      backup_interval: 60,
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
      auto_update_check: true,
      telemetry: true,
      telemetry_notice_shown: false,
      backup_path: null,
      backup_interval: 60,
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
      auto_update_check: true,
      telemetry: true,
      telemetry_notice_shown: false,
      backup_path: null,
      backup_interval: 60,
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

  it("parses telemetry = false", () => {
    fs.writeFileSync(configPath, "telemetry = false\n");
    const config = loadConfig(configPath);
    expect(config.telemetry).toBe(false);
  });

  it("parses telemetry = true", () => {
    fs.writeFileSync(configPath, "telemetry = true\n");
    const config = loadConfig(configPath);
    expect(config.telemetry).toBe(true);
  });

  it("ignores non-boolean telemetry", () => {
    fs.writeFileSync(configPath, 'telemetry = "no"\n');
    const config = loadConfig(configPath);
    expect(config.telemetry).toBe(true);
  });

  it("parses backup_path", () => {
    fs.writeFileSync(configPath, 'backup_path = "~/backups"\n');
    const config = loadConfig(configPath);
    expect(config.backup_path).toBe("~/backups");
  });

  it("parses backup_interval", () => {
    fs.writeFileSync(configPath, "backup_interval = 30\n");
    const config = loadConfig(configPath);
    expect(config.backup_interval).toBe(30);
  });

  it("ignores empty backup_path", () => {
    fs.writeFileSync(configPath, 'backup_path = ""\n');
    const config = loadConfig(configPath);
    expect(config.backup_path).toBeNull();
  });

  it("ignores non-positive backup_interval", () => {
    fs.writeFileSync(configPath, "backup_interval = 0\n");
    const config = loadConfig(configPath);
    expect(config.backup_interval).toBe(60);
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
      auto_update_check: true,
      telemetry: true,
      telemetry_notice_shown: false,
      backup_path: null,
      backup_interval: 60,
    });
  });

  it("falls back to defaults with a warning when TOML is invalid", () => {
    fs.writeFileSync(configPath, "{{{{ not valid toml !!! = = =\x00\x01\x02");
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const config = loadConfig(configPath);
    expect(config).toEqual({
      date_format: "mdy",
      first_day_of_week: "monday",
      output_format: "text",
      next_month: "same_day",
      auto_update_check: true,
      telemetry: true,
      telemetry_notice_shown: false,
      backup_path: null,
      backup_interval: 60,
    });
    expect(stderrSpy).toHaveBeenCalledOnce();
    const warning = stderrSpy.mock.calls[0][0] as string;
    expect(warning).toContain("Warning: Could not parse config file");
    expect(warning).toContain(configPath);
    expect(warning).toContain("Using defaults");
    stderrSpy.mockRestore();
  });
});

describe("getConfigPath", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns default path when no env vars set", () => {
    delete process.env.ORU_CONFIG_PATH;
    delete process.env.ORU_CONFIG_DIR;
    expect(getConfigPath()).toBe(path.join(os.homedir(), ".oru", "config.toml"));
  });

  it("respects ORU_CONFIG_PATH", () => {
    process.env.ORU_CONFIG_PATH = "/tmp/custom/my-config.toml";
    delete process.env.ORU_CONFIG_DIR;
    expect(getConfigPath()).toBe("/tmp/custom/my-config.toml");
  });

  it("respects ORU_CONFIG_DIR", () => {
    delete process.env.ORU_CONFIG_PATH;
    process.env.ORU_CONFIG_DIR = "/tmp/custom-dir";
    expect(getConfigPath()).toBe(path.join("/tmp/custom-dir", "config.toml"));
  });

  it("prefers ORU_CONFIG_PATH over ORU_CONFIG_DIR", () => {
    process.env.ORU_CONFIG_PATH = "/tmp/explicit.toml";
    process.env.ORU_CONFIG_DIR = "/tmp/custom-dir";
    expect(getConfigPath()).toBe("/tmp/explicit.toml");
  });
});

describe("setConfigValue", () => {
  let tmpDir: string;
  let configPath: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-config-set-test-"));
    configPath = path.join(tmpDir, "config.toml");
    process.env.ORU_CONFIG_PATH = configPath;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
    process.env = { ...originalEnv };
  });

  it("creates a new key in an empty file", () => {
    fs.writeFileSync(configPath, "");
    setConfigValue("date_format", '"dmy"');
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).toContain('date_format = "dmy"');
    const config = loadConfig(configPath);
    expect(config.date_format).toBe("dmy");
  });

  it("updates an existing key", () => {
    fs.writeFileSync(configPath, 'date_format = "mdy"\n');
    setConfigValue("date_format", '"dmy"');
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).toBe('date_format = "dmy"\n');
    const config = loadConfig(configPath);
    expect(config.date_format).toBe("dmy");
  });

  it("preserves other keys when updating", () => {
    fs.writeFileSync(
      configPath,
      `date_format = "mdy"
first_day_of_week = "sunday"
`,
    );
    setConfigValue("date_format", '"dmy"');
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).toContain('date_format = "dmy"');
    expect(content).toContain('first_day_of_week = "sunday"');
  });

  it("handles keys with regex special characters without crashing", () => {
    fs.writeFileSync(configPath, "");
    const keyWithSpecialChars = "test.key[0]+name*";
    expect(() => {
      setConfigValue(keyWithSpecialChars, "value");
    }).not.toThrow();
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).toContain(`${keyWithSpecialChars} = value`);
  });

  it("correctly updates a key that looks like a regex pattern", () => {
    const specialKey = "log.level";
    fs.writeFileSync(configPath, `${specialKey} = "info"\n`);
    setConfigValue(specialKey, '"debug"');
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).toBe(`${specialKey} = "debug"\n`);
    // Verify the old value is not present
    expect(content).not.toContain('log.level = "info"');
  });

  it("handles keys with dot notation without matching unintended lines", () => {
    fs.writeFileSync(
      configPath,
      `backup_path = "/backups"
backup_path_old = "/old-backups"
`,
    );
    setConfigValue("backup_path", '"/new-backups"');
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).toContain('backup_path = "/new-backups"');
    expect(content).toContain('backup_path_old = "/old-backups"');
  });

  it("handles keys with brackets in them", () => {
    fs.writeFileSync(configPath, "");
    setConfigValue("array[0]", '"value"');
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).toContain('array[0] = "value"');
  });

  it("handles keys with parentheses in them", () => {
    fs.writeFileSync(configPath, "");
    setConfigValue("func()", '"value"');
    const content = fs.readFileSync(configPath, "utf-8");
    expect(content).toContain('func() = "value"');
  });
});

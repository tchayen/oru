import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  isTelemetryEnabled,
  getTelemetryDisabledReason,
  detectCI,
  extractCommandAndFlags,
  showFirstRunNotice,
  buildEvent,
} from "../../src/telemetry/telemetry";
import type { Config } from "../../src/config/config";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    date_format: "mdy",
    first_day_of_week: "monday",
    output_format: "text",
    next_month: "same_day",
    auto_update_check: true,
    telemetry: true,
    telemetry_notice_shown: false,
    ...overrides,
  };
}

describe("isTelemetryEnabled", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns true by default", () => {
    delete process.env.DO_NOT_TRACK;
    delete process.env.ORU_TELEMETRY_DISABLED;
    expect(isTelemetryEnabled(makeConfig())).toBe(true);
  });

  it("returns false when DO_NOT_TRACK=1", () => {
    process.env.DO_NOT_TRACK = "1";
    expect(isTelemetryEnabled(makeConfig())).toBe(false);
  });

  it("returns false when ORU_TELEMETRY_DISABLED=1", () => {
    process.env.ORU_TELEMETRY_DISABLED = "1";
    expect(isTelemetryEnabled(makeConfig())).toBe(false);
  });

  it("returns false when config.telemetry is false", () => {
    delete process.env.DO_NOT_TRACK;
    delete process.env.ORU_TELEMETRY_DISABLED;
    expect(isTelemetryEnabled(makeConfig({ telemetry: false }))).toBe(false);
  });

  it("DO_NOT_TRACK takes priority over config", () => {
    process.env.DO_NOT_TRACK = "1";
    expect(isTelemetryEnabled(makeConfig({ telemetry: true }))).toBe(false);
  });
});

describe("getTelemetryDisabledReason", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns null when enabled", () => {
    delete process.env.DO_NOT_TRACK;
    delete process.env.ORU_TELEMETRY_DISABLED;
    expect(getTelemetryDisabledReason(makeConfig())).toBeNull();
  });

  it("returns DO_NOT_TRACK reason", () => {
    process.env.DO_NOT_TRACK = "1";
    expect(getTelemetryDisabledReason(makeConfig())).toContain("DO_NOT_TRACK");
  });

  it("returns ORU_TELEMETRY_DISABLED reason", () => {
    process.env.ORU_TELEMETRY_DISABLED = "1";
    delete process.env.DO_NOT_TRACK;
    expect(getTelemetryDisabledReason(makeConfig())).toContain("ORU_TELEMETRY_DISABLED");
  });

  it("returns config reason", () => {
    delete process.env.DO_NOT_TRACK;
    delete process.env.ORU_TELEMETRY_DISABLED;
    expect(getTelemetryDisabledReason(makeConfig({ telemetry: false }))).toContain("config");
  });
});

describe("detectCI", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns false when no CI env vars set", () => {
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITLAB_CI;
    delete process.env.CIRCLECI;
    delete process.env.TRAVIS;
    delete process.env.JENKINS_URL;
    delete process.env.BUILDKITE;
    delete process.env.TF_BUILD;
    expect(detectCI()).toBe(false);
  });

  it("returns true when CI=true", () => {
    process.env.CI = "true";
    expect(detectCI()).toBe(true);
  });

  it("returns true when GITHUB_ACTIONS is set", () => {
    process.env.GITHUB_ACTIONS = "true";
    expect(detectCI()).toBe(true);
  });
});

describe("extractCommandAndFlags", () => {
  it("extracts simple command", () => {
    const result = extractCommandAndFlags(["node", "oru", "list"]);
    expect(result.command).toBe("list");
    expect(result.flags).toEqual([]);
  });

  it("extracts command with flags", () => {
    const result = extractCommandAndFlags(["node", "oru", "add", "Buy milk", "--priority", "high"]);
    expect(result.command).toBe("add");
    expect(result.flags).toEqual(["--priority"]);
  });

  it("extracts short flags", () => {
    const result = extractCommandAndFlags(["node", "oru", "list", "-s", "done", "--json"]);
    expect(result.command).toBe("list");
    expect(result.flags).toEqual(["-s", "--json"]);
  });

  it("handles flags with = syntax", () => {
    const result = extractCommandAndFlags(["node", "oru", "list", "--status=done"]);
    expect(result.command).toBe("list");
    expect(result.flags).toEqual(["--status"]);
  });

  it("extracts subcommands", () => {
    const result = extractCommandAndFlags(["node", "oru", "config", "init"]);
    expect(result.command).toBe("config init");
    expect(result.flags).toEqual([]);
  });

  it("extracts telemetry subcommands", () => {
    const result = extractCommandAndFlags(["node", "oru", "telemetry", "status"]);
    expect(result.command).toBe("telemetry status");
    expect(result.flags).toEqual([]);
  });

  it("returns (unknown) for empty args", () => {
    const result = extractCommandAndFlags(["node", "oru"]);
    expect(result.command).toBe("(unknown)");
    expect(result.flags).toEqual([]);
  });

  it("does not include flag values in flags array", () => {
    const result = extractCommandAndFlags([
      "node",
      "oru",
      "update",
      "abc123",
      "--title",
      "secret title",
      "--status",
      "done",
    ]);
    expect(result.command).toBe("update");
    expect(result.flags).toEqual(["--title", "--status"]);
    expect(result.flags).not.toContain("secret title");
    expect(result.flags).not.toContain("done");
  });
});

describe("buildEvent", () => {
  it("omits error field when not provided", () => {
    const event = buildEvent("list", [], 100, 0);
    expect("error" in event).toBe(false);
  });

  it("includes error field when provided", () => {
    const event = buildEvent("foobar", [], 5, 1, "commander.unknownCommand");
    expect(event.error).toBe("commander.unknownCommand");
  });
});

describe("showFirstRunNotice", () => {
  let tmpDir: string;
  const originalEnv = { ...process.env };
  const originalWrite = process.stderr.write;
  const originalIsTTY = process.stderr.isTTY;
  let stderrOutput: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-telemetry-test-"));
    process.env.ORU_CONFIG_PATH = path.join(tmpDir, "config.toml");
    stderrOutput = "";
    process.stderr.write = ((chunk: string) => {
      stderrOutput += chunk;
      return true;
    }) as typeof process.stderr.write;
    Object.defineProperty(process.stderr, "isTTY", { value: true, configurable: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    process.stderr.write = originalWrite;
    Object.defineProperty(process.stderr, "isTTY", { value: originalIsTTY, configurable: true });
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("prints notice on first run", () => {
    showFirstRunNotice(makeConfig({ telemetry_notice_shown: false }));
    expect(stderrOutput).toContain("anonymous usage data");
    expect(stderrOutput).toContain("oru telemetry disable");
  });

  it("sets telemetry_notice_shown in config after first run", () => {
    showFirstRunNotice(makeConfig({ telemetry_notice_shown: false }));
    const content = fs.readFileSync(path.join(tmpDir, "config.toml"), "utf-8");
    expect(content).toContain("telemetry_notice_shown = true");
  });

  it("does not print notice when already shown", () => {
    showFirstRunNotice(makeConfig({ telemetry_notice_shown: true }));
    expect(stderrOutput).toBe("");
  });

  it("suppresses notice on non-TTY stderr", () => {
    Object.defineProperty(process.stderr, "isTTY", { value: undefined, configurable: true });
    showFirstRunNotice(makeConfig({ telemetry_notice_shown: false }));
    expect(stderrOutput).toBe("");
  });
});

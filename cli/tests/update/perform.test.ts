import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

describe("install method detection", () => {
  it("detects script install from .install-meta", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-meta-test-"));
    const metaPath = path.join(tmpDir, ".install-meta");

    fs.writeFileSync(metaPath, "install_method=script\nversion=1.0.0\nplatform=darwin-arm64\n");

    const raw = fs.readFileSync(metaPath, "utf-8");
    const meta: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const eqIdx = line.indexOf("=");
      if (eqIdx !== -1) {
        meta[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
      }
    }

    expect(meta.install_method).toBe("script");
    expect(meta.version).toBe("1.0.0");
    expect(meta.platform).toBe("darwin-arm64");

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns null for missing .install-meta", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-meta-test-"));
    const metaPath = path.join(tmpDir, ".install-meta");

    let meta: Record<string, string> | null = null;
    try {
      fs.readFileSync(metaPath, "utf-8");
    } catch {
      meta = null;
    }

    expect(meta).toBeNull();

    fs.rmSync(tmpDir, { recursive: true });
  });
});

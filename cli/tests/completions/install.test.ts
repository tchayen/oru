import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import {
  detectShell,
  getInstallPaths,
  installCompletions,
  confirm,
  formatSuccessMessage,
  type InstallResult,
} from "../../src/completions/install.js";

describe("detectShell", () => {
  const origShell = process.env.SHELL;

  afterEach(() => {
    if (origShell !== undefined) {
      process.env.SHELL = origShell;
    } else {
      delete process.env.SHELL;
    }
  });

  it("detects bash", () => {
    process.env.SHELL = "/bin/bash";
    expect(detectShell()).toBe("bash");
  });

  it("detects zsh", () => {
    process.env.SHELL = "/bin/zsh";
    expect(detectShell()).toBe("zsh");
  });

  it("detects fish", () => {
    process.env.SHELL = "/usr/local/bin/fish";
    expect(detectShell()).toBe("fish");
  });

  it("returns null for unknown shell", () => {
    process.env.SHELL = "/bin/tcsh";
    expect(detectShell()).toBeNull();
  });

  it("returns null when $SHELL is unset", () => {
    delete process.env.SHELL;
    expect(detectShell()).toBeNull();
  });
});

describe("getInstallPaths", () => {
  it("returns correct paths for bash", () => {
    const p = getInstallPaths("bash", "/home/user");
    expect(p.scriptPath).toBe("/home/user/.oru/completions.bash");
    expect(p.rcPath).toBe("/home/user/.bashrc");
  });

  it("returns correct paths for zsh", () => {
    const p = getInstallPaths("zsh", "/home/user");
    expect(p.scriptPath).toBe("/home/user/.oru/completions.zsh");
    expect(p.rcPath).toBe("/home/user/.zshrc");
  });

  it("returns correct paths for fish", () => {
    const p = getInstallPaths("fish", "/home/user");
    expect(p.scriptPath).toBe("/home/user/.config/fish/completions/oru.fish");
    expect(p.rcPath).toBeNull();
  });
});

describe("installCompletions", () => {
  let tmpDir: string;
  let messages: string[];
  const write = (msg: string) => messages.push(msg);

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-install-test-"));
    messages = [];
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes bash script and adds source line to bashrc", () => {
    const result = installCompletions("bash", write, tmpDir);
    expect(result.shell).toBe("bash");
    expect(result.sourceLineAdded).toBe(true);

    const script = fs.readFileSync(result.scriptPath, "utf-8");
    expect(script).toContain("_oru_completions");

    const rc = fs.readFileSync(result.rcPath!, "utf-8");
    expect(rc).toContain(`source ${result.scriptPath}`);
  });

  it("writes zsh script and adds source line to zshrc", () => {
    const result = installCompletions("zsh", write, tmpDir);
    expect(result.shell).toBe("zsh");
    expect(result.sourceLineAdded).toBe(true);

    const script = fs.readFileSync(result.scriptPath, "utf-8");
    expect(script).toContain("compdef");

    const rc = fs.readFileSync(result.rcPath!, "utf-8");
    expect(rc).toContain(`source ${result.scriptPath}`);
  });

  it("writes fish script with no rc modification", () => {
    const result = installCompletions("fish", write, tmpDir);
    expect(result.shell).toBe("fish");
    expect(result.rcPath).toBeNull();
    expect(result.sourceLineAdded).toBe(false);

    const script = fs.readFileSync(result.scriptPath, "utf-8");
    expect(script).toContain("complete -c oru");
  });

  it("is idempotent – does not duplicate source line", () => {
    installCompletions("zsh", write, tmpDir);
    messages = [];
    const result = installCompletions("zsh", write, tmpDir);
    expect(result.sourceLineAdded).toBe(false);

    const rc = fs.readFileSync(result.rcPath!, "utf-8");
    const matches = rc.match(/source /g);
    expect(matches).toHaveLength(1);
  });

  it("preserves existing rc content", () => {
    const rcPath = path.join(tmpDir, ".zshrc");
    fs.writeFileSync(rcPath, "export FOO=bar\n");

    installCompletions("zsh", write, tmpDir);

    const rc = fs.readFileSync(rcPath, "utf-8");
    expect(rc).toContain("export FOO=bar");
    expect(rc).toContain("source ");
  });

  it("detects tilde form of source line as already present", () => {
    const rcPath = path.join(tmpDir, ".zshrc");
    fs.writeFileSync(rcPath, "source ~/.oru/completions.zsh\n");

    const result = installCompletions("zsh", write, tmpDir);
    expect(result.sourceLineAdded).toBe(false);
  });
});

describe("confirm", () => {
  it("returns true for empty input (default yes)", async () => {
    const input = Readable.from(["\n"]);
    const output = new (await import("stream")).Writable({
      write: (_chunk, _enc, cb) => cb(),
    });
    const result = await confirm("Continue? ", input, output);
    expect(result).toBe(true);
  });

  it("returns true for 'y'", async () => {
    const input = Readable.from(["y\n"]);
    const output = new (await import("stream")).Writable({
      write: (_chunk, _enc, cb) => cb(),
    });
    const result = await confirm("Continue? ", input, output);
    expect(result).toBe(true);
  });

  it("returns true for 'yes'", async () => {
    const input = Readable.from(["yes\n"]);
    const output = new (await import("stream")).Writable({
      write: (_chunk, _enc, cb) => cb(),
    });
    const result = await confirm("Continue? ", input, output);
    expect(result).toBe(true);
  });

  it("returns false for 'n'", async () => {
    const input = Readable.from(["n\n"]);
    const output = new (await import("stream")).Writable({
      write: (_chunk, _enc, cb) => cb(),
    });
    const result = await confirm("Continue? ", input, output);
    expect(result).toBe(false);
  });
});

describe("formatSuccessMessage", () => {
  it("suggests sourcing zshrc for zsh", () => {
    const result: InstallResult = {
      shell: "zsh",
      scriptPath: "/home/user/.oru/completions.zsh",
      rcPath: "/home/user/.zshrc",
      sourceLineAdded: true,
    };
    expect(formatSuccessMessage(result)).toContain("source ~/.zshrc");
  });

  it("suggests sourcing bashrc for bash", () => {
    const result: InstallResult = {
      shell: "bash",
      scriptPath: "/home/user/.oru/completions.bash",
      rcPath: "/home/user/.bashrc",
      sourceLineAdded: true,
    };
    expect(formatSuccessMessage(result)).toContain("source ~/.bashrc");
  });

  it("mentions automatic loading for fish", () => {
    const result: InstallResult = {
      shell: "fish",
      scriptPath: "/home/user/.config/fish/completions/oru.fish",
      rcPath: null,
      sourceLineAdded: false,
    };
    expect(formatSuccessMessage(result)).toContain("automatically");
  });
});

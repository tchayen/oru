import fs from "fs";
import path from "path";
import os from "node:os";
import readline from "readline";
import { generateBashCompletions } from "./bash.js";
import { generateZshCompletions } from "./zsh.js";
import { generateFishCompletions } from "./fish.js";

export type Shell = "bash" | "zsh" | "fish";

export interface InstallPaths {
  scriptPath: string;
  rcPath: string | null;
}

export interface InstallResult {
  shell: Shell;
  scriptPath: string;
  rcPath: string | null;
  sourceLineAdded: boolean;
}

export function detectShell(): Shell | null {
  const shell = process.env.SHELL;
  if (!shell) {
    return null;
  }
  const name = path.basename(shell);
  if (name === "bash" || name === "zsh" || name === "fish") {
    return name;
  }
  return null;
}

export function getInstallPaths(shell: Shell, homeDir: string = os.homedir()): InstallPaths {
  switch (shell) {
    case "bash":
      return {
        scriptPath: path.join(homeDir, ".oru", "completions.bash"),
        rcPath: path.join(homeDir, ".bashrc"),
      };
    case "zsh":
      return {
        scriptPath: path.join(homeDir, ".oru", "completions.zsh"),
        rcPath: path.join(homeDir, ".zshrc"),
      };
    case "fish":
      return {
        scriptPath: path.join(homeDir, ".config", "fish", "completions", "oru.fish"),
        rcPath: null,
      };
  }
}

function generateScript(shell: Shell): string {
  switch (shell) {
    case "bash":
      return generateBashCompletions();
    case "zsh":
      return generateZshCompletions();
    case "fish":
      return generateFishCompletions();
  }
}

export function installCompletions(
  shell: Shell,
  write: (text: string) => void,
  homeDir?: string,
): InstallResult {
  const { scriptPath, rcPath } = getInstallPaths(shell, homeDir);

  // Write script file
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(scriptPath, generateScript(shell));
  write(`Wrote completions to ${scriptPath}`);

  // Append source line to rc file (if applicable)
  let sourceLineAdded = false;
  if (rcPath) {
    const sourceLine = `source ${scriptPath}`;
    const tildeForm = `source ~/.oru/completions.${shell}`;
    let existing = "";
    try {
      existing = fs.readFileSync(rcPath, "utf-8");
    } catch {
      // File doesn't exist yet - that's fine
    }

    if (!existing.includes(sourceLine) && !existing.includes(tildeForm)) {
      const newline = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
      fs.appendFileSync(rcPath, `${newline}${sourceLine}\n`);
      sourceLineAdded = true;
      write(`Added source line to ${rcPath}`);
    } else {
      write(`Source line already present in ${rcPath}`);
    }
  }

  return { shell, scriptPath, rcPath, sourceLineAdded };
}

export function confirm(
  prompt: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output });
    rl.question(prompt, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed === "" || trimmed === "y" || trimmed === "yes");
    });
  });
}

export function formatSuccessMessage(result: InstallResult): string {
  if (result.rcPath) {
    const rcName = path.basename(result.rcPath);
    return `\nRestart your shell or run: source ~/${rcName}`;
  }
  return "\nCompletions will be loaded automatically on next shell start.";
}

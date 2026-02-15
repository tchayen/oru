import { execSync } from "child_process";
import { readFileSync } from "fs";
import { defineConfig } from "tsup";

const gitCommit = execSync("git rev-parse --short HEAD").toString().trim();
const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    target: "node22",
    outDir: "dist",
    clean: true,
    minify: true,
    banner: { js: "#!/usr/bin/env node" },
    external: ["better-sqlite3"],
    define: {
      __GIT_COMMIT__: JSON.stringify(gitCommit),
      __VERSION__: JSON.stringify(pkg.version),
    },
  },
  {
    entry: ["src/server/index.ts"],
    format: ["esm"],
    target: "node22",
    outDir: "dist/server",
    clean: false,
    minify: true,
    external: ["better-sqlite3", "cloudflared"],
  },
]);

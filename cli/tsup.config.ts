import { execSync } from "child_process";
import { defineConfig } from "tsup";

const gitCommit = execSync("git rev-parse --short HEAD").toString().trim();

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
    },
  },
  {
    entry: ["src/server/index.ts"],
    format: ["esm"],
    target: "node22",
    outDir: "dist/server",
    clean: false,
    minify: true,
    external: ["better-sqlite3"],
  },
]);

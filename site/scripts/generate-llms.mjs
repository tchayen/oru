#!/usr/bin/env node
/**
 * Generate llms.txt and individual .md files for LLM-friendly docs.
 * Run: node scripts/generate-llms.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, "../src/content/docs");
const PUBLIC_DIR = path.join(__dirname, "../public");
const DOCS_OUTPUT_DIR = path.join(PUBLIC_DIR, "docs");

// Order matters for llms.txt
const DOC_ORDER = ["getting-started", "guide", "api", "mcp"];

function main() {
  // Ensure output directories exist
  fs.mkdirSync(DOCS_OUTPUT_DIR, { recursive: true });

  const docs = [];

  for (const slug of DOC_ORDER) {
    const mdPath = path.join(CONTENT_DIR, `${slug}.md`);
    if (!fs.existsSync(mdPath)) {
      console.warn(`Warning: ${mdPath} not found, skipping`);
      continue;
    }

    const content = fs.readFileSync(mdPath, "utf-8");
    docs.push({ slug, content });

    // Copy to public/docs/{slug}.md
    const outputPath = path.join(DOCS_OUTPUT_DIR, `${slug}.md`);
    fs.writeFileSync(outputPath, content);
    console.log(`Generated ${outputPath}`);
  }

  // Generate llms.txt (index)
  const llmsTxt = `# oru

> Agent-friendly task manager for the terminal. SQLite on your machine. No accounts. No cloud.

## Documentation

- [Getting Started](/docs/getting-started.md): Installation and quick start
- [Usage Guide](/docs/guide.md): All commands and features
- [API Reference](/docs/api.md): HTTP API for programmatic access
- [MCP Server](/docs/mcp.md): Model Context Protocol integration

## Quick Reference

### Installation

\`\`\`bash
curl -fsSL https://oru.sh/install.sh | bash
\`\`\`

### Common Commands

\`\`\`bash
oru add "Task title"              # Create a task
oru add "Task" -p high -d friday  # With priority and due date
oru list                          # List tasks
oru list --json                   # JSON output for agents
oru context --json                # What needs attention
oru done $ID                      # Mark complete
oru update $ID -s in_progress     # Update status
\`\`\`

### MCP Tools

| Tool | Description |
|------|-------------|
| \`add_task\` | Create a task |
| \`update_task\` | Update a task |
| \`delete_task\` | Delete a task |
| \`list_tasks\` | List with filters |
| \`get_task\` | Get by ID |
| \`get_context\` | Dashboard summary |
| \`add_note\` | Append note |
| \`list_labels\` | All labels |

For detailed documentation, see the links above.
`;

  fs.writeFileSync(path.join(PUBLIC_DIR, "llms.txt"), llmsTxt);
  console.log(`Generated ${path.join(PUBLIC_DIR, "llms.txt")}`);

  // Generate llms-full.txt (all docs concatenated)
  const fullContent = docs.map((d) => d.content).join("\n\n---\n\n");
  const llmsFullTxt = `# oru - Full Documentation

> Agent-friendly task manager for the terminal. SQLite on your machine. No accounts. No cloud.

${fullContent}
`;

  fs.writeFileSync(path.join(PUBLIC_DIR, "llms-full.txt"), llmsFullTxt);
  console.log(`Generated ${path.join(PUBLIC_DIR, "llms-full.txt")}`);

  console.log("\nDone.");
}

main();

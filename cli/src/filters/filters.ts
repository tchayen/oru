import fs from "fs";
import path from "path";
import os from "os";
import { parse } from "smol-toml";
import type { Status, Priority } from "../tasks/types";
import type { SortField } from "../tasks/repository";

export interface FilterDefinition {
  status?: Status | Status[];
  priority?: Priority | Priority[];
  owner?: string;
  label?: string;
  search?: string;
  sort?: SortField;
  actionable?: boolean;
  due?: "today" | "this-week";
  overdue?: boolean;
  all?: boolean;
  limit?: number;
  offset?: number;
  sql?: string;
}

export interface ListOptions {
  status?: Status | Status[];
  priority?: Priority | Priority[];
  owner?: string;
  label?: string;
  search?: string;
  sort?: SortField;
  actionable?: boolean;
  due?: "today" | "this-week";
  overdue?: boolean;
  all?: boolean;
  limit?: number;
  offset?: number;
}

export function getFiltersPath(): string {
  if (process.env.ORU_CONFIG_DIR) {
    return path.join(process.env.ORU_CONFIG_DIR, "filters.toml");
  }
  return path.join(os.homedir(), ".oru", "filters.toml");
}

export function loadFilters(filtersPath?: string): Record<string, FilterDefinition> {
  const resolved = filtersPath ?? getFiltersPath();
  if (!fs.existsSync(resolved)) {
    return {};
  }
  const raw = fs.readFileSync(resolved, "utf-8");
  try {
    return parse(raw) as Record<string, FilterDefinition>;
  } catch (err) {
    process.stderr.write(
      `Warning: Could not parse filters file at ${resolved}: ${err instanceof Error ? err.message : String(err)}. Ignoring.\n`,
    );
    return {};
  }
}

function serializeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value
      .map((v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
      .join(", ")}]`;
  }
  if (typeof value === "string") {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return `"${String(value)}"`;
}

function tomlSectionKey(name: string): string {
  return `["${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

function serializeFilters(filters: Record<string, FilterDefinition>): string {
  const sections: string[] = [];
  for (const [name, def] of Object.entries(filters)) {
    const lines: string[] = [tomlSectionKey(name)];
    for (const [key, value] of Object.entries(def)) {
      if (value !== undefined) {
        lines.push(`${key} = ${serializeValue(value)}`);
      }
    }
    sections.push(lines.join("\n"));
  }
  return sections.join("\n\n") + (sections.length > 0 ? "\n" : "");
}

export function saveFilters(filters: Record<string, FilterDefinition>, filtersPath?: string): void {
  const resolved = filtersPath ?? getFiltersPath();
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, serializeFilters(filters));
}

export function applyFilter(base: ListOptions, filter: FilterDefinition): ListOptions {
  const result: ListOptions = { ...base };
  if (base.status === undefined && filter.status !== undefined) {
    result.status = filter.status;
  }
  if (base.priority === undefined && filter.priority !== undefined) {
    result.priority = filter.priority;
  }
  if (base.owner === undefined && filter.owner !== undefined) {
    result.owner = filter.owner;
  }
  if (base.label === undefined && filter.label !== undefined) {
    result.label = filter.label;
  }
  if (base.search === undefined && filter.search !== undefined) {
    result.search = filter.search;
  }
  if (base.sort === undefined && filter.sort !== undefined) {
    result.sort = filter.sort;
  }
  if (base.actionable === undefined && filter.actionable !== undefined) {
    result.actionable = filter.actionable;
  }
  if (base.due === undefined && filter.due !== undefined) {
    result.due = filter.due;
  }
  if (base.overdue === undefined && filter.overdue !== undefined) {
    result.overdue = filter.overdue;
  }
  if (base.all === undefined && filter.all !== undefined) {
    result.all = filter.all;
  }
  if (base.limit === undefined && filter.limit !== undefined) {
    result.limit = filter.limit;
  }
  if (base.offset === undefined && filter.offset !== undefined) {
    result.offset = filter.offset;
  }
  return result;
}

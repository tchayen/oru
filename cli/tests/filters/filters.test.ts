import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  loadFilters,
  saveFilters,
  applyFilter,
  getFiltersPath,
  type FilterDefinition,
  type ListOptions,
} from "../../src/filters/filters.js";

describe("getFiltersPath", () => {
  it("returns default path under ~/.oru", () => {
    delete process.env.ORU_CONFIG_DIR;
    const p = getFiltersPath();
    expect(p).toBe(path.join(os.homedir(), ".oru", "filters.toml"));
  });

  it("respects ORU_CONFIG_DIR", () => {
    process.env.ORU_CONFIG_DIR = "/tmp/testoru";
    const p = getFiltersPath();
    expect(p).toBe("/tmp/testoru/filters.toml");
    delete process.env.ORU_CONFIG_DIR;
  });
});

describe("loadFilters / saveFilters", () => {
  let tmpDir: string;
  let filtersPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-filters-test-"));
    filtersPath = path.join(tmpDir, "filters.toml");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty object when file does not exist", () => {
    const filters = loadFilters(filtersPath);
    expect(filters).toEqual({});
  });

  it("round-trips a simple string filter", () => {
    const def: FilterDefinition = { owner: "alice" };
    saveFilters({ mine: def }, filtersPath);
    const loaded = loadFilters(filtersPath);
    expect(loaded.mine).toEqual({ owner: "alice" });
  });

  it("round-trips status array", () => {
    const def: FilterDefinition = { status: ["todo", "in_progress"] };
    saveFilters({ active: def }, filtersPath);
    const loaded = loadFilters(filtersPath);
    expect(loaded.active.status).toEqual(["todo", "in_progress"]);
  });

  it("round-trips single status string", () => {
    const def: FilterDefinition = { status: "todo" };
    saveFilters({ todo: def }, filtersPath);
    const loaded = loadFilters(filtersPath);
    expect(loaded.todo.status).toBe("todo");
  });

  it("round-trips boolean field", () => {
    const def: FilterDefinition = { actionable: true };
    saveFilters({ actionable: def }, filtersPath);
    const loaded = loadFilters(filtersPath);
    expect(loaded.actionable.actionable).toBe(true);
  });

  it("round-trips number field", () => {
    const def: FilterDefinition = { limit: 10 };
    saveFilters({ limited: def }, filtersPath);
    const loaded = loadFilters(filtersPath);
    expect(Number(loaded.limited.limit)).toBe(10);
  });

  it("round-trips sql field", () => {
    const def: FilterDefinition = { sql: "priority = 'urgent'" };
    saveFilters({ edge: def }, filtersPath);
    const loaded = loadFilters(filtersPath);
    expect(loaded.edge.sql).toBe("priority = 'urgent'");
  });

  it("round-trips multiple filters", () => {
    const filters: Record<string, FilterDefinition> = {
      mine: { owner: "tchayen", status: ["todo", "in_progress"] },
      upcoming: { due: "this-week", sort: "due" },
    };
    saveFilters(filters, filtersPath);
    const loaded = loadFilters(filtersPath);
    expect(loaded.mine.owner).toBe("tchayen");
    expect(loaded.mine.status).toEqual(["todo", "in_progress"]);
    expect(loaded.upcoming.due).toBe("this-week");
    expect(loaded.upcoming.sort).toBe("due");
  });

  it("overwrites existing filter on save", () => {
    saveFilters({ mine: { owner: "alice" } }, filtersPath);
    saveFilters({ mine: { owner: "bob" } }, filtersPath);
    const loaded = loadFilters(filtersPath);
    expect(loaded.mine.owner).toBe("bob");
  });

  it("creates parent directory if missing", () => {
    const nested = path.join(tmpDir, "nested", "filters.toml");
    saveFilters({ x: { owner: "a" } }, nested);
    expect(fs.existsSync(nested)).toBe(true);
  });

  it("returns empty object on malformed TOML", () => {
    fs.writeFileSync(filtersPath, "{ not valid toml !!!");
    const filters = loadFilters(filtersPath);
    expect(filters).toEqual({});
  });
});

describe("applyFilter", () => {
  it("fills in undefined base fields from filter", () => {
    const base: ListOptions = {};
    const filter: FilterDefinition = { owner: "alice", status: "todo" };
    const result = applyFilter(base, filter);
    expect(result.owner).toBe("alice");
    expect(result.status).toBe("todo");
  });

  it("explicit CLI values win over filter values", () => {
    const base: ListOptions = { owner: "bob" };
    const filter: FilterDefinition = { owner: "alice" };
    const result = applyFilter(base, filter);
    expect(result.owner).toBe("bob");
  });

  it("does not mutate the base object", () => {
    const base: ListOptions = {};
    const filter: FilterDefinition = { owner: "alice" };
    applyFilter(base, filter);
    expect(base.owner).toBeUndefined();
  });

  it("merges array status from filter", () => {
    const base: ListOptions = {};
    const filter: FilterDefinition = { status: ["todo", "in_progress"] };
    const result = applyFilter(base, filter);
    expect(result.status).toEqual(["todo", "in_progress"]);
  });

  it("base status array wins over filter", () => {
    const base: ListOptions = { status: ["done"] };
    const filter: FilterDefinition = { status: ["todo", "in_progress"] };
    const result = applyFilter(base, filter);
    expect(result.status).toEqual(["done"]);
  });

  it("fills in sort from filter when base has no sort", () => {
    const base: ListOptions = {};
    const filter: FilterDefinition = { sort: "due" };
    const result = applyFilter(base, filter);
    expect(result.sort).toBe("due");
  });

  it("merges all supported fields", () => {
    const base: ListOptions = {};
    const filter: FilterDefinition = {
      owner: "alice",
      label: "backend",
      search: "fix",
      sort: "title",
      actionable: true,
      due: "today",
      overdue: false,
      all: true,
      limit: 5,
      offset: 10,
    };
    const result = applyFilter(base, filter);
    expect(result.owner).toBe("alice");
    expect(result.label).toBe("backend");
    expect(result.search).toBe("fix");
    expect(result.sort).toBe("title");
    expect(result.actionable).toBe(true);
    expect(result.due).toBe("today");
    expect(result.overdue).toBe(false);
    expect(result.all).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.offset).toBe(10);
  });
});

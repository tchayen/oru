// These constants, functions, and Zod schemas are shared between the CLI
// (cli.ts), HTTP server (server/routes.ts), and MCP server (mcp/server.ts).

import { z } from "zod";
import { STATUSES, PRIORITIES } from "./tasks/types";

export const DUE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

export const MAX_TITLE_LENGTH = 1000;
export const MAX_NOTE_LENGTH = 10000;
export const MAX_LABEL_LENGTH = 200;
export const MAX_LABELS = 100;
export const MAX_BLOCKED_BY = 100;
export const MAX_NOTES = 100;
export const MAX_METADATA_KEYS = 50;
export const MAX_METADATA_KEY_LENGTH = 100;
export const MAX_METADATA_VALUE_LENGTH = 5000;

export function sanitizeTitle(title: string): string {
  return title.replace(/[\r\n]+/g, " ").trim();
}

export type ValidationResult = { valid: true } | { valid: false; message: string };

export function validateTitle(title: string, { required = false } = {}): ValidationResult {
  if (title.length === 0) {
    return { valid: false, message: required ? "Title is required." : "Title cannot be empty." };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      valid: false,
      message: `Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters.`,
    };
  }
  return { valid: true };
}

export function validateNote(note: string): ValidationResult {
  if (note.length > MAX_NOTE_LENGTH) {
    return {
      valid: false,
      message: `Note exceeds maximum length of ${MAX_NOTE_LENGTH} characters.`,
    };
  }
  return { valid: true };
}

export function validateLabels(labels: string[]): ValidationResult {
  for (const l of labels) {
    if (l.length === 0) {
      return { valid: false, message: "Label cannot be empty." };
    }
    if (l.length > MAX_LABEL_LENGTH) {
      return {
        valid: false,
        message: `Label exceeds maximum length of ${MAX_LABEL_LENGTH} characters.`,
      };
    }
  }
  return { valid: true };
}

// --- Shared Zod schemas (used by HTTP routes and MCP server) ---

export const StatusEnum = z.enum(STATUSES as unknown as [string, ...string[]]);
export const PriorityEnum = z.enum(PRIORITIES as unknown as [string, ...string[]]);

export const titleCreateSchema = z
  .string()
  .min(1, "Title is required.")
  .max(MAX_TITLE_LENGTH, `Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters.`);

export const titleUpdateSchema = z
  .string()
  .max(MAX_TITLE_LENGTH, `Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters.`);

export const labelsSchema = z
  .array(
    z
      .string()
      .max(MAX_LABEL_LENGTH, `Label exceeds maximum length of ${MAX_LABEL_LENGTH} characters.`),
  )
  .max(MAX_LABELS, `labels exceeds maximum of ${MAX_LABELS} items.`);

export const notesSchema = z
  .array(
    z
      .string()
      .max(MAX_NOTE_LENGTH, `Note exceeds maximum length of ${MAX_NOTE_LENGTH} characters.`),
  )
  .max(MAX_NOTES, `notes exceeds maximum of ${MAX_NOTES} items.`);

export const noteSchema = z
  .string()
  .max(MAX_NOTE_LENGTH, `Note exceeds maximum length of ${MAX_NOTE_LENGTH} characters.`);

export const blockedBySchema = z
  .array(z.string())
  .max(MAX_BLOCKED_BY, `blocked_by exceeds maximum of ${MAX_BLOCKED_BY} items.`);

export const metadataSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (val) => Object.keys(val).length <= MAX_METADATA_KEYS,
    `Metadata exceeds maximum of ${MAX_METADATA_KEYS} keys.`,
  )
  .refine(
    (val) => Object.keys(val).every((k) => k.length <= MAX_METADATA_KEY_LENGTH),
    `Metadata key exceeds maximum length of ${MAX_METADATA_KEY_LENGTH} characters.`,
  )
  .refine(
    (val) =>
      Object.values(val).every(
        (v) => typeof v !== "string" || v.length <= MAX_METADATA_VALUE_LENGTH,
      ),
    `Metadata value exceeds maximum length of ${MAX_METADATA_VALUE_LENGTH} characters.`,
  );

export const dueAtSchema = z
  .string()
  .regex(
    DUE_DATE_REGEX,
    "Invalid date format. Expected YYYY-MM-DD, YYYY-MM-DDTHH:MM, or YYYY-MM-DDTHH:MM:SS.",
  )
  .nullable()
  .optional();

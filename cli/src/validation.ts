// These constants and functions are shared between the CLI (cli.ts) and the
// HTTP server (server/routes.ts). Keep them in sync when making changes.

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

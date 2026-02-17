/**
 * Minimal ANSI color/style module.
 *
 * - Respects NO_COLOR (https://no-color.org) and FORCE_COLOR env vars.
 * - Falls back to process.stdout.isTTY detection.
 * - Uses per-attribute close codes so styles can be nested:
 *     bold("hi")  →  \x1b[1mhi\x1b[22m
 */

function isEnabled(): boolean {
  if ("NO_COLOR" in process.env) {
    return false;
  }
  if ("FORCE_COLOR" in process.env) {
    return true;
  }
  return process.stdout.isTTY ?? false;
}

type StyleFn = (text: string) => string;

function make(open: number | string, close: number): StyleFn {
  const o = `\x1b[${open}m`;
  const c = `\x1b[${close}m`;
  return (t) => (isEnabled() ? `${o}${t}${c}` : t);
}

// Modifiers
export const bold = make(1, 22);
export const dim = make(2, 22);
export const italic = make(3, 23);

// Colors
export const white = make(37, 39);

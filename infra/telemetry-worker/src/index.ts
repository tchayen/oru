interface Env {
  DB: D1Database;
}

interface TelemetryEvent {
  cli_version: string;
  command: string;
  flags: string[];
  os: string;
  arch: string;
  node_version: string;
  is_ci: boolean;
  duration_ms: number;
  exit_code: number;
  error?: string;
}

const MAX_STRING_LENGTH = 256;
const MAX_FLAGS = 50;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function validateEvent(body: unknown): TelemetryEvent | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const e = body as Record<string, unknown>;

  if (typeof e.cli_version !== "string" || e.cli_version.length > MAX_STRING_LENGTH) {
    return null;
  }
  if (typeof e.command !== "string" || e.command.length > MAX_STRING_LENGTH) {
    return null;
  }
  if (!Array.isArray(e.flags) || e.flags.length > MAX_FLAGS) {
    return null;
  }
  for (const f of e.flags) {
    if (typeof f !== "string" || f.length > MAX_STRING_LENGTH) {
      return null;
    }
  }
  if (typeof e.os !== "string" || e.os.length > MAX_STRING_LENGTH) {
    return null;
  }
  if (typeof e.arch !== "string" || e.arch.length > MAX_STRING_LENGTH) {
    return null;
  }
  if (typeof e.node_version !== "string" || e.node_version.length > MAX_STRING_LENGTH) {
    return null;
  }
  if (typeof e.is_ci !== "boolean") {
    return null;
  }
  if (typeof e.duration_ms !== "number" || !Number.isFinite(e.duration_ms)) {
    return null;
  }
  if (typeof e.exit_code !== "number" || !Number.isInteger(e.exit_code)) {
    return null;
  }
  if (
    e.error !== undefined &&
    (typeof e.error !== "string" || e.error.length > MAX_STRING_LENGTH)
  ) {
    return null;
  }

  const event: TelemetryEvent = {
    cli_version: e.cli_version,
    command: e.command,
    flags: e.flags as string[],
    os: e.os,
    arch: e.arch,
    node_version: e.node_version,
    is_ci: e.is_ci,
    duration_ms: Math.round(e.duration_ms),
    exit_code: e.exit_code,
  };
  if (e.error !== undefined) {
    event.error = e.error as string;
  }
  return event;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    if (url.pathname === "/v1/events" && request.method === "POST") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response("invalid json", { status: 400, headers: corsHeaders });
      }

      const event = validateEvent(body);
      if (!event) {
        return new Response("invalid event", { status: 400, headers: corsHeaders });
      }

      try {
        await env.DB.prepare(
          `INSERT INTO events (cli_version, command, flags, os, arch, node_version, is_ci, duration_ms, exit_code, error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            event.cli_version,
            event.command,
            JSON.stringify(event.flags),
            event.os,
            event.arch,
            event.node_version,
            event.is_ci ? 1 : 0,
            event.duration_ms,
            event.exit_code,
            event.error ?? null,
          )
          .run();
      } catch {
        return new Response("db error", { status: 500, headers: corsHeaders });
      }

      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return new Response("not found", { status: 404, headers: corsHeaders });
  },
};

const REQUEST_TIMEOUT_MS = 10000;

export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch("https://registry.npmjs.org/@tchayen/oru/latest", {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

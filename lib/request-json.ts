import { NextResponse } from "next/server";

export const DEFAULT_MAX_JSON_BYTES = 100_000;

type ParsedJson = { ok: true; body: unknown } | { ok: false; reason: "too_large" | "invalid" };

async function parseJson(request: Request, maxBytes: number): Promise<ParsedJson> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, reason: "too_large" };
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    return { ok: false, reason: "too_large" };
  }
  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

/** Parses a JSON request body; returns null when it is missing, malformed or larger than maxBytes. */
export async function readJsonBody(
  request: Request,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<unknown | null> {
  const result = await parseJson(request, maxBytes);
  return result.ok ? result.body : null;
}

/**
 * Parses a JSON object body or returns a ready-made 413 (oversize) / 400 (malformed or
 * not an object) response.
 */
export async function readJsonObject<T extends object = Record<string, unknown>>(
  request: Request,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<{ body: Partial<T>; response?: undefined } | { body?: undefined; response: NextResponse }> {
  const result = await parseJson(request, maxBytes);
  if (!result.ok) {
    return result.reason === "too_large"
      ? { response: NextResponse.json({ message: "Request body too large." }, { status: 413 }) }
      : { response: NextResponse.json({ message: "Invalid JSON body." }, { status: 400 }) };
  }
  if (!result.body || typeof result.body !== "object" || Array.isArray(result.body)) {
    return { response: NextResponse.json({ message: "Request body must be a JSON object." }, { status: 400 }) };
  }
  return { body: result.body as Partial<T> };
}

/** Returns a trimmed string, or undefined when the value is not a string. */
export function trimString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

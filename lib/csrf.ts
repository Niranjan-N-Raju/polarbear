import { NextRequest, NextResponse } from "next/server";

/**
 * Validates the Origin or Referer header against the expected host to prevent
 * CSRF attacks on state-changing requests (POST, PATCH, PUT, DELETE).
 *
 * Returns null if the request is safe; returns an error response otherwise.
 */
export function validateCsrf(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();

  // Only validate state-changing methods
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  // At least one of origin or referer must be present
  if (!origin && !referer) {
    return NextResponse.json(
      { message: "Forbidden: missing origin header." },
      { status: 403 },
    );
  }

  // Validate origin if present
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json(
          { message: "Forbidden: cross-origin request." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { message: "Forbidden: invalid origin." },
        { status: 403 },
      );
    }
    return null;
  }

  // Fall back to referer validation
  if (referer) {
    try {
      const refererHost = new URL(referer).host;
      if (refererHost !== host) {
        return NextResponse.json(
          { message: "Forbidden: cross-origin request." },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { message: "Forbidden: invalid referer." },
        { status: 403 },
      );
    }
  }

  return null;
}

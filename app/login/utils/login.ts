const SAFE_NEXT_BASE = "https://x.invalid";

/**
 * Returns `path` only when it is a same-origin, non-API relative path; otherwise null.
 * Rejects backslashes and control characters, which browsers may normalise into
 * protocol-relative URLs (e.g. "/\\evil.example").
 */
export function getSafeNextPath(path: string | null): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("\\")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(path)) return null;
  let url: URL;
  try {
    url = new URL(path, SAFE_NEXT_BASE);
  } catch {
    return null;
  }
  if (url.origin !== SAFE_NEXT_BASE) return null;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/") || path.startsWith("/api/")) return null;
  return path;
}

export function validateLoginForm(email: string, password: string): {
  emailError: string;
  passwordError: string;
} {
  return {
    emailError: email.trim() ? "" : "Email address is required.",
    passwordError: password ? "" : "Password is required.",
  };
}

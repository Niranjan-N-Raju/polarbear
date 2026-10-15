const isProduction = process.env.NODE_ENV === "production";
// `next start` always sets NODE_ENV=production even for local LAN/HTTP testing (e.g. from a
// phone on the same wifi), and browsers silently drop Secure cookies over plain HTTP — set
// ALLOW_INSECURE_COOKIES=true in .env.local to test on a device over HTTP.
const secure = isProduction && process.env.ALLOW_INSECURE_COOKIES !== "true";

/** Cookie attributes for setting the session cookie on login or token re-issue. */
export const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  secure,
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 8, // 8 hours
} as const;

/** Cookie attributes for clearing session cookies on logout. */
export const CLEAR_COOKIE_OPTS = {
  httpOnly: true,
  secure,
  sameSite: "strict" as const,
  path: "/",
  maxAge: 0,
} as const;

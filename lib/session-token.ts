import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/** Full web session cookie. */
export const SESSION_COOKIE = "em_session";
/**
 * Restricted session issued when the account must change an admin-issued password.
 * It only grants access to the profile page, GET/PATCH /api/me, logout and extend.
 */
export const PASSWORD_CHANGE_COOKIE = "em_pw_change";

export const SESSION_ISSUER = "polar-bear-next";
export const SESSION_AUDIENCE = "polar-bear-web";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
/** Absolute session lifetime: sliding extensions stop 24h after the original login. */
export const MAX_SESSION_AGE_SECONDS = 24 * 60 * 60;

export const PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED";

export interface SessionClaims {
  id: string;
  role: string;
  name?: string;
  email?: string;
  sessionVersion: number;
  /** Unix seconds of the original login; preserved across extensions. */
  sessionStart: number;
  mustChangePassword?: boolean;
}

export interface SessionPayload extends JWTPayload {
  id: string;
  role?: string;
  sessionVersion: number;
  sessionStart?: number;
  mustChangePassword?: boolean;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function signSessionToken(claims: SessionClaims, secret: Uint8Array): Promise<string> {
  const { mustChangePassword, ...rest } = claims;
  const now = nowSeconds();
  // Never outlive the absolute 24h session cap.
  const exp = Math.min(now + SESSION_TTL_SECONDS, claims.sessionStart + MAX_SESSION_AGE_SECONDS);
  return new SignJWT({ ...rest, ...(mustChangePassword ? { mustChangePassword: true } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secret);
}

/** Verifies signature, algorithm, issuer, audience and required claims. Throws on failure. */
export async function verifySessionToken(token: string, secret: Uint8Array): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
    requiredClaims: ["exp", "id", "sessionVersion"],
  });
  if (typeof payload.id !== "string" || !payload.id) throw new Error("Invalid session id claim");
  if (typeof payload.sessionVersion !== "number" || !Number.isInteger(payload.sessionVersion)) {
    throw new Error("Invalid sessionVersion claim");
  }
  return payload as SessionPayload;
}

/** Original login time in seconds; legacy tokens without sessionStart fall back to iat. */
export function getSessionStart(payload: JWTPayload): number | null {
  if (typeof payload.sessionStart === "number" && Number.isFinite(payload.sessionStart)) {
    return payload.sessionStart;
  }
  return typeof payload.iat === "number" ? payload.iat : null;
}

export function isSessionExpiredAbsolute(payload: JWTPayload, now = nowSeconds()): boolean {
  const start = getSessionStart(payload);
  return start === null || now - start >= MAX_SESSION_AGE_SECONDS;
}

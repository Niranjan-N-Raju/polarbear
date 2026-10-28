/**
 * Centralised access to required server-only environment variables.
 * Functions throw at call time (i.e. first request) rather than at build time
 * so Next.js static analysis still works without the env vars present.
 */

export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Returns the JWT signing secret as a Uint8Array.
 * Throws if JWT_SECRET is unset or shorter than 32 characters.
 */
export function getJwtSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw) {
    throw new Error(
      "JWT_SECRET environment variable is not set. Add it to .env.local",
    );
  }
  if (raw.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long.`,
    );
  }
  return new TextEncoder().encode(raw);
}

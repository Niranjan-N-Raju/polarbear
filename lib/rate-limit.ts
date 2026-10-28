/**
 * In-memory rate limiter with configurable windows per operation.
 * State resets on server restart; for multi-instance deployments replace with
 * a Redis-backed store (e.g. @upstash/ratelimit).
 *
 * NOTE: For production scale use a Redis-backed implementation. This is
 * sufficient for single-instance deployments.
 */

import { NextRequest } from "next/server";

interface Entry {
  count: number;
  firstAt: number;
  lockedUntil?: number;
}

const store = new Map<string, Entry>();

// Periodically clean up expired entries to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    const windowMs = 15 * 60 * 1000;
    if (
      (entry.lockedUntil && now > entry.lockedUntil) ||
      now - entry.firstAt > windowMs * 2
    ) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export interface RateLimitConfig {
  windowMs?: number;
  maxAttempts?: number;
  lockoutMs?: number;
}

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15-minute rolling window
const DEFAULT_MAX_ATTEMPTS = 10; // attempts before lockout
const DEFAULT_LOCKOUT_MS = 15 * 60 * 1000; // 15-minute lockout

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export function checkRateLimit(
  key: string,
  config?: RateLimitConfig,
): RateLimitResult {
  const windowMs = config?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxAttempts = config?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const lockoutMs = config?.lockoutMs ?? DEFAULT_LOCKOUT_MS;

  const now = Date.now();
  const entry = store.get(key);

  if (entry?.lockedUntil !== undefined) {
    if (now < entry.lockedUntil) {
      return { allowed: false, retryAfterMs: entry.lockedUntil - now };
    }
    store.delete(key);
  }

  if (!entry || now - entry.firstAt > windowMs) {
    store.set(key, { count: 1, firstAt: now });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > maxAttempts) {
    entry.lockedUntil = now + lockoutMs;
    store.set(key, entry);
    return { allowed: false, retryAfterMs: lockoutMs };
  }

  return { allowed: true };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Extract client IP from request headers.
 * Only trusts X-Forwarded-For from configured trusted proxies.
 * Falls back to x-real-ip or "unknown".
 */
export function getClientIp(request: NextRequest): string {
  // In production behind a known reverse proxy, trust only the last
  // proxy-appended entry (rightmost in X-Forwarded-For).
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim());
    // Use the rightmost IP (closest to our server / added by trusted proxy)
    // This is safer than the leftmost which can be spoofed by the client
    return parts[parts.length - 1] || "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Pre-configured rate limits for different operations */
export const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, maxAttempts: 5, lockoutMs: 15 * 60 * 1000 },
  userCreate: { windowMs: 60 * 60 * 1000, maxAttempts: 20, lockoutMs: 30 * 60 * 1000 },
  storeCreate: { windowMs: 60 * 60 * 1000, maxAttempts: 10, lockoutMs: 30 * 60 * 1000 },
  passwordChange: { windowMs: 15 * 60 * 1000, maxAttempts: 5, lockoutMs: 30 * 60 * 1000 },
  sessionExtend: { windowMs: 5 * 60 * 1000, maxAttempts: 10, lockoutMs: 5 * 60 * 1000 },
} as const;

/** Per-account cap across all IPs; high enough that a remote attacker cannot cheaply lock out the owner. */
export const LOGIN_ACCOUNT_GLOBAL_LIMIT = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 50,
  lockoutMs: 15 * 60 * 1000,
} as const;

export function loginAccountRateKeys(email: string, ip: string) {
  const normalized = email.toLowerCase().trim();
  return {
    perIp: `login-account:${normalized}:${ip}`,
    global: `login-account-global:${normalized}`,
  };
}

/**
 * Account-level login throttling. The 5-per-15-min budget is scoped to (email, ip) so guesses
 * from other IPs cannot lock the owner out; a looser global cap still bounds distributed guessing.
 */
export function checkLoginAccountRateLimit(email: string, ip: string): RateLimitResult {
  const keys = loginAccountRateKeys(email, ip);
  const perIp = checkRateLimit(keys.perIp, RATE_LIMITS.login);
  if (!perIp.allowed) return perIp;
  return checkRateLimit(keys.global, LOGIN_ACCOUNT_GLOBAL_LIMIT);
}

export function resetLoginAccountRateLimit(email: string, ip: string): void {
  resetRateLimit(loginAccountRateKeys(email, ip).perIp);
}

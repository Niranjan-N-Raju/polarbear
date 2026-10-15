import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimit("test:key");
  });

  it("allows first request", () => {
    const result = checkRateLimit("test:key");
    expect(result.allowed).toBe(true);
  });

  it("allows up to maxAttempts", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("test:key", { maxAttempts: 5 });
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks after exceeding maxAttempts", () => {
    for (let i = 0; i < 6; i++) {
      checkRateLimit("test:key", { maxAttempts: 5 });
    }
    const result = checkRateLimit("test:key", { maxAttempts: 5 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets correctly", () => {
    for (let i = 0; i < 20; i++) {
      checkRateLimit("test:key", { maxAttempts: 5 });
    }
    resetRateLimit("test:key");
    const result = checkRateLimit("test:key", { maxAttempts: 5 });
    expect(result.allowed).toBe(true);
  });
});

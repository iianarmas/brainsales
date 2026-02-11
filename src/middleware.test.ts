import { describe, it, expect, beforeEach } from "vitest";

// Test the rate limiting logic in isolation
// We extract the core logic since middleware runs in Edge runtime

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const TIERS = {
  auth: { maxRequests: 10, windowMs: 60_000 },
  general: { maxRequests: 100, windowMs: 60_000 },
} as const;

function createRateLimiter() {
  const store = new Map<string, RateLimitEntry>();

  return function rateLimit(key: string, tier: keyof typeof TIERS) {
    const { maxRequests, windowMs } = TIERS[tier];
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
    }

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }

    entry.count++;
    return { allowed: true, remaining: maxRequests - entry.count, retryAfter: 0 };
  };
}

describe("rate limiter", () => {
  let rateLimit: ReturnType<typeof createRateLimiter>;

  beforeEach(() => {
    rateLimit = createRateLimiter();
  });

  it("allows requests under the limit", () => {
    const result = rateLimit("ip:1.2.3.4", "general");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(99);
  });

  it("blocks requests over the limit", () => {
    for (let i = 0; i < 100; i++) {
      rateLimit("ip:1.2.3.4", "general");
    }
    const result = rateLimit("ip:1.2.3.4", "general");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("uses separate limits per tier", () => {
    // Exhaust auth tier (10 req)
    for (let i = 0; i < 10; i++) {
      rateLimit("auth:1.2.3.4", "auth");
    }
    const authResult = rateLimit("auth:1.2.3.4", "auth");
    expect(authResult.allowed).toBe(false);

    // General tier should still work
    const generalResult = rateLimit("general:1.2.3.4", "general");
    expect(generalResult.allowed).toBe(true);
  });

  it("uses separate limits per IP", () => {
    // Exhaust one IP
    for (let i = 0; i < 100; i++) {
      rateLimit("ip:1.2.3.4", "general");
    }

    // Different IP should still work
    const result = rateLimit("ip:5.6.7.8", "general");
    expect(result.allowed).toBe(true);
  });

  it("auth tier has lower limit than general", () => {
    // Auth: 10 requests
    for (let i = 0; i < 10; i++) {
      const r = rateLimit("ip:test", "auth");
      expect(r.allowed).toBe(true);
    }
    expect(rateLimit("ip:test", "auth").allowed).toBe(false);
  });
});

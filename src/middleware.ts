import { NextRequest, NextResponse } from "next/server";

/**
 * Simple in-memory sliding window rate limiter.
 * Limits API requests per IP to prevent abuse.
 *
 * Note: In-memory storage resets on deployment/restart.
 * For production at scale, consider Redis-based rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Rate limit tiers
const TIERS = {
  auth: { maxRequests: 10, windowMs: 60_000 }, // 10 req/min for auth routes
  general: { maxRequests: 100, windowMs: 60_000 }, // 100 req/min for general API
} as const;

function getTier(pathname: string): keyof typeof TIERS {
  if (pathname.startsWith("/api/auth") || pathname === "/api/profile") {
    return "auth";
  }
  return "general";
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimit(
  key: string,
  tier: keyof typeof TIERS
): { allowed: boolean; remaining: number; retryAfter: number } {
  const { maxRequests, windowMs } = TIERS[tier];
  const now = Date.now();

  cleanup();

  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, retryAfter: 0 };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate limit API routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const tier = getTier(pathname);
  const key = `${tier}:${ip}`;

  const { allowed, remaining, retryAfter } = rateLimit(key, tier);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};

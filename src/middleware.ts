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
  auth: { maxRequests: 60, windowMs: 60_000 }, // Increased from 10 to 60 (for auth routes)
  general: { maxRequests: 300, windowMs: 60_000 }, // Increased from 100 to 300 (for general API)
} as const;

function getTier(pathname: string): keyof typeof TIERS {
  if (pathname.startsWith("/api/auth")) {
    return "auth";
  }
  // Move /api/profile to general to avoid competing with auth check loops
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS for superadmin routes (called from Tauri desktop app)
  if (pathname.startsWith("/api/superadmin")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
    }
    const response = NextResponse.next();
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

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

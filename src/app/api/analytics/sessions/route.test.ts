import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@/app/lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock("@/app/lib/apiAuth", () => ({
  getUser: vi.fn(),
  getOrganizationId: vi.fn(),
  getProductId: vi.fn(),
}));

import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getOrganizationId, getProductId } from "@/app/lib/apiAuth";
import { POST } from "./route";

const mockFrom = supabaseAdmin!.from as ReturnType<typeof vi.fn>;
const mockGetUser = getUser as ReturnType<typeof vi.fn>;
const mockGetOrgId = getOrganizationId as ReturnType<typeof vi.fn>;
const mockGetProductId = getProductId as ReturnType<typeof vi.fn>;

function createRequest(body: any): NextRequest {
  return new NextRequest("http://localhost:3000/api/analytics/sessions", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analytics/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const request = createRequest({ sessionId: "sess-1" });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when sessionId is missing", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" });
    mockGetOrgId.mockResolvedValue("org-1");
    mockGetProductId.mockResolvedValue("product-1");

    const request = createRequest({});
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 403 when user has no organization", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" });
    mockGetOrgId.mockResolvedValue(null);

    const request = createRequest({ sessionId: "sess-1" });
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("returns 400 when no product context", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" });
    mockGetOrgId.mockResolvedValue("org-1");
    mockGetProductId.mockResolvedValue(null);

    const request = createRequest({ sessionId: "sess-1" });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("creates a session with outcome data", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" });
    mockGetOrgId.mockResolvedValue("org-1");
    mockGetProductId.mockResolvedValue("product-1");

    const sessionData = {
      id: "db-id-1",
      session_id: "sess-1",
      user_id: "user-1",
      outcome: "meeting_set",
    };

    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: sessionData, error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const request = createRequest({
      sessionId: "sess-1",
      outcome: "meeting_set",
      notes: "Great call",
      startedAt: new Date(Date.now() - 300000).toISOString(),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toBeDefined();
    expect(mockFrom).toHaveBeenCalledWith("call_sessions");
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: "sess-1",
        user_id: "user-1",
        product_id: "product-1",
        organization_id: "org-1",
        outcome: "meeting_set",
        notes: "Great call",
      }),
      { onConflict: "session_id" }
    );
  });

  it("handles upsert errors with 500", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" });
    mockGetOrgId.mockResolvedValue("org-1");
    mockGetProductId.mockResolvedValue("product-1");

    const chain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
    };
    mockFrom.mockReturnValue(chain);

    const request = createRequest({ sessionId: "sess-1", outcome: "meeting_set" });
    const response = await POST(request);

    expect(response.status).toBe(500);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock supabase
vi.mock("@/app/lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

// Mock apiAuth
vi.mock("@/app/lib/apiAuth", () => ({
  getUser: vi.fn(),
  getOrganizationId: vi.fn(),
  isOrgAdmin: vi.fn(),
  getProductId: vi.fn(),
}));

import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { getUser, getOrganizationId, isOrgAdmin, getProductId } from "@/app/lib/apiAuth";
import { GET } from "./route";

const mockFrom = supabaseAdmin!.from as ReturnType<typeof vi.fn>;
const mockGetUser = getUser as ReturnType<typeof vi.fn>;
const mockGetOrgId = getOrganizationId as ReturnType<typeof vi.fn>;
const mockIsOrgAdmin = isOrgAdmin as ReturnType<typeof vi.fn>;
const mockGetProductId = getProductId as ReturnType<typeof vi.fn>;

function createRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/analytics/dashboard");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url.toString(), {
    method: "GET",
    headers: { authorization: "Bearer test-token" },
  });
}

// Helper to create a chainable supabase query mock
function mockSupabaseQuery(data: any[] | null, error: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: any) => resolve({ data, error })),
  };
  // Make the chain thenable so await works
  Object.defineProperty(chain, "then", {
    value: (resolve: any, reject: any) => {
      if (error && reject) return reject(error);
      return resolve({ data, error });
    },
  });
  return chain;
}

describe("GET /api/analytics/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const request = createRequest();
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns 403 when user has no organization", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" });
    mockGetOrgId.mockResolvedValue(null);

    const request = createRequest();
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("returns 403 when user is not an org admin", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" });
    mockGetOrgId.mockResolvedValue("org-1");
    mockIsOrgAdmin.mockResolvedValue(false);

    const request = createRequest();
    const response = await GET(request);

    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toContain("org admin");
  });

  it("returns aggregated analytics for an org admin", async () => {
    mockGetUser.mockResolvedValue({ id: "admin-1" });
    mockGetOrgId.mockResolvedValue("org-1");
    mockIsOrgAdmin.mockResolvedValue(true);
    mockGetProductId.mockResolvedValue("product-1");

    // Each supabaseAdmin.from() call returns a different query chain
    // We need to handle 5 parallel queries plus sub-queries
    let callIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "call_sessions") {
        callIndex++;
        if (callIndex === 1) {
          // outcomeDistribution query
          return mockSupabaseQuery([
            { outcome: "meeting_set" },
            { outcome: "meeting_set" },
            { outcome: "not_interested" },
            { outcome: "follow_up" },
          ]);
        }
        if (callIndex === 2) {
          // completionRate: sessions
          return mockSupabaseQuery([
            { session_id: "sess-1" },
            { session_id: "sess-2" },
            { session_id: "sess-3" },
          ]);
        }
        if (callIndex === 3) {
          // dropOffAnalysis: incomplete sessions
          return mockSupabaseQuery([
            { session_id: "sess-2" },
            { session_id: "sess-3" },
          ]);
        }
        // repPerformance
        return mockSupabaseQuery([
          { user_id: "rep-1", outcome: "meeting_set", duration_seconds: 300 },
          { user_id: "rep-1", outcome: "not_interested", duration_seconds: 120 },
          { user_id: "rep-2", outcome: "meeting_set", duration_seconds: 240 },
        ]);
      }
      if (table === "call_nodes") {
        // Could be success nodes query or objection nodes query
        callIndex++;
        if (callIndex <= 5) {
          // success nodes for completion rate
          return mockSupabaseQuery([{ id: "success_call_end" }]);
        }
        if (callIndex <= 7) {
          // objection nodes
          return mockSupabaseQuery([
            { id: "obj_price", title: "Price Objection" },
            { id: "obj_timing", title: "Timing Objection" },
          ]);
        }
        // drop-off node titles
        return mockSupabaseQuery([
          { id: "disc_ehr_epic", title: "EHR Discovery", type: "discovery" },
        ]);
      }
      if (table === "call_analytics") {
        callIndex++;
        // completionRate: analytics that hit success nodes
        if (callIndex <= 6) {
          return mockSupabaseQuery([{ session_id: "sess-1" }]);
        }
        // dropOff analytics
        if (callIndex <= 8) {
          return mockSupabaseQuery([
            { session_id: "sess-2", node_id: "disc_ehr_epic", navigated_at: "2025-01-01T10:05:00Z" },
            { session_id: "sess-3", node_id: "disc_ehr_epic", navigated_at: "2025-01-01T10:10:00Z" },
          ]);
        }
        // objection analytics
        return mockSupabaseQuery([
          { node_id: "obj_price" },
          { node_id: "obj_price" },
          { node_id: "obj_timing" },
        ]);
      }
      if (table === "profiles") {
        return mockSupabaseQuery([
          { user_id: "rep-1", first_name: "Alice", last_name: "Smith", profile_picture_url: null },
          { user_id: "rep-2", first_name: "Bob", last_name: "Jones", profile_picture_url: null },
        ]);
      }
      return mockSupabaseQuery([]);
    });

    const request = createRequest();
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.dateRange).toBeDefined();
    expect(json.outcomeDistribution).toBeDefined();
    expect(json.completionRate).toBeDefined();
    expect(json.dropOffNodes).toBeDefined();
    expect(json.objectionFrequency).toBeDefined();
    expect(json.repPerformance).toBeDefined();
  });

  it("passes date range params to queries", async () => {
    mockGetUser.mockResolvedValue({ id: "admin-1" });
    mockGetOrgId.mockResolvedValue("org-1");
    mockIsOrgAdmin.mockResolvedValue(true);
    mockGetProductId.mockResolvedValue("product-1");

    // Return empty results for all queries
    mockFrom.mockImplementation(() => mockSupabaseQuery([]));

    const request = createRequest({
      from: "2025-01-01T00:00:00Z",
      to: "2025-01-31T23:59:59Z",
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.dateRange.from).toBe("2025-01-01T00:00:00Z");
    expect(json.dateRange.to).toBe("2025-01-31T23:59:59Z");
  });
});

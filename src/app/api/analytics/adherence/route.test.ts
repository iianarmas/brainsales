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
    const url = new URL("http://localhost:3000/api/analytics/adherence");
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return new NextRequest(url.toString(), {
        method: "GET",
        headers: { authorization: "Bearer test-token" },
    });
}

function mockSupabaseQuery(data: unknown[] | null, error: unknown = null) {
    const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
    };
    Object.defineProperty(chain, "then", {
        value: (resolve: (v: { data: unknown; error: unknown }) => void) =>
            resolve({ data, error }),
    });
    return chain;
}

describe("GET /api/analytics/adherence", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when user is not authenticated", async () => {
        mockGetUser.mockResolvedValue(null);
        const response = await GET(createRequest());
        expect(response.status).toBe(401);
    });

    it("returns 403 when user has no organization", async () => {
        mockGetUser.mockResolvedValue({ id: "user-1" });
        mockGetOrgId.mockResolvedValue(null);
        const response = await GET(createRequest());
        expect(response.status).toBe(403);
    });

    it("returns 403 when user is not org admin", async () => {
        mockGetUser.mockResolvedValue({ id: "user-1" });
        mockGetOrgId.mockResolvedValue("org-1");
        mockIsOrgAdmin.mockResolvedValue(false);
        const response = await GET(createRequest());
        expect(response.status).toBe(403);
        const json = await response.json();
        expect(json.error).toContain("org admin");
    });

    it("returns empty arrays and null org average when no data exists", async () => {
        mockGetUser.mockResolvedValue({ id: "admin-1" });
        mockGetOrgId.mockResolvedValue("org-1");
        mockIsOrgAdmin.mockResolvedValue(true);
        mockGetProductId.mockResolvedValue("product-1");

        mockFrom.mockImplementation(() => mockSupabaseQuery([]));

        const response = await GET(createRequest());
        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.repAdherence).toEqual([]);
        expect(json.weeklyTrend).toEqual([]);
        expect(json.orgAvgAdherence).toBeNull();
    });

    it("returns per-rep adherence summaries for an org admin", async () => {
        mockGetUser.mockResolvedValue({ id: "admin-1" });
        mockGetOrgId.mockResolvedValue("org-1");
        mockIsOrgAdmin.mockResolvedValue(true);
        mockGetProductId.mockResolvedValue("product-1");

        let callIndex = 0;
        mockFrom.mockImplementation((table: string) => {
            callIndex++;
            if (table === "call_sessions") {
                if (callIndex === 1) {
                    // repAdherenceSummary query
                    return mockSupabaseQuery([
                        { user_id: "rep-1", outcome: "meeting_set", adherence_score: 90, duration_seconds: 300 },
                        { user_id: "rep-1", outcome: "not_interested", adherence_score: 70, duration_seconds: 120 },
                        { user_id: "rep-2", outcome: "meeting_set", adherence_score: 80, duration_seconds: 240 },
                    ]);
                }
                // weeklyTrend query
                return mockSupabaseQuery([
                    { started_at: "2025-01-06T10:00:00Z", adherence_score: 85 },
                    { started_at: "2025-01-13T10:00:00Z", adherence_score: 75 },
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

        const response = await GET(createRequest());
        expect(response.status).toBe(200);
        const json = await response.json();

        expect(json.repAdherence).toHaveLength(2);
        expect(json.repAdherence[0].name).toBe("Alice Smith");
        expect(json.repAdherence[0].avgAdherenceScore).toBe(80); // avg of 90 + 70
        expect(json.repAdherence[0].totalCalls).toBe(2);
        expect(json.weeklyTrend).toBeDefined();
        expect(json.orgAvgAdherence).toBeDefined();
    });

    it("filters by userId when provided", async () => {
        mockGetUser.mockResolvedValue({ id: "admin-1" });
        mockGetOrgId.mockResolvedValue("org-1");
        mockIsOrgAdmin.mockResolvedValue(true);
        mockGetProductId.mockResolvedValue("product-1");

        mockFrom.mockImplementation(() => mockSupabaseQuery([]));

        const response = await GET(createRequest({ userId: "specific-rep" }));
        expect(response.status).toBe(200);
    });

    it("respects date range params", async () => {
        mockGetUser.mockResolvedValue({ id: "admin-1" });
        mockGetOrgId.mockResolvedValue("org-1");
        mockIsOrgAdmin.mockResolvedValue(true);
        mockGetProductId.mockResolvedValue("product-1");

        mockFrom.mockImplementation(() => mockSupabaseQuery([]));

        const response = await GET(createRequest({
            from: "2025-01-01T00:00:00Z",
            to: "2025-01-31T23:59:59Z",
        }));
        expect(response.status).toBe(200);
        const json = await response.json();
        expect(json.dateRange.from).toBe("2025-01-01T00:00:00Z");
        expect(json.dateRange.to).toBe("2025-01-31T23:59:59Z");
    });
});

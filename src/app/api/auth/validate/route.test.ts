import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// vi.mock must use inline factory (no outside variables)
vi.mock("@/app/lib/supabaseServer", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Import the mocked module to access mock functions
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { POST } from "./route";

const mockAuth = supabaseAdmin.auth as any;
const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;

function createRequest(token?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers["authorization"] = `Bearer ${token}`;

  return new NextRequest("http://localhost:3000/api/auth/validate", {
    method: "POST",
    headers,
  });
}

describe("POST /api/auth/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no auth header provided", async () => {
    const request = createRequest();
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 when token is invalid", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Invalid token"),
    });

    const request = createRequest("invalid-token");
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns valid=true when user is already an org member", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "test@314ecorp.com" },
      },
      error: null,
    });

    // organization_members query returns existing membership
    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: [
                {
                  organization_id: "org-1",
                  organizations: { is_active: true },
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const request = createRequest("valid-token");
    const response = await POST(request);
    const json = await response.json();

    expect(json.valid).toBe(true);
    expect(json.organizationId).toBe("org-1");
  });

  it("returns valid=false when no matching org for domain", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: {
        user: { id: "user-2", email: "test@unknown.com" },
      },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: [],
              error: null,
            }),
          }),
        };
      }
      if (table === "organizations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: [
                {
                  id: "org-1",
                  allowed_domains: ["314ecorp.com"],
                  allowed_emails: [],
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const request = createRequest("valid-token");
    const response = await POST(request);
    const json = await response.json();

    expect(json.valid).toBe(false);
  });

  it("auto-assigns user when domain matches org", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: {
        user: { id: "user-3", email: "new@314ecorp.com" },
      },
      error: null,
    });

    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "organization_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: [], // Not a member yet
              error: null,
            }),
          }),
          insert: insertMock,
        };
      }
      if (table === "organizations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              data: [
                {
                  id: "org-1",
                  allowed_domains: ["314ecorp.com"],
                  allowed_emails: [],
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const request = createRequest("valid-token");
    const response = await POST(request);
    const json = await response.json();

    expect(json.valid).toBe(true);
    expect(json.organizationId).toBe("org-1");
    expect(insertMock).toHaveBeenCalledWith({
      organization_id: "org-1",
      user_id: "user-3",
      role: "member",
    });
  });
});

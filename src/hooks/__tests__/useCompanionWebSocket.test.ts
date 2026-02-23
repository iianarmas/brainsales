import { renderHook, act } from "@testing-library/react";
import { useCompanionWebSocket } from "../useCompanionWebSocket";
import { useCallStore } from "@/store/callStore";
import { beforeEach, describe, it, expect, vi } from "vitest";

// Mock WebSocket
class MockWebSocket {
    url: string;
    onopen: (() => void) | null = null;
    onmessage: ((event: any) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: ((error: any) => void) | null = null;
    readyState: number = 0;

    constructor(url: string) {
        this.url = url;
        setTimeout(() => {
            if (this.onopen) this.onopen();
        }, 10);
    }

    close() {
        if (this.onclose) this.onclose();
    }
}

// Global fetch mock
global.fetch = vi.fn() as any;

// Mock Supabase
vi.mock("@/app/lib/supabaseClient", () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: null } })
        }
    }
}));

describe("useCompanionWebSocket", () => {
    beforeEach(() => {
        // Reset Zustand store state
        useCallStore.setState({
            isCompanionActive: false,
            liveTranscript: [],
            currentNodeId: "opening_general",
            scripts: {
                opening_general: {
                    id: "opening_general",
                    type: "opening",
                    title: "Test",
                    script: "Hello",
                    responses: [],
                    listenFor: ["Pricing"],
                    metadata: {
                        aiTransitionTriggers: [
                            { condition: "Asks for pricing", targetNodeId: "obj_cost", confidence: "high" }
                        ]
                    }
                }
            }
        });

        (global as any).WebSocket = MockWebSocket;
        vi.clearAllMocks();
    });

    it("should not connect if companion is inactive", () => {
        const { result } = renderHook(() => useCompanionWebSocket());
        expect(result.current.isConnected).toBe(false);
    });

    it("should connect when companion becomes active", async () => {
        act(() => {
            useCallStore.setState({ isCompanionActive: true });
        });

        const { result } = renderHook(() => useCompanionWebSocket());

        // Wait for mock connection to resolve
        await act(async () => {
            await new Promise((r) => setTimeout(r, 20));
        });

        expect(result.current.isConnected).toBe(true);
    });
});

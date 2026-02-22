import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCallStore } from "./callStore";
import { CallNode } from "@/data/callFlow";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Mock fetch for analytics calls
globalThis.fetch = vi.fn(() => Promise.resolve(new Response()));

const makeNode = (id: string, overrides: Partial<CallNode> = {}): CallNode => ({
  id,
  type: "discovery",
  title: `Node ${id}`,
  script: `Script for ${id}`,
  responses: [],
  ...overrides,
});

describe("callStore", () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset the store
    useCallStore.setState({
      scripts: {},
      currentNodeId: "opening_general",
      conversationPath: ["opening_general"],
      previousNonObjectionNode: null,
      metadata: {
        prospectName: "",
        organization: "",
        ehr: "",
        dms: "",
        automation: "",
        painPoints: [],
        competitors: [],
        objections: [],
        environmentTriggers: {},
      },
      notes: "",
      outcome: null,
      searchQuery: "",
      searchResults: [],
    });
  });

  describe("setScripts", () => {
    it("sets scripts and updates current node if invalid", () => {
      const scripts = {
        opening_a: makeNode("opening_a", { type: "opening" }),
        disc_1: makeNode("disc_1"),
      };
      useCallStore.getState().setScripts(scripts);

      expect(useCallStore.getState().scripts).toBe(scripts);
      expect(useCallStore.getState().currentNodeId).toBe("opening_a");
    });
  });

  describe("navigateTo", () => {
    it("navigates to a valid node", () => {
      const scripts = {
        opening_a: makeNode("opening_a", { type: "opening" }),
        disc_1: makeNode("disc_1"),
      };
      useCallStore.setState({ scripts, currentNodeId: "opening_a", conversationPath: ["opening_a"] });

      useCallStore.getState().navigateTo("disc_1");

      expect(useCallStore.getState().currentNodeId).toBe("disc_1");
      expect(useCallStore.getState().conversationPath).toEqual(["opening_a", "disc_1"]);
    });

    it("does not navigate to invalid node", () => {
      const scripts = { opening_a: makeNode("opening_a", { type: "opening" }) };
      useCallStore.setState({ scripts, currentNodeId: "opening_a", conversationPath: ["opening_a"] });

      useCallStore.getState().navigateTo("nonexistent");

      expect(useCallStore.getState().currentNodeId).toBe("opening_a");
    });

    it("saves return point when navigating to objection from non-objection", () => {
      const scripts = {
        disc_1: makeNode("disc_1"),
        obj_1: makeNode("obj_1", { type: "objection" }),
      };
      useCallStore.setState({ scripts, currentNodeId: "disc_1", conversationPath: ["disc_1"] });

      useCallStore.getState().navigateTo("obj_1");

      expect(useCallStore.getState().previousNonObjectionNode).toBe("disc_1");
    });

    it("resets conversation path when navigating to an opening node", () => {
      const scripts = {
        disc_1: makeNode("disc_1"),
        opening_b: makeNode("opening_b", { type: "opening" }),
      };
      useCallStore.setState({ scripts, currentNodeId: "disc_1", conversationPath: ["opening_a", "disc_1"] });

      useCallStore.getState().navigateTo("opening_b");

      expect(useCallStore.getState().currentNodeId).toBe("opening_b");
      expect(useCallStore.getState().conversationPath).toEqual(["opening_b"]);
      expect(useCallStore.getState().previousNonObjectionNode).toBeNull();
    });
  });

  describe("goBack", () => {
    it("goes back one step", () => {
      const scripts = {
        a: makeNode("a"),
        b: makeNode("b"),
      };
      useCallStore.setState({ scripts, currentNodeId: "b", conversationPath: ["a", "b"] });

      useCallStore.getState().goBack();

      expect(useCallStore.getState().currentNodeId).toBe("a");
      expect(useCallStore.getState().conversationPath).toEqual(["a"]);
    });

    it("does nothing when at root", () => {
      const scripts = { a: makeNode("a") };
      useCallStore.setState({ scripts, currentNodeId: "a", conversationPath: ["a"] });

      useCallStore.getState().goBack();

      expect(useCallStore.getState().currentNodeId).toBe("a");
      expect(useCallStore.getState().conversationPath).toEqual(["a"]);
    });
  });

  describe("returnToFlow", () => {
    it("returns to saved node and clears previous", () => {
      const scripts = {
        disc_1: makeNode("disc_1"),
        obj_1: makeNode("obj_1", { type: "objection" }),
      };
      useCallStore.setState({
        scripts,
        currentNodeId: "obj_1",
        conversationPath: ["disc_1", "obj_1"],
        previousNonObjectionNode: "disc_1",
      });

      useCallStore.getState().returnToFlow();

      expect(useCallStore.getState().currentNodeId).toBe("disc_1");
      expect(useCallStore.getState().previousNonObjectionNode).toBeNull();
    });
  });

  describe("navigateToHistoricalNode", () => {
    it("rewinds conversation path to historical node", () => {
      const scripts = {
        a: makeNode("a"),
        b: makeNode("b"),
        c: makeNode("c"),
      };
      useCallStore.setState({ scripts, currentNodeId: "c", conversationPath: ["a", "b", "c"] });

      useCallStore.getState().navigateToHistoricalNode("a");

      expect(useCallStore.getState().currentNodeId).toBe("a");
      expect(useCallStore.getState().conversationPath).toEqual(["a"]);
    });
  });

  describe("metadata", () => {
    it("updates metadata", () => {
      useCallStore.getState().updateMetadata({ prospectName: "John", organization: "ACME" });

      expect(useCallStore.getState().metadata.prospectName).toBe("John");
      expect(useCallStore.getState().metadata.organization).toBe("ACME");
    });

    it("adds pain points without duplicates", () => {
      useCallStore.getState().addPainPoint("slow scanning");
      useCallStore.getState().addPainPoint("slow scanning");
      useCallStore.getState().addPainPoint("paper records");

      expect(useCallStore.getState().metadata.painPoints).toEqual(["slow scanning", "paper records"]);
    });

    it("adds competitors without duplicates", () => {
      useCallStore.getState().addCompetitor("OnBase");
      useCallStore.getState().addCompetitor("OnBase");

      expect(useCallStore.getState().metadata.competitors).toEqual(["OnBase"]);
    });

    it("adds objections without duplicates", () => {
      useCallStore.getState().addObjection("too expensive");
      useCallStore.getState().addObjection("too expensive");

      expect(useCallStore.getState().metadata.objections).toEqual(["too expensive"]);
    });
  });

  describe("recalculateMetadata", () => {
    it("detects EHR from dynamic node metadata", () => {
      const scripts = {
        a: makeNode("a", { metadata: { ehr: "Cerner" } }),
      };
      useCallStore.setState({ scripts });

      useCallStore.getState().recalculateMetadata(["a"]);

      expect(useCallStore.getState().metadata.ehr).toBe("Cerner");
    });

    it("detects EHR from legacy hardcoded node IDs", () => {
      const scripts = {
        disc_ehr_epic: makeNode("disc_ehr_epic"),
      };
      useCallStore.setState({ scripts });

      useCallStore.getState().recalculateMetadata(["disc_ehr_epic"]);

      expect(useCallStore.getState().metadata.ehr).toBe("Epic");
    });

    it("detects competitors from node metadata", () => {
      const scripts = {
        a: makeNode("a", { metadata: { competitors: ["OnBase", "Gallery"] } }),
      };
      useCallStore.setState({ scripts });

      useCallStore.getState().recalculateMetadata(["a"]);

      expect(useCallStore.getState().metadata.competitors).toContain("OnBase");
      expect(useCallStore.getState().metadata.competitors).toContain("Gallery");
    });
  });

  describe("search", () => {
    it("finds nodes matching query", () => {
      const scripts = {
        a: makeNode("a", { title: "Epic Discovery", script: "Ask about Epic" }),
        b: makeNode("b", { title: "Budget Objection", script: "Handle budget" }),
      };
      useCallStore.setState({ scripts });

      useCallStore.getState().search("epic");

      expect(useCallStore.getState().searchResults).toHaveLength(1);
      expect(useCallStore.getState().searchResults[0].id).toBe("a");
    });

    it("clears results on empty query", () => {
      useCallStore.setState({ searchResults: [makeNode("a")] });

      useCallStore.getState().search("");

      expect(useCallStore.getState().searchResults).toEqual([]);
    });
  });

  describe("generateSummary", () => {
    it("includes metadata in summary", () => {
      useCallStore.setState({
        metadata: {
          prospectName: "Jane",
          organization: "Hospital",
          ehr: "Epic",
          dms: "OnBase",
          automation: "",
          painPoints: ["slow scanning"],
          competitors: ["OnBase"],
          objections: [],
          environmentTriggers: {},
        },
        outcome: "meeting_set",
        notes: "",
      });

      const summary = useCallStore.getState().generateSummary();

      expect(summary).toContain("Jane");
      expect(summary).toContain("Hospital");
      expect(summary).toContain("Epic");
      expect(summary).toContain("Meeting Scheduled");
    });
  });

  describe("notes and outcome", () => {
    it("sets notes", () => {
      useCallStore.getState().setNotes("Follow up next week");
      expect(useCallStore.getState().notes).toBe("Follow up next week");
    });

    it("sets outcome", () => {
      useCallStore.getState().setOutcome("meeting_set");
      expect(useCallStore.getState().outcome).toBe("meeting_set");
    });
  });
});

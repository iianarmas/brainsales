import { create } from "zustand";
import { callFlow, CallNode } from "@/data/callFlow";

export interface CallMetadata {
  prospectName: string;
  organization: string;
  ehr: string;
  dms: string;
  automation: string;
  painPoints: string[];
  competitors: string[];
  objections: string[];
}

export interface CallState {
  // Navigation
  currentNodeId: string;
  conversationPath: string[];
  previousNonObjectionNode: string | null; // Track where we were before handling objection

  // Metadata
  metadata: CallMetadata;

  // Notes
  notes: string;

  // Outcome
  outcome: "meeting_set" | "follow_up" | "send_info" | "not_interested" | null;

  // UI State
  showQuickReference: boolean;
  searchQuery: string;
  searchResults: CallNode[];
}

export interface CallActions {
  // Navigation
  navigateTo: (nodeId: string) => void;
  goBack: () => void;
  returnToFlow: () => void; // Return to where we were before objection
  removeFromPath: (nodeId: string) => void; // Remove a node from the conversation path
  reset: () => void;

  // Metadata
  updateMetadata: (updates: Partial<CallMetadata>) => void;
  addPainPoint: (painPoint: string) => void;
  addCompetitor: (competitor: string) => void;
  addObjection: (objection: string) => void;

  // Notes
  setNotes: (notes: string) => void;


  // Outcome
  setOutcome: (outcome: CallState["outcome"]) => void;

  // UI
  toggleQuickReference: () => void;
  setSearchQuery: (query: string) => void;
  search: (query: string) => void;

  // Summary
  generateSummary: () => string;
  copySummary: () => Promise<void>;

  // Current node helper
  getCurrentNode: () => CallNode;
}

const initialMetadata: CallMetadata = {
  prospectName: "",
  organization: "",
  ehr: "",
  dms: "",
  automation: "",
  painPoints: [],
  competitors: [],
  objections: [],
};

const initialState: CallState = {
  currentNodeId: "opening",
  conversationPath: ["opening"],
  previousNonObjectionNode: null,
  metadata: initialMetadata,
  notes: "",
  outcome: null,
  showQuickReference: false,
  searchQuery: "",
  searchResults: [],
};

export const useCallStore = create<CallState & CallActions>((set, get) => ({
  ...initialState,

  // Navigation
  navigateTo: (nodeId: string) => {
    const node = callFlow[nodeId];
    if (!node) return;

    const currentState = get();
    const currentNode = callFlow[currentState.currentNodeId];

    // If navigating to an objection node and we're not already on an objection,
    // save where we were so we can return
    const isNavigatingToObjection = node.type === "objection";
    const isCurrentlyOnObjection = currentNode?.type === "objection";

    set((state) => ({
      currentNodeId: nodeId,
      conversationPath: [...state.conversationPath, nodeId],
      // Save return point when jumping to objection from non-objection
      previousNonObjectionNode:
        isNavigatingToObjection && !isCurrentlyOnObjection
          ? state.currentNodeId
          : state.previousNonObjectionNode,
    }));

    // Auto-detect metadata from node navigation
    const { updateMetadata, addCompetitor } = get();

    // Detect EHR
    if (nodeId === "ehr_epic") {
      updateMetadata({ ehr: "Epic" });
    } else if (nodeId === "ehr_other") {
      // Will be updated based on response
    }

    // Detect DMS
    if (nodeId.includes("onbase")) {
      updateMetadata({ dms: "OnBase" });
      addCompetitor("OnBase");
    }
    if (nodeId.includes("gallery")) {
      updateMetadata({ dms: "Epic Gallery" });
      addCompetitor("Epic Gallery");
    }
    if (nodeId.includes("brainware")) {
      addCompetitor("Brainware");
    }

    // Detect outcomes
    if (nodeId === "call_end_success" || nodeId === "meeting_set") {
      set({ outcome: "meeting_set" });
    } else if (nodeId === "call_end_info") {
      set({ outcome: "send_info" });
    } else if (nodeId === "call_end_followup") {
      set({ outcome: "follow_up" });
    } else if (nodeId === "call_end_no") {
      set({ outcome: "not_interested" });
    }
  },

  goBack: () => {
    set((state) => {
      if (state.conversationPath.length <= 1) return state;

      const newPath = state.conversationPath.slice(0, -1);
      return {
        conversationPath: newPath,
        currentNodeId: newPath[newPath.length - 1],
      };
    });
  },

  returnToFlow: () => {
    const { previousNonObjectionNode } = get();
    if (previousNonObjectionNode) {
      set((state) => ({
        currentNodeId: previousNonObjectionNode,
        conversationPath: [...state.conversationPath, previousNonObjectionNode],
        previousNonObjectionNode: null, // Clear after returning
      }));
    }
  },

  removeFromPath: (nodeId: string) => {
    set((state) => {
      // Can't remove if it's the only item or if it's the current node
      if (state.conversationPath.length <= 1) return state;
      if (nodeId === state.currentNodeId) return state;

      // Remove all occurrences of this node from the path
      const newPath = state.conversationPath.filter((id) => id !== nodeId);

      // Make sure we still have at least one node
      if (newPath.length === 0) return state;

      return {
        conversationPath: newPath,
      };
    });
  },

  reset: () => {
    set({ ...initialState });
  },

  // Metadata
  updateMetadata: (updates) => {
    set((state) => ({
      metadata: { ...state.metadata, ...updates },
    }));
  },

  addPainPoint: (painPoint) => {
    set((state) => ({
      metadata: {
        ...state.metadata,
        painPoints: state.metadata.painPoints.includes(painPoint)
          ? state.metadata.painPoints
          : [...state.metadata.painPoints, painPoint],
      },
    }));
  },

  addCompetitor: (competitor) => {
    set((state) => ({
      metadata: {
        ...state.metadata,
        competitors: state.metadata.competitors.includes(competitor)
          ? state.metadata.competitors
          : [...state.metadata.competitors, competitor],
      },
    }));
  },

  addObjection: (objection) => {
    set((state) => ({
      metadata: {
        ...state.metadata,
        objections: state.metadata.objections.includes(objection)
          ? state.metadata.objections
          : [...state.metadata.objections, objection],
      },
    }));
  },

  // Notes
  setNotes: (notes) => set({ notes }),

  // Outcome
  setOutcome: (outcome) => set({ outcome }),

  // UI
  toggleQuickReference: () => {
    set((state) => ({ showQuickReference: !state.showQuickReference }));
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  search: (query) => {
    if (!query.trim()) {
      set({ searchResults: [], searchQuery: query });
      return;
    }

    const lowerQuery = query.toLowerCase();
    const results: CallNode[] = [];

    Object.values(callFlow).forEach((node) => {
      const searchText = `${node.title} ${node.script} ${node.context || ""} ${
        node.keyPoints?.join(" ") || ""
      } ${node.metadata?.competitorInfo || ""}`.toLowerCase();

      if (searchText.includes(lowerQuery)) {
        results.push(node);
      }
    });

    set({ searchResults: results, searchQuery: query });
  },

  // Summary
  generateSummary: () => {
    const { metadata, notes, outcome } = get();

    const outcomeLabels: Record<string, string> = {
      meeting_set: "Meeting Scheduled",
      follow_up: "Follow-up Scheduled",
      send_info: "Information Sent",
      not_interested: "Not Interested",
    };

    const lines: string[] = [
      "=== CALL SUMMARY ===",
      "",
    ];

    if (metadata.prospectName) lines.push(`Contact: ${metadata.prospectName}`);
    if (metadata.organization) lines.push(`Organization: ${metadata.organization}`);
    if (outcome) lines.push(`Outcome: ${outcomeLabels[outcome] || outcome}`);

    lines.push("");
    lines.push("--- ENVIRONMENT ---");
    if (metadata.ehr) lines.push(`EHR: ${metadata.ehr}`);
    if (metadata.dms) lines.push(`DMS: ${metadata.dms}`);
    if (metadata.automation) lines.push(`Automation: ${metadata.automation}`);

    if (metadata.competitors.length > 0) {
      lines.push("");
      lines.push("--- COMPETITORS MENTIONED ---");
      metadata.competitors.forEach((c) => lines.push(`- ${c}`));
    }

    if (metadata.painPoints.length > 0) {
      lines.push("");
      lines.push("--- PAIN POINTS ---");
      metadata.painPoints.forEach((p) => lines.push(`- ${p}`));
    }

    if (metadata.objections.length > 0) {
      lines.push("");
      lines.push("--- OBJECTIONS ---");
      metadata.objections.forEach((o) => lines.push(`- ${o}`));
    }

    if (notes.trim()) {
      lines.push("");
      lines.push("--- NOTES ---");
      lines.push(notes);
    }

    lines.push("");
    lines.push("===================");

    return lines.join("\n");
  },

  copySummary: async () => {
    const summary = get().generateSummary();
    await navigator.clipboard.writeText(summary);
  },

  // Current node helper
  getCurrentNode: () => {
    return callFlow[get().currentNodeId];
  },
}));

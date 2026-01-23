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
  navigateToHistoricalNode: (nodeId: string) => void; // Navigate to a node in the path (rewind, don't append)
  goBack: () => void;
  returnToFlow: () => void; // Return to where we were before objection
  removeFromPath: (nodeId: string) => void; // Remove a node from the conversation path
  reset: () => void;

  // Metadata
  recalculateMetadata: (path: string[]) => void; // Recalculate metadata from path
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

  // Scripts
  generateScripts: () => string;
  copyScripts: () => Promise<void>;

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

  // Helper to recalculate metadata from conversation path
  recalculateMetadata: (path: string[]) => {
    const currentMetadata = get().metadata;
    const autoDetectedCompetitors: string[] = [];
    let ehr = "";
    let dms = "";
    let outcome: CallState["outcome"] = null;

    // Go through the path and rebuild auto-detected metadata
    path.forEach((nodeId) => {
      // Detect EHR (explicit choices) - these take precedence
      if (nodeId === "ehr_epic") {
        ehr = "Epic";
      } else if (nodeId === "ehr_other" || nodeId === "ehr_other_than") {
        ehr = "Other";
      }

      // Detect DMS and infer EHR when necessary
      if (nodeId.includes("onbase")) {
        dms = "OnBase";
        if (!autoDetectedCompetitors.includes("OnBase")) {
          autoDetectedCompetitors.push("OnBase");
        }
      }
      if (nodeId.includes("gallery")) {
        dms = "Epic Gallery";
        // Gallery is Epic-only, so always set EHR to Epic
        ehr = "Epic";
        if (!autoDetectedCompetitors.includes("Epic Gallery")) {
          autoDetectedCompetitors.push("Epic Gallery");
        }
      }
      if (nodeId.includes("other_dms")) {
        dms = "Other";
      }
      // Explicitly handle "no DMS" paths
      if (nodeId === "epic_only_path") {
        ehr = "Epic"; // Epic only path implies Epic EHR
        dms = "None";
      }
      if (nodeId === "ehr_only_path") {
        dms = "None";
        // Don't override EHR if already set from earlier node
        if (!ehr) {
          ehr = "Other";
        }
      }
      if (nodeId.includes("brainware")) {
        if (!autoDetectedCompetitors.includes("Brainware")) {
          autoDetectedCompetitors.push("Brainware");
        }
      }

      // Detect outcomes
      if (nodeId === "call_end_success" || nodeId === "meeting_set") {
        outcome = "meeting_set";
      } else if (nodeId === "call_end_info") {
        outcome = "send_info";
      } else if (nodeId === "call_end_followup") {
        outcome = "follow_up";
      } else if (nodeId === "call_end_no") {
        outcome = "not_interested";
      }
    });

    // Replace with auto-detected competitors from the current path
    // Keep manually entered data (prospectName, organization, painPoints, objections, automation)
    set({
      metadata: {
        ...currentMetadata,
        ehr,
        dms,
        competitors: autoDetectedCompetitors,
      },
      outcome,
    });
  },

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

    // Recalculate metadata from the full path
    get().recalculateMetadata(get().conversationPath);
  },

  navigateToHistoricalNode: (nodeId: string) => {
    const node = callFlow[nodeId];
    if (!node) return;

    set((state) => {
      // Find the index of this node in the path
      const nodeIndex = state.conversationPath.indexOf(nodeId);

      // If not found or already at current position, do nothing
      if (nodeIndex === -1 || nodeIndex === state.conversationPath.length - 1) {
        return state;
      }

      // Slice the path up to and including this node (rewind)
      const newPath = state.conversationPath.slice(0, nodeIndex + 1);

      return {
        conversationPath: newPath,
        currentNodeId: nodeId,
      };
    });

    // Recalculate metadata from the new path
    get().recalculateMetadata(get().conversationPath);
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

    // Recalculate metadata from the new path
    get().recalculateMetadata(get().conversationPath);
  },

  returnToFlow: () => {
    const { previousNonObjectionNode } = get();
    if (previousNonObjectionNode) {
      set((state) => ({
        currentNodeId: previousNonObjectionNode,
        conversationPath: [...state.conversationPath, previousNonObjectionNode],
        previousNonObjectionNode: null, // Clear after returning
      }));

      // Recalculate metadata from the new path
      get().recalculateMetadata(get().conversationPath);
    }
  },

  removeFromPath: (nodeId: string) => {
    set((state) => {
      // Can't remove if it's the only item
      if (state.conversationPath.length <= 1) return state;

      // Remove all occurrences of this node from the path
      const newPath = state.conversationPath.filter((id) => id !== nodeId);

      // Make sure we still have at least one node
      if (newPath.length === 0) return state;

      // If we're removing the current node, navigate to the last item in the new path
      const newCurrentNode = nodeId === state.currentNodeId
        ? newPath[newPath.length - 1]
        : state.currentNodeId;

      return {
        conversationPath: newPath,
        currentNodeId: newCurrentNode,
      };
    });

    // Recalculate metadata from the new path
    get().recalculateMetadata(get().conversationPath);
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
    ];

    if (metadata.prospectName) lines.push(`Contact: ${metadata.prospectName}`);
    if (metadata.organization) lines.push(`Organization: ${metadata.organization}`);
    if (outcome) lines.push(`Outcome: ${outcomeLabels[outcome] || outcome}`);

    lines.push("ENVIRONMENT:");
    if (metadata.ehr) lines.push(`EHR: ${metadata.ehr}`);
    if (metadata.dms) lines.push(`DMS: ${metadata.dms}`);
    if (metadata.automation) lines.push(`Automation: ${metadata.automation}`);

    if (metadata.competitors.length > 0) {
      lines.push("");
      lines.push("COMPETITORS MENTIONED:");
      metadata.competitors.forEach((c) => lines.push(`- ${c}`));
    }

    if (metadata.painPoints.length > 0) {
      lines.push("");
      lines.push("PAIN POINTS:");
      metadata.painPoints.forEach((p) => lines.push(`- ${p}`));
    }

    if (metadata.objections.length > 0) {
      lines.push("");
      lines.push("OBJECTIONS:");
      metadata.objections.forEach((o) => lines.push(`- ${o}`));
    }

    if (notes.trim()) {
      lines.push("");
      lines.push("ADDITIONAL NOTES:");
      lines.push(notes);
    }
    return lines.join("\n");
  },

  copySummary: async () => {
    const summary = get().generateSummary();
    await navigator.clipboard.writeText(summary);
  },

  // Scripts
  generateScripts: () => {
    const { conversationPath } = get();
    const scripts: string[] = [];

    conversationPath.forEach((nodeId, index) => {
      const node = callFlow[nodeId];
      if (node && node.script) {
        scripts.push(`${index + 1}. ${node.title}\n\n"${node.script}"\n`);
      }
    });

    return scripts.join("\n");
  },

  copyScripts: async () => {
    const scripts = get().generateScripts();
    await navigator.clipboard.writeText(scripts);
  },

  // Current node helper
  getCurrentNode: () => {
    return callFlow[get().currentNodeId];
  },
}));

import { create } from "zustand";
import { callFlow, CallNode } from "@/data/callFlow";
import { supabase } from "@/app/lib/supabaseClient";

async function getAuthHeaders(productId?: string | null): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    // Silently fail - analytics shouldn't break the call experience
  }
  if (productId) {
    headers["X-Product-Id"] = productId;
  }
  return headers;
}

export interface CallMetadata {
  prospectName: string;
  organization: string;
  ehr: string;
  dms: string;
  automation: string;
  painPoints: string[];
  competitors: string[];
  objections: string[];
  environmentTriggers: Record<string, string | string[]>;
}

export interface CallState {
  // Navigation
  scripts: Record<string, CallNode>;
  sessionId: string;
  sessionStartedAt: string;
  currentNodeId: string;
  conversationPath: string[];
  previousNonObjectionNode: string | null; // Track where we were before handling objection
  activeCallFlowId: string | null; // Opening node ID that defines the current call flow

  // Metadata
  metadata: CallMetadata;

  // Notes
  notes: string;

  // Outcome
  outcome: "meeting_set" | "follow_up" | "send_info" | "not_interested" | null;

  // Product context for analytics
  productId: string | null;

  // UI State
  showQuickReference: boolean;
  searchQuery: string;
  searchResults: CallNode[];
}

export interface CallActions {
  // Navigation
  setScripts: (scripts: Record<string, CallNode>) => void;
  navigateTo: (nodeId: string) => void;
  navigateToHistoricalNode: (nodeId: string) => void; // Navigate to a node in the path (rewind, don't append)
  goBack: () => void;
  returnToFlow: () => void; // Return to where we were before objection
  removeFromPath: (nodeId: string) => void; // Remove a node from the conversation path
  setActiveCallFlowId: (flowId: string | null) => void;
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
  persistSession: () => void;

  // Product context
  setProductId: (productId: string | null) => void;

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
  environmentTriggers: {},
};

const getInitialNode = () => {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("brainsales_last_opening_node");
      if (saved) return saved;
    } catch (e) {
      console.warn("Failed to get last opening node from localStorage", e);
    }
  }
  return "opening_general";
};

const getInitialQuickReference = () => {
  if (typeof window !== "undefined") {
    return window.innerWidth >= 768; // Default to open on desktop/tablet, closed on mobile
  }
  return true;
};

const initialState: CallState = {
  scripts: callFlow, // Start with static data for instant load, then sync dynamicly
  sessionId: typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).substring(2),
  sessionStartedAt: new Date().toISOString(),
  currentNodeId: getInitialNode(),
  conversationPath: [getInitialNode()],
  previousNonObjectionNode: null,
  activeCallFlowId: getInitialNode(),
  metadata: initialMetadata,
  notes: "",
  outcome: null,
  productId: null,
  showQuickReference: getInitialQuickReference(),
  searchQuery: "",
  searchResults: [],
};

export const useCallStore = create<CallState & CallActions>((set, get) => ({
  ...initialState,

  // Helper to recalculate metadata from conversation path
  recalculateMetadata: (path: string[]) => {
    const { metadata: currentMetadata, scripts } = get();
    const autoDetectedCompetitors: string[] = [];
    let ehr = "";
    let dms = "";
    let outcome: CallState["outcome"] = null;

    // Go through the path and rebuild auto-detected metadata
    // Dynamic metadata (admin-configured) takes precedence over hardcoded checks.
    // Values accumulate: a later node only overwrites EHR/DMS if it explicitly sets a new value.
    path.forEach((nodeId) => {
      const nodeMetadata = scripts[nodeId]?.metadata;
      const hasDynamicEhr = !!(nodeMetadata?.ehr);
      const hasDynamicDms = !!(nodeMetadata?.dms);

      // --- Dynamic Metadata from Node Config (takes precedence) ---
      if (nodeMetadata) {
        if (hasDynamicEhr) {
          ehr = nodeMetadata.ehr!;
        }
        if (hasDynamicDms) {
          dms = nodeMetadata.dms!;
        }
        if (nodeMetadata.competitors && Array.isArray(nodeMetadata.competitors)) {
          nodeMetadata.competitors.forEach(comp => {
            if (comp && !autoDetectedCompetitors.includes(comp)) {
              autoDetectedCompetitors.push(comp);
            }
          });
        }
      }

      // --- Legacy hardcoded detection (only for fields not set by dynamic metadata on this node) ---
      if (!hasDynamicEhr) {
        if (nodeId === "disc_ehr_epic") {
          ehr = "Epic";
        } else if (nodeId === "disc_ehr_other" || nodeId === "disc_ehr_other_than") {
          ehr = "Other";
        } else if (nodeId.includes("gallery")) {
          // Gallery is Epic-only, so always set EHR to Epic
          ehr = "Epic";
        } else if (nodeId === "disc_epic_only") {
          ehr = "Epic";
        } else if (nodeId === "disc_ehr_only" && !ehr) {
          ehr = "Other";
        }
      }

      if (!hasDynamicDms) {
        if (nodeId.includes("onbase")) {
          dms = "OnBase";
        } else if (nodeId.includes("gallery")) {
          dms = "Epic Gallery";
        } else if (nodeId.includes("other_dms")) {
          dms = "Other";
        } else if (nodeId === "disc_epic_only" || nodeId === "disc_ehr_only") {
          // Only set "None" if no DMS was previously detected
          if (!dms) {
            dms = "None";
          }
        }
      }

      // Competitors from hardcoded checks (always accumulate)
      if (nodeId.includes("onbase") && !autoDetectedCompetitors.includes("OnBase")) {
        autoDetectedCompetitors.push("OnBase");
      }
      if (nodeId.includes("gallery") && !autoDetectedCompetitors.includes("Epic Gallery")) {
        autoDetectedCompetitors.push("Epic Gallery");
      }
      if (nodeId.includes("brainware") && !autoDetectedCompetitors.includes("Brainware")) {
        autoDetectedCompetitors.push("Brainware");
      }

      // Detect outcomes from metadata (Admin defined)
      if (scripts[nodeId]?.metadata?.outcome) {
        outcome = scripts[nodeId].metadata!.outcome!;
      }
      // Infer outcome from node type
      else if (scripts[nodeId]?.type === "success") {
        outcome = "meeting_set";
      }
      // Legacy: Detect outcomes from hardcoded IDs
      else if (nodeId === "success_call_end" || nodeId === "success_meeting_set") {
        outcome = "meeting_set";
      } else if (nodeId === "end_call_info") {
        outcome = "send_info";
      } else if (nodeId === "end_call_followup") {
        outcome = "follow_up";
      } else if (nodeId === "end_call_no") {
        outcome = "not_interested";
      }
    });

    // Collect dynamic environment triggers from node metadata
    const dynamicTriggers: Record<string, string | string[]> = {};
    path.forEach((nodeId) => {
      const nodeEnvTriggers = scripts[nodeId]?.metadata?.environmentTriggers;
      if (nodeEnvTriggers) {
        Object.entries(nodeEnvTriggers).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            // Accumulate array values
            const existing = dynamicTriggers[key];
            const arr = Array.isArray(existing) ? [...existing] : [];
            value.forEach((v) => {
              if (v && !arr.includes(v)) arr.push(v);
            });
            dynamicTriggers[key] = arr;
          } else if (value) {
            // Text triggers: later node overwrites
            dynamicTriggers[key] = value;
          }
        });
      }
    });

    // Keep manually entered data (prospectName, organization, painPoints, objections, automation)
    set({
      metadata: {
        ...currentMetadata,
        ehr,
        dms,
        competitors: autoDetectedCompetitors,
        environmentTriggers: dynamicTriggers,
      },
      outcome,
    });
  },

  // Navigation
  setScripts: (scripts) => {
    const { currentNodeId, conversationPath } = get();

    // Try to restore last opening script if it exists and is valid
    const savedOpeningNodeId = typeof window !== "undefined" ? localStorage.getItem("brainsales_last_opening_node") : null;
    let targetNodeId = currentNodeId;

    // If we're setting scripts for the first time OR the current node is no longer valid
    if (!scripts[currentNodeId]) {
      // 1. Check if we have a saved opening node that is valid in the new scripts
      if (savedOpeningNodeId && scripts[savedOpeningNodeId] && scripts[savedOpeningNodeId].type === "opening") {
        targetNodeId = savedOpeningNodeId;
      }
      // 2. Otherwise, find ANY valid opening node
      else {
        const openingNode = Object.values(scripts).find((n) => n.type === "opening");
        targetNodeId = openingNode?.id || Object.keys(scripts)[0];
      }
    }
    // SPECIAL CASE: We are at the start of the conversation.
    // Ensure we are using the saved opening node if it's different from the CURRENT initial node.
    else if (conversationPath.length === 1 && scripts[currentNodeId]?.type === "opening") {
      if (savedOpeningNodeId && scripts[savedOpeningNodeId] && scripts[savedOpeningNodeId].type === "opening" && savedOpeningNodeId !== currentNodeId) {
        targetNodeId = savedOpeningNodeId;
      }
    }

    if (targetNodeId && targetNodeId !== currentNodeId) {
      set({
        scripts,
        currentNodeId: targetNodeId,
        conversationPath: [targetNodeId],
        previousNonObjectionNode: null,
        activeCallFlowId: scripts[targetNodeId]?.type === "opening" ? targetNodeId : get().activeCallFlowId,
        metadata: initialMetadata,
        notes: "",
        outcome: null,
      });
      return;
    }

    set({ scripts });
  },

  navigateTo: (nodeId: string) => {
    const { scripts } = get();
    const node = scripts[nodeId];
    if (!node) return;

    const currentState = get();
    const currentNode = scripts[currentState.currentNodeId];

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

    // Persist if it's an opening script and set as active call flow
    if (node.type === "opening") {
      localStorage.setItem("brainsales_last_opening_node", nodeId);
      set({ activeCallFlowId: nodeId });
    }

    // Recalculate metadata from the full path
    get().recalculateMetadata(get().conversationPath);

    // Log to analytics
    const { sessionId, productId } = get();
    getAuthHeaders(productId).then((headers) => {
      fetch("/api/analytics/log", {
        method: "POST",
        headers,
        body: JSON.stringify({ nodeId, sessionId }),
      }).catch(console.error);
    });

    // Persist session if an outcome was detected during navigation
    if (get().outcome) {
      get().persistSession();
    }
  },

  navigateToHistoricalNode: (nodeId: string) => {
    const { scripts } = get();
    const node = scripts[nodeId];
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
    // Persist the ending session before resetting (if any navigation happened)
    const { conversationPath } = get();
    if (conversationPath.length > 1) {
      get().persistSession();
    }

    const currentScripts = get().scripts;
    const initialNode = getInitialNode();
    const resolvedNode = currentScripts[initialNode] ? initialNode : (Object.values(currentScripts).find(n => n.type === 'opening')?.id || Object.keys(currentScripts)[0]);
    set({
      ...initialState,
      scripts: currentScripts,
      currentNodeId: resolvedNode,
      conversationPath: [resolvedNode],
      activeCallFlowId: resolvedNode,
      sessionId: typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      sessionStartedAt: new Date().toISOString(),
    });
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

  // Active call flow
  setActiveCallFlowId: (flowId) => set({ activeCallFlowId: flowId }),

  // Product context
  setProductId: (productId) => set({ productId }),

  // Notes
  setNotes: (notes) => set({ notes }),

  // Outcome
  setOutcome: (outcome) => {
    set({ outcome });
    // Persist when an explicit outcome is set
    if (outcome) {
      get().persistSession();
    }
  },

  persistSession: () => {
    const { sessionId, sessionStartedAt, outcome, notes, metadata, productId } = get();
    // Fire-and-forget: don't block the UI
    getAuthHeaders(productId).then((headers) => {
      fetch("/api/analytics/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionId,
          outcome,
          notes,
          startedAt: sessionStartedAt,
          metadata: {
            prospectName: metadata.prospectName,
            organization: metadata.organization,
            ehr: metadata.ehr,
            dms: metadata.dms,
            competitors: metadata.competitors,
            environmentTriggers: metadata.environmentTriggers,
          },
        }),
      }).catch(console.error);
    });
  },

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
    const { scripts } = get();

    Object.values(scripts).forEach((node) => {
      const searchText = `${node.title} ${node.script} ${node.context || ""} ${node.keyPoints?.join(" ") || ""
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
    const { conversationPath, scripts } = get();
    const scriptLines: string[] = [];

    conversationPath.forEach((nodeId, index) => {
      const node = scripts[nodeId];
      if (node && node.script) {
        scriptLines.push(`${index + 1}. ${node.title}\n\n"${node.script}"\n`);
      }
    });

    return scriptLines.join("\n");
  },

  copyScripts: async () => {
    const scripts = get().generateScripts();
    await navigator.clipboard.writeText(scripts);
  },

  // Current node helper
  getCurrentNode: () => {
    const { scripts, currentNodeId } = get();
    return scripts[currentNodeId];
  },
}));

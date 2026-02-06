import { create } from "zustand";
import { Node, Edge, MarkerType } from "@xyflow/react";
import { CallNode } from "@/data/callFlow";
import type { EditorTab } from "@/components/ScriptEditor/EditorTabs";

export type EditorView = "visual" | "tree";

// Topic configuration from product settings
export interface Topic {
  id: string;
  label: string;
  icon: string;
  color: string;
  sort_order?: number;
}

export interface TransformedNode extends Node {
  data: {
    callNode: CallNode;
    topicGroupId: string | null;
    onDelete?: (id: string, title: string) => void;
    isHighlighted?: boolean;
    topics?: Topic[];
  };
}

interface CacheEntry {
  nodes: TransformedNode[];
  edges: Edge[];
  rawNodes: CallNode[];
  fetchedAt: number;
}

export interface CollaboratorState {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  activeNodeId: string | null;
  lastSeen: number;
}

interface ScriptEditorState {
  // Shared across both editors
  activeTab: EditorTab;
  view: EditorView;
  productId: string | null;
  isAdmin: boolean;
  isAdminInitialized: boolean; // Track if admin status has been set for this session

  // Cache per tab (keyed by `${productId}:${activeTab}`)
  cache: Map<string, CacheEntry>;

  // UI State
  selectedNodeId: string | null;
  isNewNode: boolean;
  loading: boolean;
  isFetching: boolean; // True during background refetch
  error: string | null;

  // Topics (shared)
  topics: Topic[];

  // Real-time Collaborators
  activeCollaborators: Map<string, CollaboratorState>;
}

interface ScriptEditorActions {
  // Tab & View
  setActiveTab: (tab: EditorTab) => void;
  setView: (view: EditorView) => void;
  setProductId: (productId: string | null) => void;
  setIsAdmin: (isAdmin: boolean) => void;

  // Cache management
  getCacheKey: () => string;
  getCachedData: (cacheKey?: string) => CacheEntry | undefined;
  setCachedData: (cacheKey: string, nodes: TransformedNode[], edges: Edge[], rawNodes: CallNode[]) => void;
  shouldRefetch: (staleTime?: number) => boolean;
  invalidateCache: (cacheKey?: string) => void;
  invalidateAllCache: () => void;

  // Selection
  selectNode: (nodeId: string | null, isNew?: boolean) => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setIsFetching: (isFetching: boolean) => void;
  setError: (error: string | null) => void;

  // Topics
  setTopics: (topics: Topic[]) => void;

  // Node/Edge updates (for real-time sync)
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  updateCachedNodes: (cacheKey: string, updater: (nodes: TransformedNode[]) => TransformedNode[]) => void;
  updateCachedEdges: (cacheKey: string, updater: (edges: Edge[]) => Edge[]) => void;

  // Collaborator actions
  setCollaborator: (userId: string, state: CollaboratorState) => void;
  removeCollaborator: (userId: string) => void;
  clearCollaborators: () => void;
}

const DEFAULT_STALE_TIME = 30000; // 30 seconds

export const useScriptEditorStore = create<ScriptEditorState & ScriptEditorActions>((set, get) => ({
  // Initial state
  activeTab: "official",
  view: "visual",
  productId: null,
  isAdmin: false,
  isAdminInitialized: false,
  cache: new Map(),
  selectedNodeId: null,
  isNewNode: false,
  loading: true,
  isFetching: false,
  error: null,
  topics: [],
  activeCollaborators: new Map(),

  // Tab & View
  setActiveTab: (tab) => {
    const current = get().activeTab;
    if (current !== tab) {
      set({ activeTab: tab, selectedNodeId: null, isNewNode: false });
    }
  },

  setView: (view) => {
    const current = get().view;
    if (current !== view) {
      set({ view });
    }
  },

  setProductId: (productId) => set({ productId }),
  setIsAdmin: (isAdmin) => {
    const { isAdminInitialized, activeTab } = get();

    set({ isAdmin });

    // Handle initialization or transition to admin status
    if (!isAdminInitialized || (isAdmin && activeTab === "sandbox")) {
      set({ isAdminInitialized: true });

      // Set appropriate default tab based on admin status
      if (isAdmin) {
        // Admins should start on official flow
        set({ activeTab: "official" });
      } else {
        // Non-admins should start on sandbox (cannot access official)
        set({ activeTab: "sandbox" });
      }
    } else if (!isAdmin) {
      // Even if already initialized, non-admins must not be on official tab
      if (activeTab === "official") {
        set({ activeTab: "sandbox" });
      }
    }
  },

  // Cache management
  getCacheKey: () => {
    const { productId, activeTab } = get();
    return `${productId || "default"}:${activeTab}`;
  },

  getCachedData: (cacheKey) => {
    const key = cacheKey || get().getCacheKey();
    return get().cache.get(key);
  },

  setCachedData: (cacheKey, nodes, edges, rawNodes) => {
    set((state) => {
      const newCache = new Map(state.cache);
      newCache.set(cacheKey, {
        nodes,
        edges,
        rawNodes,
        fetchedAt: Date.now(),
      });
      return { cache: newCache, loading: false, isFetching: false, error: null };
    });
  },

  shouldRefetch: (staleTime = DEFAULT_STALE_TIME) => {
    const cacheKey = get().getCacheKey();
    const cached = get().cache.get(cacheKey);
    if (!cached) return true;
    return Date.now() - cached.fetchedAt > staleTime;
  },

  invalidateCache: (cacheKey) => {
    const key = cacheKey || get().getCacheKey();
    set((state) => {
      const newCache = new Map(state.cache);
      newCache.delete(key);
      return { cache: newCache };
    });
  },

  invalidateAllCache: () => {
    set({ cache: new Map() });
  },

  // Selection
  selectNode: (nodeId, isNew = false) => {
    set({ selectedNodeId: nodeId, isNewNode: isNew });
  },

  // Loading state
  setLoading: (loading) => set({ loading }),
  setIsFetching: (isFetching) => set({ isFetching }),
  setError: (error) => set({ error, loading: false, isFetching: false }),

  // Topics
  setTopics: (topics) => set({ topics }),

  // Node/Edge updates for real-time sync
  updateNodePosition: (nodeId, position) => {
    const cacheKey = get().getCacheKey();
    set((state) => {
      const cached = state.cache.get(cacheKey);
      if (!cached) return state;

      const updatedNodes = cached.nodes.map((node) =>
        node.id === nodeId ? { ...node, position } : node
      );

      const newCache = new Map(state.cache);
      newCache.set(cacheKey, {
        ...cached,
        nodes: updatedNodes,
      });

      return { cache: newCache };
    });
  },

  updateCachedNodes: (cacheKey, updater) => {
    set((state) => {
      const cached = state.cache.get(cacheKey);
      if (!cached) return state;

      const newCache = new Map(state.cache);
      newCache.set(cacheKey, {
        ...cached,
        nodes: updater(cached.nodes),
      });

      return { cache: newCache };
    });
  },

  updateCachedEdges: (cacheKey, updater) => {
    set((state) => {
      const cached = state.cache.get(cacheKey);
      if (!cached) return state;

      const newCache = new Map(state.cache);
      newCache.set(cacheKey, {
        ...cached,
        edges: updater(cached.edges),
      });

      return { cache: newCache };
    });
  },

  // Collaborator actions
  setCollaborator: (userId, state) => {
    set((s) => {
      const next = new Map(s.activeCollaborators);
      next.set(userId, state);
      return { activeCollaborators: next };
    });
  },

  removeCollaborator: (userId) => {
    set((s) => {
      const next = new Map(s.activeCollaborators);
      next.delete(userId);
      return { activeCollaborators: next };
    });
  },

  clearCollaborators: () => {
    set({ activeCollaborators: new Map() });
  },
}));

// Helper to transform raw API data to React Flow format
export function transformNodesToFlowFormat(
  nodesData: Array<CallNode & { position_x?: number; position_y?: number; topic_group_id?: string | null }>
): { nodes: TransformedNode[]; edges: Edge[] } {
  const flowNodes: TransformedNode[] = nodesData.map((nodeData) => ({
    id: nodeData.id,
    type: "scriptNode",
    position: {
      x: nodeData.position_x || 0,
      y: nodeData.position_y || 0,
    },
    data: {
      callNode: nodeData,
      topicGroupId: nodeData.topic_group_id || null,
    },
  }));

  const flowEdges: Edge[] = [];
  const nodeIds = new Set(nodesData.map((n) => n.id));

  nodesData.forEach((nodeData) => {
    nodeData.responses.forEach((response, index) => {
      if (!nodeIds.has(response.nextNode)) {
        console.warn(`[ScriptEditor] Orphan edge: ${nodeData.id} -> ${response.nextNode} (target missing)`);
        return;
      }
      flowEdges.push({
        id: `${nodeData.id}-${response.nextNode}-${index}`,
        source: nodeData.id,
        target: response.nextNode,
        label: response.label,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      });
    });
  });

  return { nodes: flowNodes, edges: flowEdges };
}

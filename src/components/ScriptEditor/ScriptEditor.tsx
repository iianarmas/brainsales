"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  Connection,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowInstance,
  OnSelectionChangeParams,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { X, Save, Download, Loader2, Users, GitFork, Upload, ArrowUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CallNode } from "@/data/callFlow";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";
import ScriptNode from "./nodes/ScriptNode";
import NodeEditPanel from "./NodeEditPanel";
import EditorToolbar from "./EditorToolbar";
import NodeLibrary from "./NodeLibrary";
import { autoLayoutNodes } from "./utils/autoLayout";
import { validateFlow, getValidationSummary } from "./utils/validateFlow";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import ImportOptionsModal from "./ImportOptionsModal";
import VersionHistoryModal from "./VersionHistoryModal";
import { useEditorHistory, HistoryCommand } from "./hooks/useEditorHistory";
import { SelectionAutoPan } from "./hooks/useSelectionAutoPan";
import HeatmapOverlay from "./HeatmapOverlay";
import ViewToggle from "./ViewToggle";
import EditorTabs, { type EditorTab } from "./EditorTabs";
import { usePresence } from "@/hooks/usePresence";
import { LoadingScreen } from "@/components/LoadingScreen";
import type { EditorView } from "@/app/admin/scripts/page";
import { useScriptEditorStore, TransformedNode as StoreTransformedNode } from "@/store/scriptEditorStore";
import { useScriptEditorData, useTopics } from "@/hooks/useScriptEditorData";
import { useRealtimeNodeSync } from "@/hooks/useRealtimeNodeSync";

const nodeTypes = {
  scriptNode: ScriptNode as any, // Type assertion to avoid React Flow type conflicts
};

interface ScriptEditorProps {
  onClose: () => void;
  view: EditorView;
  onViewChange: (view: EditorView) => void;
  productId?: string;
  isReadOnly?: boolean;
  isAdmin?: boolean;
}

interface TransformedNode extends Node {
  data: {
    callNode: CallNode;
    topicGroupId: string | null;
    onDelete?: (id: string, title: string) => void;
    isHighlighted?: boolean;
    topics?: any[]; // Pass topics through node data if needed, or just context
  };
}

export default function ScriptEditor({ onClose, view, onViewChange, productId, isReadOnly = false, isAdmin = false }: ScriptEditorProps) {
  const { session } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState<TransformedNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<CallNode | null>(null);
  const [isNewNode, setIsNewNode] = useState(false);
  const [unsavedNodeIds, setUnsavedNodeIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Use shared store for activeTab
  const { activeTab, setActiveTab, invalidateCache, getCacheKey } = useScriptEditorStore();

  // Use shared data hook for fetching with caching
  const {
    nodes: cachedNodes,
    edges: cachedEdges,
    loading,
    error,
    refetch,
  } = useScriptEditorData({ productId, staleTime: 30000, refetchOnFocus: false });

  // Fetch topics using shared hook
  const topics = useTopics(productId);
  const edgesRef = useRef<Edge[]>([]);

  // Keep edgesRef in sync with edges state
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Sync cached data to local React Flow state when cache or tab changes
  useEffect(() => {
    // Always sync when activeTab changes (even if empty, to clear old data)
    setNodes(cachedNodes as TransformedNode[]);
    setEdges(cachedEdges);
  }, [cachedNodes, cachedEdges, setNodes, setEdges, activeTab]);

  // Determine effective read-only state based on tab (must be defined before useRealtimeNodeSync)
  const effectiveReadOnly = useMemo(() => {
    if (activeTab === "official") return isReadOnly || !isAdmin;
    if (activeTab === "sandbox") return false; // User can always edit their own sandbox
    if (activeTab === "community") return true; // Community is read-only on canvas
    return isReadOnly;
  }, [activeTab, isReadOnly, isAdmin]);

  // Real-time collaboration: sync node positions across users
  const {
    broadcastPosition,
    broadcastPositionBatch,
    broadcastNodeAdded,
    broadcastNodeDeleted,
    broadcastNodeUpdated,
    broadcastEdgeAdded,
    broadcastEdgeDeleted,
    broadcastNodeFocus,
    activeCollaborators,
    isConnected: isRealtimeConnected,
  } = useRealtimeNodeSync({
    productId,
    enabled: !!session?.access_token, // Enable whenever authenticated to see updates
    onPositionUpdate: useCallback((nodeId: string, position: { x: number; y: number }) => {
      // Update local React Flow state when receiving remote position updates
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? { ...node, position } : node
        )
      );
    }, [setNodes]),
    onNodeAdded: useCallback((node: any) => {
      setNodes((nds) => [...nds, node]);
    }, [setNodes]),
    onNodeDeleted: useCallback((nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    }, [setNodes, setEdges]),
    onNodeUpdated: useCallback((nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, callNode: data } } : n))
      );
    }, [setNodes]),
    onEdgeAdded: useCallback((edge: any) => {
      setEdges((eds) => addEdge(edge, eds));
    }, [setEdges]),
    onEdgeDeleted: useCallback((edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    }, [setEdges]),
  });

  // Get the API base URL for node CRUD based on active tab
  const getApiBaseUrl = useCallback(() => {
    if (activeTab === "sandbox") return "/api/scripts/sandbox/nodes";
    if (activeTab === "community") return "/api/scripts/community/nodes";
    return "/api/admin/scripts/nodes";
  }, [activeTab]);

  // Refresh data by invalidating cache and optionally refetching
  const refreshData = useCallback(async (targetTab?: EditorTab) => {
    const tabToRefresh = targetTab || activeTab;
    const cacheKey = getCacheKey(); // This gets the current cache key based on activeTab and productId

    // If refreshing a different tab, we need to construct its key
    const targetKey = targetTab
      ? `${productId || "default"}:${targetTab}`
      : cacheKey;

    invalidateCache(targetKey);

    // If the invalidated tab is the current one, trigger refetch to update UI
    if (tabToRefresh === activeTab) {
      await refetch();
    }
  }, [activeTab, getCacheKey, invalidateCache, productId, refetch]);

  // Handle tab changes: clear selection (data hook handles fetching via cache)
  const handleTabChange = useCallback((tab: EditorTab) => {
    setActiveTab(tab);
    setSelectedNode(null);
    setIsNewNode(false);
    setUnsavedNodeIds(new Set());
    // No need to manually trigger refetch - the data hook reacts to activeTab changes
    // and uses smart caching (only refetches if cache is stale)
  }, [setActiveTab]);
  const [activeAdmins, setActiveAdmins] = useState<Array<{
    user_id: string;
    email: string;
    profiles: {
      first_name: string | null;
      last_name: string | null;
      profile_picture_url: string | null;
    } | null;
  }>>([]);
  const [edgeReconnectSuccessful, setEdgeReconnectSuccessful] = useState(true);
  const [searchState, setSearchState] = useState<{ term: string; index: number }>({ term: "", index: 0 });
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [bulkForkLoading, setBulkForkLoading] = useState(false);
  const [bulkPromoteLoading, setBulkPromoteLoading] = useState(false);

  // Track user presence
  usePresence();

  // History hook
  const { execute, undo, redo, canUndo, canRedo } = useEditorHistory();

  // Note: Auto-pan is enabled via SelectionAutoPan component rendered inside ReactFlow

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Presence Subscription
  useEffect(() => {
    const fetchPresence = async () => {
      if (!session?.access_token) return;

      try {
        const response = await fetch("/api/admin/online-users", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setActiveAdmins(data);
        } else if (response.status === 403) {
          // User is not authorized to view online admins, silently ignore
          console.debug("Not authorized to view online admins");
        } else {
          console.error("Failed to fetch presence from API");
        }
      } catch (err) {
        console.error("Error fetching presence from API:", err);
      }
    };

    fetchPresence();

    const subscription = supabase
      .channel("presence-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        () => fetchPresence()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [session?.access_token]);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    nodeId: string | null;
    nodeIds?: string[];
    nodeTitle: string;
    connectionCount: number;
    isDeleting: boolean;
    count?: number;
  }>({
    isOpen: false,
    nodeId: null,
    nodeTitle: "",
    connectionCount: 0,
    isDeleting: false,
    count: 1,
  });

  // Import modal state
  const [importModal, setImportModal] = useState<{
    isOpen: boolean;
    data: any | null;
    fileName: string;
  }>({
    isOpen: false,
    data: null,
    fileName: "",
  });

  // Note: Data fetching is now handled by useScriptEditorData hook with smart caching
  // No need for fetchKey or manual fetch useEffect - the hook handles:
  // - Initial fetch
  // - Tab changes (via activeTab dependency)
  // - Smart caching (30s stale time)
  // - No refetch on view switch if cache is fresh

  // Note: Topics are now fetched by useTopics hook

  // Handle connection creation
  const onConnect = useCallback(
    async (connection: Connection) => {
      const sourceNodeId = connection.source;
      const targetNodeId = connection.target;

      if (effectiveReadOnly) return;
      if (!sourceNodeId || !targetNodeId || !session?.access_token) return;

      // 1. Update UI edges
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          },
          eds
        )
      );

      // 2. Sync with node data model
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (sourceNode) {
        const updatedCallNode = {
          ...sourceNode.data.callNode,
          responses: [
            ...(sourceNode.data.callNode.responses || []),
            {
              label: "Next", // Default label
              nextNode: targetNodeId,
            }
          ]
        };

        // 3. Persist to backend
        try {
          const apiBase = activeTab === "sandbox" ? "/api/scripts/sandbox/nodes" : "/api/admin/scripts/nodes";
          const response = await fetch(`${apiBase}/${sourceNodeId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(updatedCallNode),
          });

          if (!response.ok) throw new Error("Failed to save connection");

          // Broadcast edge addition
          const newEdge: Edge = {
            id: `${sourceNodeId}-${targetNodeId}-${(sourceNode.data.callNode.responses || []).length}`,
            source: sourceNodeId,
            target: targetNodeId,
            label: "Next",
            markerEnd: { type: MarkerType.ArrowClosed },
          };
          broadcastEdgeAdded(newEdge);

          // Update local state
          setNodes((nds) =>
            nds.map((n) =>
              n.id === sourceNodeId
                ? { ...n, data: { ...n.data, callNode: updatedCallNode } }
                : n
            )
          );
          toast.success("Connection saved");
        } catch (err) {
          console.error("Error saving connection:", err);
          toast.error("Failed to save connection");
        }
      }
    },
    [setEdges, nodes, session, setNodes, effectiveReadOnly, activeTab]
  );

  // Handle edge removal from data model
  const removeEdgeFromModel = useCallback(
    async (edge: Edge) => {
      if (isReadOnly) return;
      if (!session?.access_token) return;

      const sourceNodeId = edge.source;
      const targetNodeId = edge.target;

      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (sourceNode) {
        const responses = sourceNode.data.callNode.responses;

        // Extract the response index from the edge ID (format: sourceId-targetId-index)
        const edgeIdParts = edge.id.split("-");
        const edgeIndex = parseInt(edgeIdParts[edgeIdParts.length - 1], 10);

        // Use the index from the edge ID if valid, otherwise fall back to findIndex
        let responseIndex: number;
        if (!isNaN(edgeIndex) && edgeIndex < responses.length && responses[edgeIndex]?.nextNode === targetNodeId) {
          responseIndex = edgeIndex;
        } else {
          responseIndex = responses.findIndex(r => r.nextNode === targetNodeId);
        }

        if (responseIndex !== -1) {
          const updatedResponses = [...responses];
          updatedResponses.splice(responseIndex, 1);

          const updatedCallNode = {
            ...sourceNode.data.callNode,
            responses: updatedResponses
          };

          try {
            const edgeApiBase = activeTab === "sandbox" ? "/api/scripts/sandbox/nodes" : "/api/admin/scripts/nodes";
            const response = await fetch(`${edgeApiBase}/${sourceNodeId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify(updatedCallNode),
            });

            if (!response.ok) throw new Error("Failed to sync edge removal");

            // Broadcast edge removal
            broadcastEdgeDeleted(edge.id);

            setNodes((nds) =>
              nds.map((n) =>
                n.id === sourceNodeId
                  ? { ...n, data: { ...n.data, callNode: updatedCallNode } }
                  : n
              )
            );
            toast.success("Connection removed");
          } catch (err) {
            console.error("Error removing connection:", err);
            toast.error("Failed to sync connection removal");
          }
        }
      }
    },
    [nodes, session, setNodes, activeTab, isReadOnly]
  );

  // Handle edge reconnection
  const onReconnectStart = useCallback(() => {
    setEdgeReconnectSuccessful(false);
  }, []);

  const onReconnect = useCallback(
    async (oldEdge: Edge, newConnection: Connection) => {
      if (isReadOnly) return;
      setEdgeReconnectSuccessful(true);

      // 1. Remove old connection from model if source/target changed
      // (Actually reconnecting usually implies the edge ID might change or we just update it)
      // In React Flow, reconnectEdge replaces the edge in the state.

      // We'll treat reconnection as a deletion of the old and addition of the new for the data model
      if (oldEdge.target !== newConnection.target || oldEdge.source !== newConnection.source) {
        await removeEdgeFromModel(oldEdge);

        // setEdges is handled by reconnectEdge usually, but we need to trigger onConnect logic for the new one
        // or just call setEdges here and sync.
        setEdges((els) => reconnectEdge(oldEdge, newConnection, els));

        // Sync new connection
        onConnect(newConnection);
      }
    },
    [onConnect, removeEdgeFromModel, setEdges, isReadOnly]
  );

  const onReconnectEnd = useCallback(
    async (_: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeReconnectSuccessful) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        await removeEdgeFromModel(edge);
      }
    },
    [edgeReconnectSuccessful, removeEdgeFromModel, setEdges]
  );

  // Handle edge click to delete
  const onEdgeClick = useCallback(
    async (_: React.MouseEvent, edge: Edge) => {
      if (isReadOnly) return;
      const label = edge.label ? ` "${edge.label}"` : "";
      if (window.confirm(`Remove this connection${label} from "${edge.source}" to "${edge.target}"?`)) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        await removeEdgeFromModel(edge);
      }
    },
    [removeEdgeFromModel, setEdges, isReadOnly]
  );

  // Validate connection
  const isValidConnection = useCallback(
    (connection: Edge | Connection) => {
      // 1. No self-connections
      if (connection.source === connection.target) return false;

      // 2. No duplicate connections
      const isDuplicate = edges.some(
        (edge) =>
          edge.source === connection.source &&
          edge.target === connection.target &&
          edge.sourceHandle === connection.sourceHandle
      );

      if (isDuplicate) return false;

      return true;
    },
    [edges]
  );

  // Handle delete request
  const handleDeleteNode = useCallback(
    (id: string, title: string) => {
      if (effectiveReadOnly) return;
      const connections = edgesRef.current.filter((e) => e.source === id || e.target === id);
      setDeleteModal({
        isOpen: true,
        nodeId: id,
        nodeTitle: title,
        connectionCount: connections.length,
        isDeleting: false,
        count: 1,
      });
    },
    [effectiveReadOnly]
  );

  // Handle Bulk Delete Request
  const handleBulkDelete = useCallback(() => {
    if (effectiveReadOnly || selectedNodeIds.length === 0) return;

    // Calculate total connections for all selected nodes
    // We only care about edges extending OUTSIDE the selection or INTO the selection from OUTSIDE
    // Internal edges within the selection will be deleted naturally
    /* 
       Actually, simple count of all edges connected to these nodes is a decent proxy for "impact", 
       even if some are internal.
    */
    const connectedEdges = edges.filter(
      (e) => selectedNodeIds.includes(e.source) || selectedNodeIds.includes(e.target)
    );

    setDeleteModal({
      isOpen: true,
      nodeId: null,
      nodeIds: selectedNodeIds,
      nodeTitle: `${selectedNodeIds.length} Nodes`,
      connectionCount: connectedEdges.length,
      isDeleting: false,
      count: selectedNodeIds.length,
    });
  }, [edges, effectiveReadOnly, selectedNodeIds]);

  // Execute delete (Handles both single and bulk)
  const confirmDelete = async () => {
    const { nodeId, nodeIds } = deleteModal;
    if ((!nodeId && (!nodeIds || nodeIds.length === 0)) || !session?.access_token) return;

    // Normalize input to array
    const targets = nodeIds && nodeIds.length > 0 ? nodeIds : [nodeId!];
    const isBulk = targets.length > 1;

    // Get nodes data for undo
    // Capture snapshot of nodes and edges before deletion
    const nodesToDelete = nodes.filter(n => targets.includes(n.id));
    const edgesToDelete = edges.filter(e => targets.includes(e.source) || targets.includes(e.target));
    const edgesToUpdateParent = edgesToDelete.filter(e => targets.includes(e.target) && !targets.includes(e.source));

    // Identify unsaved nodes (created but not persisted to DB)
    const unsavedTargets = new Set(targets.filter(id => unsavedNodeIds.has(id)));
    const persistedTargets = targets.filter(id => !unsavedNodeIds.has(id));

    const deleteCommand: HistoryCommand = {
      name: isBulk ? `Delete ${targets.length} Nodes` : `Delete ${deleteModal.nodeTitle}`,
      redo: async () => {
        // 1. Update Parents (remove references to deleted nodes)
        // Group by parent to minimize updates
        const parentUpdates = new Map<string, CallNode>();

        // We only need to update parents that are NOT being deleted themselves
        for (const edge of edgesToUpdateParent) {
          if (targets.includes(edge.source)) continue; // Source is also being deleted, no need to update it

          let parentNode = parentUpdates.get(edge.source);
          if (!parentNode) {
            const node = nodes.find(n => n.id === edge.source);
            if (node) parentNode = { ...node.data.callNode };
          }

          if (parentNode) {
            // Remove response pointing to a deleted node
            parentNode.responses = parentNode.responses.filter(r => !targets.includes(r.nextNode));
            parentUpdates.set(edge.source, parentNode);
          }
        }

        // Apply parent updates to DB
        const apiBase = activeTab === "sandbox" ? "/api/scripts/sandbox/nodes" : "/api/admin/scripts/nodes";

        for (const [parentId, updatedCallNode] of Array.from(parentUpdates.entries())) {
          await fetch(`${apiBase}/${parentId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(updatedCallNode),
          });
        }

        // Update local state for parents
        setNodes((nds) =>
          nds.map((n) => {
            const updated = parentUpdates.get(n.id);
            return updated ? { ...n, data: { ...n.data, callNode: updated } } : n;
          })
        );

        // 2. Delete persisted nodes from DB
        if (persistedTargets.length > 0) {
          // We can optimize this if there was a bulk delete endpoint, but for now we loop
          // or we use Promise.all to speed it up
          const deletePromises = persistedTargets.map(id =>
            fetch(`${apiBase}/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${session!.access_token}` },
            })
          );
          await Promise.all(deletePromises);
        }

        // 3. Update State
        setNodes((nds) => nds.filter((n) => !targets.includes(n.id)));
        setEdges((eds) => eds.filter((e) => !targets.includes(e.source) && !targets.includes(e.target)));

        // Broadcast deletions
        targets.forEach(id => broadcastNodeDeleted(id));

        if (selectedNode && targets.includes(selectedNode.id)) setSelectedNode(null);
        if (selectedNodeIds.some(id => targets.includes(id))) setSelectedNodeIds([]); // Clear selection

        // Remove from unsaved set
        if (unsavedTargets.size > 0) {
          setUnsavedNodeIds((prev) => {
            const next = new Set(prev);
            unsavedTargets.forEach(id => next.delete(id));
            return next;
          });
        }
      },
      undo: async () => {
        const apiBase = activeTab === "sandbox" ? "/api/scripts/sandbox/nodes" : "/api/admin/scripts/nodes";

        // Restore persisted nodes
        const nodesToRestore = nodesToDelete.filter(n => !unsavedNodeIds.has(n.id));

        if (nodesToRestore.length > 0) {
          const restorePromises = nodesToRestore.map(node =>
            fetch(apiBase, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session!.access_token}`,
              },
              body: JSON.stringify({
                ...node.data.callNode,
                position_x: node.position.x,
                position_y: node.position.y,
                topic_group_id: node.data.topicGroupId
              }),
            })
          );
          await Promise.all(restorePromises);
        }

        // Re-mark unsaved nodes
        const nodesToResave = nodesToDelete.filter(n => unsavedNodeIds.has(n.id));
        if (nodesToResave.length > 0) {
          setUnsavedNodeIds((prev) => {
            const next = new Set(prev);
            nodesToResave.forEach(n => next.add(n.id));
            return next;
          });
        }

        // Restore parent references (reverse of update)
        // We'd need to re-add the responses. 
        // For simplicity in undo, we can just fetch the *original* parent state from our captured edges/nodes snapshot? 
        // Actually, we modified the parent in the DB, so we must revert that change in DB too.

        // We need the original parents.
        // Let's find them from current 'nodes' (before redo executes, 'nodes' has original state... 
        // wait, inside undo, 'nodes' is the *new* state without deleted items).
        // BUT 'nodes' variable in closure is stale? No, it's from render scope...
        // Actually, simple undo strategy: We have specific edges to restore.
        // We can just restore the specific edges to the parents.

        // Let's be robust: 
        // We know what edges we deleted: `edgesToUpdateParent`
        // We iterate these and add the response back to the parent.

        const parentRestores = new Map<string, CallNode>();
        // We need to fetch current state of parents from server or assume local is synced?
        // Better to re-fetch or use what we know.

        // Actually, we can just rely on the fact that we have the *complete* previous state in `edgesToUpdateParent`.
        // BUT we need the parent node object to patch.
        // The parent node is still in `nodes` (since we filtered it out of `nodesToDelete`).
        // Wait, `nodes` in `undo` will be the state *after* delete.
        // So we can find the parent there.

        // Wait, `execute` executes immediately. The closure captures `nodes` at the time of `confirmDelete` call.
        // So `nodes` inside `redo/undo` refers to the scope when `confirmDelete` was called (i.e., BEFORE delete).
        // Correct. `nodesToDelete` is captured from `nodes` before delete.

        // So inside `undo`:
        // We need to restore `nodesToDelete` -> simple.
        // We need to revert changes to `parentUpdates`.
        // We can iterate `parentUpdates` (captured in redo? No, move it up).

        // Let's refine the scope.
        // I'll move `parentUpdates` logic outside redo so it's captured.

        // Re-implementing logic with proper scope capture is tricky with inline redo/undo.
        // For now, let's keep it simple and safe: Re-fetch parent logic is complex. 
        // Let's just restore the specific missing links.

        for (const edge of edgesToDelete) {
          // If source is restored, and target is restored, the edge in ReactFlow will just appear if we add it to `edges`.
          // But the *data* in the parent (source) 'responses' array needs to be fixed in DB.
          // If the source was deleted, restoring the node (POST) *should* include its responses if we send them. 
          // Yes, `node.data.callNode` has the responses. So restoring the deleted node restores its outgoing edges in DB!
          // SO we only need to worry about edges where source was NOT deleted (i.e. parents of deleted nodes).
        }

        const parentsToRevert = new Set<string>();
        edgesToUpdateParent.forEach(e => parentsToRevert.add(e.source));

        for (const parentId of Array.from(parentsToRevert)) {
          // Find original parent state from the captured `nodes`.
          const originalParent = nodes.find(n => n.id === parentId);
          if (originalParent) {
            await fetch(`${apiBase}/${parentId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session!.access_token}`,
              },
              body: JSON.stringify(originalParent.data.callNode), // Revert to original
            });
          }
        }

        // Restore Client State
        setNodes((nds) => {
          // Restore deleted nodes
          const restored = [...nds, ...nodesToDelete];
          // Revert modified parents
          return restored.map(n => {
            const original = nodes.find(orig => orig.id === n.id);
            return original ? original : n;
          });
        });
        setEdges((eds) => [...eds, ...edgesToDelete]);
      }
    };

    try {
      setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
      await execute(deleteCommand);
      setDeleteModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      console.error("Error deleting node(s):", err);
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  // Recompute edges whenever node responses change
  // Build a stable key from response data to avoid infinite loops
  // (nodes reference changes on every render due to the delete handler effect)
  const responsesKey = useMemo(
    () =>
      nodes
        .map((n) =>
          `${n.id}:${(n.data.callNode.responses || []).map((r) => `${r.label}>${r.nextNode}`).join(",")}`
        )
        .join("|"),
    [nodes]
  );

  useEffect(() => {
    const newEdges: Edge[] = [];
    nodes.forEach((node) => {
      const responses = node.data.callNode.responses || [];
      responses.forEach((response, index) => {
        if (response.nextNode) {
          newEdges.push({
            id: `${node.id}-${response.nextNode}-${index}`,
            source: node.id,
            target: response.nextNode,
            label: response.label,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          });
        }
      });
    });
    setEdges(newEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responsesKey, setEdges]);

  // Update nodes with delete handler when nodes or handler changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          onDelete: handleDeleteNode,
        }
      }))
    );
  }, [handleDeleteNode, setNodes]);

  // Handle node selection
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const transformedNode = node as TransformedNode;
      setSelectedNode(transformedNode.data.callNode);
      setIsNewNode(false);

      // Broadcast focus
      broadcastNodeFocus(node.id);
    },
    [broadcastNodeFocus]
  );

  // Handle node deselection
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setIsNewNode(false);

    // Broadcast clear focus
    broadcastNodeFocus(null);
  }, [broadcastNodeFocus]);

  // Handle node drag - broadcast position changes for real-time collaboration
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
      if (effectiveReadOnly) return;
      if (draggedNodes.length > 1) {
        broadcastPositionBatch(
          draggedNodes.map((n) => ({ nodeId: n.id, position: n.position }))
        );
      } else {
        broadcastPosition(node.id, node.position);
      }
    },
    [effectiveReadOnly, broadcastPosition, broadcastPositionBatch]
  );

  // Handle node drag end - broadcast final positions
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
      if (effectiveReadOnly) return;
      if (draggedNodes.length > 1) {
        broadcastPositionBatch(
          draggedNodes.map((n) => ({ nodeId: n.id, position: n.position }))
        );
      } else {
        broadcastPosition(node.id, node.position);
      }
    },
    [effectiveReadOnly, broadcastPosition, broadcastPositionBatch]
  );

  // Track multi-selection via React Flow's native Shift+click / drag-select
  const onSelectionChange = useCallback(({ nodes: selectedNodes }: OnSelectionChangeParams) => {
    setSelectedNodeIds(selectedNodes.map((n) => n.id));
  }, []);

  // Bulk fork selected nodes to sandbox
  const handleBulkFork = useCallback(async () => {
    if (!session?.access_token || selectedNodeIds.length === 0) return;
    setBulkForkLoading(true);
    try {
      const response = await fetch("/api/scripts/sandbox/fork", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(productId ? { "X-Product-Id": productId } : {}),
        },
        body: JSON.stringify({ nodeIds: selectedNodeIds }),
      });
      if (!response.ok) throw new Error("Failed to fork nodes");
      const data = await response.json();
      const count = Object.keys(data.mapping).length;
      toast.success(`${count} node(s) forked to sandbox`);

      // Refresh sandbox data so it's ready when user switches tabs
      await refreshData("sandbox");
    } catch (err) {
      toast.error("Failed to bulk fork nodes");
    } finally {
      setBulkForkLoading(false);
    }
  }, [session, selectedNodeIds, productId, refreshData]);

  // Bulk publish selected sandbox nodes to community
  const handleBulkPublish = useCallback(async () => {
    if (!session?.access_token || selectedNodeIds.length === 0) return;
    setBulkPromoteLoading(true); // Reusing promote loading state for publish as they are similar contextually or add a new one if very strict
    try {
      const response = await fetch("/api/scripts/community/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(productId ? { "X-Product-Id": productId } : {}),
        },
        body: JSON.stringify({ nodeIds: selectedNodeIds }),
      });
      if (!response.ok) throw new Error("Failed to publish nodes");
      const data = await response.json();
      toast.success(data.message);

      // Refresh community and sandbox data
      await refreshData("community");
      await refreshData("sandbox");
    } catch (err) {
      toast.error("Failed to bulk publish nodes");
    } finally {
      setBulkPromoteLoading(false);
    }
  }, [session, selectedNodeIds, productId, refreshData]);

  // Bulk promote selected community nodes to official (admin only)
  const handleBulkPromote = useCallback(async () => {
    if (!session?.access_token || selectedNodeIds.length === 0) return;
    setBulkPromoteLoading(true);
    try {
      // Use the new bulk promote endpoint logic
      const response = await fetch("/api/scripts/community/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(productId ? { "X-Product-Id": productId } : {}),
        },
        body: JSON.stringify({ nodeIds: selectedNodeIds }), // Send array of IDs
      });

      if (!response.ok) throw new Error("Failed to promote nodes");

      const data = await response.json();
      toast.success(data.message);

      // Refresh official and community data
      await refreshData("official");
      await refreshData("community");

    } catch (err) {
      console.error(err);
      toast.error("Failed to bulk promote nodes");
    } finally {
      setBulkPromoteLoading(false);
    }
  }, [session, selectedNodeIds, productId, refreshData]);

  // Handle save
  const handleSave = async () => {
    if (!session?.access_token) {
      toast.error("Not authenticated");
      return;
    }

    try {
      setSaving(true);

      const apiBase = getApiBaseUrl();
      const apiHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      };
      if (productId) apiHeaders["X-Product-Id"] = productId;

      // 1. Persist all unsaved nodes first
      if (unsavedNodeIds.size > 0) {
        const unsavedIds = Array.from(unsavedNodeIds);
        const savePromises = unsavedIds.map(async (id) => {
          const node = nodes.find(n => n.id === id);
          if (!node) return;

          const response = await fetch(apiBase, {
            method: "POST",
            headers: apiHeaders,
            body: JSON.stringify({
              ...node.data.callNode,
              position_x: node.position.x,
              position_y: node.position.y,
              topic_group_id: (node.data.callNode as any).topic_group_id || node.data.callNode.type,
              product_id: productId,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to save node ${id}: ${errorData.error || response.statusText}`);
          }
        });

        await Promise.all(savePromises);

        // Clear unsaved IDs since they are now persisted
        setUnsavedNodeIds(new Set());
      }

      // 2. Prepare position updates for all nodes
      const positionUpdates = nodes.map((node) => ({
        id: node.id,
        position_x: node.position.x,
        position_y: node.position.y,
      }));

      // 3. Save positions
      const positionsUrl = activeTab === "sandbox" ? "/api/scripts/sandbox/positions" : "/api/admin/scripts/positions";
      const positionsResponse = await fetch(positionsUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(productId ? { "X-Product-Id": productId } : {}),
        },
        body: JSON.stringify({ positions: positionUpdates }),
      });

      if (!positionsResponse.ok) {
        throw new Error("Failed to save node positions");
      }

      // Refetch data to ensure everything is in sync without clearing the UI
      await refetch();

      // Show success message
      toast.success("Changes saved successfully!");
    } catch (err) {
      console.error("Error saving:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Handle auto-layout
  const handleAutoLayout = useCallback(() => {
    const layoutedNodes = autoLayoutNodes(nodes, edges) as TransformedNode[];
    setNodes(layoutedNodes);

    // Broadcast all new positions for real-time collaboration
    if (!effectiveReadOnly) {
      const positions = layoutedNodes.map((node) => ({
        nodeId: node.id,
        position: node.position,
      }));
      broadcastPositionBatch(positions);
    }
  }, [nodes, edges, setNodes, effectiveReadOnly, broadcastPositionBatch]);

  // Handle validation
  const handleValidate = useCallback(() => {
    const errors = validateFlow(nodes, edges);
    const summary = getValidationSummary(errors);

    if (errors.length === 0) {
      toast.success("✅ Flow validation passed! No errors or warnings found.");
    } else {
      const errorMessages = errors
        .map((e) => `${e.type.toUpperCase()}: ${e.message}`)
        .join("\n");
      toast.error("Validation failed", {
        description: `Errors: ${summary.errorCount}, Warnings: ${summary.warningCount}`,
      });
      // Keeping alert for detailed view if needed, or could use a modal/dialog
      alert(
        `Validation Results:\n\n${errorMessages}\n\nSummary:\n- Errors: ${summary.errorCount}\n- Warnings: ${summary.warningCount}`
      );
    }
  }, [nodes, edges]);

  // Handle export
  const handleExport = useCallback(() => {
    // Export nodes to JSON file
    const exportData = {
      nodes: nodes.map((n) => ({
        ...n.data.callNode,
        position_x: n.position.x,
        position_y: n.position.y,
        topic_group_id: n.data.topicGroupId,
      })),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `callflow-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes]);

  // Handle import file selection
  const handleImportClick = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: any) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Basic validation
        if (!data.nodes || !Array.isArray(data.nodes)) {
          throw new Error("Invalid file format: 'nodes' array is missing");
        }

        setImportModal({
          isOpen: true,
          data: data,
          fileName: file.name,
        });

      } catch (err) {
        console.error("Error reading file:", err);
        toast.error("Failed to read file: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    };
    input.click();
  }, []);

  // Execute import
  const [importLoading, setImportLoading] = useState(false);
  const executeImport = async (strategy: "merge" | "overwrite") => {
    if (!importModal.data || !session?.access_token) return;

    try {
      setImportLoading(true); // Show loading
      setImportModal(prev => ({ ...prev, isOpen: false })); // Close modal

      const response = await fetch("/api/admin/scripts/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nodes: importModal.data.nodes,
          strategy,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Import failed");
      }

      const result = await response.json();
      toast.success(`Import successful! ${result.count} nodes processed.`);

      // Invalidate all cache and reload to reflect changes
      invalidateCache();
      window.location.reload();

    } catch (err) {
      console.error("Import error:", err);
      toast.error(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setImportLoading(false);
    }
  };

  // Handle Search
  const handleSearch = useCallback(
    (term: string) => {
      if (!term) {
        setSearchState({ term: "", index: 0 });
        setNodes((nds) =>
          nds.map((node) => ({
            ...node,
            data: { ...node.data, isHighlighted: false },
          }))
        );
        return;
      }

      const matchingNodes = nodes.filter((node) =>
        node.data.callNode.title.toLowerCase().includes(term.toLowerCase()) ||
        node.data.callNode.script.toLowerCase().includes(term.toLowerCase())
      );

      if (matchingNodes.length > 0) {
        const isSameTerm = term.toLowerCase() === searchState.term.toLowerCase();
        const nextIndex = isSameTerm ? (searchState.index + 1) % matchingNodes.length : 0;
        const matchingNode = matchingNodes[nextIndex];

        setSearchState({ term, index: nextIndex });

        // Update node highlights
        setNodes((nds) =>
          nds.map((node) => ({
            ...node,
            data: {
              ...node.data,
              isHighlighted: node.id === matchingNode.id,
            },
          }))
        );

        if (reactFlowInstance) {
          reactFlowInstance.fitView({
            nodes: [{ id: matchingNode.id }],
            duration: 800,
            padding: 0.5,
          });
        }
        setSelectedNode(matchingNode.data.callNode);
      } else {
        setSearchState({ term, index: 0 });
        setNodes((nds) =>
          nds.map((node) => ({
            ...node,
            data: { ...node.data, isHighlighted: false },
          }))
        );
      }
    },
    [nodes, reactFlowInstance, searchState, setNodes]
  );

  // Handle Drag & Drop
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (typeof type === "undefined" || !type || !reactFlowInstance || !session?.access_token) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Generate a meaningful ID from type + title
      const prefixMap: Record<string, string> = {
        opening: "opening", discovery: "disc", pitch: "pitch",
        objection: "obj", close: "close", success: "success", end: "end"
      };
      const prefix = prefixMap[type] || type;
      const defaultTitle = `New ${type.charAt(0).toUpperCase() + type.slice(1)} Node`;
      const slug = defaultTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").substring(0, 40);
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      let newNodeId = `${prefix}_${slug}_${randomSuffix}`;
      const existingIds = new Set(nodes.map((n) => n.id));
      if (existingIds.has(newNodeId)) {
        let counter = 2;
        while (existingIds.has(`${newNodeId}_${counter}`)) counter++;
        newNodeId = `${newNodeId}_${counter}`;
      }

      const newNodeData: Partial<CallNode> = {
        id: newNodeId,
        type: type as any,
        title: defaultTitle,
        script: "",
        responses: [],
        topic_group_id: type, // Default to node type
        ...(productId ? { product_id: productId } : {}), // Add product_id
      };

      // Only add to local state — the node will be persisted when the user saves it
      const newNode: TransformedNode = {
        id: newNodeId,
        type: "scriptNode",
        position,
        data: {
          callNode: newNodeData as CallNode,
          topicGroupId: type as string,
          onDelete: handleDeleteNode,
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNode(newNodeData as CallNode);
      setIsNewNode(true);
      setUnsavedNodeIds((prev) => new Set(prev).add(newNodeId));

      // Broadcast new node
      broadcastNodeAdded(newNode);
    },
    [reactFlowInstance, session, setNodes, execute, handleDeleteNode, selectedNode, broadcastNodeAdded]
  );

  if (loading || importLoading) {
    return <LoadingScreen message={importLoading ? "Importing nodes..." : "Loading script editor..."} />;
  }

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary-light/20">
        <div className="flex items-center gap-3">
          <Image src="/assets/images/icon_transparent_bg.png" alt="BrainSales Icon" width={32} height={32} className="rounded-md" />
          <h2 className="text-xl font-bold text-primary">Script Editor</h2>
          {saving && (
            <span className="flex items-center gap-2 text-sm text-primary font-medium animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving changes...
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <EditorTabs activeTab={activeTab} onTabChange={handleTabChange} isAdmin={isAdmin} />
          <ViewToggle view={view} onViewChange={onViewChange} />
        </div>

        <div className="flex items-center gap-6">
          {/* Presence Indicator */}
          {activeAdmins.length > 0 && (
            <div className="flex items-center -space-x-2">
              <div className="flex items-center gap-1.5 mr-3 px-2 py-1 bg-muted rounded-full text-xs font-medium text-green-500">
                <Users className="h-3 w-3" />
                <span>{activeAdmins.length} Online</span>
              </div>
              {activeAdmins.slice(0, 5).map((admin) => {
                const initials = admin.profiles?.first_name && admin.profiles?.last_name
                  ? `${admin.profiles.first_name[0]}${admin.profiles.last_name[0]}`.toUpperCase()
                  : admin.profiles?.first_name
                    ? admin.profiles.first_name.substring(0, 2).toUpperCase()
                    : admin.email.substring(0, 2).toUpperCase();

                return (
                  <div
                    key={admin.user_id}
                    className="h-8 w-8 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary cursor-help overflow-hidden"
                    title={admin.email}
                  >
                    {admin.profiles?.profile_picture_url ? (
                      <img
                        src={admin.profiles.profile_picture_url}
                        alt={admin.email}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                );
              })}
              {activeAdmins.length > 5 && (
                <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  +{activeAdmins.length - 5}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node Library */}
        <NodeLibrary />

        {/* React Flow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange as any}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onInit={setReactFlowInstance}
            onReconnect={onReconnect}
            onReconnectStart={onReconnectStart}
            onReconnectEnd={onReconnectEnd}
            onEdgeClick={onEdgeClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode="Shift"
            autoPanOnNodeDrag
            autoPanOnConnect
            fitView
            className="bg-muted/30"
          >
            <Background />
            <Controls className="!text-primary" />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-white border border-primary border-3 rounded-xl"
              maskColor="rgba(212, 212, 212, 0.45)"
            />
            <HeatmapOverlay isVisible={showHeatmap} nodes={nodes} />
            <SelectionAutoPan enabled={true} />
          </ReactFlow>

          {/* Floating Bulk Actions Toolbar */}
          {selectedNodeIds.length > 1 && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 bg-white border border-primary-light/30 rounded-xl shadow-xl">
              <span className="text-sm font-medium text-primary mr-2">
                {selectedNodeIds.length} selected
              </span>
              {activeTab === "official" && (
                <button
                  onClick={handleBulkFork}
                  disabled={bulkForkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {bulkForkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitFork className="h-3.5 w-3.5" />}
                  Fork All to Sandbox
                </button>
              )}
              {activeTab === "sandbox" && (
                <>
                  <button
                    onClick={handleBulkPublish}
                    disabled={bulkPromoteLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {bulkPromoteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Publish All to Community
                  </button>
                </>
              )}
              {activeTab === "community" && (
                <>
                  <button
                    onClick={handleBulkFork}
                    disabled={bulkForkLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {bulkForkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitFork className="h-3.5 w-3.5" />}
                    Fork All to Sandbox
                  </button>
                  {isAdmin && (
                    <button
                      onClick={handleBulkPromote}
                      disabled={bulkPromoteLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {bulkPromoteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                      Promote All to Official
                    </button>
                  )}
                </>
              )}
              {/* Common Bulk Actions */}
              {!effectiveReadOnly && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete All
                </button>
              )}
            </div>
          )}

          {/* Toolbar */}
          <EditorToolbar
            onSave={handleSave}
            saving={saving}
            onAutoLayout={handleAutoLayout}
            onValidate={handleValidate}
            onExport={handleExport}
            onImport={handleImportClick}
            onSearch={handleSearch}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onHistory={() => setShowHistory(true)}
            showHeatmap={showHeatmap}
            onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
            isReadOnly={effectiveReadOnly}
          />
        </div>

        {/* Right sidebar - Node edit panel */}
        {selectedNode && (
          <div className="w-[400px] flex-shrink-0 h-full overflow-hidden">
            <NodeEditPanel
              node={selectedNode}
              onClose={() => { setSelectedNode(null); setIsNewNode(false); }}
              onUpdate={async (updatedNode) => {
                if (!session?.access_token) return;

                // For new nodes where the user changed the ID, find by the original node prop
                const originalId = isNewNode ? selectedNode!.id : updatedNode.id;
                const oldNode = nodes.find(n => n.id === originalId)?.data.callNode;
                if (!oldNode) return;

                const nodePosition = nodes.find(n => n.id === originalId)?.position;
                const isUnsaved = unsavedNodeIds.has(originalId);

                const apiHeaders: Record<string, string> = {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                };
                if (productId) apiHeaders["X-Product-Id"] = productId;

                const apiBase = getApiBaseUrl();

                if (isUnsaved) {
                  // Node hasn't been persisted yet — POST to create it in the DB
                  const createCommand: HistoryCommand = {
                    name: `Create ${updatedNode.title}`,
                    redo: async () => {
                      const response = await fetch(apiBase, {
                        method: "POST",
                        headers: apiHeaders,
                        body: JSON.stringify({
                          ...updatedNode,
                          position_x: nodePosition?.x || 0,
                          position_y: nodePosition?.y || 0,
                          topic_group_id: (updatedNode as any).topic_group_id || updatedNode.type,
                          product_id: productId,
                        }),
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "Failed to create node");
                      }

                      // Update local state with the final ID
                      setNodes((nds) =>
                        nds.map((n) => {
                          if (n.id === originalId) {
                            return {
                              ...n,
                              id: updatedNode.id,
                              data: {
                                ...n.data,
                                callNode: updatedNode,
                                topicGroupId: (updatedNode as any).topic_group_id || null,
                              },
                            };
                          }
                          return n;
                        })
                      );
                      setSelectedNode(updatedNode);
                      setIsNewNode(false);
                      setUnsavedNodeIds((prev) => {
                        const next = new Set(prev);
                        next.delete(originalId);
                        return next;
                      });

                      // Broadcast creation (technically an update from unsaved to saved, but syncs data)
                      broadcastNodeAdded({
                        id: updatedNode.id,
                        type: "scriptNode",
                        position: nodePosition || { x: 0, y: 0 },
                        data: {
                          callNode: updatedNode,
                          topicGroupId: (updatedNode as any).topic_group_id || null,
                        },
                      });

                      toast.success("Node created");
                    },
                    undo: async () => {
                      const response = await fetch(`${apiBase}/${updatedNode.id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${session.access_token}` },
                      });
                      if (!response.ok) throw new Error("Failed to undo node creation");

                      setNodes((nds) => nds.filter((n) => n.id !== updatedNode.id));
                      if (selectedNode?.id === updatedNode.id) setSelectedNode(null);
                    },
                  };

                  await execute(createCommand);
                } else {
                  // Existing persisted node — PATCH to update
                  const updateCommand: HistoryCommand = {
                    name: `Update ${updatedNode.title}`,
                    redo: async () => {
                      const response = await fetch(`${apiBase}/${originalId}`, {
                        method: "PATCH",
                        headers: apiHeaders,
                        body: JSON.stringify(updatedNode),
                      });

                      if (!response.ok) throw new Error("Failed to update node");

                      // Broadcast update
                      broadcastNodeUpdated(originalId, updatedNode);

                      setNodes((nds) =>
                        nds.map((n) => {
                          if (n.id === originalId) {
                            return {
                              ...n,
                              id: updatedNode.id,
                              position: n.position,
                              data: {
                                ...n.data,
                                callNode: updatedNode,
                                topicGroupId: (updatedNode as any).topic_group_id || null,
                              },
                            };
                          }
                          return n;
                        })
                      );
                      setSelectedNode(updatedNode);
                      setIsNewNode(false);
                      toast.success("Node updated");
                    },
                    undo: async () => {
                      const response = await fetch(`${apiBase}/${updatedNode.id}`, {
                        method: "PATCH",
                        headers: apiHeaders,
                        body: JSON.stringify(oldNode),
                      });

                      if (!response.ok) throw new Error("Failed to undo update");

                      setNodes((nds) =>
                        nds.map((n) => {
                          if (n.id === updatedNode.id) {
                            return {
                              ...n,
                              id: oldNode.id,
                              data: {
                                ...n.data,
                                callNode: oldNode,
                                topicGroupId: (oldNode as any).topic_group_id || null,
                              },
                            };
                          }
                          return n;
                        })
                      );
                      setSelectedNode(oldNode);
                      toast.success("Undid update");
                    }
                  };

                  await execute(updateCommand);
                }
              }}
              refreshData={refreshData}
              session={session}
              isNew={isNewNode}
              isReadOnly={effectiveReadOnly}
              activeTab={activeTab}
              isAdmin={isAdmin}
              existingIds={new Set(nodes.map((n) => n.id))}
              allNodes={nodes.map((n) => n.data.callNode)}
              productId={productId}
              topics={topics} // Pass dynamic topics
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        nodeTitle={deleteModal.nodeTitle}
        connectionCount={deleteModal.connectionCount}
        onClose={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDelete}
        isDeleting={deleteModal.isDeleting}
        count={deleteModal.count}
      />

      {/* Import Options Modal */}
      <ImportOptionsModal
        isOpen={importModal.isOpen}
        fileName={importModal.fileName}
        onClose={() => setImportModal(prev => ({ ...prev, isOpen: false }))}
        onImport={executeImport}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        productId={productId}
      />
    </div >
  );
}

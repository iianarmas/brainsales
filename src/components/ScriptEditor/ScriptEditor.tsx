"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { X, Save, Download, Loader2, Users } from "lucide-react";
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
import HeatmapOverlay from "./HeatmapOverlay";
import ViewToggle from "./ViewToggle";
import { usePresence } from "@/hooks/usePresence";
import { LoadingScreen } from "@/components/LoadingScreen";
import type { EditorView } from "@/app/admin/scripts/page";

const nodeTypes = {
  scriptNode: ScriptNode as any, // Type assertion to avoid React Flow type conflicts
};

interface ScriptEditorProps {
  onClose: () => void;
  view: EditorView;
  onViewChange: (view: EditorView) => void;
  productId?: string;
  isReadOnly?: boolean;
}

interface TransformedNode extends Node {
  data: {
    callNode: CallNode;
    topicGroupId: string | null;
    onDelete?: (id: string, title: string) => void;
  };
}

export default function ScriptEditor({ onClose, view, onViewChange, productId, isReadOnly = false }: ScriptEditorProps) {
  const { session } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState<TransformedNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<CallNode | null>(null);
  const [isNewNode, setIsNewNode] = useState(false);
  const [unsavedNodeIds, setUnsavedNodeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
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

  // Track user presence
  usePresence();

  // History hook
  const { execute, undo, redo, canUndo, canRedo } = useEditorHistory();

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
    nodeTitle: string;
    connectionCount: number;
    isDeleting: boolean;
  }>({
    isOpen: false,
    nodeId: null,
    nodeTitle: "",
    connectionCount: 0,
    isDeleting: false,
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

  const [fetchKey, setFetchKey] = useState(0);

  // Refetch when switching to visual view
  useEffect(() => {
    if (view === "visual") {
      setFetchKey((k) => k + 1);
    }
  }, [view]);

  // Fetch nodes from API
  useEffect(() => {
    // Only fetch if we have a user ID (stable identifier)
    if (!session?.user?.id) return;

    async function fetchNodes() {
      if (!session?.access_token) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const fetchHeaders: Record<string, string> = {
          Authorization: `Bearer ${session.access_token}`,
        };
        if (productId) fetchHeaders["X-Product-Id"] = productId;

        const response = await fetch("/api/admin/scripts/nodes", {
          headers: fetchHeaders,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch nodes");
        }

        const nodesData: Array<CallNode & { position_x: number; position_y: number; topic_group_id: string | null }> = await response.json();

        // Transform to React Flow format
        const flowNodes: TransformedNode[] = nodesData.map((nodeData) => ({
          id: nodeData.id,
          type: "scriptNode",
          position: {
            x: nodeData.position_x || 0,
            y: nodeData.position_y || 0
          },
          data: {
            callNode: nodeData,
            topicGroupId: nodeData.topic_group_id,
          },
        }));

        // Create edges from responses
        const flowEdges: Edge[] = [];
        nodesData.forEach((nodeData) => {
          nodeData.responses.forEach((response, index) => {
            flowEdges.push({
              id: `${nodeData.id}-${response.nextNode}-${index}`,
              source: nodeData.id,
              target: response.nextNode, // This is the ID of the target node
              label: response.label,
              markerEnd: {
                type: MarkerType.ArrowClosed,
              },
            });
          });
        });

        setNodes(flowNodes);
        setEdges(flowEdges);
        setError(null);
      } catch (err) {
        console.error("Error fetching nodes:", err);
        setError(err instanceof Error ? err.message : "Failed to load nodes");
      } finally {
        setLoading(false);
      }
    }

    fetchNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, setNodes, setEdges, fetchKey, productId]);

  // Handle connection creation
  const onConnect = useCallback(
    async (connection: Connection) => {
      const sourceNodeId = connection.source;
      const targetNodeId = connection.target;

      if (isReadOnly) return;
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
          const response = await fetch(`/api/admin/scripts/nodes/${sourceNodeId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(updatedCallNode),
          });

          if (!response.ok) throw new Error("Failed to save connection");

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
    [setEdges, nodes, session, setNodes]
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
            const response = await fetch(`/api/admin/scripts/nodes/${sourceNodeId}`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify(updatedCallNode),
            });

            if (!response.ok) throw new Error("Failed to sync edge removal");

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
    [nodes, session, setNodes]
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
    [onConnect, removeEdgeFromModel, setEdges]
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
    [removeEdgeFromModel, setEdges]
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
  const handleDeleteNode = useCallback((id: string, title: string) => {
    if (isReadOnly) return;
    // Calculate connections (incoming + outgoing)
    const connectedEdges = edges.filter(
      (e) => e.source === id || e.target === id
    );

    setDeleteModal({
      isOpen: true,
      nodeId: id,
      nodeTitle: title,
      connectionCount: connectedEdges.length,
      isDeleting: false,
    });
  }, [edges]);

  // Execute delete
  const confirmDelete = async () => {
    const { nodeId } = deleteModal;
    if (!nodeId || !session?.access_token) return;

    // Get node data for undo
    const nodeToDelete = nodes.find(n => n.id === nodeId);
    const edgesToDelete = edges.filter(e => e.source === nodeId || e.target === nodeId);

    const isUnsaved = unsavedNodeIds.has(nodeId);

    const deleteCommand: HistoryCommand = {
      name: `Delete ${deleteModal.nodeTitle}`,
      redo: async () => {
        if (!isUnsaved) {
          // Remove references to this node from parent nodes first
          const incomingEdges = edgesToDelete.filter(e => e.target === nodeId);
          for (const edge of incomingEdges) {
            const parentNode = nodes.find(n => n.id === edge.source);
            if (parentNode) {
              const updatedResponses = parentNode.data.callNode.responses.filter(
                r => r.nextNode !== nodeId
              );
              await fetch(`/api/admin/scripts/nodes/${edge.source}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  ...parentNode.data.callNode,
                  responses: updatedResponses,
                }),
              });
              // Update local state for the parent
              setNodes((nds) =>
                nds.map((n) =>
                  n.id === edge.source
                    ? { ...n, data: { ...n.data, callNode: { ...n.data.callNode, responses: updatedResponses } } }
                    : n
                )
              );
            }
          }

          // Now delete the node itself
          const response = await fetch(`/api/admin/scripts/nodes/${nodeId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (!response.ok) throw new Error("Failed to delete node");
        }

        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
        if (selectedNode?.id === nodeId) setSelectedNode(null);
        if (isUnsaved) {
          setUnsavedNodeIds((prev) => {
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          });
        }
      },
      undo: async () => {
        if (!nodeToDelete) return;

        if (!isUnsaved) {
          // Restore to DB only if it was previously persisted
          const response = await fetch("/api/admin/scripts/nodes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              ...nodeToDelete.data.callNode,
              position_x: nodeToDelete.position.x,
              position_y: nodeToDelete.position.y,
              topic_group_id: nodeToDelete.data.topicGroupId
            }),
          });
          if (!response.ok) throw new Error("Failed to restore node");
        } else {
          // Re-mark as unsaved
          setUnsavedNodeIds((prev) => new Set(prev).add(nodeId));
        }

        setNodes((nds) => [...nds, nodeToDelete]);
        setEdges((eds) => [...eds, ...edgesToDelete]);
      }
    };

    try {
      setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
      await execute(deleteCommand);
      setDeleteModal((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      console.error("Error deleting node:", err);
      toast.error(`Failed to delete node: ${err instanceof Error ? err.message : "Unknown error"}`);
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
    },
    []
  );

  // Handle node deselection
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setIsNewNode(false);
  }, []);

  // Handle save
  const handleSave = async () => {
    if (!session?.access_token) {
      setError("Not authenticated");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Prepare position updates for all nodes
      const positionUpdates = nodes.map((node) => ({
        id: node.id,
        position_x: node.position.x,
        position_y: node.position.y,
      }));

      // Save positions
      const positionsResponse = await fetch("/api/admin/scripts/positions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ positions: positionUpdates }),
      });

      if (!positionsResponse.ok) {
        throw new Error("Failed to save node positions");
      }

      console.log("✅ Saved positions for", positionUpdates.length, "nodes");

      // Show success message (you can add a toast notification here)
      toast.success("Changes saved successfully!");
    } catch (err) {
      console.error("Error saving:", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Handle auto-layout
  const handleAutoLayout = useCallback(() => {
    const layoutedNodes = autoLayoutNodes(nodes, edges) as TransformedNode[];
    setNodes(layoutedNodes);
  }, [nodes, edges, setNodes]);

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
    input.onchange = async (e) => {
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
  const executeImport = async (strategy: "merge" | "overwrite") => {
    if (!importModal.data || !session?.access_token) return;

    try {
      setLoading(true); // Show general loading
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

      // Reload to reflect changes
      window.location.reload();

    } catch (err) {
      console.error("Import error:", err);
      toast.error(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setLoading(false);
    }
  };

  // Handle Search
  const handleSearch = useCallback(
    (term: string) => {
      if (!term || !reactFlowInstance) return;

      const matchingNode = nodes.find((node) =>
        node.data.callNode.title.toLowerCase().includes(term.toLowerCase())
      );

      if (matchingNode) {
        reactFlowInstance.fitView({
          nodes: [{ id: matchingNode.id }],
          duration: 800,
          padding: 0.5,
        });
        setSelectedNode(matchingNode.data.callNode);
      }
    },
    [nodes, reactFlowInstance]
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
      let newNodeId = `${prefix}_${slug}`;
      const existingIds = new Set(nodes.map((n) => n.id));
      if (existingIds.has(newNodeId)) {
        let counter = 2;
        while (existingIds.has(`${newNodeId}_${counter}`)) counter++;
        newNodeId = `${newNodeId}_${counter}`;
      }

      const newNodeData: Partial<CallNode> = {
        id: newNodeId,
        type: type as any,
        title: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        script: "",
        context: "",
        keyPoints: [],
        warnings: [],
        listenFor: [],
        responses: [],
        topic_group_id: type, // Default to node type
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
    },
    [reactFlowInstance, session, setNodes, execute, handleDeleteNode, selectedNode]
  );

  if (loading) {
    return <LoadingScreen message="Loading script editor..." />;
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

        <ViewToggle view={view} onViewChange={onViewChange} />

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
            onInit={setReactFlowInstance}
            onReconnect={onReconnect}
            onReconnectStart={onReconnectStart}
            onReconnectEnd={onReconnectEnd}
            onEdgeClick={onEdgeClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
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
          </ReactFlow>

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
            isReadOnly={isReadOnly}
          />
        </div>

        {/* Right sidebar - Node edit panel */}
        {selectedNode && (
          <div className="w-[400px] flex-shrink-0 h-full overflow-hidden">
            <NodeEditPanel
              node={selectedNode}
              session={session}
              isNew={isNewNode}
              isReadOnly={isReadOnly}
              existingIds={new Set(nodes.map((n) => n.id))}
              allNodes={nodes.map((n) => n.data.callNode)}
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

                if (isUnsaved) {
                  // Node hasn't been persisted yet — POST to create it in the DB
                  const createCommand: HistoryCommand = {
                    name: `Create ${updatedNode.title}`,
                    redo: async () => {
                      const response = await fetch("/api/admin/scripts/nodes", {
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
                      toast.success("Node created");
                    },
                    undo: async () => {
                      const response = await fetch(`/api/admin/scripts/nodes/${updatedNode.id}`, {
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
                      const response = await fetch(`/api/admin/scripts/nodes/${originalId}`, {
                        method: "PATCH",
                        headers: apiHeaders,
                        body: JSON.stringify(updatedNode),
                      });

                      if (!response.ok) throw new Error("Failed to update node");

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
                      const response = await fetch(`/api/admin/scripts/nodes/${updatedNode.id}`, {
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
      />
    </div >
  );
}

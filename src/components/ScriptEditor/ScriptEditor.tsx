"use client";

import React, { useState, useCallback, useEffect } from "react";
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
import { usePresence } from "@/hooks/usePresence";
import { LoadingScreen } from "@/components/LoadingScreen";

const nodeTypes = {
  scriptNode: ScriptNode as any, // Type assertion to avoid React Flow type conflicts
};

interface ScriptEditorProps {
  onClose: () => void;
}

interface TransformedNode extends Node {
  data: {
    callNode: CallNode;
    topicGroupId: string | null;
    onDelete?: (id: string, title: string) => void;
  };
}

export default function ScriptEditor({ onClose }: ScriptEditorProps) {
  const { session } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState<TransformedNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<CallNode | null>(null);
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

        const response = await fetch("/api/admin/scripts/nodes", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
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
    // Depends on session.user.id to prevent refetching on token refresh/window focus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, setNodes, setEdges]);

  // Handle connection creation
  const onConnect = useCallback(
    async (connection: Connection) => {
      const sourceNodeId = connection.source;
      const targetNodeId = connection.target;

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
      if (!session?.access_token) return;

      const sourceNodeId = edge.source;
      const targetNodeId = edge.target;

      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (sourceNode) {
        // Find the index of the response that points to targetNodeId
        // Note: multiple responses might point to the same target, we should be careful.
        // Usually edges are unique by (source, target, sourceHandle).
        const responses = sourceNode.data.callNode.responses;
        const responseIndex = responses.findIndex(r => r.nextNode === targetNodeId);

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
      // Simple confirm or direct delete
      if (window.confirm("Disconnect these nodes?")) {
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

    const deleteCommand: HistoryCommand = {
      name: `Delete ${deleteModal.nodeTitle}`,
      redo: async () => {
        const response = await fetch(`/api/admin/scripts/nodes/${nodeId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok) throw new Error("Failed to delete node");

        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
        if (selectedNode?.id === nodeId) setSelectedNode(null);
      },
      undo: async () => {
        if (!nodeToDelete) return;

        // Restore Node
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
    },
    []
  );

  // Handle node deselection
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
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

      // Generate a simple ID
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const newNodeId = `node_${timestamp}_${random}`;

      const newNodeData: Partial<CallNode> = {
        id: newNodeId,
        type: type as any,
        title: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        script: "Enter script here...",
        context: "",
        keyPoints: [],
        warnings: [],
        listenFor: [],
        responses: [],
        topic_group_id: type, // Default to node type
      };

      const createCommand: HistoryCommand = {
        name: `Create ${type} node`,
        redo: async () => {
          setSaving(true);
          const response = await fetch("/api/admin/scripts/nodes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              ...newNodeData,
              position_x: position.x,
              position_y: position.y,
              topic_group_id: type, // Ensure it's passed here too
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to create node");
          }

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
          setSaving(false);
        },
        undo: async () => {
          setSaving(true);
          const response = await fetch(`/api/admin/scripts/nodes/${newNodeId}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (!response.ok) throw new Error("Failed to undo node creation");

          setNodes((nds) => nds.filter((n) => n.id !== newNodeId));
          if (selectedNode?.id === newNodeId) setSelectedNode(null);
          setSaving(false);
        }
      };

      try {
        await execute(createCommand);
      } catch (err) {
        console.error("Error creating node:", err);
        toast.error(`Failed to create node: ${err instanceof Error ? err.message : "Unknown error"}`);
        setSaving(false);
      }
    },
    [reactFlowInstance, session, setNodes, execute, handleDeleteNode, selectedNode]
  );

  if (loading) {
    return <LoadingScreen message="Loading script editor..." />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Script Editor</h2>
          {saving && (
            <span className="flex items-center gap-2 text-sm text-primary font-medium animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving changes...
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          {/* Presence Indicator */}
          {activeAdmins.length > 0 && (
            <div className="flex items-center -space-x-2">
              <div className="flex items-center gap-1.5 mr-3 px-2 py-1 bg-muted rounded-full text-xs font-medium text-muted-foreground">
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
            <button
              onClick={onClose}
              className="flex items-center justify-center p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
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
      <div className="flex h-[calc(100vh-73px)]">
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
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-slate-100 border border-border border-3 border-primary rounded-xl"
              maskColor="rgba(0, 0, 0, 0.1)"
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
          />
        </div>

        {/* Right sidebar - Node edit panel */}
        {selectedNode && (
          <NodeEditPanel
            node={selectedNode}
            session={session}
            onClose={() => setSelectedNode(null)}
            onUpdate={async (updatedNode) => {
              const oldNode = nodes.find(n => n.id === updatedNode.id)?.data.callNode;
              if (!oldNode || !session?.access_token) return;

              const updateCommand: HistoryCommand = {
                name: `Update ${updatedNode.title}`,
                redo: async () => {
                  const response = await fetch(`/api/admin/scripts/nodes/${updatedNode.id}`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify(updatedNode),
                  });

                  if (!response.ok) throw new Error("Failed to update node");

                  setNodes((nds) =>
                    nds.map((n) => {
                      if (n.id === updatedNode.id) {
                        return {
                          ...n,
                          position: n.position, // Keep position
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
                  toast.success("Node updated");
                },
                undo: async () => {
                  const response = await fetch(`/api/admin/scripts/nodes/${oldNode.id}`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify(oldNode),
                  });

                  if (!response.ok) throw new Error("Failed to undo update");

                  setNodes((nds) =>
                    nds.map((n) => {
                      if (n.id === oldNode.id) {
                        return {
                          ...n,
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
            }}
          />
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

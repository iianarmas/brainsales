"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Plus,
  Loader2,
  AlertCircle,
  FolderTree,
  ChevronDown,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { CallNode, NodeType } from "@/data/callFlow";
import { useAuth } from "@/context/AuthContext";
import NodeEditPanel from "../NodeEditPanel";
import TreeNodeItem from "./TreeNodeItem";
import TreeSearchBar from "./TreeSearchBar";
import { useTreeData, findMatchingIds } from "./useTreeData";
import ViewToggle from "../ViewToggle";
import DeleteConfirmationModal from "../DeleteConfirmationModal";
import type { EditorView } from "@/app/admin/scripts/page";
import Image from "next/image";
import { supabase } from "@/app/lib/supabaseClient";
import { usePresence } from "@/hooks/usePresence";
import EditorTabs from "../EditorTabs";
import { useScriptEditorStore } from "@/store/scriptEditorStore";

interface TreeEditorProps {
  view: EditorView;
  onViewChange: (view: EditorView) => void;
  productId?: string;
  isReadOnly?: boolean;
  isAdmin?: boolean;
}

export default function TreeEditor({ view, onViewChange, productId, isReadOnly = false, isAdmin = false }: TreeEditorProps) {
  const { session } = useAuth();
  usePresence();

  // Use shared store for activeTab (synced with ScriptEditor)
  const { activeTab, setActiveTab } = useScriptEditorStore();

  const { roots, nodesMap, allNodes, loading, error, refetch } =
    useTreeData(session, productId, activeTab);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [originalNodeId, setOriginalNodeId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewNode, setIsNewNode] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(55); // percentage
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    nodeId: string | null;
    nodeTitle: string;
    connectionCount: number;
    isDeleting: boolean;
  }>({ isOpen: false, nodeId: null, nodeTitle: "", connectionCount: 0, isDeleting: false });
  const addMenuRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [activeAdmins, setActiveAdmins] = useState<Array<{
    user_id: string;
    email: string;
    profiles: {
      first_name: string | null;
      last_name: string | null;
      profile_picture_url: string | null;
    } | null;
  }>>([]);

  // Presence subscription
  useEffect(() => {
    const fetchPresence = async () => {
      if (!session?.access_token) return;
      try {
        const response = await fetch("/api/admin/online-users", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (response.ok) {
          setActiveAdmins(await response.json());
        }
      } catch (err) {
        console.error("Error fetching presence:", err);
      }
    };

    fetchPresence();

    const subscription = supabase
      .channel("tree-presence-updates")
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

  // Note: No longer refetch on view switch - data is cached in the shared store
  // The useTreeData hook still handles initial fetches and tab changes

  // Auto-expand root nodes on first load
  useEffect(() => {
    if (roots.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set(roots.map((r) => r.node.id)));
    }
  }, [roots]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search matching
  const searchMatchIds = useMemo(() => {
    if (!searchTerm.trim()) return new Set<string>();
    return findMatchingIds(roots, searchTerm.trim());
  }, [roots, searchTerm]);

  // Auto-expand matches when searching
  useEffect(() => {
    if (searchMatchIds.size > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        searchMatchIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [searchMatchIds]);

  const selectedNode = selectedNodeId ? nodesMap[selectedNodeId] || null : null;
  const isSandbox = activeTab === "sandbox";
  const getApiBaseUrl = () => isSandbox ? "/api/scripts/sandbox/nodes" : "/api/admin/scripts/nodes";

  const handleToggle = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const handleSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setOriginalNodeId(nodeId);
    setIsNewNode(false);
  }, []);

  const isAllExpanded = useMemo(() => {
    const allIds = Object.keys(nodesMap);
    return allIds.length > 0 && allIds.every((id) => expandedIds.has(id));
  }, [nodesMap, expandedIds]);

  const handleToggleAll = useCallback(() => {
    if (isAllExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(Object.keys(nodesMap)));
    }
  }, [isAllExpanded, nodesMap]);

  // Close add menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as HTMLElement)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Resizable panel drag handlers
  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const container = document.getElementById("tree-editor-panels");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPanelWidth(Math.min(80, Math.max(20, pct)));
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleAddNewNode = useCallback(
    async (nodeType: NodeType) => {
      if (!session?.access_token) return;
      setShowAddMenu(false);

      const prefixMap: Record<string, string> = {
        opening: "opening", discovery: "disc", pitch: "pitch",
        objection: "obj", close: "close", success: "success", end: "end"
      };
      const prefix = prefixMap[nodeType] || nodeType;
      const defaultTitle = `New ${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node`;
      const slug = defaultTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").substring(0, 40);
      let newId = `${prefix}_${slug}`;
      const currentIds = new Set(Object.keys(nodesMap));
      if (currentIds.has(newId)) {
        let counter = 2;
        while (currentIds.has(`${newId}_${counter}`)) counter++;
        newId = `${newId}_${counter}`;
      }

      const newNode: CallNode = {
        id: newId,
        type: nodeType,
        title: defaultTitle,
        script: " ",
        responses: [],
      };

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        };
        if (productId) headers["X-Product-Id"] = productId;

        const res = await fetch(getApiBaseUrl(), {
          method: "POST",
          headers,
          body: JSON.stringify({ ...newNode, product_id: productId }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to create node");
        }

        toast.success(`${newNode.title} created`);
        refetch();
        setSelectedNodeId(newId);
        setOriginalNodeId(newId);
        setIsNewNode(true);
      } catch (err) {
        console.error("Error creating node:", err);
        toast.error(err instanceof Error ? err.message : "Failed to create node");
      }
    },
    [session?.access_token, nodesMap, refetch, productId]
  );

  const nodeTypeOptions: { type: NodeType; label: string }[] = [
    { type: "opening", label: "Opening" },
    { type: "discovery", label: "Discovery Question" },
    { type: "pitch", label: "Pitch" },
    { type: "objection", label: "Objection" },
    { type: "close", label: "Close" },
    { type: "success", label: "Success" },
    { type: "end", label: "End" },
  ];

  const handleNodeUpdate = useCallback(
    async (updatedNode: CallNode) => {
      if (!session?.access_token) return;

      const apiId = originalNodeId || updatedNode.id;
      const idChanged = apiId !== updatedNode.id;

      const baseHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      };
      if (productId) baseHeaders["X-Product-Id"] = productId;

      try {
        if (idChanged) {
          // ID was changed: create new node with new ID, then delete old one
          const createRes = await fetch(getApiBaseUrl(), {
            method: "POST",
            headers: baseHeaders,
            body: JSON.stringify({ ...updatedNode, product_id: productId }),
          });

          if (!createRes.ok) throw new Error("Failed to create node with new ID");

          // Update any parent nodes that reference the old ID
          const allNodesList = Object.values(nodesMap);
          for (const n of allNodesList) {
            const hasRef = n.responses.some((r) => r.nextNode === apiId);
            if (hasRef) {
              const updatedParent = {
                ...n,
                responses: n.responses.map((r) =>
                  r.nextNode === apiId ? { ...r, nextNode: updatedNode.id } : r
                ),
              };
              await fetch(`${getApiBaseUrl()}/${n.id}`, {
                method: "PATCH",
                headers: baseHeaders,
                body: JSON.stringify(updatedParent),
              });
            }
          }

          // Delete the old node
          await fetch(`${getApiBaseUrl()}/${apiId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        } else {
          const response = await fetch(`${getApiBaseUrl()}/${apiId}`, {
            method: "PATCH",
            headers: baseHeaders,
            body: JSON.stringify(updatedNode),
          });

          if (!response.ok) throw new Error("Failed to update node");
        }

        toast.success("Node updated");
        setSelectedNodeId(updatedNode.id);
        setOriginalNodeId(updatedNode.id);
        setIsNewNode(false);
        refetch();
      } catch (err) {
        console.error("Error updating node:", err);
        toast.error("Failed to update node");
        throw err;
      }
    },
    [session?.access_token, originalNodeId, nodesMap, refetch, productId]
  );

  const handleAddChild = useCallback(
    async (parentId: string) => {
      if (!session?.access_token) return;

      const parent = nodesMap[parentId];
      if (!parent) return;

      const prefix = "disc";
      const defaultTitle = "New Discovery Node";
      const slug = defaultTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").substring(0, 40);
      let newId = `${prefix}_${slug}`;
      const currentIds = new Set(Object.keys(nodesMap));
      if (currentIds.has(newId)) {
        let counter = 2;
        while (currentIds.has(`${newId}_${counter}`)) counter++;
        newId = `${newId}_${counter}`;
      }

      const newNode: CallNode = {
        id: newId,
        type: "discovery" as NodeType,
        title: defaultTitle,
        script: " ",
        responses: [],
      };

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        };
        if (productId) headers["X-Product-Id"] = productId;

        // Create the new node
        const createRes = await fetch(getApiBaseUrl(), {
          method: "POST",
          headers,
          body: JSON.stringify({ ...newNode, product_id: productId }),
        });

        if (!createRes.ok) throw new Error("Failed to create node");

        // Add a response on the parent pointing to the new node
        const updatedParent: CallNode = {
          ...parent,
          responses: [
            ...parent.responses,
            { label: "New Response", nextNode: newId },
          ],
        };

        const updateRes = await fetch(`${getApiBaseUrl()}/${parentId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(updatedParent),
        });

        if (!updateRes.ok) throw new Error("Failed to update parent");

        toast.success("Child node created");
        refetch();

        // Select and expand to show the new node
        setExpandedIds((prev) => new Set([...prev, parentId]));
        setSelectedNodeId(newId);
        setOriginalNodeId(newId);
        setIsNewNode(true);
      } catch (err) {
        console.error("Error adding child node:", err);
        toast.error("Failed to add child node");
      }
    },
    [session?.access_token, nodesMap, refetch, productId]
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const node = nodesMap[nodeId];
      if (!node) return;

      // Count connections referencing this node
      const connectionCount = Object.values(nodesMap).reduce(
        (count, n) => count + n.responses.filter((r) => r.nextNode === nodeId).length,
        0
      );

      setDeleteModal({
        isOpen: true,
        nodeId,
        nodeTitle: node.title,
        connectionCount,
        isDeleting: false,
      });
    },
    [nodesMap]
  );

  const confirmDelete = useCallback(async () => {
    const { nodeId } = deleteModal;
    if (!nodeId || !session?.access_token) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      // Remove references to this node from parent nodes
      const allNodesList = Object.values(nodesMap);
      for (const n of allNodesList) {
        const hasRef = n.responses.some((r) => r.nextNode === nodeId);
        if (hasRef) {
          const updatedParent = {
            ...n,
            responses: n.responses.filter((r) => r.nextNode !== nodeId),
          };
          await fetch(`${getApiBaseUrl()}/${n.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(updatedParent),
          });
        }
      }

      // Delete the node
      const res = await fetch(`${getApiBaseUrl()}/${nodeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error("Failed to delete node");

      toast.success(`"${deleteModal.nodeTitle}" deleted`);
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
      setDeleteModal((prev) => ({ ...prev, isOpen: false }));
      refetch();
    } catch (err) {
      console.error("Error deleting node:", err);
      toast.error("Failed to delete node");
    } finally {
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [deleteModal, session?.access_token, nodesMap, selectedNodeId, refetch]);

  const existingIds = useMemo(
    () => new Set(Object.keys(nodesMap)),
    [nodesMap]
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading script nodes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-gray-700 font-medium">Failed to load nodes</p>
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/assets/images/icon_transparent_bg.png" alt="BrainSales Icon" width={32} height={32} className="rounded-md" />
          <h2 className="text-xl font-bold text-primary">Script Editor</h2>
          <span className="text-sm text-gray-400">
            {allNodes.length} nodes
          </span>
        </div>

        <div className="flex items-center gap-3">
          <EditorTabs activeTab={activeTab} onTabChange={setActiveTab} isAdmin={isAdmin} />
          <ViewToggle view={view} onViewChange={onViewChange} />
        </div>

        <div className="flex items-center gap-4">
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
        </div>
      </div>

      {/* Main content */}
      <div id="tree-editor-panels" className="flex-1 flex overflow-hidden">
        {/* Left panel - Tree */}
        <div style={{ width: `${leftPanelWidth}%` }} className="flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
          {/* Toolbar */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <div className="flex-1">
              <TreeSearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                resultCount={searchMatchIds.size}
              />
            </div>
            {!isReadOnly && (
              <div className="relative" ref={addMenuRef}>
                <button
                  onClick={() => setShowAddMenu((v) => !v)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                  title="Add new node"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showAddMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[180px]">
                    {nodeTypeOptions.map((opt) => (
                      <button
                        key={opt.type}
                        onClick={() => handleAddNewNode(opt.type)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={handleToggleAll}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title={isAllExpanded ? "Collapse all" : "Expand all"}
            >
              {isAllExpanded ? (
                <ChevronsDownUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronsUpDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Tree */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {roots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <FolderTree className="w-8 h-8" />
                <p className="text-sm">No nodes found</p>
              </div>
            ) : (
              roots.map((root) => (
                <TreeNodeItem
                  key={root.node.id}
                  item={root}
                  depth={0}
                  isExpanded={expandedIds.has(root.node.id)}
                  isSelected={selectedNodeId === root.node.id}
                  matchesSearch={searchMatchIds.has(root.node.id)}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                  onAddChild={handleAddChild}
                  onDelete={handleDeleteNode}
                  expandedIds={expandedIds}
                  selectedNodeId={selectedNodeId}
                  searchMatchIds={searchMatchIds}
                  isReadOnly={isReadOnly}
                />
              ))
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 flex-shrink-0 cursor-col-resize bg-gray-100 hover:bg-primary/30 transition-colors"
        />

        {/* Right panel - Edit */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selectedNode ? (
            <NodeEditPanel
              node={selectedNode}
              onClose={() => setSelectedNodeId(null)}
              onUpdate={handleNodeUpdate}
              session={session}
              isNew={isNewNode}
              isReadOnly={isReadOnly}
              existingIds={existingIds}
              allNodes={allNodes}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <FolderTree className="w-10 h-10" />
              <p className="text-sm">Select a node to edit</p>
              <p className="text-xs text-gray-300">
                Click any node in the tree to view and edit its properties
              </p>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        nodeTitle={deleteModal.nodeTitle}
        connectionCount={deleteModal.connectionCount}
        onClose={() => setDeleteModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDelete}
        isDeleting={deleteModal.isDeleting}
      />
    </div >
  );
}

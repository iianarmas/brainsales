"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProduct } from "@/context/ProductContext";
import { useCallFlow } from "@/hooks/useCallFlow";
import { useScriptShortcuts, UserScriptShortcut } from "@/hooks/useScriptShortcuts";
import { CallNode, isNodeInFlow } from "@/data/callFlow";
import {
  Keyboard,
  ChevronDown,
  X,
  Save,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { UserObjectionPreference } from "@/types/product";

// Keys that cannot be assigned to scripts
const RESERVED_KEYS = new Set([
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "escape", "backspace", "tab", "enter", " ",
]);

// Keys that should be blocked from the system shortcuts handler
const SYSTEM_SHORTCUTS = new Set(["k", "q"]); // ctrl+k, ctrl+q are system

function buildKeyString(e: KeyboardEvent): string | null {
  const key = e.key.toLowerCase();
  if (RESERVED_KEYS.has(key)) return null;

  const hasModifier = e.ctrlKey || e.altKey;
  const prefix = e.ctrlKey ? "ctrl+" : e.altKey ? "alt+" : "";

  // ctrl/alt + letter
  if (hasModifier && /^[a-z]$/.test(key)) {
    // Block system shortcuts like ctrl+k, ctrl+q
    if (e.ctrlKey && SYSTEM_SHORTCUTS.has(key)) return null;
    return prefix + key;
  }

  // Plain single letter (no modifier)
  if (!hasModifier && /^[a-z]$/.test(key)) return key;

  // Function keys (with or without modifiers)
  if (/^f([1-9]|1[0-2])$/.test(key)) return prefix + key;

  return null;
}

function formatKeyLabel(key: string): string {
  return key
    .replace("ctrl+", "Ctrl+")
    .replace("alt+", "Alt+")
    .replace(/^(.)$/, (c) => c.toUpperCase());
}

const NODE_TYPE_ORDER: Record<string, number> = {
  opening: 0, discovery: 1, pitch: 2, close: 3,
  success: 4, voicemail: 5, end: 6, objection: 7,
};

const SHORTCUT_KEYS_OBJECTION = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

// ─────────────────────────────────────────────────────────────────
// ObjectionShortcutsSection — embedded objection config for settings
// ─────────────────────────────────────────────────────────────────

interface ObjectionSectionProps {
  productId: string;
  allObjectionNodes: CallNode[];
}

function ObjectionShortcutsSection({ productId, allObjectionNodes }: ObjectionSectionProps) {
  const { session } = useAuth();
  const [keyToNode, setKeyToNode] = useState<Record<string, string>>({});
  const [nodeToKey, setNodeToKey] = useState<Record<string, string>>({});
  const [hasCustomized, setHasCustomized] = useState(false);
  const [loading, setLoading] = useState(true);
  // edit state: node_id → key | null
  const [editMap, setEditMap] = useState<Map<string, string | null>>(new Map());
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchObjShortcuts = useCallback(async () => {
    if (!session?.access_token || !productId) return;
    setLoading(true);
    try {
      const [prodRes, userRes] = await Promise.all([
        fetch(`/api/products/${productId}/objection-shortcuts`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch(`/api/user-objection-preferences?product_id=${productId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);
      const prodData = prodRes.ok ? await prodRes.json() : { keyToNode: {}, nodeToKey: {} };
      const userData = userRes.ok ? await userRes.json() : { customized: false };

      if (userData.customized) {
        setHasCustomized(true);
        setKeyToNode(userData.keyToNode || {});
        setNodeToKey(userData.nodeToKey || {});
      } else {
        setHasCustomized(false);
        setKeyToNode(prodData.keyToNode || {});
        setNodeToKey(prodData.nodeToKey || {});
      }
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, productId]);

  useEffect(() => {
    fetchObjShortcuts();
  }, [fetchObjShortcuts]);

  // Sync editMap whenever remote data loads
  useEffect(() => {
    if (loading) return;
    const m = new Map<string, string | null>();
    allObjectionNodes.forEach((node) => {
      m.set(node.id, nodeToKey[node.id] ?? null);
    });
    setEditMap(m);
    setIsDirty(false);
  }, [loading, nodeToKey, allObjectionNodes]);

  const assignKey = (nodeId: string, key: string | null) => {
    setEditMap((prev) => {
      const next = new Map(prev);
      // Clear the key from any other node first
      if (key !== null) {
        for (const [nid, k] of next) {
          if (k === key && nid !== nodeId) next.set(nid, null);
        }
      }
      next.set(nodeId, key);
      return next;
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const prefs: UserObjectionPreference[] = [];
      for (const [nodeId, key] of editMap) {
        prefs.push({ node_id: nodeId, shortcut_key: key });
      }
      const res = await fetch("/api/user-objection-preferences", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product_id: productId, preferences: prefs }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Objection shortcuts saved");
      await fetchObjShortcuts();
      setIsDirty(false);
    } catch {
      toast.error("Failed to save objection shortcuts");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/user-objection-preferences?product_id=${productId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Reset to admin defaults");
      await fetchObjShortcuts();
      setIsDirty(false);
    } catch {
      toast.error("Failed to reset");
    } finally {
      setSaving(false);
    }
  };

  const usedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const [, k] of editMap) if (k) s.add(k);
    return s;
  }, [editMap]);

  const [expandedObjNodes, setExpandedObjNodes] = useState<Set<string>>(new Set());
  const toggleObjExpand = (nodeId: string) => {
    setExpandedObjNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading objection shortcuts...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Objection Shortcuts (0–9)</span>
          {hasCustomized && (
            <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">Customized</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasCustomized && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to admin defaults
            </button>
          )}
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Keys 0–9 are reserved for objections. Assign which objections appear on each key.
        Admin defaults are configured in{" "}
        <a href="/admin" target="_blank" className="text-primary hover:underline inline-flex items-center gap-0.5">
          Product Settings <ExternalLink className="h-3 w-3" />
        </a>.
      </p>

      {allObjectionNodes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No objection nodes in this flow.</p>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {allObjectionNodes.map((node) => {
            const assignedKey = editMap.get(node.id) ?? null;
            const isExpanded = expandedObjNodes.has(node.id);
            return (
              <div
                key={node.id}
                className="rounded-lg bg-muted/30 border border-border overflow-hidden"
              >
                <div className="flex items-center gap-3 px-3 py-2">
                  <span className="flex-1 text-sm text-foreground truncate">{node.title}</span>
                  {node.call_flow_ids && node.call_flow_ids.length > 0 ? null : (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Universal</span>
                  )}
                  {node.script && (
                    <button
                      onClick={() => toggleObjExpand(node.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      title={isExpanded ? "Hide script" : "Show script"}
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  )}
                  <select
                    value={assignedKey ?? ""}
                    onChange={(e) => assignKey(node.id, e.target.value || null)}
                    className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-24 flex-shrink-0"
                  >
                    <option value="">No key</option>
                    {SHORTCUT_KEYS_OBJECTION.map((k) => (
                      <option key={k} value={k}>
                        Key {k}{usedKeys.has(k) && assignedKey !== k ? " (swap)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {isExpanded && node.script && (
                  <div className="px-4 pb-3 border-t border-border/50 bg-muted/10">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-l-2 border-primary/30 pl-3 mt-2">
                      {node.script}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main ShortcutsTab
// ─────────────────────────────────────────────────────────────────

export function ShortcutsTab() {
  const { session } = useAuth();
  const { products, currentProduct } = useProduct();

  // Selected product (defaults to current product)
  const [selectedProductId, setSelectedProductId] = useState<string>(
    currentProduct?.id ?? ""
  );
  // Sync with currentProduct on first load
  useEffect(() => {
    if (!selectedProductId && currentProduct?.id) {
      setSelectedProductId(currentProduct.id);
    }
  }, [currentProduct?.id, selectedProductId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? currentProduct;

  // Load call flow for the selected product
  const { callFlow, loading: flowLoading } = useCallFlow(
    selectedProductId || null,
    session?.access_token
  );

  // Derive opening nodes (= available flows)
  const openingNodes = useMemo(
    () =>
      Object.values(callFlow)
        .filter((n) => n.type === "opening" && (!n.scope || n.scope === "official"))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [callFlow]
  );

  // Selected flow (null = all flows)
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  // Reset flow when product changes
  useEffect(() => {
    setSelectedFlowId(null);
  }, [selectedProductId]);

  // Filtered script nodes (non-objection, official, in flow)
  const scriptNodes = useMemo(() => {
    return Object.values(callFlow)
      .filter((n) => {
        if (n.type === "objection") return false;
        if (n.scope && n.scope !== "official") return false;
        // When a specific flow is selected, exclude opening nodes that belong to other flows
        if (n.type === "opening" && selectedFlowId && n.id !== selectedFlowId) return false;
        return isNodeInFlow(n, selectedFlowId);
      })
      .sort((a, b) => {
        const typeOrder = (NODE_TYPE_ORDER[a.type] ?? 99) - (NODE_TYPE_ORDER[b.type] ?? 99);
        if (typeOrder !== 0) return typeOrder;
        return a.title.localeCompare(b.title);
      });
  }, [callFlow, selectedFlowId]);

  // Objection nodes (for the objection section)
  const objectionNodes = useMemo(
    () =>
      Object.values(callFlow)
        .filter((n) => n.type === "objection" && (!n.scope || n.scope === "official"))
        .filter((n) => isNodeInFlow(n, selectedFlowId))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [callFlow, selectedFlowId]
  );

  // Load current script shortcuts for selected product
  const { shortcuts, nodeToKey, loading: shortcutsLoading, saveShortcuts, clearShortcuts } =
    useScriptShortcuts(selectedProductId);

  // Local edit state: node_id → key | null (null = remove)
  const [editedKeys, setEditedKeys] = useState<Map<string, string>>(new Map());
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Expanded script preview rows
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // Reset edits when product changes or shortcuts load
  useEffect(() => {
    setEditedKeys(new Map());
    setIsDirty(false);
    setExpandedNodes(new Set());
  }, [selectedProductId, shortcutsLoading]);

  // Reset expanded when flow changes
  useEffect(() => {
    setExpandedNodes(new Set());
  }, [selectedFlowId]);

  // Key capture state
  const [capturingForNodeId, setCapturingForNodeId] = useState<string | null>(null);
  const captureRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  // Merged view: apply edits on top of saved shortcuts
  const effectiveNodeToKey = useMemo<Record<string, string>>(() => {
    const base = { ...nodeToKey };
    for (const [nodeId, key] of editedKeys) {
      if (key === "") {
        delete base[nodeId];
        // Also remove any other node that had this key (we don't track that here, just keep delete)
      } else {
        base[nodeId] = key;
      }
    }
    return base;
  }, [nodeToKey, editedKeys]);

  // Reverse map: key → nodeId (from effective)
  const effectiveKeyToNode = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const [nodeId, key] of Object.entries(effectiveNodeToKey)) {
      m[key] = nodeId;
    }
    return m;
  }, [effectiveNodeToKey]);

  const startCapture = useCallback(
    (nodeId: string) => {
      setCapturingForNodeId(nodeId);

      const handler = (e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          setCapturingForNodeId(null);
          window.removeEventListener("keydown", handler, true);
          return;
        }

        const keyStr = buildKeyString(e);
        if (!keyStr) return; // invalid key, keep waiting

        // Check if key is taken by another script node
        const conflictNodeId = effectiveKeyToNode[keyStr];
        if (conflictNodeId && conflictNodeId !== nodeId) {
          // Auto-swap: remove from the other node
          setEditedKeys((prev) => {
            const next = new Map(prev);
            // Remove key from conflict node
            next.set(conflictNodeId, "");
            // Assign to target node
            next.set(nodeId, keyStr);
            return next;
          });
          toast.info(
            `Moved ${formatKeyLabel(keyStr)} from "${callFlow[conflictNodeId]?.title}" to "${callFlow[nodeId]?.title}"`
          );
        } else {
          setEditedKeys((prev) => {
            const next = new Map(prev);
            next.set(nodeId, keyStr);
            return next;
          });
        }

        setIsDirty(true);
        setCapturingForNodeId(null);
        window.removeEventListener("keydown", handler, true);
      };

      captureRef.current = handler;
      window.addEventListener("keydown", handler, true);
    },
    [effectiveKeyToNode, callFlow]
  );

  // Cleanup capture on unmount
  useEffect(() => {
    return () => {
      if (captureRef.current) {
        window.removeEventListener("keydown", captureRef.current, true);
      }
    };
  }, []);

  const removeKey = (nodeId: string) => {
    setEditedKeys((prev) => {
      const next = new Map(prev);
      next.set(nodeId, "");
      return next;
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!selectedProductId) return;
    setSaving(true);
    try {
      // Build the full shortcut list from effective state
      const toSave = Object.entries(effectiveNodeToKey)
        .filter(([, key]) => key !== "")
        .map(([nodeId, shortcut_key]) => ({
          node_id: nodeId,
          call_flow_id: callFlow[nodeId]?.call_flow_ids?.[0] ?? null,
          shortcut_key,
        }));

      await saveShortcuts(selectedProductId, toSave);
      setEditedKeys(new Map());
      setIsDirty(false);
      toast.success("Script shortcuts saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    if (!selectedProductId) return;
    setSaving(true);
    try {
      await clearShortcuts(selectedProductId);
      setEditedKeys(new Map());
      setIsDirty(false);
      toast.success("All script shortcuts cleared");
    } catch {
      toast.error("Failed to clear shortcuts");
    } finally {
      setSaving(false);
    }
  };

  const hasAnyShortcuts =
    shortcuts.length > 0 || Array.from(editedKeys.values()).some((v) => v !== "");

  const isLoading = flowLoading || shortcutsLoading;

  return (
    <div className="space-y-8">
      {/* ── Section header ── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Keyboard className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Keyboard Shortcuts</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Assign custom keyboard shortcuts to navigate directly to any script during a call.
          Press the assigned key while on the call screen to jump to that script instantly.
        </p>
      </div>

      {/* ── Selectors row ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Product selector */}
        {products.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Product</label>
            <div className="relative">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="appearance-none bg-background border border-border rounded-lg px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}

        {/* Flow selector */}
        {openingNodes.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Flow</label>
            <div className="relative">
              <select
                value={selectedFlowId ?? ""}
                onChange={(e) => setSelectedFlowId(e.target.value || null)}
                className="appearance-none bg-background border border-border rounded-lg px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="">All flows</option>
                {openingNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}

        {selectedProduct && products.length <= 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Product</label>
            <span className="text-sm text-foreground font-medium py-2">{selectedProduct.name}</span>
          </div>
        )}
      </div>

      {/* ── Script shortcuts table ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Script Shortcuts</h3>
          <div className="flex items-center gap-2">
            {hasAnyShortcuts && (
              <button
                onClick={handleClearAll}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                Clear all
              </button>
            )}
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save changes
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Click "Assign key" on any script, then press a key. Supports single letters (A–Z),
          function keys (F1–F12), and combos (Ctrl+letter, Alt+letter).
          Keys 0–9 are reserved for objections below.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading scripts...
          </div>
        ) : scriptNodes.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
            No official scripts found for this product
            {selectedFlowId ? " and flow" : ""}.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 bg-muted/40 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Script</span>
              <span className="text-center w-16">Type</span>
              <span className="text-right w-32">Shortcut</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {scriptNodes.map((node) => {
                const assignedKey = effectiveNodeToKey[node.id];
                const isCapturing = capturingForNodeId === node.id;
                const isExpanded = expandedNodes.has(node.id);

                return (
                  <div key={node.id}>
                    <div
                      className={`grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-2.5 transition-colors ${
                        isCapturing ? "bg-primary/5" : "hover:bg-muted/20"
                      }`}
                    >
                      {/* Script title + expand toggle */}
                      <div className="min-w-0 flex items-center gap-2">
                        {node.script && (
                          <button
                            onClick={() => toggleExpand(node.id)}
                            className="flex-shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                            title={isExpanded ? "Hide script" : "Show script"}
                          >
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        )}
                        <div className="min-w-0">
                          <span className="text-sm text-foreground truncate block">{node.title}</span>
                          {!node.call_flow_ids || node.call_flow_ids.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground">Universal</span>
                          ) : null}
                        </div>
                      </div>

                      {/* Type badge */}
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-16 text-center">
                        {node.type}
                      </span>

                      {/* Key assignment */}
                      <div className="w-32 flex items-center justify-end gap-1">
                        {isCapturing ? (
                          <span className="text-xs text-primary font-medium animate-pulse">
                            Press a key...
                          </span>
                        ) : assignedKey ? (
                          <>
                            <kbd
                              className="inline-flex items-center px-2 py-0.5 text-xs font-mono bg-muted border border-border rounded cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors"
                              onClick={() => startCapture(node.id)}
                              title="Click to reassign"
                            >
                              {formatKeyLabel(assignedKey)}
                            </kbd>
                            <button
                              onClick={() => removeKey(node.id)}
                              className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                              title="Remove shortcut"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startCapture(node.id)}
                            className="text-xs text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary/50 px-2 py-0.5 rounded transition-colors"
                          >
                            Assign key
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded script content */}
                    {isExpanded && node.script && (
                      <div className="px-4 pb-3 bg-muted/10 border-t border-border/50">
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed border-l-2 border-primary/30 pl-3 mt-2">
                          {node.script}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <hr className="border-border" />

      {/* ── Objection shortcuts ── */}
      {selectedProductId && (
        <ObjectionShortcutsSection
          productId={selectedProductId}
          allObjectionNodes={objectionNodes}
        />
      )}

      {/* Click outside capture to cancel */}
      {capturingForNodeId && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setCapturingForNodeId(null)}
        />
      )}
    </div>
  );
}

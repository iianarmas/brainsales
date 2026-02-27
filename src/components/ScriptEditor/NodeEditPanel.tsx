import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, Plus, Trash2, Save, Loader2, Lock, ChevronDown, Search, GitFork, Upload, ArrowUp, ArrowDown, Undo2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { toast } from "sonner";
import { useConfirmModal } from "@/components/ConfirmModal";
import { CallNode } from "@/data/callFlow";
import { Session } from "@supabase/supabase-js";
import { useNodeLock } from "@/hooks/useNodeLock";
import { topicGroups } from "@/data/topicGroups";
import type { EditorTab } from "./EditorTabs";
import type { EnvironmentTrigger } from "@/types/product";
import { ThemedSelect } from "@/components/ThemedSelect";

interface NodeEditPanelProps {
  node: CallNode;
  onClose: () => void;
  onUpdate: (updatedNode: CallNode) => Promise<void>;
  session: Session | null;
  isNew?: boolean;
  existingIds?: Set<string>;
  allNodes?: CallNode[];
  isReadOnly?: boolean;
  activeTab?: EditorTab;
  isAdmin?: boolean;
  productId?: string;
  topics?: any[];
  refreshData?: (tab?: EditorTab) => Promise<void>;
}

const typeColors: Record<string, string> = {
  opening: "bg-green-500/20 text-green-400",
  discovery: "bg-blue-500/20 text-blue-400",
  pitch: "bg-yellow-500/20 text-yellow-400",
  objection: "bg-red-500/20 text-red-400",
  close: "bg-purple-500/20 text-purple-400",
  success: "bg-emerald-500/20 text-emerald-400",
  end: "bg-gray-500/20 text-gray-400",
};

function NodePicker({
  value,
  onChange,
  nodes,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  nodes: CallNode[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedNode = nodes.find((n) => n.id === value);
  const filtered = nodes.filter((n) => {
    const q = search.toLowerCase();
    return (
      n.id.toLowerCase().includes(q) ||
      n.title.toLowerCase().includes(q) ||
      n.type.toLowerCase().includes(q)
    );
  });

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="w-full flex items-center justify-between px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 text-left"
      >
        {selectedNode ? (
          <span className="truncate">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1.5 ${typeColors[selectedNode.type] || ""}`}>
              {selectedNode.type}
            </span>
            {selectedNode.title}
          </span>
        ) : value ? (
          <span className="truncate text-muted-foreground">{value}</span>
        ) : (
          <span className="text-muted-foreground">Select next node...</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-background border border-border rounded-lg shadow-xl max-h-64 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search by title, ID, or type..."
              autoFocus
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">No nodes found</p>
            ) : (
              filtered.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    onChange(n.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-primary/10 transition-colors border-b border-border last:border-0 ${n.id === value ? "bg-primary/5" : ""
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${typeColors[n.type] || ""}`}>
                      {n.type}
                    </span>
                    <span className="text-sm font-medium truncate">{n.title}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 ml-0.5">{n.id}</p>
                  {n.script && (
                    <p className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-2 leading-tight">
                      {n.script.slice(0, 120)}{n.script.length > 120 ? "..." : ""}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NodeEditPanel({
  node,
  onClose,
  onUpdate,
  session,
  isNew = false,
  existingIds = new Set(),
  allNodes = [],
  isReadOnly: externalReadOnly = false,
  activeTab = "official",
  isAdmin = false,
  productId,
  topics,
  refreshData,
}: NodeEditPanelProps) {
  const [formData, setFormData] = useState<CallNode>(node);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Environment trigger definitions from product config
  const defaultEnvTriggers: EnvironmentTrigger[] = [
    { key: "ehr", label: "EHR Name", icon: "Server", type: "text" },
    { key: "dms", label: "DMS Name", icon: "Database", type: "text" },
    { key: "competitors", label: "Competitors", icon: "Users", type: "array" },
  ];
  const [envTriggerDefs, setEnvTriggerDefs] = useState<EnvironmentTrigger[]>(defaultEnvTriggers);

  useEffect(() => {
    if (!productId || !session?.access_token) return;
    fetch(`/api/products/${productId}/config`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.configuration?.environmentTriggers?.length > 0) {
          setEnvTriggerDefs(data.configuration.environmentTriggers);
        }
      })
      .catch(() => { });
  }, [productId, session?.access_token]);

  const { confirm: confirmModal } = useConfirmModal();
  const { lockedBy, isLockedByMe } = useNodeLock(node.id);
  const isReadOnly = externalReadOnly || (lockedBy !== null && !isLockedByMe);

  // Scope-aware action handlers
  const handleForkToSandbox = async () => {
    if (!session?.access_token) return;
    setActionLoading("fork");
    try {
      const response = await fetch("/api/scripts/sandbox/fork", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(productId ? { "X-Product-Id": productId } : {}),
        },
        body: JSON.stringify({ nodeIds: [node.id] }),
      });
      if (!response.ok) throw new Error("Failed to fork node");
      const data = await response.json();
      toast.success(`Node forked to sandbox as ${data.mapping[node.id]}`);
      if (refreshData) await refreshData("sandbox");
    } catch (err) {
      toast.error("Failed to fork node to sandbox");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublishToCommunity = async () => {
    if (!session?.access_token) return;
    setActionLoading("publish");
    try {
      const response = await fetch("/api/scripts/community/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(productId ? { "X-Product-Id": productId } : {}),
        },
        body: JSON.stringify({ nodeId: node.id }),
      });
      if (!response.ok) throw new Error("Failed to publish");
      toast.success("Node published to community!");
      if (refreshData) {
        await refreshData("community");
        await refreshData("sandbox");
      }
    } catch (err) {
      toast.error("Failed to publish node");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublish = async () => {
    if (!session?.access_token) return;
    setActionLoading("unpublish");
    try {
      const response = await fetch("/api/scripts/community/unpublish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(productId ? { "X-Product-Id": productId } : {}),
        },
        body: JSON.stringify({ nodeId: node.id }),
      });
      if (!response.ok) throw new Error("Failed to unpublish");
      toast.success("Node moved back to sandbox");
      if (refreshData) {
        await refreshData("sandbox");
        await refreshData("community");
      }
    } catch (err) {
      toast.error("Failed to unpublish node");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromoteToOfficial = async () => {
    if (!session?.access_token) return;
    setActionLoading("promote");
    try {
      const response = await fetch("/api/scripts/community/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(productId ? { "X-Product-Id": productId } : {}),
        },
        body: JSON.stringify({ nodeId: node.id }),
      });
      if (!response.ok) throw new Error("Failed to promote");
      const data = await response.json();
      toast.success(`Node promoted to official flow! (ID: ${data.officialId})`);
      if (refreshData) {
        await refreshData("official");
        await refreshData("community");
      }
    } catch (err) {
      toast.error("Failed to promote node");
    } finally {
      setActionLoading(null);
    }
  };

  // Admin delete for community/sandbox nodes (e.g. removing promoted nodes)
  const handleAdminDelete = async () => {
    if (!session?.access_token || !isAdmin) return;
    const confirmed = await confirmModal({
      title: "Delete Node",
      message: `Delete "${node.title}" permanently? This cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    setActionLoading("delete");
    try {
      const deleteUrl = activeTab === "sandbox"
        ? `/api/scripts/sandbox/nodes/${node.id}`
        : `/api/scripts/sandbox/nodes/${node.id}`;
      const response = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to delete node");
      toast.success("Node deleted");
      onClose();
    } catch (err) {
      toast.error("Failed to delete node");
    } finally {
      setActionLoading(null);
    }
  };

  // Update form when node changes
  useEffect(() => {
    setFormData(node);
    setHasChanges(false);
  }, [node]);

  const handleChange = (field: keyof CallNode, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleArrayAdd = (field: "keyPoints" | "warnings" | "listenFor") => {
    const currentArray = formData[field] || [];
    handleChange(field, [...currentArray, ""]);
  };

  const handleArrayUpdate = (
    field: "keyPoints" | "warnings" | "listenFor",
    index: number,
    value: string
  ) => {
    const currentArray = formData[field] || [];
    const newArray = [...currentArray];
    newArray[index] = value;
    handleChange(field, newArray);
  };

  const handleArrayRemove = (
    field: "keyPoints" | "warnings" | "listenFor" | "competitors",
    index: number
  ) => {
    // Competitors is nested in metadata
    if (field === "competitors") {
      const currentArray = formData.metadata?.competitors || [];
      const newArray = currentArray.filter((_, i) => i !== index);
      handleChange("metadata", { ...formData.metadata, competitors: newArray });
      return;
    }

    const currentArray = formData[field] || [];
    const newArray = currentArray.filter((_, i) => i !== index);
    handleChange(field, newArray);
  };

  const handleResponseAdd = () => {
    const currentResponses = formData.responses || [];
    handleChange("responses", [
      ...currentResponses,
      { label: "", nextNode: "", note: "" },
    ]);
  };

  const handleResponseUpdate = (
    index: number,
    field: "label" | "nextNode" | "note" | "isSpecialInstruction",
    value: string | boolean
  ) => {
    const newResponses = [...formData.responses];
    newResponses[index] = {
      ...newResponses[index],
      [field]: value,
    };
    handleChange("responses", newResponses);
  };

  const handleResponseRemove = (index: number) => {
    const newResponses = formData.responses.filter((_, i) => i !== index);
    handleChange("responses", newResponses);
  };

  const handleResponseMove = (index: number, direction: "up" | "down") => {
    const newResponses = [...formData.responses];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newResponses.length) return;
    [newResponses[index], newResponses[targetIndex]] = [newResponses[targetIndex], newResponses[index]];
    handleChange("responses", newResponses);
  };

  // Nodes available for linking (exclude current node)
  const linkableNodes = allNodes.filter((n) => n.id !== formData.id);

  const isDuplicateId = isNew && existingIds.has(formData.id) && formData.id !== node.id;

  const handleSave = async () => {
    if (isDuplicateId) return;
    try {
      setSaving(true);
      setError(null);

      // Delegate saving to the parent (ScriptEditor) so it can track history
      await onUpdate(formData);

      setHasChanges(false);
    } catch (err) {
      console.error("Error saving node:", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full h-full border-l border-border bg-background overflow-y-auto shadow-lg backdrop-blur">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary border-b border-primary-foreground/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-primary-foreground">Edit Node</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted text-white rounded hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* Lock banner */}
      {isReadOnly && (
        <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-3">
          <Lock className="h-4 w-4 text-amber-500" />
          <p className="text-xs text-amber-700 font-medium">
            Locked by <span className="font-bold">{lockedBy}</span>. You can only view this node.
          </p>
        </div>
      )}

      {/* Form */}
      <div className="p-4 space-y-6">
        {/* ID */}
        <div>
          <label className="block text-sm font-medium mb-1">ID</label>
          {isNew ? (
            <>
              <input
                type="text"
                value={formData.id}
                onChange={(e) => {
                  const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                  handleChange("id", sanitized);
                }}
                className={`w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${existingIds.has(formData.id) && formData.id !== node.id
                  ? "border-red-500"
                  : "border-border"
                  }`}
                placeholder="e.g. disc_budget_timeline"
              />
              {existingIds.has(formData.id) && formData.id !== node.id && (
                <p className="text-[10px] text-red-500 mt-1">This ID already exists</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Use lowercase letters, numbers, and underscores only. Should start with type prefix (e.g. disc_, pitch_, obj_).
              </p>
            </>
          ) : (
            <input
              type="text"
              value={formData.id}
              disabled
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm opacity-60 cursor-not-allowed"
            />
          )}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <input
            type="text"
            value={formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}
            disabled
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm opacity-60 cursor-not-allowed"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Node type is set at creation and cannot be changed.
          </p>
        </div>

        {/* Topic Group */}
        <div>
          <label className="block text-sm font-medium mb-1">Topic Group</label>
          <ThemedSelect
            value={(formData as any).topic_group_id === "uncategorized" ? "" : (formData as any).topic_group_id || ""}
            onChange={(val) => handleChange("topic_group_id" as any, val || "uncategorized")}
            options={[
              { id: "", name: "None (Uncategorized)" },
              ...(topics && topics.length > 0 ? topics : topicGroups).map(g => ({ id: g.id, name: g.label }))
            ]}
            className="w-full"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Setting a topic group makes this node visible in the Call Screen navigation.
          </p>
        </div>

        {/* Call Flow Assignment - hidden for opening nodes since they define the flow */}
        {formData.type !== "opening" && (() => {
          const openingNodes = (allNodes || []).filter(n => n.type === "opening");
          const isUniversal = formData.call_flow_ids === null || formData.call_flow_ids === undefined;
          return openingNodes.length > 0 ? (
            <div>
              <label className="block text-sm font-medium mb-1">Call Flow Assignment</label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUniversal}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleChange("call_flow_ids" as any, null);
                      } else {
                        // Uncheck universal — set to empty array so individual flows can be selected
                        handleChange("call_flow_ids" as any, []);
                      }
                    }}
                    disabled={isReadOnly}
                    className="h-4 w-4 rounded border-gray-300 accent-[var(--color-primary)] focus:ring-primary"
                  />
                  <span className={isUniversal ? "font-medium" : ""}>Universal (show in all flows)</span>
                </label>
                {openingNodes.map(openingNode => {
                  const flowIds = formData.call_flow_ids || [];
                  const isChecked = flowIds.includes(openingNode.id);
                  return (
                    <label key={openingNode.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          let newIds: string[];
                          if (e.target.checked) {
                            newIds = [...flowIds, openingNode.id];
                          } else {
                            newIds = flowIds.filter((id: string) => id !== openingNode.id);
                          }
                          handleChange("call_flow_ids" as any, newIds);
                        }}
                        disabled={isReadOnly || isUniversal}
                        className="h-4 w-4 rounded border-gray-300 accent-[var(--color-primary)] focus:ring-primary disabled:opacity-40"
                      />
                      <span className={isUniversal ? "opacity-50" : ""}>{openingNode.title}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Universal nodes appear in all call flows. Uncheck to assign to specific flows only.
              </p>
            </div>
          ) : null;
        })()}

        {/* Outcome */}
        <div>
          <label className="block text-sm font-medium mb-1">Outcome</label>
          <ThemedSelect
            value={formData.metadata?.outcome || ""}
            onChange={(val) => {
              handleChange("metadata", {
                ...formData.metadata,
                outcome: val || null,
              });
            }}
            options={[
              { id: "", name: "None (In-progress)" },
              { id: "meeting_set", name: "Meeting Scheduled" },
              { id: "follow_up", name: "Follow-up Scheduled" },
              { id: "send_info", name: "Information Sent" },
              { id: "not_interested", name: "Not Interested" },
            ]}
            className="w-full"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Designating an outcome triggers UI behavior (like showing meeting details) when this node is reached.
          </p>
        </div>

        {/* Environment Triggers (Dynamic) */}
        <div className="space-y-4 p-4 bg-purple-500/5 rounded-lg border border-purple-500/10">
          <h4 className="text-sm font-semibold text-purple-700">Environment Triggers</h4>
          {envTriggerDefs.map((triggerDef) => {
            const TriggerIcon = (LucideIcons as Record<string, any>)[triggerDef.icon] || LucideIcons.HelpCircle;
            // Legacy keys read from top-level metadata fields, others from environmentTriggers map
            const legacyKeys: Record<string, string> = { ehr: "ehr", dms: "dms", competitors: "competitors" };
            const isLegacyKey = triggerDef.key in legacyKeys;

            const getValue = (): string | string[] => {
              if (isLegacyKey) {
                const legacyVal = (formData.metadata as any)?.[triggerDef.key];
                if (legacyVal !== undefined && legacyVal !== "" && !(Array.isArray(legacyVal) && legacyVal.length === 0)) return legacyVal;
              }
              return formData.metadata?.environmentTriggers?.[triggerDef.key] ?? (triggerDef.type === "array" ? [] : "");
            };

            const setValue = (val: string | string[]) => {
              const newEnvTriggers = { ...formData.metadata?.environmentTriggers, [triggerDef.key]: val };
              const metaUpdate: any = { ...formData.metadata, environmentTriggers: newEnvTriggers };
              // Also write to legacy fields for backward compat
              if (isLegacyKey) {
                metaUpdate[triggerDef.key] = val;
              }
              handleChange("metadata", metaUpdate);
            };

            const currentValue = getValue();

            if (triggerDef.type === "array") {
              const arrValue = Array.isArray(currentValue) ? currentValue : [];
              return (
                <div key={triggerDef.key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                      <TriggerIcon className="h-3.5 w-3.5 text-purple-500" />
                      {triggerDef.label}
                    </label>
                    <button
                      onClick={() => setValue([...arrValue, ""])}
                      disabled={isReadOnly}
                      className="flex items-center gap-1 text-[10px] text-primary hover:underline disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {arrValue.map((item: string, index: number) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const newArr = [...arrValue];
                            newArr[index] = e.target.value;
                            setValue(newArr);
                          }}
                          disabled={isReadOnly}
                          className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                          placeholder={`${triggerDef.label} item`}
                        />
                        {!isReadOnly && (
                          <button
                            onClick={() => {
                              const newArr = arrValue.filter((_: string, i: number) => i !== index);
                              setValue(newArr);
                            }}
                            className="p-2 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // Text type
            return (
              <div key={triggerDef.key}>
                <label className="block text-xs font-medium mb-1 flex items-center gap-1.5">
                  <TriggerIcon className="h-3.5 w-3.5 text-purple-500" />
                  {triggerDef.label}
                </label>
                <input
                  type="text"
                  value={typeof currentValue === "string" ? currentValue : ""}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder={`Enter ${triggerDef.label.toLowerCase()}`}
                />
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground mt-2">
            Setting these values will trigger their appearance in the &quot;Call Context&quot; panel on the left side of the call screen.
          </p>
        </div>

        {/* AI Configuration (Dynamic) */}
        <div className="space-y-4 p-4 bg-blue-500/5 rounded-lg border border-blue-500/10">
          <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-2">
            <LucideIcons.Bot className="w-4 h-4" />
            AI Co-Pilot Configuration
          </h4>

          <div>
            <label className="block text-xs font-medium mb-1">AI Intent (What is the purpose of this node?)</label>
            <input
              type="text"
              value={formData.metadata?.aiIntent || ""}
              onChange={(e) => handleChange("metadata", { ...formData.metadata, aiIntent: e.target.value })}
              disabled={isReadOnly}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              placeholder="e.g., Uncover budget constraints"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium">Auto-Navigation Triggers</label>
              <button
                onClick={() => {
                  const current = formData.metadata?.aiTransitionTriggers || [];
                  handleChange("metadata", {
                    ...formData.metadata,
                    aiTransitionTriggers: [...current, { condition: "", targetNodeId: "", confidence: "high" }]
                  });
                }}
                disabled={isReadOnly}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                Add Trigger
              </button>
            </div>
            <div className="space-y-3">
              {(formData.metadata?.aiTransitionTriggers || []).map((trigger: any, index: number) => (
                <div key={index} className="p-2 border border-blue-500/20 rounded bg-background space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="text"
                      value={trigger.condition}
                      onChange={(e) => {
                        const current = [...(formData.metadata?.aiTransitionTriggers || [])];
                        current[index].condition = e.target.value;
                        handleChange("metadata", { ...formData.metadata, aiTransitionTriggers: current });
                      }}
                      disabled={isReadOnly}
                      className="flex-1 px-2 py-1.5 border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="e.g., Prospect says it's too expensive"
                    />
                    {!isReadOnly && (
                      <button
                        onClick={() => {
                          const current = [...(formData.metadata?.aiTransitionTriggers || [])];
                          current.splice(index, 1);
                          handleChange("metadata", { ...formData.metadata, aiTransitionTriggers: current });
                        }}
                        className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <NodePicker
                      value={trigger.targetNodeId}
                      onChange={(val) => {
                        const current = [...(formData.metadata?.aiTransitionTriggers || [])];
                        current[index].targetNodeId = val;
                        handleChange("metadata", { ...formData.metadata, aiTransitionTriggers: current });
                      }}
                      nodes={linkableNodes}
                      disabled={isReadOnly}
                    />
                    <ThemedSelect
                      value={trigger.confidence}
                      onChange={(val) => {
                        const current = [...(formData.metadata?.aiTransitionTriggers || [])];
                        current[index].confidence = val as "high" | "medium";
                        handleChange("metadata", { ...formData.metadata, aiTransitionTriggers: current });
                      }}
                      options={[
                        { id: "high", name: "High Confidence" },
                        { id: "medium", name: "Medium Confidence" },
                      ]}
                      className="w-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            These rules instruct the AI Co-Pilot on when to automatically move to the next script node based on real-time transcript analysis.
          </p>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            disabled={isReadOnly}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            placeholder="Enter node title"
          />
        </div>

        {/* Script */}
        <div>
          <label className="block text-sm font-medium mb-1">Script</label>
          <textarea
            value={formData.script}
            onChange={(e) => handleChange("script", e.target.value)}
            disabled={isReadOnly}
            rows={6}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
            placeholder="Enter script here..."
          />
        </div>

        {/* Context */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Context <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            value={formData.context || ""}
            onChange={(e) => handleChange("context", e.target.value || undefined)}
            disabled={isReadOnly}
            rows={3}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
            placeholder="Enter context information"
          />
        </div>

        {/* Key Points */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Key Points</label>
            <button
              onClick={() => handleArrayAdd("keyPoints")}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
          <div className="space-y-2">
            {(formData.keyPoints || []).map((point, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={point}
                  onChange={(e) =>
                    handleArrayUpdate("keyPoints", index, e.target.value)
                  }
                  disabled={isReadOnly}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="Key point"
                />
                {!isReadOnly && (
                  <button
                    onClick={() => handleArrayRemove("keyPoints", index)}
                    className="p-2 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {(!formData.keyPoints || formData.keyPoints.length === 0) && (
              <p className="text-xs text-muted-foreground">No key points added</p>
            )}
          </div>
        </div>

        {/* Listen For */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Listen For</label>
            <button
              onClick={() => handleArrayAdd("listenFor")}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
          <div className="space-y-2">
            {(formData.listenFor || []).map((item, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) =>
                    handleArrayUpdate("listenFor", index, e.target.value)
                  }
                  disabled={isReadOnly}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="Listen for item"
                />
                {!isReadOnly && (
                  <button
                    onClick={() => handleArrayRemove("listenFor", index)}
                    className="p-2 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {(!formData.listenFor || formData.listenFor.length === 0) && (
              <p className="text-xs text-muted-foreground">No listen for items added</p>
            )}
          </div>
        </div>

        {/* Warnings */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Warnings/Avoid</label>
            <button
              onClick={() => handleArrayAdd("warnings")}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
          <div className="space-y-2">
            {(formData.warnings || []).map((warning, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={warning}
                  onChange={(e) =>
                    handleArrayUpdate("warnings", index, e.target.value)
                  }
                  disabled={isReadOnly}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="Warning"
                />
                {!isReadOnly && (
                  <button
                    onClick={() => handleArrayRemove("warnings", index)}
                    className="p-2 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {(!formData.warnings || formData.warnings.length === 0) && (
              <p className="text-xs text-muted-foreground">No warnings added</p>
            )}
          </div>
        </div>

        {/* Responses */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Responses</label>
            <button
              onClick={handleResponseAdd}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
          <div className="space-y-3">
            {formData.responses.map((response, index) => (
              <div
                key={index}
                className={`p-3 border rounded-lg space-y-2 transition-all ${response.isSpecialInstruction
                  ? "bg-amber-500/5 border-amber-500/20"
                  : "bg-card border-border"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Response {index + 1}
                    </span>
                    {response.isSpecialInstruction && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 text-[10px] font-bold rounded uppercase tracking-wider border border-amber-500/20">
                        <LucideIcons.Bot className="h-2.5 w-2.5" />
                        Instruction
                      </span>
                    )}
                  </div>
                  {!isReadOnly && (
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleResponseMove(index, "up")}
                        disabled={index === 0}
                        className="p-1 hover:bg-primary/10 text-muted-foreground rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleResponseMove(index, "down")}
                        disabled={index === formData.responses.length - 1}
                        className="p-1 hover:bg-primary/10 text-muted-foreground rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => handleResponseRemove(index)}
                        className="p-1 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={response.label}
                      onChange={(e) =>
                        handleResponseUpdate(index, "label", e.target.value)
                      }
                      disabled={isReadOnly}
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                      placeholder="Response label"
                    />
                    {!isReadOnly && (
                      <label className="flex items-center gap-1.5 px-2 py-1.5 bg-background border border-border rounded-lg cursor-pointer hover:border-amber-500/40 transition-colors group">
                        <input
                          type="checkbox"
                          checked={response.isSpecialInstruction || false}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            const newResponses = [...formData.responses];
                            newResponses[index] = {
                              ...newResponses[index],
                              isSpecialInstruction: isChecked,
                              nextNode: isChecked ? "" : newResponses[index].nextNode
                            };
                            handleChange("responses", newResponses);
                          }}
                          className="h-3.5 w-3.5 rounded border-gray-300 accent-amber-500"
                        />
                        <span className="text-[10px] font-medium text-muted-foreground group-hover:text-amber-600 transition-colors whitespace-nowrap">
                          Coaching
                        </span>
                      </label>
                    )}
                  </div>

                  {!response.isSpecialInstruction ? (
                    <NodePicker
                      value={response.nextNode}
                      onChange={(val) => handleResponseUpdate(index, "nextNode", val)}
                      nodes={linkableNodes}
                      disabled={isReadOnly}
                    />
                  ) : (
                    <div className="px-3 py-2 bg-amber-500/5 border border-dashed border-amber-500/20 rounded-lg text-[11px] text-amber-700/70 italic flex items-center gap-2">
                      <LucideIcons.Info className="h-3 w-3" />
                      No next node connection required for coaching instructions.
                    </div>
                  )}

                  <textarea
                    value={response.note || ""}
                    onChange={(e) =>
                      handleResponseUpdate(index, "note", e.target.value)
                    }
                    disabled={isReadOnly}
                    rows={response.isSpecialInstruction ? 3 : 1}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 resize-none"
                    placeholder={
                      response.isSpecialInstruction
                        ? "Enter instructions for the rep on how to handle this scenario..."
                        : "Note (optional)"
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 pt-4 border-t border-border bg-background space-y-2">
          {/* Save button (hidden in community read-only view) */}
          {activeTab !== "community" && (
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving || isReadOnly || isDuplicateId}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isReadOnly ? "View Only" : (hasChanges ? "Save Changes" : "No Changes")}
                </>
              )}
            </button>
          )}

          {/* Scope-aware action buttons */}
          {((activeTab === "official" && !isAdmin) || (activeTab === "community" && node.owner_user_id !== session?.user?.id)) && !isNew && (
            <div className="space-y-1">
              <button
                onClick={handleForkToSandbox}
                disabled={actionLoading !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === "fork" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitFork className="h-4 w-4" />}
                {activeTab === "community" ? "Copy to My Sandbox" : "Fork to My Sandbox"}
              </button>
              {activeTab === "community" && (
                <p className="text-[10px] text-muted-foreground text-center px-2">
                  Creates a personal copy in your sandbox. The community node stays.
                </p>
              )}
            </div>
          )}

          {activeTab === "official" && isAdmin && !isNew && (
            <div className="text-center p-3 bg-muted/40 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground italic">
                You are editing an official node. Changes affect all users.
              </p>
            </div>
          )}

          {activeTab === "sandbox" && !isNew && (
            <button
              onClick={handlePublishToCommunity}
              disabled={actionLoading !== null || hasChanges}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              title={hasChanges ? "Save changes before publishing" : ""}
            >
              {actionLoading === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Publish to Community
            </button>
          )}

          {activeTab === "community" && node.owner_user_id === session?.user?.id && (
            <button
              onClick={handleUnpublish}
              disabled={actionLoading !== null}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {actionLoading === "unpublish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              Unpublish (Move to Sandbox)
            </button>
          )}

          {activeTab === "community" && isAdmin && (
            <div className="space-y-2">
              <button
                onClick={handlePromoteToOfficial}
                disabled={actionLoading !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {actionLoading === "promote" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                Promote to Official Flow
              </button>
              <p className="text-[10px] text-muted-foreground text-center px-2">
                Copies this node to the official flow and moves the original back to the author's sandbox.
              </p>
              <button
                onClick={handleAdminDelete}
                disabled={actionLoading !== null}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/10 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50 text-sm"
              >
                {actionLoading === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete from Community
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Save, Loader2, Lock, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { CallNode } from "@/data/callFlow";
import { Session } from "@supabase/supabase-js";
import { useNodeLock } from "@/hooks/useNodeLock";
import { topicGroups } from "@/data/topicGroups";

interface NodeEditPanelProps {
  node: CallNode;
  onClose: () => void;
  onUpdate: (updatedNode: CallNode) => Promise<void>;
  session: Session | null;
  isNew?: boolean;
  existingIds?: Set<string>;
  allNodes?: CallNode[];
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
        className="w-full flex items-center justify-between px-3 py-2 bg-background border border-primary-light/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 text-left"
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
        <div className="absolute z-50 mt-1 w-full bg-background border border-primary-light/20 rounded-lg shadow-xl max-h-64 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-primary-light/20">
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
                  className={`w-full text-left px-3 py-2.5 hover:bg-primary-light/10 transition-colors border-b border-primary-light/10 last:border-0 ${
                    n.id === value ? "bg-primary-light/15" : ""
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
}: NodeEditPanelProps) {
  const [formData, setFormData] = useState<CallNode>(node);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { lockedBy, isLockedByMe } = useNodeLock(node.id);
  const isReadOnly = lockedBy !== null && !isLockedByMe;

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
    field: "keyPoints" | "warnings" | "listenFor",
    index: number
  ) => {
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
    field: "label" | "nextNode" | "note",
    value: string
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
    <div className="w-full h-full border-l border-primary-light/20 bg-background overflow-y-auto shadow-lg backdrop-blur">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary-light border-b border-primary-light/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Edit Node</h3>
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
                className={`w-full px-3 py-2 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                  existingIds.has(formData.id) && formData.id !== node.id
                    ? "border-red-500"
                    : "border-primary-light/20"
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
              className="w-full px-3 py-2 bg-muted border border-primary-light/20 rounded-lg text-sm opacity-60 cursor-not-allowed"
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
            className="w-full px-3 py-2 bg-muted border border-primary-light/20 rounded-lg text-sm opacity-60 cursor-not-allowed"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Node type is set at creation and cannot be changed.
          </p>
        </div>

        {/* Topic Group */}
        <div>
          <label className="block text-sm font-medium mb-1">Topic Group</label>
          <select
            value={(formData as any).topic_group_id === "uncategorized" ? "" : (formData as any).topic_group_id || ""}
            onChange={(e) => handleChange("topic_group_id" as any, e.target.value || "uncategorized")}
            disabled={isReadOnly}
            className="w-full px-3 py-2 bg-background border border-primary-light/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          >
            <option value="">None (Uncategorized)</option>
            {topicGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Setting a topic group makes this node visible in the Call Screen navigation.
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
            className="w-full px-3 py-2 bg-background border border-primary-light/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
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
            className="w-full px-3 py-2 bg-background border border-primary-light/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
            placeholder="Enter script text"
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
            className="w-full px-3 py-2 bg-background border border-primary-light/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
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
                  className="flex-1 px-3 py-2 bg-background border border-primary-light/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
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
                  className="flex-1 px-3 py-2 bg-background border border-primary-light/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
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
                  className="flex-1 px-3 py-2 bg-background border border-primary-light/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
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
                className="p-3 bg-primary-light/10 border border-primary-light/50 rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Response {index + 1}
                  </span>
                  {!isReadOnly && (
                    <button
                      onClick={() => handleResponseRemove(index)}
                      className="p-1 hover:bg-red-500/10 text-red-500 rounded transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={response.label}
                  onChange={(e) =>
                    handleResponseUpdate(index, "label", e.target.value)
                  }
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 bg-background border border-primary-light/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="Response label"
                />
                <NodePicker
                  value={response.nextNode}
                  onChange={(val) => handleResponseUpdate(index, "nextNode", val)}
                  nodes={linkableNodes}
                  disabled={isReadOnly}
                />
                <input
                  type="text"
                  value={response.note || ""}
                  onChange={(e) =>
                    handleResponseUpdate(index, "note", e.target.value)
                  }
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 bg-background border border-primary-light/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  placeholder="Note (optional)"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 pt-4 border-t border-primary-light/50 bg-background">
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
                {isReadOnly ? "Locked Member" : (hasChanges ? "Save Changes" : "No Changes")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

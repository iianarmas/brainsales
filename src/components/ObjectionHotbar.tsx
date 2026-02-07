"use client";

import { useMemo, useState, useCallback } from "react";
import { useCallStore } from "@/store/callStore";
import { useObjectionShortcuts } from "@/hooks/useObjectionShortcuts";
import { AlertCircle, ChevronDown, ChevronUp, CornerUpLeft, Settings, X, Save, RotateCcw } from "lucide-react";
import { UserObjectionPreference } from "@/types/product";
import { toast } from "sonner";

const SHORTCUT_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function ObjectionHotbar() {
  const { navigateTo, currentNodeId, previousNonObjectionNode, returnToFlow, scripts } = useCallStore();
  const {
    nodeToKey,
    hasCustomized,
    selectedNodeIds,
    saveUserPreferences,
    resetToDefaults,
  } = useObjectionShortcuts();
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit mode state: tracks which nodes are selected and their shortcut keys
  const [editSelections, setEditSelections] = useState<Map<string, string | null>>(new Map());

  // All objection nodes from scripts
  const allObjectionNodes = useMemo(() => {
    return Object.values(scripts)
      .filter(n => n.type === "objection")
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [scripts]);

  // Derive objection lists from scripts store, using dynamic shortcuts
  const { commonObjections, moreObjections } = useMemo(() => {
    const common: { id: string; label: string; shortcut: string }[] = [];
    const more: { id: string; label: string; shortcut: string }[] = [];

    const objectionNodes = hasCustomized
      ? allObjectionNodes.filter(n => selectedNodeIds.includes(n.id))
      : allObjectionNodes;

    objectionNodes.forEach(node => {
      const shortcut = nodeToKey[node.id];
      if (shortcut !== undefined) {
        common.push({ id: node.id, label: node.title, shortcut });
      } else {
        more.push({ id: node.id, label: node.title, shortcut: "" });
      }
    });

    // Sort common by shortcut number
    common.sort((a, b) => a.shortcut.localeCompare(b.shortcut));

    return { commonObjections: common, moreObjections: more };
  }, [scripts, nodeToKey, hasCustomized, selectedNodeIds, allObjectionNodes]);

  const handleObjection = (objectionId: string) => {
    navigateTo(objectionId);
  };

  // Check if we're currently on an objection node
  const currentNode = scripts[currentNodeId];
  const isOnObjection = currentNode?.type === "objection";

  // Get the title of the node we can return to
  const returnNodeTitle = previousNonObjectionNode
    ? scripts[previousNonObjectionNode]?.title
    : null;

  // Enter edit mode: initialize selections from current state
  const enterEditMode = useCallback(() => {
    const selections = new Map<string, string | null>();

    if (hasCustomized) {
      // Initialize from user's current preferences
      selectedNodeIds.forEach(nodeId => {
        selections.set(nodeId, nodeToKey[nodeId] || null);
      });
    } else {
      // Initialize from admin defaults — all objections visible, admin shortcuts preserved
      allObjectionNodes.forEach(node => {
        selections.set(node.id, nodeToKey[node.id] || null);
      });
    }

    setEditSelections(selections);
    setEditMode(true);
    setExpanded(true);
  }, [hasCustomized, selectedNodeIds, nodeToKey, allObjectionNodes]);

  const cancelEditMode = () => {
    setEditMode(false);
  };

  const toggleNodeSelection = (nodeId: string) => {
    setEditSelections(prev => {
      const next = new Map(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.set(nodeId, null);
      }
      return next;
    });
  };

  const assignShortcutKey = (nodeId: string, key: string | null) => {
    setEditSelections(prev => {
      const next = new Map(prev);
      // If this key is already assigned to another node, clear it
      if (key !== null) {
        for (const [nid, k] of next) {
          if (k === key && nid !== nodeId) {
            next.set(nid, null);
          }
        }
      }
      next.set(nodeId, key);
      return next;
    });
  };

  const getUsedKeys = (): Set<string> => {
    const used = new Set<string>();
    for (const [, key] of editSelections) {
      if (key !== null) used.add(key);
    }
    return used;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const prefs: UserObjectionPreference[] = [];
      for (const [nodeId, key] of editSelections) {
        prefs.push({ node_id: nodeId, shortcut_key: key });
      }
      await saveUserPreferences(prefs);
      setEditMode(false);
      toast.success("Objection preferences saved");
    } catch (err) {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await resetToDefaults();
      setEditMode(false);
      toast.success("Reset to default shortcuts");
    } catch (err) {
      toast.error("Failed to reset preferences");
    } finally {
      setSaving(false);
    }
  };

  // Edit mode UI
  if (editMode) {
    const usedKeys = getUsedKeys();
    const selectedCount = editSelections.size;

    return (
      <div className="bg-violet-50 border-t border-[#502c85]/20">
        {/* Edit mode header */}
        <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-[#502c85]/20">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[#502c85]" />
            <span className="text-sm font-medium text-[#502c85]">
              Customize Objections
            </span>
            <span className="text-xs text-[#502c85]/60">
              ({selectedCount} selected)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasCustomized && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 text-xs text-[#502c85]/70 hover:text-[#502c85] hover:bg-[#502c85]/10 rounded transition-colors"
                title="Reset to admin defaults"
              >
                <RotateCcw className="h-3 w-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
            <button
              onClick={cancelEditMode}
              disabled={saving}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-[#502c85] text-white rounded hover:bg-[#502c85]/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save
            </button>
          </div>
        </div>

        {/* Objection checklist */}
        <div className="px-3 md:px-4 py-2 max-h-[300px] overflow-y-auto">
          <div className="space-y-1">
            {allObjectionNodes.map(node => {
              const isSelected = editSelections.has(node.id);
              const assignedKey = editSelections.get(node.id) ?? null;

              return (
                <div
                  key={node.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                    isSelected
                      ? "bg-white border border-[#502c85]/30"
                      : "bg-transparent border border-transparent hover:bg-white/50"
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleNodeSelection(node.id)}
                    className="h-4 w-4 rounded border-gray-300 text-[#502c85] focus:ring-[#502c85] cursor-pointer flex-shrink-0"
                  />

                  {/* Label */}
                  <span
                    className={`flex-1 truncate cursor-pointer ${
                      isSelected ? "text-[#502c85] font-medium" : "text-gray-500"
                    }`}
                    onClick={() => toggleNodeSelection(node.id)}
                  >
                    {node.title}
                  </span>

                  {/* Shortcut key selector */}
                  {isSelected && (
                    <select
                      value={assignedKey || ""}
                      onChange={(e) =>
                        assignShortcutKey(node.id, e.target.value || null)
                      }
                      className="bg-white border border-[#502c85]/30 rounded px-1.5 py-0.5 text-xs text-[#502c85] focus:outline-none focus:ring-1 focus:ring-[#502c85]/50 w-16 flex-shrink-0"
                    >
                      <option value="">No key</option>
                      {SHORTCUT_KEYS.map(k => (
                        <option
                          key={k}
                          value={k}
                          disabled={usedKeys.has(k) && assignedKey !== k}
                        >
                          Key {k}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Normal mode UI
  return (
    <div className="bg-violet-50 border-t border-[#502c85]/20">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 md:px-4 py-1.5 md:py-2 hover:bg-[#502c85]/10 transition-colors touch-manipulation"
      >
        <div className="flex items-center gap-1.5 md:gap-2">
          <AlertCircle className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#502c85]" />
          <span className="text-xs md:text-sm font-medium text-[#502c85]">
            <span className="hidden sm:inline">Quick </span>Objections
          </span>
          {isOnObjection && (
            <span className="text-[10px] md:text-xs bg-[#502c85] text-white px-1.5 md:px-2 py-0.5 rounded">
              Handling
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Edit/customize button */}
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              enterEditMode();
            }}
            className="p-1 hover:bg-[#502c85]/20 rounded transition-colors"
            title="Customize objections"
          >
            <Settings className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#502c85]" />
          </span>
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#502c85]" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#502c85]" />
          )}
        </div>
      </button>

      {/* Quick access buttons - always visible, horizontally scrollable on mobile */}
      <div className="px-2 md:px-4 pb-2">
        <div className="flex gap-1.5 md:gap-1 items-center overflow-x-auto scrollbar-hide pb-1 -mx-2 px-2 md:mx-0 md:px-0 md:flex-wrap">
          {/* Return to Flow button - only show when we have somewhere to return */}
          {previousNonObjectionNode && (
            <button
              onClick={returnToFlow}
              className="inline-flex items-center gap-1 px-2.5 md:px-2 py-1.5 md:py-1 text-xs rounded transition-colors bg-[#502c85]/40 text-[#502c85] hover:bg-[#502c85] hover:text-white active:bg-[#502c85] active:text-white mr-1 md:mr-2 flex-shrink-0 touch-manipulation"
              title={`Return to: ${returnNodeTitle}`}
            >
              <CornerUpLeft className="h-3 w-3" />
              <span className="hidden sm:inline">Return to Flow</span>
              <span className="sm:hidden">Back</span>
            </button>
          )}

          {commonObjections.map((obj) => (
            <button
              key={obj.id}
              onClick={() => handleObjection(obj.id)}
              className={`inline-flex items-center gap-1 px-2.5 md:px-2 py-1.5 md:py-1 text-xs rounded transition-colors flex-shrink-0 touch-manipulation ${currentNodeId === obj.id
                ? "bg-[#502c85] text-white"
                : "bg-white text-[#502c85] border border-[#502c85] hover:bg-[#502c85] hover:text-white active:bg-[#502c85] active:text-white"
                }`}
              title={`Jump to: ${obj.label}`}
            >
              {obj.shortcut && (
                <kbd className="text-[10px] opacity-60 hidden md:inline">{obj.shortcut}</kbd>
              )}
              {obj.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expanded section with more objections */}
      {expanded && moreObjections.length > 0 && (
        <div className="px-2 md:px-4 pb-2 md:pb-3 pt-1 border-t border-[#502c85]/20">
          <p className="text-[10px] md:text-xs font-bold text-[#502c85] mb-1.5 md:mb-2">More objections:</p>
          <div className="flex gap-1.5 md:gap-1 overflow-x-auto scrollbar-hide pb-1 -mx-2 px-2 md:mx-0 md:px-0 md:flex-wrap">
            {moreObjections.map((obj) => (
              <button
                key={obj.id}
                onClick={() => handleObjection(obj.id)}
                className={`inline-flex items-center gap-1 px-2.5 md:px-2 py-1.5 md:py-1 text-xs rounded transition-colors flex-shrink-0 touch-manipulation ${currentNodeId === obj.id
                  ? "bg-[#502c85] text-white"
                  : "bg-white text-[#502c85] border border-[#502c85] hover:bg-[#502c85] hover:text-white active:bg-[#502c85] active:text-white"
                  }`}
                title={`Jump to: ${obj.label}`}
              >
                {obj.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

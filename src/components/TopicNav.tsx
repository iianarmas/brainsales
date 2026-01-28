"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { topicGroups, getTopicForNode } from "@/data/topicGroups";

export function TopicNav() {
  const { currentNodeId, navigateTo, scripts } = useCallStore();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Find which topic the current node belongs to
  const currentTopic = getTopicForNode(currentNodeId);

  // Helper to get nodes for a topic group
  // Dynamic topic_group_id from the DB is the source of truth.
  // Static lists are only used as a fallback when topic_group_id is not set.
  const getNodesForTopic = (topicId: string) => {
    const staticNodes = topicGroups.find(t => t.id === topicId)?.nodes || [];

    const result: string[] = [];
    const seen = new Set<string>();

    // First pass: add all nodes that have topic_group_id explicitly set to this topic
    for (const [id, node] of Object.entries(scripts)) {
      const n = node as any;
      if (n.topic_group_id === topicId) {
        if (!seen.has(id)) {
          seen.add(id);
          result.push(id);
        }
      }
    }

    // Second pass: add static nodes only if topic_group_id was never set (null/undefined).
    // Nodes explicitly set to "uncategorized" or reassigned to another group are excluded.
    for (const id of staticNodes) {
      if (seen.has(id)) continue;
      const node = scripts[id];
      if (!node) continue;
      const n = node as any;
      if (n.topic_group_id == null) {
        seen.add(id);
        result.push(id);
      }
    }

    return result;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenDropdown(null);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleNodeSelect = (nodeId: string) => {
    navigateTo(nodeId);
    setOpenDropdown(null);
  };

  return (
    <div
      ref={navRef}
      className="fixed top-[60px] left-0 right-0 z-40 pt-3 bg-white border-b border-gray-200 px-4 py-2"
    >
      <div className="flex items-center gap-1 flex-wrap">
        {topicGroups.map((topic) => {
          const Icon = topic.icon;
          const isActive = currentTopic?.id === topic.id;
          const isOpen = openDropdown === topic.id;

          return (
            <div key={topic.id} className="relative">
              <button
                onClick={() =>
                  setOpenDropdown(isOpen ? null : topic.id)
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isActive
                  ? "bg-primary text-white"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
              >
                <Icon className="h-4 w-4" />
                <span>{topic.label}</span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              {/* Dropdown */}
              {isOpen && (
                <div
                  className="absolute top-full left-0 mt-1 min-w-[200px] bg-white rounded-lg shadow-lg border border-primary/20 z-50 py-1"
                >
                  {getNodesForTopic(topic.id).map((nodeId) => {
                    const node = scripts[nodeId];
                    if (!node) return null;

                    const isCurrentNode = currentNodeId === nodeId;

                    return (
                      <button
                        key={nodeId}
                        onClick={() => handleNodeSelect(nodeId)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${isCurrentNode
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${isCurrentNode ? "bg-primary" : "bg-gray-300"
                              }`}
                          />
                          <span className="truncate">{node.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
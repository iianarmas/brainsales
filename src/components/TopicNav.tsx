"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { callFlow } from "@/data/callFlow";
import { topicGroups, getTopicForNode } from "@/data/topicGroups";

// Color configurations for each topic
const colorConfig: Record<
  string,
  { bg: string; bgActive: string; text: string; textActive: string; border: string }
> = {
  green: {
    bg: "bg-green-50",
    bgActive: "bg-green-500",
    text: "text-green-700",
    textActive: "text-white",
    border: "border-green-200",
  },
  blue: {
    bg: "bg-blue-50",
    bgActive: "bg-blue-500",
    text: "text-blue-700",
    textActive: "text-white",
    border: "border-blue-200",
  },
  cyan: {
    bg: "bg-cyan-50",
    bgActive: "bg-cyan-500",
    text: "text-cyan-700",
    textActive: "text-white",
    border: "border-cyan-200",
  },
  purple: {
    bg: "bg-purple-50",
    bgActive: "bg-purple-500",
    text: "text-purple-700",
    textActive: "text-white",
    border: "border-purple-200",
  },
  pink: {
    bg: "bg-pink-50",
    bgActive: "bg-pink-500",
    text: "text-pink-700",
    textActive: "text-white",
    border: "border-pink-200",
  },
  yellow: {
    bg: "bg-yellow-50",
    bgActive: "bg-yellow-500",
    text: "text-yellow-700",
    textActive: "text-white",
    border: "border-yellow-200",
  },
  orange: {
    bg: "bg-orange-50",
    bgActive: "bg-orange-500",
    text: "text-orange-700",
    textActive: "text-white",
    border: "border-orange-200",
  },
  gray: {
    bg: "bg-gray-50",
    bgActive: "bg-gray-500",
    text: "text-gray-700",
    textActive: "text-white",
    border: "border-gray-200",
  },
};

export function TopicNav() {
  const { currentNodeId, navigateTo } = useCallStore();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Find which topic the current node belongs to
  const currentTopic = getTopicForNode(currentNodeId);

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
      className="bg-white border-b border-gray-200 px-4 py-2"
    >
      <div className="flex items-center gap-1 flex-wrap">
        {topicGroups.map((topic) => {
          const Icon = topic.icon;
          const colors = colorConfig[topic.color] || colorConfig.gray;
          const isActive = currentTopic?.id === topic.id;
          const isOpen = openDropdown === topic.id;

          return (
            <div key={topic.id} className="relative">
              <button
                onClick={() =>
                  setOpenDropdown(isOpen ? null : topic.id)
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? `${colors.bgActive} ${colors.textActive}`
                    : `${colors.bg} ${colors.text} hover:opacity-80`
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{topic.label}</span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown */}
              {isOpen && (
                <div
                  className={`absolute top-full left-0 mt-1 min-w-[200px] bg-white rounded-lg shadow-lg border ${colors.border} z-50 py-1`}
                >
                  {topic.nodes.map((nodeId) => {
                    const node = callFlow[nodeId];
                    if (!node) return null;

                    const isCurrentNode = currentNodeId === nodeId;

                    return (
                      <button
                        key={nodeId}
                        onClick={() => handleNodeSelect(nodeId)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          isCurrentNode
                            ? `${colors.bg} ${colors.text} font-medium`
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isCurrentNode ? colors.bgActive : "bg-gray-300"
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

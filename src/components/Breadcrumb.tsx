"use client";

import { useCallStore } from "@/store/callStore";
import { callFlow } from "@/data/callFlow";
import { ChevronRight, X } from "lucide-react";

const nodeTypeColors: Record<string, string> = {
  opening: "bg-green-100 text-green-800 border-green-200",
  discovery: "bg-blue-100 text-blue-800 border-blue-200",
  pitch: "bg-purple-100 text-purple-800 border-purple-200",
  objection: "bg-red-100 text-red-800 border-red-200",
  close: "bg-orange-100 text-orange-800 border-orange-200",
  success: "bg-green-100 text-green-800 border-green-200",
  end: "bg-gray-100 text-gray-800 border-gray-200",
};

export function Breadcrumb() {
  const { conversationPath, navigateTo, currentNodeId, removeFromPath } = useCallStore();

  // Deduplicate: keep only the last occurrence of each node
  const deduplicatedPath = conversationPath.reduce<string[]>((acc, nodeId) => {
    // Remove previous occurrence if exists, then add current
    const filtered = acc.filter((id) => id !== nodeId);
    return [...filtered, nodeId];
  }, []);

  // Show last 5 items with ellipsis if more
  const displayPath = deduplicatedPath.length > 5
    ? ["...", ...deduplicatedPath.slice(-5)]
    : deduplicatedPath;

  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 max-h-[200px] overflow-y-auto">
      <div className="flex flex-wrap gap-1 items-center">
        {displayPath.map((nodeId, index) => {
          if (nodeId === "...") {
            return (
              <span key="ellipsis" className="text-gray-400 text-sm px-2">
                ...
              </span>
            );
          }

          const node = callFlow[nodeId];
          if (!node) return null;

          const isLast = index === displayPath.length - 1;
          const colorClass = nodeTypeColors[node.type] || nodeTypeColors.end;

          return (
            <div key={`${nodeId}-${index}`} className="flex items-center">
              <div className="relative group">
                <button
                  onClick={() => {
                    // Find the index in the full path and navigate there
                    const fullIndex = conversationPath.indexOf(nodeId);
                    if (fullIndex !== -1 && nodeId !== currentNodeId) {
                      // Reset to that point in the path
                      navigateTo(nodeId);
                    }
                  }}
                  disabled={isLast}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${colorClass} ${
                    isLast
                      ? "font-semibold"
                      : "opacity-70 hover:opacity-100 cursor-pointer"
                  }`}
                  title={node.title}
                >
                  {node.title.length > 20
                    ? node.title.substring(0, 20) + "..."
                    : node.title}
                </button>
                {/* X button to remove from path - only show on hover and not for current node */}
                {!isLast && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromPath(nodeId);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from path"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {!isLast && (
                <ChevronRight className="h-3 w-3 text-gray-400 mx-1 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

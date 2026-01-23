"use client";

import { useCallStore } from "@/store/callStore";
import { callFlow } from "@/data/callFlow";
import { ChevronRight, X } from "lucide-react";

const nodeTypeColors: Record<string, string> = {
  opening: "bg-white text-[#502c85] border-[#502c85]",
  discovery: "bg-white text-[#502c85] border-[#502c85]",
  pitch: "bg-white text-[#502c85] border-[#502c85]",
  objection: "bg-white text-red-800 border-red-600",
  close: "bg-white text-[#502c85] border-[#502c85]",
  success: "bg-white text-green-900 border-green-800",
  end: "bg-white text-primary border-primary",
};

export function Breadcrumb() {
  const { conversationPath, navigateToHistoricalNode, removeFromPath } = useCallStore();

  // Show last 10 items with ellipsis if more (no deduplication - preserve chronological order)
  const displayPath = conversationPath.length > 10
    ? ["...", ...conversationPath.slice(-10)]
    : conversationPath;

  return (
    <div className="bg-[#502c85]/10 rounded-lg p-3 max-h-[200px] overflow-y-auto">
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

          // Calculate actual index in full path (accounting for ellipsis)
          const actualIndex = conversationPath.length > 10
            ? (conversationPath.length - 10) + index - 1 // -1 to account for "..." taking a slot
            : index;

          return (
            <div key={`${nodeId}-${actualIndex}`} className="flex items-center">
              <div className="relative group">
                <button
                  onClick={() => {
                    if (!isLast) {
                      // Rewind to this point in the path
                      navigateToHistoricalNode(nodeId);
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
                {/* X button to remove from path - show on all nodes except when it's the only node */}
                {conversationPath.length > 1 && (
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

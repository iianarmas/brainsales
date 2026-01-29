"use client";

import { useMemo } from "react";
import { useCallStore } from "@/store/callStore";
import { useObjectionShortcuts } from "@/hooks/useObjectionShortcuts";
import { AlertCircle, ChevronDown, ChevronUp, CornerUpLeft } from "lucide-react";
import { useState } from "react";

export function ObjectionHotbar() {
  const { navigateTo, currentNodeId, previousNonObjectionNode, returnToFlow, scripts } = useCallStore();
  const { nodeToKey } = useObjectionShortcuts();
  const [expanded, setExpanded] = useState(false);

  // Derive objection lists from scripts store, using dynamic shortcuts
  const { commonObjections, moreObjections } = useMemo(() => {
    const allObjectionNodes = Object.values(scripts).filter(n => n.type === "objection");
    const common: { id: string; label: string; shortcut: string }[] = [];
    const more: { id: string; label: string; shortcut: string }[] = [];

    allObjectionNodes.forEach(node => {
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
  }, [scripts, nodeToKey]);

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

  return (
    <div className="bg-violet-50 border-t border-[#502c85]/20">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-[#502c85]/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[#502c85]" />
          <span className="text-sm font-medium text-[#502c85]">
            Quick Objection Handlers
          </span>
          {isOnObjection && (
            <span className="text-xs bg-[#502c85] text-white px-2 py-0.5 rounded">
              Handling objection
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-[#502c85]" />
        ) : (
          <ChevronUp className="h-4 w-4 text-[#502c85]" />
        )}
      </button>

      {/* Quick access buttons - always visible */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-1 items-center">
          {/* Return to Flow button - only show when we have somewhere to return */}
          {previousNonObjectionNode && (
            <button
              onClick={returnToFlow}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors bg-[#502c85]/40 text-[#502c85] hover:bg-[#502c85] hover:text-white mr-2"
              title={`Return to: ${returnNodeTitle}`}
            >
              <CornerUpLeft className="h-3 w-3" />
              Return to Flow
            </button>
          )}

          {commonObjections.map((obj) => (
            <button
              key={obj.id}
              onClick={() => handleObjection(obj.id)}
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${currentNodeId === obj.id
                ? "bg-[#502c85] text-white"
                : "bg-white text-[#502c85] border border-[#502c85] hover:bg-[#502c85] hover:text-white"
                }`}
              title={`Jump to: ${obj.label}`}
            >
              {obj.shortcut && (
                <kbd className="text-[10px] opacity-60">{obj.shortcut}</kbd>
              )}
              {obj.label}
            </button>
          ))}
        </div>
      </div>

      {/* Expanded section with more objections */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-[#502c85]/20">
          <p className="text-xs font-bold text-[#502c85] mb-2">More objections:</p>
          <div className="flex flex-wrap gap-1">
            {moreObjections.map((obj) => (
              <button
                key={obj.id}
                onClick={() => handleObjection(obj.id)}
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${currentNodeId === obj.id
                  ? "bg-[#502c85] text-white"
                  : "bg-white text-[#502c85] border border-[#502c85] hover:bg-[#502c85] hover:text-white"
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

"use client";

import { useCallStore } from "@/store/callStore";
import { callFlow } from "@/data/callFlow";
import { AlertCircle, ChevronDown, ChevronUp, CornerUpLeft } from "lucide-react";
import { useState } from "react";

// Common objections that can come up anytime during a call
const commonObjections = [
  { id: "objection_whats_this_about", label: "What's This About?", shortcut: "0" },
  { id: "objection_not_interested", label: "Not Interested", shortcut: "1" },
  { id: "objection_timing", label: "Bad Timing", shortcut: "2" },
  { id: "objection_happy_current", label: "Happy with Current", shortcut: "3" },
  { id: "objection_send_info", label: "Send Info", shortcut: "4" },
  { id: "objection_cost", label: "Cost/Budget", shortcut: "5" },
  { id: "objection_not_decision_maker", label: "Not Decision Maker", shortcut: "6" },
  { id: "objection_contract", label: "Under Contract", shortcut: "7" },
  { id: "objection_implementing", label: "Implementing Something", shortcut: "8" },
];

const moreObjections = [
  { id: "objection_no_budget", label: "No Budget", shortcut: "" },
  { id: "objection_change_management", label: "Change Management", shortcut: "" },
  { id: "objection_vendor_consolidation", label: "Vendor Consolidation", shortcut: "" },
  { id: "objection_procurement", label: "Procurement Process", shortcut: "" },
  { id: "objection_looking_competitor", label: "Looking at Competitor", shortcut: "" },
  { id: "objection_waiting_gallery", label: "Waiting for Epic Gallery", shortcut: "" },
];

export function ObjectionHotbar() {
  const { navigateTo, currentNodeId, previousNonObjectionNode, returnToFlow } = useCallStore();
  const [expanded, setExpanded] = useState(false);

  const handleObjection = (objectionId: string) => {
    navigateTo(objectionId);
  };

  // Check if we're currently on an objection node
  const currentNode = callFlow[currentNodeId];
  const isOnObjection = currentNode?.type === "objection";

  // Get the title of the node we can return to
  const returnNodeTitle = previousNonObjectionNode
    ? callFlow[previousNonObjectionNode]?.title
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
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                currentNodeId === obj.id
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
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                  currentNodeId === obj.id
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

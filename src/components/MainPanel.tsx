"use client";

import { useCallStore } from "@/store/callStore";
import { NodeDisplay } from "./NodeDisplay";
export function MainPanel() {
  const { currentNodeId, scripts } = useCallStore();
  const currentNode = scripts[currentNodeId];

  if (!currentNode) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500">Node not found: {currentNodeId}</p>
      </div>
    );
  }

  return (
    <div className="h-full p-6">
      <NodeDisplay node={currentNode} />
    </div>
  );
}

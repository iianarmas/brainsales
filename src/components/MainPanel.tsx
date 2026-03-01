"use client";

import { useCallStore } from "@/store/callStore";
import { NodeDisplay } from "./NodeDisplay";
export function MainPanel() {
  const { currentNodeId, scripts } = useCallStore();
  const currentNode = scripts[currentNodeId];

  if (!currentNode) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8 bg-background">
        <div className="flex flex-col items-center justify-center space-y-4 max-w-sm text-center">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-primary/20 rounded-full animate-spin"></div>
            <div className="absolute top-0 left-0 w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-foreground tracking-tight">Loading Call Flow</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please wait while we prepare your scripts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6">
      <NodeDisplay node={currentNode} />
    </div>
  );
}

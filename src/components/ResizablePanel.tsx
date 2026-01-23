"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  side: "left" | "right";
  className?: string;
}

export function ResizablePanel({
  children,
  defaultWidth,
  minWidth,
  maxWidth,
  side,
  className = "",
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;

      let newWidth: number;
      if (side === "left") {
        newWidth = e.clientX - panelRef.current.getBoundingClientRect().left;
      } else {
        newWidth = panelRef.current.getBoundingClientRect().right - e.clientX;
      }

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    },
    [isResizing, minWidth, maxWidth, side]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    }

    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <div
      ref={panelRef}
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: `${width}px` }}
    >
      {children}

      {/* Resize handle */}
      <div
        className={`absolute top-0 bottom-0 w-0.5 cursor-col-resize hover:bg-[#502c85] transition-colors z-10 ${
          isResizing ? "bg-[#502c85]" : "bg-transparent hover:bg-[#502c85]/80"
        } ${side === "left" ? "right-0" : "left-0"}`}
        onMouseDown={startResizing}
      >
        {/* Visual indicator on hover */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 ${
            side === "left" ? "-right-1" : "-left-1"
          } w-3 h-8 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity`}
        >
          <div className="w-0.5 h-6 bg-gray-400 rounded-full" />
        </div>
      </div>
    </div>
  );
}

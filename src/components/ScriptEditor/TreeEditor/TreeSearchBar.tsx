"use client";

import React, { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

interface TreeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
}

export default function TreeSearchBar({
  value,
  onChange,
  resultCount,
}: TreeSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search nodes... (Ctrl+K)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-16 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
      />
      {value && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <span className="text-xs text-muted-foreground font-medium">
            {resultCount} found
          </span>
          <button
            onClick={() => onChange("")}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}

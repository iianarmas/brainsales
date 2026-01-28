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
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search nodes... (Ctrl+K)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-16 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
      />
      {value && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <span className="text-xs text-gray-400">
            {resultCount} found
          </span>
          <button
            onClick={() => onChange("")}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useCallStore } from "@/store/callStore";
import { CallNode } from "@/data/callFlow";
import { Search, X, Target, Lightbulb, AlertCircle, Calendar } from "lucide-react";

const nodeTypeIcons: Record<string, typeof Search> = {
  opening: Target,
  discovery: Search,
  pitch: Lightbulb,
  objection: AlertCircle,
  close: Calendar,
  success: Target,
  end: X,
};

const nodeTypeColors: Record<string, string> = {
  opening: "text-green-600 dark:text-green-400 bg-green-500/15",
  discovery: "text-blue-600 dark:text-blue-400 bg-blue-500/15",
  pitch: "text-purple-600 dark:text-purple-400 bg-purple-500/15",
  objection: "text-red-600 dark:text-red-400 bg-red-500/15",
  close: "text-orange-600 dark:text-orange-400 bg-orange-500/15",
  success: "text-green-600 dark:text-green-400 bg-green-500/15",
  end: "text-muted-foreground bg-muted",
};

export function SearchDropdown() {
  const { searchQuery, searchResults, navigateTo, setSearchQuery } =
    useCallStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (node: CallNode) => {
    navigateTo(node.id);
    setSearchQuery("");
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    try {
      const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escaped})`, "gi");
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return text;
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !(e.target as Element)?.closest("[data-search-input]")
      ) {
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setSearchQuery]);

  if (!searchQuery) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 mt-1 w-[480px] max-w-[90vw] bg-card rounded-xl shadow-2xl border border-border overflow-hidden z-50 transition-colors"
    >
      {/* Results */}
      <div className="max-h-[60vh] overflow-y-auto">
        {searchQuery.trim() === "" ? (
          <div className="p-6 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-2 text-muted/30" />
            <p className="text-sm font-medium">Start typing to search the call flow</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <p className="text-sm">No results found for &quot;{searchQuery.trim()}&quot;</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {searchResults.map((node) => {
              const Icon = nodeTypeIcons[node.type] || Search;
              const colorClass = nodeTypeColors[node.type] || nodeTypeColors.end;

              return (
                <button
                  key={node.id}
                  onClick={() => handleSelect(node)}
                  className="w-full p-3 text-left hover:bg-muted transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${colorClass}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">
                        {highlightMatch(node.title, searchQuery)}
                      </p>
                      <p className="text-xs text-foreground/70 mt-0.5 line-clamp-2">
                        {highlightMatch(
                          node.script.substring(0, 150) +
                          (node.script.length > 150 ? "..." : ""),
                          searchQuery
                        )}
                      </p>
                      {node.metadata?.competitorInfo && (
                        <p className="text-xs text-primary mt-0.5 font-medium">
                          Competitor info available
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border bg-muted/50 flex items-center justify-between text-xs text-muted-foreground transition-colors">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-background border border-border rounded text-[10px] font-sans">Enter</kbd> select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-background border border-border rounded text-[10px] font-sans">Esc</kbd> close
          </span>
        </div>
        {searchResults.length > 0 && (
          <span className="font-medium">{searchResults.length} results</span>
        )}
      </div>
    </div>
  );
}

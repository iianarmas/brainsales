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
  opening: "text-green-600 bg-green-100",
  discovery: "text-blue-600 bg-blue-100",
  pitch: "text-purple-600 bg-purple-100",
  objection: "text-red-600 bg-red-100",
  close: "text-orange-600 bg-orange-100",
  success: "text-green-600 bg-green-100",
  end: "text-gray-600 bg-gray-100",
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
      className="absolute top-full right-0 mt-1 w-[480px] max-w-[90vw] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
    >
      {/* Results */}
      <div className="max-h-[60vh] overflow-y-auto">
        {searchQuery.trim() === "" ? (
          <div className="p-6 text-center text-gray-500">
            <Search className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Start typing to search the call flow</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p className="text-sm">No results found for &quot;{searchQuery.trim()}&quot;</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {searchResults.map((node) => {
              const Icon = nodeTypeIcons[node.type] || Search;
              const colorClass = nodeTypeColors[node.type] || nodeTypeColors.end;

              return (
                <button
                  key={node.id}
                  onClick={() => handleSelect(node)}
                  className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${colorClass}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">
                        {highlightMatch(node.title, searchQuery)}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {highlightMatch(
                          node.script.substring(0, 150) +
                            (node.script.length > 150 ? "..." : ""),
                          searchQuery
                        )}
                      </p>
                      {node.metadata?.competitorInfo && (
                        <p className="text-xs text-purple-600 mt-0.5">
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
      <div className="p-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="px-1 py-0.5 bg-white border rounded text-[10px]">↵</kbd> select
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-white border rounded text-[10px]">Esc</kbd> close
          </span>
        </div>
        {searchResults.length > 0 && (
          <span>{searchResults.length} results</span>
        )}
      </div>
    </div>
  );
}

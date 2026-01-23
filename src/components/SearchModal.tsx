"use client";

import { useEffect, useRef } from "react";
import { useCallStore } from "@/store/callStore";
import { callFlow, CallNode } from "@/data/callFlow";
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

export function SearchModal() {
  const { searchQuery, setSearchQuery, search, searchResults, navigateTo } =
    useCallStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    search(searchQuery);
  }, [searchQuery, search]);

  const handleSelect = (node: CallNode) => {
    navigateTo(node.id);
    setSearchQuery("");
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.trim()})`, "gi");
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
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
        onClick={() => setSearchQuery("")}
      />

      {/* Modal */}
      <div className="relative min-h-full flex items-start justify-center p-4 pt-[10vh]">
        <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-200">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for keywords, competitors, objections..."
              className="flex-1 text-lg outline-none placeholder-gray-400"
            />
            <button
              onClick={() => setSearchQuery("")}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {searchQuery.trim() === "" ? (
              <div className="p-8 text-center text-gray-500">
                <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Start typing to search the call flow</p>
                <p className="text-sm mt-2">
                  Search for keywords like &quot;Brainware&quot;, &quot;objection&quot;, &quot;OnBase&quot;
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No results found for &quot;{searchQuery}&quot;</p>
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
                      className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">
                            {highlightMatch(node.title, searchQuery)}
                          </p>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {highlightMatch(
                              node.script.substring(0, 150) +
                                (node.script.length > 150 ? "..." : ""),
                              searchQuery
                            )}
                          </p>
                          {node.metadata?.competitorInfo && (
                            <p className="text-xs text-purple-600 mt-1">
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
          <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 bg-white border rounded">↵</kbd> to
                select
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-white border rounded">Esc</kbd> to
                close
              </span>
            </div>
            {searchResults.length > 0 && (
              <span>{searchResults.length} results</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

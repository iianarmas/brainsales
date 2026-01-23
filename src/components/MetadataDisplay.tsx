"use client";

import { useCallStore } from "@/store/callStore";
import { Server, Database, AlertTriangle, X } from "lucide-react";

export function MetadataDisplay() {
  const { metadata, updateMetadata } = useCallStore();

  const hasAnyData =
    metadata.ehr ||
    metadata.dms ||
    metadata.competitors.length > 0 ||
    metadata.painPoints.length > 0;

  if (!hasAnyData) {
    return (
      <div className="bg-white rounded-lg p-4 border border-[#502c85]/20">
        <p className="text-sm text-gray-500 text-center">
          Call context will appear here as you navigate
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-[#502c85]/20 space-y-3">
      {/* Auto-detected info */}
      {(metadata.ehr || metadata.dms) && (
        <div className="pt-2 space-y-1">
          {metadata.ehr && (
            <div className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4 text-[#502c85]/50 flex-shrink-0" />
              <span className="text-gray-600">EHR:</span>
              <span className={`font-medium ${metadata.ehr === "None" ? "text-gray-500 italic" : "text-gray-900"}`}>
                {metadata.ehr}
              </span>
            </div>
          )}
          {metadata.dms && (
            <div className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-purple-500 flex-shrink-0" />
              <span className="text-gray-600">DMS:</span>
              <span className={`font-medium ${metadata.dms === "None" ? "text-gray-500 italic" : "text-gray-900"}`}>
                {metadata.dms}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Competitors */}
      {metadata.competitors.length > 0 && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Competitors:</p>
          <div className="flex flex-wrap gap-1">
            {metadata.competitors.map((competitor) => (
              <span
                key={competitor}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs"
              >
                {competitor}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pain Points */}
      {metadata.painPoints.length > 0 && (
        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Pain Points:</p>
          <div className="flex flex-wrap gap-1">
            {metadata.painPoints.map((pain, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs"
              >
                <AlertTriangle className="h-3 w-3" />
                {pain}
                <button
                  onClick={() =>
                    updateMetadata({
                      painPoints: metadata.painPoints.filter((_, i) => i !== index),
                    })
                  }
                  className="hover:text-amber-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick Add Pain Point */}
      <div className="pt-2 border-t border-gray-200">
        <QuickAddPainPoint />
      </div>
    </div>
  );
}

function QuickAddPainPoint() {
  const { addPainPoint, metadata } = useCallStore();

  const commonPainPoints = [
    "Manual indexing",
    "High volume",
    "Accuracy issues",
    "Staff time",
    "Backlog",
  ];

  // Filter out already added pain points
  const availablePainPoints = commonPainPoints.filter(
    (pain) => !metadata.painPoints.includes(pain)
  );

  if (availablePainPoints.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">Quick add pain point:</p>
      <div className="flex flex-wrap gap-1">
        {availablePainPoints.map((pain) => (
          <button
            key={pain}
            onClick={() => addPainPoint(pain)}
            className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-amber-100 text-gray-600 hover:text-amber-800 rounded transition-colors"
          >
            + {pain}
          </button>
        ))}
      </div>
    </div>
  );
}

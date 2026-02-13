"use client";

import { useCallStore } from "@/store/callStore";
import { useProduct } from "@/context/ProductContext";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { AlertTriangle, X } from "lucide-react";
import type { EnvironmentTrigger } from "@/types/product";

const defaultEnvTriggers: EnvironmentTrigger[] = [
  { key: "ehr", label: "EHR", icon: "Server", type: "text" },
  { key: "dms", label: "DMS", icon: "Database", type: "text" },
  { key: "competitors", label: "Competitors", icon: "Users", type: "array" },
];

// Legacy keys that also exist as top-level metadata fields
const LEGACY_KEYS = new Set(["ehr", "dms", "competitors"]);

export function MetadataDisplay() {
  const { metadata, updateMetadata } = useCallStore();
  const { currentProduct } = useProduct();
  const { session } = useAuth();
  const [triggerDefs, setTriggerDefs] = useState<EnvironmentTrigger[]>(defaultEnvTriggers);

  useEffect(() => {
    if (!currentProduct || !session?.access_token) return;
    fetch(`/api/products/${currentProduct.id}/config`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.configuration?.environmentTriggers?.length > 0) {
          setTriggerDefs(data.configuration.environmentTriggers);
        }
      })
      .catch(() => {});
  }, [currentProduct, session?.access_token]);

  // Get trigger value: check legacy fields first, then environmentTriggers map
  const getTriggerValue = (def: EnvironmentTrigger): string | string[] => {
    if (LEGACY_KEYS.has(def.key)) {
      const legacyVal = (metadata as any)[def.key];
      if (legacyVal !== undefined && legacyVal !== "" && !(Array.isArray(legacyVal) && legacyVal.length === 0)) {
        return legacyVal;
      }
    }
    return metadata.environmentTriggers?.[def.key] ?? (def.type === "array" ? [] : "");
  };

  // Check if any trigger has data
  const hasAnyTriggerData = triggerDefs.some((def) => {
    const val = getTriggerValue(def);
    return Array.isArray(val) ? val.length > 0 : !!val;
  });

  const hasAnyData = hasAnyTriggerData || metadata.painPoints.length > 0;

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-[#502c85]/20 space-y-3">
      {!hasAnyData ? (
        <p className="text-sm text-gray-500 text-center py-2">
          Call context will appear here as you navigate
        </p>
      ) : (
        <>
          {/* Dynamic Environment Triggers */}
          {hasAnyTriggerData && (
            <div className="pt-2 space-y-1">
              {triggerDefs.map((def) => {
                const value = getTriggerValue(def);
                const Icon = (LucideIcons as Record<string, any>)[def.icon] || LucideIcons.HelpCircle;

                if (def.type === "array") {
                  const arrVal = Array.isArray(value) ? value : [];
                  if (arrVal.length === 0) return null;
                  return (
                    <div key={def.key} className="pt-2 border-t border-gray-200 first:border-t-0 first:pt-0">
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {def.label}:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {arrVal.map((item: string) => (
                          <span
                            key={item}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Text type
                if (!value) return null;
                const isNone = value === "None";
                return (
                  <div key={def.key} className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 text-[#502c85]/50 flex-shrink-0" />
                    <span className="text-gray-600">{def.label}:</span>
                    <span className={`font-medium ${isNone ? "text-gray-500 italic" : "text-gray-900"}`}>
                      {value as string}
                    </span>
                  </div>
                );
              })}
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
        </>
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
  const { currentProduct } = useProduct();
  const { session } = useAuth();
  const [availablePainPoints, setAvailablePainPoints] = useState<string[]>([]);

  // Default pain points (fallback)
  const defaultPainPoints = [
    "Manual indexing",
    "High volume",
    "Accuracy issues",
    "Staff time",
    "Backlog",
  ];

  useEffect(() => {
    async function fetchConfig() {
      if (!currentProduct || !session?.access_token) {
        setAvailablePainPoints(defaultPainPoints.filter(p => !metadata.painPoints.includes(p)));
        return;
      }

      try {
        const res = await fetch(`/api/products/${currentProduct.id}/config`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const configPainPoints = data.configuration?.painPoints || defaultPainPoints;
          // Filter out already added ones
          setAvailablePainPoints(configPainPoints.filter((p: string) => !metadata.painPoints.includes(p)));
        } else {
          setAvailablePainPoints(defaultPainPoints.filter(p => !metadata.painPoints.includes(p)));
        }
      } catch (err) {
        setAvailablePainPoints(defaultPainPoints.filter(p => !metadata.painPoints.includes(p)));
      }
    }

    fetchConfig();
  }, [currentProduct, session?.access_token, metadata.painPoints]);


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

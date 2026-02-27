"use client";

import { useCallStore } from "@/store/callStore";
import { useProduct } from "@/context/ProductContext";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useRef } from "react";
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
  const [availablePainPoints, setAvailablePainPoints] = useState<string[]>([]);

  useEffect(() => {
    if (!currentProduct || !session?.access_token) return;

    const timestampKey = `brainsales_config_timestamp_${currentProduct.id}`;
    const cacheKey = `brainsales_config_cache_${currentProduct.id}`;
    const lastFetch = localStorage.getItem(timestampKey);
    const now = Date.now();

    // Try to load from cache first
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.triggerDefs) setTriggerDefs(parsed.triggerDefs);
        if (parsed.painPoints) {
          setAvailablePainPoints(parsed.painPoints.filter((p: string) => !metadata.painPoints.includes(p)));
        }
      } catch (e) { /* ignore */ }
    }

    if (lastFetch && now - Number(lastFetch) < 300000) { // 5 mins
      return;
    }

    fetch(`/api/products/${currentProduct.id}/config`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          const updates: any = {};
          if (data.configuration?.environmentTriggers?.length > 0) {
            setTriggerDefs(data.configuration.environmentTriggers);
            updates.triggerDefs = data.configuration.environmentTriggers;
          }
          if (data.configuration?.painPoints?.length > 0) {
            setAvailablePainPoints(data.configuration.painPoints.filter((p: string) => !metadata.painPoints.includes(p)));
            updates.painPoints = data.configuration.painPoints;
          }

          localStorage.setItem(timestampKey, String(Date.now()));
          localStorage.setItem(cacheKey, JSON.stringify(updates));
        }
      })
      .catch(() => { });
  }, [currentProduct?.id, session?.access_token, metadata.painPoints]);

  // Get trigger value: check legacy fields first, then environmentTriggers map
  const getTriggerValue = (def: EnvironmentTrigger): string | string[] => {
    // ... same logic ...
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
    <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-4 border border-primary/20 space-y-3 transition-colors">
      {!hasAnyData ? (
        <p className="text-sm text-muted-foreground text-center py-2">
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
                    <div key={def.key} className="pt-2 border-t border-primary/20 first:border-t-0 first:pt-0">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {def.label}:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {arrVal.map((item: string) => (
                          <span
                            key={item}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-500 dark:text-red-400 rounded text-xs border border-red-500/20"
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
                    <Icon className="h-4 w-4 text-primary/50 flex-shrink-0" />
                    <span className="text-muted-foreground">{def.label}:</span>
                    <span className={`font-medium ${isNone ? "text-muted-foreground italic" : "text-foreground"}`}>
                      {value as string}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pain Points */}
          {metadata.painPoints.length > 0 && (
            <div className="pt-2 border-t border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Pain Points:</p>
              <div className="flex flex-wrap gap-1">
                {metadata.painPoints.map((pain, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs transition-colors"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {pain}
                    <button
                      onClick={() =>
                        updateMetadata({
                          painPoints: metadata.painPoints.filter((_, i) => i !== index),
                        })
                      }
                      className="hover:text-primary/70 transition-colors"
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
      <div className="pt-2 border-t border-primary/20">
        <QuickAddPainPoint availablePainPoints={availablePainPoints} />
      </div>
    </div>
  );
}

function QuickAddPainPoint({ availablePainPoints }: { availablePainPoints: string[] }) {
  const { addPainPoint } = useCallStore();

  if (availablePainPoints.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">Quick add pain point:</p>
      <div className="flex flex-wrap gap-1">
        {availablePainPoints.map((pain) => (
          <button
            key={pain}
            onClick={() => addPainPoint(pain)}
            className="px-2 py-0.5 text-xs bg-primary/5 hover:bg-primary/10 text-primary rounded transition-colors"
          >
            + {pain}
          </button>
        ))}
      </div>
    </div>
  );
}

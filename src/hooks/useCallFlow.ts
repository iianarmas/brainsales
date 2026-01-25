import { useState, useEffect } from "react";
import { callFlow as staticCallFlow, CallNode } from "@/data/callFlow";

/**
 * Hook to fetch call flow data from database with fallback to static import
 *
 * This enables incremental migration from static callFlow.ts to dynamic database storage.
 * If the API returns empty data or fails, it falls back to the static import.
 */
const CACHE_KEY = "brainsales_call_flow_cache";

/**
 * Hook to fetch call flow data from database with fallback to static import
 */
export function useCallFlow() {
  const [cachedData, setCachedData] = useState<Record<string, CallNode> | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          console.log("🚀 useCallFlow: Loaded from localStorage cache");
          return JSON.parse(cached);
        }
      } catch (e) {
        console.warn("Failed to parse cache", e);
      }
    }
    return null;
  });

  // Initialize callFlow with cached data if available, or static fallback
  const [callFlow, setCallFlow] = useState<Record<string, CallNode>>(cachedData || staticCallFlow);

  // loading is false if we have cached data or if the fetch completes
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchCallFlow() {
      try {
        console.log("🔄 useCallFlow: Fetching fresh scripts from API...");
        const response = await fetch(`/api/scripts/callflow?t=${Date.now()}`, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Pragma": "no-cache",
            "Cache-Control": "no-cache"
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch call flow: ${response.statusText}`);
        }

        const data = await response.json();

        // If database returns empty data, we keep the current state (either cached or static)
        if (!data || Object.keys(data).length === 0) {
          console.warn("⚠️ useCallFlow: API returned empty data, skipping update");
          if (isMounted) setLoading(false);
          return;
        }

        // Update state and cache
        if (isMounted) {
          console.log("✅ useCallFlow: Scripts updated from database");
          setCallFlow(data);
          setLoading(false);

          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
          } catch (e) {
            console.warn("Failed to save callFlow to localStorage", e);
          }
        }
      } catch (err) {
        console.error("❌ useCallFlow: Error fetching scripts:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to fetch call flow");
          setLoading(false);
        }
      }
    }

    fetchCallFlow();

    // Refresh when tab gains focus to ensure admin changes reflect immediately
    const handleFocus = () => {
      console.log("🔔 useCallFlow: Window focused, refreshing scripts...");
      fetchCallFlow();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return {
    callFlow,
    loading,
    error,
    refresh: () => {
      window.dispatchEvent(new Event('focus'));
    }
  };
}

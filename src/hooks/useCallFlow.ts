import { useState, useEffect, useCallback, useRef } from "react";
import { callFlow as staticCallFlow, CallNode } from "@/data/callFlow";

/**
 * Hook to fetch call flow data from database with fallback to static import
 *
 * This enables incremental migration from static callFlow.ts to dynamic database storage.
 * If the API returns empty data or fails, it falls back to the static import.
 *
 * @param productId - Optional product ID to filter scripts for. If provided, only scripts
 *                    belonging to that product will be returned.
 */
const CACHE_KEY_PREFIX = "brainsales_call_flow_cache";

function getCacheKey(productId?: string | null) {
  return productId ? `${CACHE_KEY_PREFIX}_${productId}` : CACHE_KEY_PREFIX;
}

/**
 * Hook to fetch call flow data from database with fallback to static import.
 * When accessToken is provided, the API also returns the user's sandbox nodes
 * as personal "side paths" alongside the official flow.
 */
export function useCallFlow(productId?: string | null, accessToken?: string | null) {
  const cacheKey = getCacheKey(productId);

  const [cachedData, setCachedData] = useState<Record<string, CallNode> | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {

          return JSON.parse(cached);
        }
      } catch (e) {
        console.warn("Failed to parse cache", e);
      }
    }
    return null;
  });

  // Initialize callFlow with cached data if available, or empty object (to stay loading)
  const [callFlow, setCallFlow] = useState<Record<string, CallNode>>(cachedData || {});

  // loading is true if we don't have cached data
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const fetchCallFlow = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const headers: Record<string, string> = {
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      };

      // Add product ID header if provided
      if (productId) {
        headers["X-Product-Id"] = productId;
      }

      // Add auth header so the API can fetch the user's sandbox nodes
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`/api/scripts/callflow?t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch call flow: ${response.statusText}`);
      }

      const data = await response.json();

      // If database returns empty data (but not null/undefined), it means the org has no nodes yet.
      if (data === null || data === undefined) {
        setLoading(false);
        return;
      }

      // Performance: Optimization - check if data changed before updating state
      // Use JSON comparison as a quick way to check if object structure changed
      const currentDataStr = JSON.stringify(callFlow);
      const newDataStr = JSON.stringify(data);

      if (currentDataStr !== newDataStr) {
        setCallFlow(data);
        try {
          localStorage.setItem(cacheKey, newDataStr);
        } catch (e) {
          console.warn("Failed to save callFlow to localStorage", e);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("❌ useCallFlow: Error fetching scripts:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch call flow");
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  }, [productId, accessToken, cacheKey, callFlow]);

  useEffect(() => {
    fetchCallFlow(true);

    // Refresh when tab gains focus, but debounced or checked to avoid spamming
    let focusTimeout: NodeJS.Timeout;
    const handleFocus = () => {
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          fetchCallFlow();
        }
      }, 500);
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
      clearTimeout(focusTimeout);
    };
  }, [fetchCallFlow]);

  return {
    callFlow,
    loading,
    error,
    refresh: fetchCallFlow
  };
}

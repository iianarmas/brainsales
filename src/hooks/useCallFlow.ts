import { useState, useEffect, useCallback } from "react";
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

  // Initialize callFlow with cached data if available, or static fallback
  const [callFlow, setCallFlow] = useState<Record<string, CallNode>>(cachedData || staticCallFlow);

  // loading is false if we have cached data or if the fetch completes
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState<string | null>(null);

  const fetchCallFlow = useCallback(async () => {
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

      // If database returns empty data, we keep the current state (either cached or static)
      if (!data || Object.keys(data).length === 0) {
        console.warn("⚠️ useCallFlow: API returned empty data, skipping update");
        setLoading(false);
        return;
      }

      // Update state and cache

      setCallFlow(data);
      setLoading(false);

      try {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) {
        console.warn("Failed to save callFlow to localStorage", e);
      }
    } catch (err) {
      console.error("❌ useCallFlow: Error fetching scripts:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch call flow");
      setLoading(false);
    }
  }, [productId, accessToken, cacheKey]);

  useEffect(() => {
    fetchCallFlow();

    // Refresh when tab gains focus to ensure admin changes reflect immediately
    const handleFocus = () => {

      fetchCallFlow();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchCallFlow]);

  return {
    callFlow,
    loading,
    error,
    refresh: fetchCallFlow
  };
}

import { useState, useEffect, useCallback, useRef } from "react";
import { callFlow as staticCallFlow, CallNode } from "@/data/callFlow";

/**
 * Hook to fetch call flow data from database with fallback to static import
 */
const CACHE_KEY_PREFIX = "brainsales_call_flow_cache";

function getCacheKey(productId?: string | null) {
  return productId ? `${CACHE_KEY_PREFIX}_${productId}` : CACHE_KEY_PREFIX;
}

function getTimestampKey(productId?: string | null) {
  return productId ? `brainsales_call_flow_timestamp_${productId}` : `brainsales_call_flow_timestamp`;
}

function getCachedFlow(cacheKey: string): Record<string, CallNode> | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.warn("Failed to parse cache", e);
    return null;
  }
}

/**
 * Hook to fetch call flow data from database with fallback to static import.
 */
export function useCallFlow(productId?: string | null, accessToken?: string | null) {
  const cacheKey = getCacheKey(productId);

  // loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);

  // useCallFlow state - we manage this manually to handle productId changes properly
  const [callFlow, setCallFlow] = useState<Record<string, CallNode>>({});
  const [prevCacheKey, setPrevCacheKey] = useState<string | null>(null);

  // Derived state pattern: Reset state IMMEDIATELY when cacheKey (productId) changes
  if (prevCacheKey !== cacheKey) {
    const cached = getCachedFlow(cacheKey);
    setCallFlow(cached || {});
    setLoading(!cached);
    setPrevCacheKey(cacheKey);
    // Reset fetch timestamp to force a refresh check in useEffect
    lastFetchTimeRef.current = 0;
  }

  const fetchCallFlow = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const headers: Record<string, string> = {
        "Pragma": "no-cache",
        "Cache-Control": "no-cache"
      };

      if (productId) {
        headers["X-Product-Id"] = productId;
      }

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

      if (data === null || data === undefined) {
        setLoading(false);
        return;
      }

      const newDataStr = JSON.stringify(data);
      const currentDataStr = JSON.stringify(callFlow);

      if (currentDataStr !== newDataStr) {
        setCallFlow(data);
        try {
          localStorage.setItem(cacheKey, newDataStr);
        } catch (e) {
          console.warn("Failed to save callFlow to localStorage", e);
        }
      }

      const now = Date.now();
      lastFetchTimeRef.current = now;
      try {
        localStorage.setItem(getTimestampKey(productId), String(now));
      } catch { /* ignore */ }

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
    const timestampKey = getTimestampKey(productId);
    const lastFetch = typeof window !== "undefined" ? localStorage.getItem(timestampKey) : null;
    const now = Date.now();
    const isCacheFresh = lastFetch && (now - Number(lastFetch) < 60000); // 60s

    if (!isCacheFresh) {
      fetchCallFlow(true);
    } else {
      lastFetchTimeRef.current = Number(lastFetch);
      setLoading(false);
    }

    let focusTimeout: NodeJS.Timeout;
    const handleFocus = () => {
      clearTimeout(focusTimeout);
      focusTimeout = setTimeout(() => {
        const now = Date.now();
        if (document.visibilityState === 'visible' && now - lastFetchTimeRef.current > 120000) {
          fetchCallFlow();
        }
      }, 2000);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === cacheKey && e.newValue) {
        try {
          const updatedFlow = JSON.parse(e.newValue);
          setCallFlow(updatedFlow);
        } catch { /* ignore */ }
      }
    };

    const handleSameTabUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ cacheKey: string }>).detail;
      if (detail?.cacheKey === cacheKey) {
        const cached = getCachedFlow(cacheKey);
        if (cached) setCallFlow(cached);
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("brainsales_callflow_updated", handleSameTabUpdate);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("brainsales_callflow_updated", handleSameTabUpdate);
      clearTimeout(focusTimeout);
    };
  }, [fetchCallFlow, cacheKey, productId]);

  return {
    callFlow,
    loading,
    error,
    refresh: fetchCallFlow
  };
}


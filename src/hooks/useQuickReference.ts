import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProduct } from "@/context/ProductContext";
import { useKbStore } from "@/store/useKbStore";
import { QuickReferenceData } from "@/types/product";

// Fallback data for when no product-specific data exists
const fallbackData: QuickReferenceData = {
  differentiators: [],
  competitors: [],
  metrics: [],
  tips: [],
};

interface UseQuickReferenceReturn {
  data: QuickReferenceData;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isHydrated: boolean;
}

export function useQuickReference(): UseQuickReferenceReturn {
  const { session } = useAuth();
  const { currentProduct, products } = useProduct();
  const {
    quickReference: cachedMap,
    lastFetchedQuickRef: lastFetchedMap,
    setQuickReference,
    _hasHydrated: isHydrated
  } = useKbStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveProductId = currentProduct?.id || products[0]?.id;

  const cachedData = useMemo(() => {
    if (!effectiveProductId) return fallbackData;
    return cachedMap[effectiveProductId] || fallbackData;
  }, [cachedMap, effectiveProductId]);

  const fetchQuickReference = useCallback(async () => {
    if (!session?.access_token || !effectiveProductId) {
      return;
    }

    // Only show loading if we have no cached data at all for this product
    if (!cachedMap[effectiveProductId]) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(
        `/api/products/${effectiveProductId}/quick-reference`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch quick reference data");
      }

      const quickRefData: QuickReferenceData = await response.json();
      setQuickReference(effectiveProductId, quickRefData);
    } catch (err) {
      console.error("Error fetching quick reference:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, effectiveProductId, cachedMap, setQuickReference]);

  // Fetch on mount and when product changes, but only if stale (older than 30s) or missing
  useEffect(() => {
    if (!effectiveProductId || !isHydrated) return;

    const lastFetched = lastFetchedMap[effectiveProductId] || 0;
    const isStale = Date.now() - lastFetched > 30000; // 30 seconds stale time

    if (!cachedMap[effectiveProductId] || isStale) {
      fetchQuickReference();
    }
  }, [effectiveProductId, fetchQuickReference, lastFetchedMap, cachedMap, isHydrated]);

  const hasData = !!cachedMap[effectiveProductId];

  return {
    data: cachedData,
    loading: loading && !hasData, // Only show loading if no cache
    error,
    refresh: fetchQuickReference,
    isHydrated
  };
}


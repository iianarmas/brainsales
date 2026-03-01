"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProduct } from "@/context/ProductContext";
import { QuickReferenceData, QuickReferenceCompetitor } from "@/types/product";

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
}

export function useQuickReference(): UseQuickReferenceReturn {
  const { session } = useAuth();
  const { currentProduct, products } = useProduct();
  const [data, setData] = useState<QuickReferenceData>(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuickReference = useCallback(async () => {
    // If we don't have a product selected, try to use the first one from product context
    const effectiveProductId = currentProduct?.id || products[0]?.id;

    if (!session?.access_token || !effectiveProductId) {
      setData(fallbackData);
      setLoading(false);
      return;
    }

    setLoading(true);
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
      setData(quickRefData);
    } catch (err) {
      console.error("Error fetching quick reference:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      setData(fallbackData);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, currentProduct?.id, products]);

  // Fetch on mount and when product changes
  useEffect(() => {
    fetchQuickReference();
  }, [fetchQuickReference]);

  return {
    data,
    loading,
    error,
    refresh: fetchQuickReference,
  };
}

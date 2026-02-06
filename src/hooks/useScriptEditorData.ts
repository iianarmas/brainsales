"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useScriptEditorStore,
  transformNodesToFlowFormat,
  TransformedNode,
} from "@/store/scriptEditorStore";
import type { Edge } from "@xyflow/react";
import type { CallNode } from "@/data/callFlow";

interface UseScriptEditorDataOptions {
  staleTime?: number; // ms before cache is considered stale (default: 30000)
  refetchOnFocus?: boolean; // Whether to refetch when tab regains focus (default: false)
  productId?: string;
  enabled?: boolean; // Whether fetching is enabled (default: true)
}

interface UseScriptEditorDataReturn {
  nodes: TransformedNode[];
  edges: Edge[];
  rawNodes: CallNode[];
  loading: boolean;
  isFetching: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  activeTab: "official" | "sandbox" | "community";
}

const DEFAULT_STALE_TIME = 30000; // 30 seconds
const EMPTY_ARRAY: any[] = [];

export function useScriptEditorData(
  options: UseScriptEditorDataOptions = {}
): UseScriptEditorDataReturn {
  const {
    staleTime = DEFAULT_STALE_TIME,
    refetchOnFocus = false,
    productId,
    enabled = true,
  } = options;

  const { session } = useAuth();
  const hasFetchedOnce = useRef(false);

  const {
    activeTab,
    getCacheKey,
    getCachedData,
    setCachedData,
    shouldRefetch,
    setLoading,
    setIsFetching,
    setError,
    loading,
    isFetching,
    error,
    setProductId,
  } = useScriptEditorStore();

  // Update productId in store when it changes
  useEffect(() => {
    if (productId !== undefined) {
      setProductId(productId);
    }
  }, [productId, setProductId]);

  const fetchNodes = useCallback(async (force = false) => {
    if (!session?.access_token || !enabled) {
      return;
    }

    const cacheKey = getCacheKey();
    const cached = getCachedData(cacheKey);

    // If we have fresh cache and not forcing, skip fetch
    if (!force && cached && !shouldRefetch(staleTime)) {
      // Ensure loading is false if we have cached data
      if (loading) setLoading(false);
      return;
    }

    // Set appropriate loading state
    if (!hasFetchedOnce.current || !cached) {
      setLoading(true);
    } else {
      setIsFetching(true);
    }

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session.access_token}`,
      };
      if (productId) {
        headers["X-Product-Id"] = productId;
      }

      // Select endpoint based on active tab
      const fetchUrl =
        activeTab === "sandbox"
          ? "/api/scripts/sandbox/nodes"
          : activeTab === "community"
            ? "/api/scripts/community/nodes"
            : "/api/admin/scripts/nodes";

      const response = await fetch(fetchUrl, { headers });

      if (!response.ok) {
        throw new Error("Failed to fetch nodes");
      }

      const nodesData: Array<
        CallNode & { position_x: number; position_y: number; topic_group_id: string | null }
      > = await response.json();

      // Transform to React Flow format
      const { nodes: flowNodes, edges: flowEdges } = transformNodesToFlowFormat(nodesData);

      // Update cache
      setCachedData(cacheKey, flowNodes, flowEdges, nodesData);
      hasFetchedOnce.current = true;
    } catch (err) {
      console.error("Error fetching nodes:", err);
      setError(err instanceof Error ? err.message : "Failed to load nodes");
    }
  }, [
    session?.access_token,
    enabled,
    getCacheKey,
    getCachedData,
    shouldRefetch,
    staleTime,
    loading,
    setLoading,
    setIsFetching,
    productId,
    activeTab,
    setCachedData,
    setError,
  ]);

  // Get cached data for current tab
  const cacheKey = getCacheKey();
  const cached = getCachedData(cacheKey);

  // Initial fetch and refetch on tab/product change OR if cache is empty
  useEffect(() => {
    if (session?.user?.id && enabled && (!hasFetchedOnce.current || !cached)) {
      fetchNodes();
    }
  }, [session?.user?.id, enabled, activeTab, productId, fetchNodes, cached]);

  // Handle focus events (optional refetch on focus)
  useEffect(() => {
    if (!refetchOnFocus) return;

    const handleFocus = () => {
      if (shouldRefetch(staleTime)) {
        fetchNodes();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchOnFocus, shouldRefetch, staleTime, fetchNodes]);

  return {
    nodes: (cached?.nodes as TransformedNode[]) || (EMPTY_ARRAY as TransformedNode[]),
    edges: cached?.edges || EMPTY_ARRAY,
    rawNodes: cached?.rawNodes || EMPTY_ARRAY,
    loading,
    isFetching,
    error,
    refetch: () => fetchNodes(true),
    activeTab,
  };
}

// Hook for fetching topics (separate from nodes)
export function useTopics(productId?: string) {
  const { session } = useAuth();
  const { topics, setTopics } = useScriptEditorStore();

  useEffect(() => {
    async function fetchTopics() {
      if (!productId || !session?.access_token) return;

      try {
        const res = await fetch(`/api/products/${productId}/config`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.topics && Array.isArray(data.topics)) {
            setTopics(data.topics);
          }
        }
      } catch (err) {
        console.error("Error fetching topics:", err);
      }
    }

    fetchTopics();
  }, [productId, session?.access_token, setTopics]);

  return topics;
}

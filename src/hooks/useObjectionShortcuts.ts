"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProduct } from "@/context/ProductContext";
import {
  ObjectionShortcut,
  ObjectionShortcutMap,
  ObjectionNodeMap,
} from "@/types/product";

interface UseObjectionShortcutsReturn {
  shortcuts: ObjectionShortcut[];
  keyToNode: ObjectionShortcutMap; // '0' -> 'obj_whats_this_about'
  nodeToKey: ObjectionNodeMap; // 'obj_whats_this_about' -> '0'
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useObjectionShortcuts(): UseObjectionShortcutsReturn {
  const { session } = useAuth();
  const { currentProduct } = useProduct();
  const [shortcuts, setShortcuts] = useState<ObjectionShortcut[]>([]);
  const [keyToNode, setKeyToNode] = useState<ObjectionShortcutMap>({});
  const [nodeToKey, setNodeToKey] = useState<ObjectionNodeMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShortcuts = useCallback(async () => {
    if (!session?.access_token || !currentProduct?.id) {
      setShortcuts([]);
      setKeyToNode({});
      setNodeToKey({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/products/${currentProduct.id}/objection-shortcuts`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch objection shortcuts");
      }

      const data = await response.json();
      setShortcuts(data.shortcuts || []);
      setKeyToNode(data.keyToNode || {});
      setNodeToKey(data.nodeToKey || {});
    } catch (err) {
      console.error("Error fetching objection shortcuts:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch shortcuts");
      setShortcuts([]);
      setKeyToNode({});
      setNodeToKey({});
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, currentProduct?.id]);

  // Fetch on mount and when product changes
  useEffect(() => {
    fetchShortcuts();
  }, [fetchShortcuts]);

  return {
    shortcuts,
    keyToNode,
    nodeToKey,
    loading,
    error,
    refresh: fetchShortcuts,
  };
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProduct } from "@/context/ProductContext";
import {
  ObjectionShortcut,
  ObjectionShortcutMap,
  ObjectionNodeMap,
  UserObjectionPreference,
} from "@/types/product";

interface UseObjectionShortcutsReturn {
  shortcuts: ObjectionShortcut[];
  keyToNode: ObjectionShortcutMap; // '0' -> 'obj_whats_this_about'
  nodeToKey: ObjectionNodeMap; // 'obj_whats_this_about' -> '0'
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  // User preference support
  hasCustomized: boolean;
  selectedNodeIds: string[]; // node IDs the user has selected to show
  saveUserPreferences: (prefs: UserObjectionPreference[]) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export function useObjectionShortcuts(): UseObjectionShortcutsReturn {
  const { session } = useAuth();
  const { currentProduct } = useProduct();
  const [shortcuts, setShortcuts] = useState<ObjectionShortcut[]>([]);
  const [keyToNode, setKeyToNode] = useState<ObjectionShortcutMap>({});
  const [nodeToKey, setNodeToKey] = useState<ObjectionNodeMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCustomized, setHasCustomized] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  const fetchShortcuts = useCallback(async () => {
    if (!session?.access_token || !currentProduct?.id) {
      setShortcuts([]);
      setKeyToNode({});
      setNodeToKey({});
      setSelectedNodeIds([]);
      setHasCustomized(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch both product-level shortcuts and user preferences in parallel
      const [productRes, userRes] = await Promise.all([
        fetch(
          `/api/products/${currentProduct.id}/objection-shortcuts`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        ),
        fetch(
          `/api/user-objection-preferences?product_id=${currentProduct.id}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        ),
      ]);

      if (!productRes.ok) {
        throw new Error("Failed to fetch objection shortcuts");
      }

      const productData = await productRes.json();
      const userData = userRes.ok ? await userRes.json() : { customized: false };

      if (userData.customized) {
        // Use user preferences
        setHasCustomized(true);
        setKeyToNode(userData.keyToNode || {});
        setNodeToKey(userData.nodeToKey || {});
        setSelectedNodeIds(
          (userData.preferences || []).map((p: UserObjectionPreference) => p.node_id)
        );
        // Keep product shortcuts for reference
        setShortcuts(productData.shortcuts || []);
      } else {
        // Fall back to admin/product defaults
        setHasCustomized(false);
        setShortcuts(productData.shortcuts || []);
        setKeyToNode(productData.keyToNode || {});
        setNodeToKey(productData.nodeToKey || {});
        // When not customized, all objections are shown (selectedNodeIds empty = show all)
        setSelectedNodeIds([]);
      }
    } catch (err) {
      console.error("Error fetching objection shortcuts:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch shortcuts");
      setShortcuts([]);
      setKeyToNode({});
      setNodeToKey({});
      setSelectedNodeIds([]);
      setHasCustomized(false);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, currentProduct?.id]);

  // Fetch on mount and when product changes
  useEffect(() => {
    fetchShortcuts();
  }, [fetchShortcuts]);

  const saveUserPreferences = useCallback(
    async (prefs: UserObjectionPreference[]) => {
      if (!session?.access_token || !currentProduct?.id) return;

      const res = await fetch("/api/user-objection-preferences", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: currentProduct.id,
          preferences: prefs,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save preferences");
      }

      // Refresh to pick up the new data
      await fetchShortcuts();
    },
    [session?.access_token, currentProduct?.id, fetchShortcuts]
  );

  const resetToDefaults = useCallback(async () => {
    if (!session?.access_token || !currentProduct?.id) return;

    const res = await fetch(
      `/api/user-objection-preferences?product_id=${currentProduct.id}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to reset preferences");
    }

    // Refresh to pick up admin defaults
    await fetchShortcuts();
  }, [session?.access_token, currentProduct?.id, fetchShortcuts]);

  return {
    shortcuts,
    keyToNode,
    nodeToKey,
    loading,
    error,
    refresh: fetchShortcuts,
    hasCustomized,
    selectedNodeIds,
    saveUserPreferences,
    resetToDefaults,
  };
}

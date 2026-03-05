"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

export interface UserScriptShortcut {
  id: string;
  user_id: string;
  product_id: string;
  call_flow_id: string | null;
  node_id: string;
  shortcut_key: string;
  created_at: string;
}

interface UseScriptShortcutsReturn {
  shortcuts: UserScriptShortcut[];
  keyToNode: Record<string, string>;
  nodeToKey: Record<string, string>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveShortcuts: (
    productId: string,
    shortcuts: Array<{ node_id: string; call_flow_id?: string | null; shortcut_key: string }>
  ) => Promise<void>;
  clearShortcuts: (productId: string) => Promise<void>;
}

export function useScriptShortcuts(productId: string | null | undefined): UseScriptShortcutsReturn {
  const { session } = useAuth();
  const [shortcuts, setShortcuts] = useState<UserScriptShortcut[]>([]);
  const [keyToNode, setKeyToNode] = useState<Record<string, string>>({});
  const [nodeToKey, setNodeToKey] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShortcuts = useCallback(async () => {
    if (!session?.access_token || !productId) {
      setShortcuts([]);
      setKeyToNode({});
      setNodeToKey({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/user-script-shortcuts?product_id=${productId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch script shortcuts");

      const data = await res.json();
      setShortcuts(data.shortcuts || []);
      setKeyToNode(data.keyToNode || {});
      setNodeToKey(data.nodeToKey || {});
    } catch (err) {
      console.error("Error fetching script shortcuts:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch shortcuts");
      setShortcuts([]);
      setKeyToNode({});
      setNodeToKey({});
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, productId]);

  useEffect(() => {
    fetchShortcuts();
  }, [fetchShortcuts]);

  const saveShortcuts = useCallback(
    async (
      pid: string,
      newShortcuts: Array<{ node_id: string; call_flow_id?: string | null; shortcut_key: string }>
    ) => {
      if (!session?.access_token) return;

      const res = await fetch("/api/user-script-shortcuts", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ product_id: pid, shortcuts: newShortcuts }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save shortcuts");
      }

      await fetchShortcuts();
    },
    [session?.access_token, fetchShortcuts]
  );

  const clearShortcuts = useCallback(
    async (pid: string) => {
      if (!session?.access_token) return;

      const res = await fetch(`/api/user-script-shortcuts?product_id=${pid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear shortcuts");
      }

      await fetchShortcuts();
    },
    [session?.access_token, fetchShortcuts]
  );

  return {
    shortcuts,
    keyToNode,
    nodeToKey,
    loading,
    error,
    refresh: fetchShortcuts,
    saveShortcuts,
    clearShortcuts,
  };
}

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { CallNode } from "@/data/callFlow";
import { Session } from "@supabase/supabase-js";
import type { EditorTab } from "../EditorTabs";

export interface TreeItem {
  node: CallNode;
  children: TreeItem[];
  isLink: boolean;
  responseLabel: string;
}

interface UseTreeDataReturn {
  roots: TreeItem[];
  nodesMap: Record<string, CallNode>;
  allNodes: CallNode[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function buildTree(nodesMap: Record<string, CallNode>): TreeItem[] {
  const allNodes = Object.values(nodesMap);

  // Find root nodes: opening type nodes, or nodes not referenced by any other node
  const referencedIds = new Set<string>();
  allNodes.forEach((n) => {
    n.responses.forEach((r) => referencedIds.add(r.nextNode));
  });

  // Opening nodes are always roots
  const openingRoots = allNodes.filter((n) => n.type === "opening");
  // Non-opening nodes that are not referenced by any other node are also roots (orphans)
  const orphanRoots = allNodes.filter(
    (n) => n.type !== "opening" && !referencedIds.has(n.id)
  );
  let roots = [...openingRoots, ...orphanRoots];
  if (roots.length === 0 && allNodes.length > 0) {
    roots = [allNodes[0]];
  }

  const visited = new Set<string>();

  function buildNode(node: CallNode, responseLabel: string): TreeItem {
    if (visited.has(node.id)) {
      return { node, children: [], isLink: true, responseLabel };
    }
    visited.add(node.id);

    const children: TreeItem[] = [];
    for (const resp of node.responses) {
      const child = nodesMap[resp.nextNode];
      if (child) {
        children.push(buildNode(child, resp.label));
      }
    }

    return { node, children, isLink: false, responseLabel };
  }

  return roots.map((r) => buildNode(r, ""));
}

// Find all node IDs that match search or have matching descendants
function findMatchingIds(
  roots: TreeItem[],
  query: string
): Set<string> {
  const matches = new Set<string>();
  const q = query.toLowerCase();

  function walk(item: TreeItem): boolean {
    const selfMatch =
      item.node.title.toLowerCase().includes(q) ||
      item.node.type.toLowerCase().includes(q) ||
      item.node.id.toLowerCase().includes(q) ||
      item.node.script.toLowerCase().includes(q);

    let childMatch = false;
    if (!item.isLink) {
      for (const child of item.children) {
        if (walk(child)) childMatch = true;
      }
    }

    if (selfMatch || childMatch) {
      matches.add(item.node.id);
      return true;
    }
    return false;
  }

  roots.forEach(walk);
  return matches;
}

export function useTreeData(session: Session | null, productId?: string, activeTab: EditorTab = "official"): UseTreeDataReturn {
  const [nodesMap, setNodesMap] = useState<Record<string, CallNode>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const hasFetchedOnce = useRef(false);

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!session?.user?.id) return;

    async function fetchNodes() {
      if (!session?.access_token) {
        setError("Not authenticated");
        setLoading(false);
        return;
      }

      try {
        // Only show loading spinner on initial load
        if (!hasFetchedOnce.current) {
          setLoading(true);
        }
        const headers: Record<string, string> = {
          Authorization: `Bearer ${session.access_token}`,
        };
        if (productId) {
          headers["X-Product-Id"] = productId;
        }

        // Use the right endpoint based on active tab
        const fetchUrl = activeTab === "sandbox"
          ? "/api/scripts/sandbox/nodes"
          : activeTab === "community"
            ? "/api/scripts/community/nodes"
            : "/api/admin/scripts/nodes";

        const response = await fetch(fetchUrl, {
          headers,
        });

        if (!response.ok) throw new Error("Failed to fetch nodes");

        const data: CallNode[] = await response.json();
        const map: Record<string, CallNode> = {};
        data.forEach((n) => (map[n.id] = n));
        setNodesMap(map);
        setError(null);
        hasFetchedOnce.current = true;
      } catch (err) {
        console.error("Error fetching nodes:", err);
        setError(err instanceof Error ? err.message : "Failed to load nodes");
      } finally {
        setLoading(false);
      }
    }

    fetchNodes();
  }, [session?.user?.id, session?.access_token, fetchKey, productId, activeTab]);

  const roots = useMemo(() => buildTree(nodesMap), [nodesMap]);
  const allNodes = useMemo(() => Object.values(nodesMap), [nodesMap]);

  return { roots, nodesMap, allNodes, loading, error, refetch };
}

export { findMatchingIds };

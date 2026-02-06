"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useScriptEditorStore } from "@/store/scriptEditorStore";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PositionBroadcast {
  nodeId: string;
  position: { x: number; y: number };
  userId: string;
  userEmail: string;
  timestamp: number;
}

interface NodeUpdateBroadcast {
  nodeId: string;
  data: any;
  userId: string;
  userEmail: string;
  timestamp: number;
}

interface NodeAddedBroadcast {
  node: any;
  userId: string;
  userEmail: string;
  timestamp: number;
}

interface NodeDeletedBroadcast {
  nodeId: string;
  userId: string;
  userEmail: string;
  timestamp: number;
}

interface EdgeBroadcast {
  edge: any;
  userId: string;
  userEmail: string;
  timestamp: number;
}

interface EdgeDeletedBroadcast {
  edgeId: string;
  userId: string;
  userEmail: string;
  timestamp: number;
}

interface NodeFocusBroadcast {
  nodeId: string | null;
  userId: string;
  userEmail: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  timestamp: number;
}

interface CollaboratorState {
  userId: string;
  email: string;
  activeNodeId: string | null;
  lastSeen: number;
}

interface UseRealtimeNodeSyncOptions {
  productId?: string | null;
  enabled?: boolean;
  onPositionUpdate?: (nodeId: string, position: { x: number; y: number }, userId: string) => void;
  onNodeAdded?: (node: any, userId: string) => void;
  onNodeDeleted?: (nodeId: string, userId: string) => void;
  onNodeUpdated?: (nodeId: string, data: any, userId: string) => void;
  onEdgeAdded?: (edge: any, userId: string) => void;
  onEdgeDeleted?: (edgeId: string, userId: string) => void;
}

interface UseRealtimeNodeSyncReturn {
  broadcastPosition: (nodeId: string, position: { x: number; y: number }) => void;
  broadcastPositionBatch: (positions: Array<{ nodeId: string; position: { x: number; y: number } }>) => void;
  broadcastNodeAdded: (node: any) => void;
  broadcastNodeDeleted: (nodeId: string) => void;
  broadcastNodeUpdated: (nodeId: string, data: any) => void;
  broadcastEdgeAdded: (edge: any) => void;
  broadcastEdgeDeleted: (edgeId: string) => void;
  broadcastNodeFocus: (nodeId: string | null) => void;
  activeCollaborators: Map<string, CollaboratorState>;
  isConnected: boolean;
}

// Throttle state interface
interface ThrottleState {
  lastCall: number;
  timeoutId: NodeJS.Timeout | null;
  lastArgs: [string, { x: number; y: number }] | null;
}

export function useRealtimeNodeSync(
  options: UseRealtimeNodeSyncOptions = {}
): UseRealtimeNodeSyncReturn {
  const { productId, enabled = true, onPositionUpdate } = options;

  const { user, session, profile } = useAuth();
  const { activeTab, updateNodePosition, setCollaborator, removeCollaborator, activeCollaborators } = useScriptEditorStore();

  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const onPositionUpdateRef = useRef(options.onPositionUpdate);
  const onNodeAddedRef = useRef(options.onNodeAdded);
  const onNodeDeletedRef = useRef(options.onNodeDeleted);
  const onNodeUpdatedRef = useRef(options.onNodeUpdated);
  const onEdgeAddedRef = useRef(options.onEdgeAdded);
  const onEdgeDeletedRef = useRef(options.onEdgeDeleted);

  // Keep callback refs updated
  useEffect(() => {
    onPositionUpdateRef.current = options.onPositionUpdate;
    onNodeAddedRef.current = options.onNodeAdded;
    onNodeDeletedRef.current = options.onNodeDeleted;
    onNodeUpdatedRef.current = options.onNodeUpdated;
    onEdgeAddedRef.current = options.onEdgeAdded;
    onEdgeDeletedRef.current = options.onEdgeDeleted;
  }, [options]);

  // Generate channel name based on product and tab
  const getChannelName = useCallback(() => {
    const name = `script-editor:${productId || "default"}:${activeTab}`;
    console.log(`[Realtime] Targeted channel name: ${name}`);
    return name;
  }, [productId, activeTab]);

  // Throttle state for position broadcasts (50ms)
  const throttleRef = useRef<ThrottleState>({
    lastCall: 0,
    timeoutId: null,
    lastArgs: null,
  });
  const THROTTLE_DELAY = 50;

  // Broadcast position update (throttled)
  const broadcastPosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      if (!channelRef.current || !user || !isConnected) return;

      const now = Date.now();
      const throttle = throttleRef.current;
      throttle.lastArgs = [nodeId, position];

      const sendBroadcast = (nId: string, pos: { x: number; y: number }) => {
        if (!channelRef.current || !user) return;

        const payload = {
          nodeId: nId,
          position: pos,
          userId: user.id || "anonymous",
          userEmail: user.email || "unknown",
          firstName: profile?.first_name || null,
          lastName: profile?.last_name || null,
          avatarUrl: profile?.profile_picture_url || null,
          timestamp: Date.now(),
        };

        console.log(`[Realtime] Sending position_update for ${nId}`, pos);
        channelRef.current.send({
          type: "broadcast",
          event: "position_update",
          payload,
        });
      };

      if (now - throttle.lastCall >= THROTTLE_DELAY) {
        throttle.lastCall = now;
        sendBroadcast(nodeId, position);
      } else if (!throttle.timeoutId) {
        // Schedule a trailing call
        throttle.timeoutId = setTimeout(() => {
          throttle.lastCall = Date.now();
          throttle.timeoutId = null;
          if (throttle.lastArgs) {
            sendBroadcast(throttle.lastArgs[0], throttle.lastArgs[1]);
          }
        }, THROTTLE_DELAY - (now - throttle.lastCall));
      }
    },
    [user, isConnected]
  );

  // Broadcast batch of positions (for auto-layout, etc.)
  const broadcastPositionBatch = useCallback(
    (positions: Array<{ nodeId: string; position: { x: number; y: number } }>) => {
      if (!channelRef.current || !user || !isConnected) return;

      channelRef.current.send({
        type: "broadcast",
        event: "positions_batch",
        payload: {
          positions,
          userId: user.id,
          userEmail: user.email || "unknown",
          timestamp: Date.now(),
        },
      });
    },
    [user, isConnected]
  );

  const broadcastNodeAdded = useCallback((node: any) => {
    if (!channelRef.current || !user || !isConnected) {
      console.warn("[Realtime] Cannot broadcast node_added: not connected", { isConnected, hasChannel: !!channelRef.current });
      return;
    }

    // Strip non-serializable data (functions, etc.)
    const cleanNode = JSON.parse(JSON.stringify(node));

    console.log("[Realtime] Broadcasting node_added", cleanNode.id);
    channelRef.current.send({
      type: "broadcast",
      event: "node_added",
      payload: {
        node: cleanNode,
        userId: user.id,
        userEmail: user.email || "unknown",
        firstName: profile?.first_name || null,
        lastName: profile?.last_name || null,
        avatarUrl: profile?.profile_picture_url || null,
        timestamp: Date.now()
      },
    });
  }, [user, profile, isConnected]);

  const broadcastNodeDeleted = useCallback((nodeId: string) => {
    if (!channelRef.current || !user || !isConnected) return;
    console.log("[Realtime] Broadcasting node_deleted", nodeId);
    channelRef.current.send({
      type: "broadcast",
      event: "node_deleted",
      payload: {
        nodeId,
        userId: user.id,
        userEmail: user.email || "unknown",
        firstName: profile?.first_name || null,
        lastName: profile?.last_name || null,
        avatarUrl: profile?.profile_picture_url || null,
        timestamp: Date.now()
      },
    });
  }, [user, profile, isConnected]);

  const broadcastNodeUpdated = useCallback((nodeId: string, data: any) => {
    if (!channelRef.current || !user || !isConnected) return;

    // Strip functions
    const cleanData = JSON.parse(JSON.stringify(data));

    console.log("[Realtime] Broadcasting node_updated", nodeId);
    channelRef.current.send({
      type: "broadcast",
      event: "node_updated",
      payload: {
        nodeId,
        data: cleanData,
        userId: user.id,
        userEmail: user.email || "unknown",
        firstName: profile?.first_name || null,
        lastName: profile?.last_name || null,
        avatarUrl: profile?.profile_picture_url || null,
        timestamp: Date.now()
      },
    });
  }, [user, profile, isConnected]);

  const broadcastEdgeAdded = useCallback((edge: any) => {
    if (!channelRef.current || !user || !isConnected) return;

    const cleanEdge = JSON.parse(JSON.stringify(edge));

    console.log("[Realtime] Broadcasting edge_added", cleanEdge.id);
    channelRef.current.send({
      type: "broadcast",
      event: "edge_added",
      payload: {
        edge: cleanEdge,
        userId: user.id,
        userEmail: user.email || "unknown",
        firstName: profile?.first_name || null,
        lastName: profile?.last_name || null,
        avatarUrl: profile?.profile_picture_url || null,
        timestamp: Date.now()
      },
    });
  }, [user, profile, isConnected]);

  const broadcastEdgeDeleted = useCallback((edgeId: string) => {
    if (!channelRef.current || !user || !isConnected) return;
    console.log("[Realtime] Broadcasting edge_deleted", edgeId);
    channelRef.current.send({
      type: "broadcast",
      event: "edge_deleted",
      payload: {
        edgeId,
        userId: user.id,
        userEmail: user.email || "unknown",
        firstName: profile?.first_name || null,
        lastName: profile?.last_name || null,
        avatarUrl: profile?.profile_picture_url || null,
        timestamp: Date.now()
      },
    });
  }, [user, profile, isConnected]);

  const broadcastNodeFocus = useCallback((nodeId: string | null) => {
    if (!channelRef.current || !user || !isConnected) return;
    console.log("[Realtime] Broadcasting node_focus", nodeId);
    channelRef.current.send({
      type: "broadcast",
      event: "node_focus",
      payload: {
        nodeId,
        userId: user.id,
        userEmail: user.email || "unknown",
        firstName: profile?.first_name || null,
        lastName: profile?.last_name || null,
        avatarUrl: profile?.profile_picture_url || null,
        timestamp: Date.now()
      },
    });
  }, [user, profile, isConnected]);

  // Handle incoming position updates
  const handlePositionUpdate = useCallback(
    (payload: PositionBroadcast) => {
      // Ignore our own broadcasts
      if (payload.userId === user?.id) return;

      // Update position in store
      updateNodePosition(payload.nodeId, payload.position);

      // Call custom callback if provided
      onPositionUpdateRef.current?.(payload.nodeId, payload.position, payload.userId);

      // Update collaborator state in store
      setCollaborator(payload.userId, {
        userId: payload.userId,
        email: payload.userEmail,
        firstName: (payload as any).firstName || null,
        lastName: (payload as any).lastName || null,
        avatarUrl: (payload as any).avatarUrl || null,
        activeNodeId: payload.nodeId,
        lastSeen: payload.timestamp,
      });
    },
    [user?.id, updateNodePosition, setCollaborator]
  );

  // Handle batch position updates
  const handlePositionBatch = useCallback(
    (payload: { positions: Array<{ nodeId: string; position: { x: number; y: number } }>; userId: string; userEmail: string; timestamp: number }) => {
      // Ignore our own broadcasts
      if (payload.userId === user?.id) return;

      // Update all positions
      payload.positions.forEach(({ nodeId, position }) => {
        updateNodePosition(nodeId, position);
        onPositionUpdateRef.current?.(nodeId, position, payload.userId);
      });

      // Update collaborator state in store
      setCollaborator(payload.userId, {
        userId: payload.userId,
        email: payload.userEmail,
        firstName: (payload as any).firstName || null,
        lastName: (payload as any).lastName || null,
        avatarUrl: (payload as any).avatarUrl || null,
        activeNodeId: null, // Batch update, no single active node
        lastSeen: payload.timestamp,
      });
    },
    [user?.id, updateNodePosition, setCollaborator]
  );

  // Set up Supabase Realtime channel
  useEffect(() => {
    if (!enabled || !user || !session?.access_token) {
      return;
    }

    const channelName = getChannelName();

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }, // Don't receive our own broadcasts
      },
    });

    // Listen for position updates
    channel
      .on("broadcast", { event: "position_update" }, ({ payload }) => {
        handlePositionUpdate(payload as PositionBroadcast);
      })
      .on("broadcast", { event: "positions_batch" }, ({ payload }) => {
        handlePositionBatch(payload);
      })
      .on("broadcast", { event: "node_added" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        console.log("[Realtime] Received remote node_added", payload.node.id);
        onNodeAddedRef.current?.(payload.node, payload.userId);
      })
      .on("broadcast", { event: "node_deleted" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        console.log("[Realtime] Received remote node_deleted", payload.nodeId);
        onNodeDeletedRef.current?.(payload.nodeId, payload.userId);
      })
      .on("broadcast", { event: "node_updated" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        console.log("[Realtime] Received remote node_updated", payload.nodeId);
        onNodeUpdatedRef.current?.(payload.nodeId, payload.data, payload.userId);
      })
      .on("broadcast", { event: "edge_added" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        console.log("[Realtime] Received remote edge_added", payload.edge.id);
        onEdgeAddedRef.current?.(payload.edge, payload.userId);
      })
      .on("broadcast", { event: "edge_deleted" }, ({ payload }) => {
        if (payload.userId === user.id) return;
        console.log("[Realtime] Received remote edge_deleted", payload.edgeId);
        onEdgeDeletedRef.current?.(payload.edgeId, payload.userId);
      })
      .on("broadcast", { event: "node_focus" }, ({ payload }: { payload: NodeFocusBroadcast }) => {
        if (payload.userId === user.id) return;
        console.log("[Realtime] Received remote node_focus", payload.nodeId);
        setCollaborator(payload.userId, {
          userId: payload.userId,
          email: payload.userEmail,
          firstName: payload.firstName || null,
          lastName: payload.lastName || null,
          avatarUrl: payload.avatarUrl || null,
          activeNodeId: payload.nodeId,
          lastSeen: payload.timestamp,
        });
      })
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status for ${channelName}:`, status);
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    // Cleanup on unmount or when dependencies change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled, user, session?.access_token, getChannelName, handlePositionUpdate, handlePositionBatch]);

  // Cleanup stale collaborators (older than 1 minute)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [userId, state] of activeCollaborators) {
        if (now - state.lastSeen > 60000) {
          removeCollaborator(userId);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [activeCollaborators, removeCollaborator]);

  return {
    broadcastPosition,
    broadcastPositionBatch,
    broadcastNodeAdded,
    broadcastNodeDeleted,
    broadcastNodeUpdated,
    broadcastEdgeAdded,
    broadcastEdgeDeleted,
    broadcastNodeFocus,
    activeCollaborators,
    isConnected,
  };
}

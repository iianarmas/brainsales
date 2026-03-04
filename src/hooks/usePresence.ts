"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";

export function usePresence() {
  const { user, organizationId } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user || !organizationId) return;

    const updatePresence = async (isOnline: boolean = true) => {
      try {
        const { error } = await supabase.from("user_presence").upsert(
          {
            user_id: user.id,
            email: user.email,
            last_seen: new Date().toISOString(),
            is_online: isOnline,
            organization_id: organizationId,
          },
          { onConflict: "user_id" }
        );

        if (error) {
          console.error("Presence update error:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
        }
      } catch (error) {
        console.error("Failed to update presence:", error);
      }
    };

    const setOffline = () => {
      updatePresence(false);
    };

    // Initial presence update
    updatePresence(true);

    // Heartbeat every 30 seconds
    intervalRef.current = setInterval(() => updatePresence(true), 30000);

    // Supabase Presence channel so other clients detect joins/leaves instantly
    const presenceChannel = supabase.channel(`org-presence:${organizationId}`, {
      config: { presence: { key: user.id } },
    });

    presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({ user_id: user.id });
      }
    });

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        void presenceChannel.untrack();
      } else {
        updatePresence(true);
        void presenceChannel.track({ user_id: user.id });
        if (!intervalRef.current) {
          intervalRef.current = setInterval(() => updatePresence(true), 30000);
        }
      }
    };

    // Handle beforeunload (user closing/navigating away)
    const handleBeforeUnload = () => {
      const data = JSON.stringify({
        user_id: user.id,
        is_online: false,
      });
      navigator.sendBeacon?.("/api/presence-offline", data);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      setOffline();
      supabase.removeChannel(presenceChannel);
    };
  }, [user, organizationId]);
}

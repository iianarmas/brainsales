"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";

export function usePresence() {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const updatePresence = async (isOnline: boolean = true) => {
      try {
        const { error } = await supabase.from("user_presence").upsert(
          {
            user_id: user.id,
            email: user.email,
            last_seen: new Date().toISOString(),
            is_online: isOnline,
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
        } else {

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

    // Handle page visibility changes
    // When tab is hidden, stop heartbeat but keep is_online=true so user shows as "idle"
    // (their last_seen will get stale, and the frontend can show them as idle)
    // When tab is visible again, resume heartbeat
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Stop heartbeat but don't set offline - user will appear idle as last_seen ages
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Tab is visible again - update presence immediately and restart heartbeat
        updatePresence(true);
        if (!intervalRef.current) {
          intervalRef.current = setInterval(() => updatePresence(true), 30000);
        }
      }
    };

    // Handle beforeunload (user closing/navigating away)
    const handleBeforeUnload = () => {
      // Use sendBeacon for more reliable delivery on page unload
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
    };
  }, [user]);
}

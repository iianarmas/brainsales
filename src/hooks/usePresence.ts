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
          console.log("Presence updated:", { isOnline, user_id: user.id });
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
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setOffline();
      } else {
        updatePresence(true);
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

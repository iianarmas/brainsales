"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";

// Simple session-level cache for admin status
const adminStatusCache: Record<string, boolean> = {};

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    // Initialize from cache if available
    return user ? adminStatusCache[user.id] ?? false : false;
  });
  const [checkedUserId, setCheckedUserId] = useState<string | null>(() => {
    // If we have a cached value, we count it as already checked
    return user && adminStatusCache[user.id] !== undefined ? user.id : null;
  });

  // Loading is true if:
  // 1. Auth is still loading, OR
  // 2. We have a user but haven't checked their admin status yet (and not in cache)
  const loading = useMemo(() => {
    if (authLoading) return true;
    if (user && checkedUserId !== user.id) return true;
    return false;
  }, [authLoading, user, checkedUserId]);

  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        setIsAdmin(false);
        setCheckedUserId(null);
        return;
      }

      // Skip if already checked this user in THIS component instance
      // or if it's already in the session cache (handled by initial state)
      if (checkedUserId === user.id) return;

      try {
        const { data } = await supabase
          .from("admins")
          .select("id")
          .eq("user_id", user.id)
          .single();

        const status = !!data;
        setIsAdmin(status);
        adminStatusCache[user.id] = status;
      } catch {
        setIsAdmin(false);
        // We don't cache failure to allow for retries or if it was a network error
        // but for a better UX we could cache false too. 
        // Given this is an admin check, strictness is better.
      } finally {
        setCheckedUserId(user.id);
      }
    }

    checkAdminStatus();
  }, [user, checkedUserId]);

  return { isAdmin, loading };
}

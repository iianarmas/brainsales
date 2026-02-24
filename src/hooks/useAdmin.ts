"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";

/**
 * Hook to check if the current user has admin privileges.
 * 
 * NOTE: We've removed the static session-level cache to ensure that if a user's
 * role changes (e.g. after registering an organization), the app detects it 
 * immediately without requiring a full page refresh.
 */
export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  // Loading is true if:
  // 1. Auth is still loading, OR
  // 2. We have a user but haven't checked their admin status for this specific user ID yet
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

      // If we've already checked this specific user in this component instance, skip
      if (checkedUserId === user.id) return;

      try {
        // We check the 'admins' table which is the source of truth for 
        // administrative privileges (script editing, etc.)
        const { data, error } = await supabase
          .from("admins")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        setIsAdmin(!!data);
      } catch (err) {
        console.error("Error checking admin status:", err);
        setIsAdmin(false);
      } finally {
        setCheckedUserId(user.id);
      }
    }

    checkAdminStatus();
  }, [user, checkedUserId]);

  return { isAdmin, loading };
}

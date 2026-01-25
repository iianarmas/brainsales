"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";

export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  // Loading is true if:
  // 1. Auth is still loading, OR
  // 2. We have a user but haven't checked their admin status yet
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

      // Skip if already checked this user
      if (checkedUserId === user.id) return;

      try {
        const { data } = await supabase
          .from("admins")
          .select("id")
          .eq("user_id", user.id)
          .single();

        setIsAdmin(!!data);
      } catch {
        setIsAdmin(false);
      } finally {
        setCheckedUserId(user.id);
      }
    }

    checkAdminStatus();
  }, [user, checkedUserId]);

  return { isAdmin, loading };
}

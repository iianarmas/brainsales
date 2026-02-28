"use client";

import { useAuth } from "@/context/AuthContext";

/**
 * Hook to check if the current user has admin privileges.
 * 
 * Consumes the isAdmin status from AuthContext, which is cached
 * in localStorage for synchronous initialization across page loads.
 */
export function useAdmin() {
  const { loading: authLoading, isAdmin: authIsAdmin } = useAuth();

  // Loading is true only if auth itself is loading
  const loading = authLoading;
  const isAdmin = authIsAdmin;

  return { isAdmin, loading };
}

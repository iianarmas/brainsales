"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/app/lib/supabaseClient";
import { UserProfile } from "@/types/profile";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  organizationId: string | null;
  authStatus: "authenticated" | "pending_approval" | "no_org" | "unauthenticated";
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("brainsales_profile_cache");
        return cached ? JSON.parse(cached) : null;
      } catch { return null; }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(!profile);
  const [organizationId, setOrganizationId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("brainsales_org_id_cache");
    }
    return null;
  });
  const [authStatus, setAuthStatus] = useState<"authenticated" | "pending_approval" | "no_org" | "unauthenticated">("unauthenticated");
  const profileFetchedForUser = useRef<string | null>(null);
  const lastProfileFetchRef = useRef<number>(0);
  const validationInProgress = useRef(false);
  const validatedUserId = useRef<string | null>(null);

  // Validate user's email domain against org whitelist in DB
  const validateUser = async (accessToken: string, userId: string): Promise<boolean> => {
    // Skip re-validation if this user was already validated
    if (validatedUserId.current === userId) return true;
    if (validationInProgress.current) return true;
    validationInProgress.current = true;

    try {
      const response = await fetch("/api/auth/validate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Treat server/network errors and rate limiting as transient — don't log the user out
      if (response.status >= 500 || response.status === 429) return true;

      const data = await response.json();

      if (data.valid && data.organizationId) {
        setOrganizationId(data.organizationId);
        localStorage.setItem("brainsales_org_id_cache", data.organizationId);
        setAuthStatus("authenticated");
        validatedUserId.current = userId;
        return true;
      }

      if (data.reason === "pending_approval") {
        setAuthStatus("pending_approval");
        // Keep user signed-in but blocked at the waiting screen
        validatedUserId.current = userId;
        return true; // don't force sign-out
      }

      if (data.reason === "no_org") {
        setAuthStatus("no_org");
        // Redirect to /register — user is authenticated with Google but has no workspace
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/register")) {
          window.location.href = `/register?email=${encodeURIComponent(data.email ?? "")}`;
        }
        validatedUserId.current = userId;
        return true; // keep session alive so /register can use it
      }

      return false;
    } catch {
      // Network error / timeout — assume transient, don't force logout
      return true;
    } finally {
      validationInProgress.current = false;
    }
  };

  // Fetch profile function
  const fetchProfile = async (accessToken: string) => {
    const now = Date.now();
    // Only fetch if it's been > 30s since last success, or if user changed
    if (now - lastProfileFetchRef.current < 30000 && profile) return;

    setProfileLoading(true);
    try {
      const response = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Only update if changed
        if (JSON.stringify(profile) !== JSON.stringify(data.profile)) {
          setProfile(data.profile);
          localStorage.setItem("brainsales_profile_cache", JSON.stringify(data.profile));
        }
        lastProfileFetchRef.current = Date.now();
      } else {
        console.error("Failed to fetch profile");
        setProfile(null);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (session?.access_token) {
      await fetchProfile(session.access_token);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user?.email && session.access_token) {
        // Only validate and fetch profile on sign-in or initial session
        // AND only if the user isn't already validated (prevents cross-tab reload)
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && validatedUserId.current !== session.user.id) {
          setLoading(true); // Ensure loading is true when we start parallel fetching
          try {
            // Parallelize validation and profile fetching
            const [isValidResult] = await Promise.all([
              validateUser(session.access_token, session.user.id),
              fetchProfile(session.access_token)
            ]);

            if (!isValidResult) {
              await supabase.auth.signOut();
              setUser(null);
              setSession(null);
              setOrganizationId(null);
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error("Auth initialization error:", error);
          }
        }
      }

      if (event === "SIGNED_OUT") {
        validatedUserId.current = null;
        setAuthStatus("unauthenticated");
        setOrganizationId(null);
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const userId = user?.id ?? null;
  // Profile fetching is primarily handled by onAuthStateChange event listeners for performance (parallelizing with validation)
  // This hook ensures that if context is re-rendered or state is lost, the profile is still fetched.
  useEffect(() => {
    if (userId && session?.access_token && profileFetchedForUser.current !== userId && !profileLoading) {
      profileFetchedForUser.current = userId;
      fetchProfile(session.access_token);
    } else if (!userId) {
      profileFetchedForUser.current = null;
      setProfile(null);
    }
  }, [userId, session?.access_token, profileLoading]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setOrganizationId(null);
    setAuthStatus("unauthenticated");
    await supabase.auth.signOut();
  };

  const value = useMemo(() => ({
    user,
    session,
    profile,
    loading,
    profileLoading,
    organizationId,
    authStatus,
    signInWithGoogle,
    signOut,
    refreshProfile,
  }), [
    user,
    session,
    profile,
    loading,
    profileLoading,
    organizationId,
    authStatus,
    signInWithGoogle,
    signOut
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

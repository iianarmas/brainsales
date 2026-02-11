"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
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
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const profileFetchedForUser = useRef<string | null>(null);
  const validationInProgress = useRef(false);

  // Validate user's email domain against org whitelist in DB
  const validateUser = async (accessToken: string): Promise<boolean> => {
    if (validationInProgress.current) return true;
    validationInProgress.current = true;

    try {
      const response = await fetch("/api/auth/validate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.valid && data.organizationId) {
        setOrganizationId(data.organizationId);
        return true;
      }

      return false;
    } catch {
      return false;
    } finally {
      validationInProgress.current = false;
    }
  };

  // Fetch profile function
  const fetchProfile = async (accessToken: string) => {
    setProfileLoading(true);
    try {
      const response = await fetch("/api/profile", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
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
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user?.email && session.access_token) {
        // Validate user's domain against DB org whitelist
        const isValid = await validateUser(session.access_token);

        if (!isValid) {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setOrganizationId(null);
          setLoading(false);
          return;
        }
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile once when user ID changes (not on every token refresh)
  const userId = user?.id ?? null;
  useEffect(() => {
    if (userId && session?.access_token && profileFetchedForUser.current !== userId) {
      profileFetchedForUser.current = userId;
      fetchProfile(session.access_token);
    } else if (!userId) {
      profileFetchedForUser.current = null;
      setProfile(null);
    }
  }, [userId, session?.access_token]);

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
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        profileLoading,
        organizationId,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
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

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";
import { LoadingScreen } from "./LoadingScreen";
import { X, Users, RefreshCw, Circle } from "lucide-react";

interface UserPresence {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  last_seen: string;
  is_online: boolean;
}

interface AdminDashboardProps {
  onClose: () => void;
}

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const { session } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;

    const headers = {
      Authorization: `Bearer ${session.access_token}`,
    };

    try {
      const usersRes = await fetch("/api/admin/online-users", { headers });

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setOnlineUsers(usersData);
      }
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
      setError("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime presence updates
    const channel = supabase
      .channel("admin-presence-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        () => fetchData()
      )
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchData]);

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString();
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-primary-light">
          <h2 className="text-lg font-semibold text-white">Admin Dashboard</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-white hover:text-primary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <LoadingScreen fullScreen={false} message="Fetching admin data..." />
          ) : (
            <>
              {/* Online Users Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-primary" />
                  <h3 className="font-medium text-gray-900">
                    Online Users ({onlineUsers.length})
                  </h3>
                  <button
                    onClick={fetchData}
                    className="ml-auto p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className="h-4 w-4 text-primary" />
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg border border-primary-light/20">
                  {onlineUsers.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500 text-center">
                      No users currently online
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-200">
                      {onlineUsers.map((user) => {
                        const displayName = user.first_name && user.last_name
                          ? `${user.first_name} ${user.last_name}`
                          : user.first_name || user.last_name || user.email;

                        return (
                          <li
                            key={user.id}
                            className="flex items-center justify-between p-3"
                          >
                            <div className="flex items-center gap-2">
                              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                              <span className="text-sm text-gray-900">
                                {displayName}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatLastSeen(user.last_seen)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-primary-light/20 bg-primary-light/10">
          <p className="text-xs text-gray-500 text-center">
            Admin: {session?.user?.email}
          </p>
        </div>
      </div>
    </div>
  );
}

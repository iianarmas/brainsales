"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";
import { X, Users, Key, RefreshCw, Save, Check, Circle } from "lucide-react";

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
  const [inviteCode, setInviteCode] = useState("");
  const [newInviteCode, setNewInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!session?.access_token) return;

    const headers = {
      Authorization: `Bearer ${session.access_token}`,
    };

    try {
      const [usersRes, settingsRes] = await Promise.all([
        fetch("/api/admin/online-users", { headers }),
        fetch("/api/admin/settings", { headers }),
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setOnlineUsers(usersData);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setInviteCode(settingsData.value);
        setNewInviteCode(settingsData.value);
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

  const saveInviteCode = async () => {
    if (!session?.access_token || !newInviteCode.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: newInviteCode }),
      });

      if (response.ok) {
        const data = await response.json();
        setInviteCode(data.value);
        setNewInviteCode(data.value);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to save");
      }
    } catch {
      setError("Failed to save invite code");
    } finally {
      setSaving(false);
    }
  };

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
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
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
                    <RefreshCw className="h-4 w-4 text-gray-400" />
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

              {/* Invite Code Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Key className="h-5 w-5 text-primary" />
                  <h3 className="font-medium text-gray-900">Invite Code</h3>
                </div>
                <div className="bg-gray-50 rounded-lg border border-primary-light/20 p-4 space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Current Code
                    </label>
                    <p className="font-mono text-lg font-semibold text-gray-900">
                      {inviteCode}
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="newInviteCode"
                      className="block text-xs text-gray-500 mb-1"
                    >
                      Change Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="newInviteCode"
                        type="text"
                        value={newInviteCode}
                        onChange={(e) =>
                          setNewInviteCode(e.target.value.toUpperCase())
                        }
                        className="flex-1 px-3 py-2 border border-primary-light/20 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-primary-light focus:border-primary-light outline-none"
                        placeholder="NEW CODE"
                      />
                      <button
                        onClick={saveInviteCode}
                        disabled={
                          saving ||
                          !newInviteCode.trim() ||
                          newInviteCode === inviteCode
                        }
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {saving ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : saved ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {saved ? "Saved!" : "Save"}
                      </button>
                    </div>
                  </div>
                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                </div>
              </div>
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

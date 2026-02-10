"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/app/lib/supabaseClient";

interface OnlineUser {
  id: string;
  user_id: string;
  email: string;
  last_seen: string;
  is_online: boolean;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
}

export function OnlineUsersHeader() {
  const { session, user: currentUser } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  const fetchOnlineUsers = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const res = await fetch("/api/online-users", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Filter out the current user
        setOnlineUsers(
          data.filter((u: OnlineUser) => u.user_id !== currentUser?.id)
        );
      }
    } catch (err) {
      console.error("Failed to fetch online users:", err);
    }
  }, [session?.access_token, currentUser?.id]);

  useEffect(() => {
    fetchOnlineUsers();

    // Subscribe to realtime presence updates
    const channel = supabase
      .channel("header-presence-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        () => fetchOnlineUsers()
      )
      .subscribe();

    // Refresh every 30 seconds
    const interval = setInterval(fetchOnlineUsers, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchOnlineUsers]);

  if (onlineUsers.length === 0) return null;

  const getInitials = (user: OnlineUser) => {
    const first = user.first_name?.[0] || "";
    const last = user.last_name?.[0] || "";
    if (first || last) return `${first}${last}`.toUpperCase();
    return user.email?.[0]?.toUpperCase() || "?";
  };

  const getDisplayName = (user: OnlineUser) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.first_name || user.last_name || user.email;
  };

  const isIdle = (user: OnlineUser) => {
    const lastSeen = new Date(user.last_seen).getTime();
    const now = Date.now();
    // Consider idle if last_seen is older than 45 seconds
    return now - lastSeen > 45000;
  };

  // Colors for initials avatars - deterministic based on user_id
  const avatarColors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-cyan-500",
  ];

  const getAvatarColor = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  // Ring colors for online indicators
  const ringColors = [
    "ring-red-500",
    "ring-blue-500",
    "ring-green-500",
    "ring-yellow-500",
    "ring-purple-500",
    "ring-pink-500",
    "ring-indigo-500",
    "ring-teal-500",
    "ring-orange-500",
  ];

  const getRingColor = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Mixing up the hash slightly to avoid same color for ring and avatar background if possible
    hash = (hash * 31) & 0xFFFFFFFF;
    return ringColors[Math.abs(hash) % ringColors.length];
  };

  // Show max 5 avatars, then a "+N" overflow
  const maxVisible = 5;
  const visibleUsers = onlineUsers.slice(0, maxVisible);
  const overflowCount = onlineUsers.length - maxVisible;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visibleUsers.map((user) => {
          const idle = isIdle(user);
          return (
            <div key={user.user_id} className="relative group/avatar">
              {/* Avatar */}
              <div
                className={`relative h-8 w-8 rounded-full ring-2 ${idle ? "ring-gray-300 opacity-50" : getRingColor(user.user_id)
                  } flex-shrink-0 transition-all cursor-pointer`}
              >
                {user.profile_picture_url ? (
                  <img
                    src={user.profile_picture_url}
                    alt={getDisplayName(user)}
                    className={`h-full w-full rounded-full object-cover ${idle ? "grayscale-[30%]" : ""
                      }`}
                  />
                ) : (
                  <div
                    className={`h-full w-full rounded-full flex items-center justify-center text-white text-xs font-semibold ${getAvatarColor(
                      user.user_id
                    )} ${idle ? "grayscale-[30%]" : ""}`}
                  >
                    {getInitials(user)}
                  </div>
                )}

              </div>

              {/* Custom Google-style Tooltip */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-white text-gray-900 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.15)] border border-gray-100 opacity-0 group-hover/avatar:opacity-100 transition-all scale-95 group-hover/avatar:scale-100 pointer-events-none z-[100] min-w-[200px]">
                <div className="flex items-center gap-3">
                  {/* Tooltip Image */}
                  <div className="h-10 w-10 rounded-full flex-shrink-0 overflow-hidden ring-1 ring-gray-100">
                    {user.profile_picture_url ? (
                      <img
                        src={user.profile_picture_url}
                        alt={getDisplayName(user)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className={`h-full w-full flex items-center justify-center text-white text-sm font-semibold ${getAvatarColor(user.user_id)}`}>
                        {getInitials(user)}
                      </div>
                    )}
                  </div>

                  {/* Tooltip Info */}
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm truncate">
                      {getDisplayName(user)}
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                      {user.email}
                    </span>
                    {idle && (
                      <span className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">
                        Idle
                      </span>
                    )}
                  </div>
                </div>

                {/* Tooltip arrow */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2">
                  <div className="border-[6px] border-transparent border-b-white" />
                  <div className="absolute top-[-1px] left-1/2 -translate-x-1/2 border-[6px] border-transparent border-b-gray-100 -z-10" />
                </div>
              </div>
            </div>
          );
        })}

        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <div className="relative group">
            <div className="h-8 w-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
              +{overflowCount}
            </div>

            {/* Overflow tooltip */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] shadow-lg">
              {onlineUsers.slice(maxVisible).map((user) => (
                <div key={user.user_id} className="py-0.5">
                  {getDisplayName(user)}
                </div>
              ))}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-px">
                <div className="border-4 border-transparent border-b-gray-900" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

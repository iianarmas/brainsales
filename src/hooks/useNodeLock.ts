"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

export function useNodeLock(nodeId: string | null) {
    const { session } = useAuth();
    const [lockedBy, setLockedBy] = useState<string | null>(null);
    const [isLockedByMe, setIsLockedByMe] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const releaseLock = useCallback(async (id: string) => {
        if (!session?.access_token) return;

        try {
            await fetch("/api/admin/scripts/locks", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ nodeId: id }),
            });
        } catch (error) {
            console.error("Error releasing lock:", error);
        }
    }, [session]);

    const acquireLock = useCallback(async (id: string) => {
        if (!session?.access_token) return;

        try {
            const response = await fetch("/api/admin/scripts/locks", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ nodeId: id }),
            });

            const data = await response.json();

            if (response.status === 409) {
                setLockedBy(data.lockedBy);
                setIsLockedByMe(false);
            } else if (response.ok) {
                setLockedBy(null);
                setIsLockedByMe(true);
            } else {
                console.error("Lock error:", data.error);
            }
        } catch (error) {
            console.error("Error acquiring lock:", error);
        }
    }, [session]);

    useEffect(() => {
        if (!nodeId || !session) {
            setLockedBy(null);
            setIsLockedByMe(false);
            return;
        }

        acquireLock(nodeId);

        // Heartbeat every 30 seconds to refresh lock
        intervalRef.current = setInterval(() => {
            acquireLock(nodeId);
        }, 30000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            releaseLock(nodeId);
        };
    }, [nodeId, session, acquireLock, releaseLock]);

    return { lockedBy, isLockedByMe };
}

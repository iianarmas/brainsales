"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";

interface HeatmapOverlayProps {
    isVisible: boolean;
    nodes: any[];
}

export default function HeatmapOverlay({ isVisible, nodes }: HeatmapOverlayProps) {
    const { session } = useAuth();
    const [stats, setStats] = useState<Record<string, number>>({});
    const [maxCount, setMaxCount] = useState(0);

    useEffect(() => {
        if (!isVisible || !session?.access_token) return;

        const fetchStats = async () => {
            try {
                const response = await fetch("/api/analytics/stats", {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    setStats(data);

                    // Find max count for normalization
                    const counts = Object.values(data) as number[];
                    if (counts.length > 0) {
                        setMaxCount(Math.max(...counts));
                    }
                }
            } catch (error) {
                console.error("Error fetching heatmap stats:", error);
            }
        };

        fetchStats();
    }, [isVisible, session]);

    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 pointer-events-none z-0">
            {nodes.map((node) => {
                const count = stats[node.id] || 0;
                if (count === 0) return null;

                // Calculate intensity (0 to 1)
                const intensity = maxCount > 0 ? count / maxCount : 0;

                // Heatmap colors: Low (Blue/Green) -> High (Red)
                // For simplicity, we'll use a red overlay with varying opacity
                const opacity = 0.1 + intensity * 0.5; // From 0.1 to 0.6

                return (
                    <div
                        key={`heatmap-${node.id}`}
                        className="absolute rounded-lg transition-all duration-500 bg-red-500 blur-xl"
                        style={{
                            left: node.position.x - 10,
                            top: node.position.y - 10,
                            width: (node.width || 200) + 20,
                            height: (node.height || 100) + 20,
                            opacity: opacity,
                            zIndex: -1,
                        }}
                    />
                );
            })}
        </div>
    );
}

"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@xyflow/react";

interface HeatmapOverlayProps {
    isVisible: boolean;
    nodes: any[];
}

export default function HeatmapOverlay({ isVisible, nodes }: HeatmapOverlayProps) {
    const { session } = useAuth();
    const [stats, setStats] = useState<Record<string, number>>({});
    const [maxCount, setMaxCount] = useState(0);

    // Get the viewport transform from React Flow store
    const transform = useStore((s) => s.transform);
    const [tx, ty, tzoom] = transform;

    useEffect(() => {
        if (!isVisible || !session?.access_token) return;

        const fetchStats = async () => {
            try {
                const response = await fetch("/api/analytics/log", {
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
        <div
            className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
            style={{
                transform: `rotate(0deg)`, // Reset parent transform if needed
            }}
        >
            <div
                style={{
                    transform: `translate(${tx}px, ${ty}px) scale(${tzoom})`,
                    transformOrigin: "0 0",
                    width: "100%",
                    height: "100%",
                }}
            >
                {nodes.map((node) => {
                    const count = stats[node.id] || 0;
                    if (count === 0) return null;

                    // Calculate intensity (0 to 1)
                    const intensity = maxCount > 0 ? count / maxCount : 0;

                    const opacity = 0.1 + intensity * 0.5; // From 0.1 to 0.6

                    // Use measured dimensions if available, otherwise fallback
                    const width = node.measured?.width || node.width || 250;
                    const height = node.measured?.height || node.height || 150;

                    return (
                        <div
                            key={`heatmap-${node.id}`}
                            className="absolute rounded-lg transition-all duration-500 bg-red-500 blur-2xl"
                            style={{
                                left: node.position.x - 20,
                                top: node.position.y - 20,
                                width: width + 40,
                                height: height + 40,
                                opacity: opacity,
                                zIndex: -1,
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

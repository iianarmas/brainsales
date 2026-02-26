"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
    message?: string;
    fullScreen?: boolean;
}

export function LoadingScreen({
    message = "Loading...",
    fullScreen = false
}: LoadingScreenProps) {
    const content = (
        <div className="flex flex-col items-center justify-center gap-6 p-8">
            <div className="relative">
                {/* Main purple spinner with subtle drop shadow instead of background glow */}
                <Loader2 className="h-10 w-10 animate-spin text-primary relative z-10 drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.2)]" />
            </div>

            <div className="flex flex-col items-center gap-2 relative z-10">
                <p className="text-xl font-bold text-foreground animate-pulse tracking-tight transition-colors">
                    BrainSales
                </p>
                <p className="text-sm text-foreground/60 font-medium tracking-wide uppercase transition-colors">
                    {message}
                </p>
            </div>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center transition-all duration-500">
                {content}
            </div>
        );
    }

    return (
        <div className="w-full h-full min-h-[400px] flex items-center justify-center">
            {content}
        </div>
    );
}

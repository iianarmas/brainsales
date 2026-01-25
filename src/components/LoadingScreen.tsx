"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
    message?: string;
    fullScreen?: boolean;
}

export function LoadingScreen({
    message = "Loading...",
    fullScreen = true
}: LoadingScreenProps) {
    const content = (
        <div className="flex flex-col items-center justify-center gap-6 p-8">
            <div className="relative">
                {/* Glowing background effect */}
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />

                {/* Main purple spinner */}
                <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
            </div>

            <div className="flex flex-col items-center gap-2 relative z-10">
                <p className="text-xl font-bold text-primary animate-pulse tracking-tight">
                    BrainSales
                </p>
                <p className="text-sm text-primary-light font-medium tracking-wide uppercase">
                    {message}
                </p>
            </div>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center transition-all duration-500">
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

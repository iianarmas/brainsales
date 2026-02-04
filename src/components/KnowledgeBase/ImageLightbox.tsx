'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Maximize, RefreshCcw } from 'lucide-react';

interface ImageLightboxProps {
    src: string;
    alt?: string;
    onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Handle zoom with scroll
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) return; // Allow standard browser zoom if needed? Usually we want to intercept.

        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.min(Math.max(scale + delta, 0.5), 5);
        setScale(newScale);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale <= 1) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const reset = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const zoomIn = () => setScale(s => Math.min(s + 0.2, 5));
    const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));

    return (
        <div className="fixed inset-0 z-[100] flex flex-col">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-md cursor-pointer"
                onClick={onClose}
            />

            {/* Header controls */}
            <div className="relative z-10 flex items-center justify-between p-4 bg-black/20">
                <div className="text-white text-sm font-medium truncate max-w-[200px] sm:max-w-md">
                    {alt || 'Image Preview'}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={reset}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Reset"
                    >
                        <RefreshCcw className="h-5 w-5" />
                    </button>
                    <div className="h-4 w-px bg-white/20 mx-1" />
                    <button
                        onClick={zoomOut}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut className="h-5 w-5" />
                    </button>
                    <span className="text-white text-xs min-w-[3rem] text-center font-mono">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={zoomIn}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn className="h-5 w-5" />
                    </button>
                    <div className="h-4 w-px bg-white/20 mx-1" />
                    <button
                        onClick={onClose}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors focus:outline-none"
                        title="Close"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>
            </div>

            {/* Image Container */}
            <div
                ref={containerRef}
                className="relative flex-1 flex items-center justify-center overflow-hidden h-full"
                onWheel={handleWheel}
            >
                <div
                    className="relative transition-transform duration-75 ease-out select-none"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                    }}
                    onMouseDown={handleMouseDown}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src}
                        alt={alt}
                        className="max-h-[85vh] max-w-[90vw] object-contain shadow-2xl pointer-events-none"
                        draggable={false}
                    />
                </div>
            </div>

            {/* Footer Info */}
            <div className="relative z-10 p-4 text-center">
                <p className="text-white/40 text-xs">
                    Scroll to zoom • Click & drag to move • ESC to close
                </p>
            </div>
        </div>
    );
}

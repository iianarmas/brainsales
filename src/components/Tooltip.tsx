'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
    variant?: 'primary' | 'invert';
}

export function Tooltip({ content, children, position = 'top', className = '', variant = 'primary' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const updatePosition = () => {
        if (triggerRef.current && tooltipRef.current) {
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            let top = 0;
            let left = 0;

            switch (position) {
                case 'top':
                    top = triggerRect.top - tooltipRect.height - 8;
                    left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                    break;
                case 'bottom':
                    top = triggerRect.bottom + 8;
                    left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                    break;
                case 'left':
                    top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                    left = triggerRect.left - tooltipRect.width - 8;
                    break;
                case 'right':
                    top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                    left = triggerRect.right + 8;
                    break;
            }

            // Constrain to viewport
            const padding = 8;
            left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
            top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));

            setCoords({ top: top + window.scrollY, left: left + window.scrollX });
        }
    };

    useEffect(() => {
        if (isVisible) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);
        }
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isVisible]);

    const variantStyles = variant === 'primary'
        ? "text-primary-foreground bg-primary border-transparent"
        : "text-foreground bg-surface-elevated border border-border shadow-lg";

    const arrowColor = variant === 'primary' ? "bg-primary" : "bg-surface-elevated border-border";

    return (
        <div
            ref={triggerRef}
            className={`inline-block ${className}`}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && content && (
                <div
                    ref={tooltipRef}
                    style={{ top: coords.top, left: coords.left }}
                    className={`fixed z-[9999] px-2.5 py-1 text-xs font-semibold rounded shadow-lg pointer-events-none animate-in fade-in zoom-in-95 duration-100 whitespace-nowrap transition-colors ${variantStyles}`}
                >
                    {content}
                    {/* Arrow */}
                    <div
                        className={`absolute w-2 h-2 rotate-45 ${arrowColor} ${variant === 'invert' ? (
                            position === 'top' ? 'border-r border-b' :
                                position === 'bottom' ? 'border-l border-t' :
                                    position === 'left' ? 'border-r border-t' :
                                        'border-l border-b'
                        ) : ''
                            } ${position === 'top' ? 'bottom-[-5px] left-1/2 -translate-x-1/2' :
                                position === 'bottom' ? 'top-[-5px] left-1/2 -translate-x-1/2' :
                                    position === 'left' ? 'right-[-5px] top-1/2 -translate-y-1/2' :
                                        'left-[-5px] top-1/2 -translate-y-1/2'
                            }`}
                    />
                </div>
            )}
        </div>
    );
}

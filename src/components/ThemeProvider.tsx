'use client';

import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';

// ─── Color Utility Functions (pure math, no dependencies) ───

function hexToHSL(hex: string): { h: number; s: number; l: number } {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * Math.max(0, Math.min(1, color)))
            .toString(16)
            .padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Determine if white or dark text has better contrast on the given background.
 * Returns '#ffffff' or '#11111B' (our dark base).
 */
function getAccessibleForeground(hex: string): string {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    // Relative luminance (simplified)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#11111B' : '#ffffff';
}

// ─── Derive all primary color tokens ───

interface DerivedTokens {
    primary: string;
    primaryHover: string;
    primaryMuted: string;
    primarySubtleBg: string;
    primaryForeground: string;
    ring: string;
}

function derivePrimaryTokens(primaryHex: string, isDark: boolean): DerivedTokens {
    const hsl = hexToHSL(primaryHex);

    let { h, s, l } = hsl;

    if (isDark) {
        // Increase lightness, reduce saturation for safe dark mode display
        l = clamp(l + 8, 30, 75);
        s = clamp(s - 6, 10, 90);
    }

    const primary = hslToHex(h, s, l);
    const primaryHover = hslToHex(h, s, clamp(isDark ? l + 6 : l - 6, 10, 90));
    const primaryForeground = getAccessibleForeground(primary);

    return {
        primary,
        primaryHover,
        primaryMuted: `hsla(${h}, ${s}%, ${l}%, 0.4)`,
        primarySubtleBg: `hsla(${h}, ${s}%, ${l}%, ${isDark ? 0.12 : 0.08})`,
        primaryForeground,
        ring: primary,
    };
}

// ─── ThemeProvider Component ───

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { theme, primaryColor } = useThemeStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const root = document.documentElement;
        const isDark = theme === 'dark';

        // 1. Set data-theme attribute (drives CSS token switching + Tailwind dark:)
        root.setAttribute('data-theme', theme);

        // 2. Compute derived primary tokens
        const tokens = derivePrimaryTokens(primaryColor, isDark);

        // 3. Apply all primary-derived tokens to the root
        root.style.setProperty('--primary', tokens.primary);
        root.style.setProperty('--primary-hover', tokens.primaryHover);
        root.style.setProperty('--primary-muted', tokens.primaryMuted);
        root.style.setProperty('--primary-subtle-bg', tokens.primarySubtleBg);
        root.style.setProperty('--primary-foreground', tokens.primaryForeground);
        root.style.setProperty('--ring', tokens.ring);
        root.style.setProperty('--focus-ring', tokens.ring);
    }, [theme, primaryColor, mounted]);

    return <>{children}</>;
}

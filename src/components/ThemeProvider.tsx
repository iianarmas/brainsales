'use client';

import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { theme, primaryColor } = useThemeStore();
    const [mounted, setMounted] = useState(false);

    // Avoid hydration mismatch by waiting for mount
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const root = window.document.documentElement;

        // Apply theme class
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        // Apply primary color
        root.style.setProperty('--primary', primaryColor);

        // Optionally calculate a darker/lighter variant if needed for shadows/gradients
        // root.style.setProperty('--primary-dark', darken(primaryColor, 10));
    }, [theme, primaryColor, mounted]);

    // Prevent flash by not rendering until mounted if needed, 
    // but better to just apply the class to the html element immediately.
    // Next.js handles this better with suppressHydrationWarning on body/html.

    return <>{children}</>;
}

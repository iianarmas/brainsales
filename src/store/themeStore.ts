import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface ThemeState {
    theme: Theme;
    primaryColor: string;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    setPrimaryColor: (color: string) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'light',
            primaryColor: '#502c85',
            toggleTheme: () =>
                set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
            setTheme: (theme) => set({ theme }),
            setPrimaryColor: (color) => set({ primaryColor: color }),
        }),
        {
            name: 'brainsales-theme-storage',
        }
    )
);

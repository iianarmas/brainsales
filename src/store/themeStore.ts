import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

export interface ThemePreset {
    name: string;
    value: string; // hex
}

export const THEME_PRESETS: ThemePreset[] = [
    { name: 'Purple', value: '#502c85' },
    { name: 'Indigo', value: '#4f46e5' },
    { name: 'Blue', value: '#2563eb' },
    { name: 'Sky', value: '#0ea5e9' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Amber', value: '#d97706' },
    { name: 'Rose', value: '#e11d48' },
];

interface ThemeState {
    theme: Theme;
    primaryColor: string;
    presetName: string | null; // null = custom color
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    setPrimaryColor: (color: string) => void;
    selectPreset: (preset: ThemePreset) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'light',
            primaryColor: '#502c85',
            presetName: 'Purple',
            toggleTheme: () =>
                set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
            setTheme: (theme) => set({ theme }),
            setPrimaryColor: (color) => set({ primaryColor: color, presetName: null }),
            selectPreset: (preset) => set({ primaryColor: preset.value, presetName: preset.name }),
        }),
        {
            name: 'brainsales-theme-storage',
        }
    )
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

export interface ThemePreset {
    name: string;
    value: string; // hex
}

export const THEME_PRESETS: ThemePreset[] = [
    { name: 'Petrol', value: '#1a4c65' },
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
    presetName: string | null;
    previewTheme: Theme | null;
    previewColor: string | null;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    setPrimaryColor: (color: string) => void;
    selectPreset: (preset: ThemePreset) => void;

    // Preview actions
    setPreviewTheme: (theme: Theme | null) => void;
    setPreviewColor: (color: string | null) => void;
    reset: () => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'light',
            primaryColor: '#1a4c65',
            presetName: 'Petrol',
            previewTheme: null,
            previewColor: null,
            toggleTheme: () =>
                set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
            setTheme: (theme) => set({ theme }),
            setPrimaryColor: (color) => set({ primaryColor: color, presetName: null }),
            selectPreset: (preset) => set({ primaryColor: preset.value, presetName: preset.name }),
            setPreviewTheme: (previewTheme) => set({ previewTheme }),
            setPreviewColor: (previewColor) => set({ previewColor }),
            reset: () => set({
                theme: 'light',
                primaryColor: '#1a4c65',
                presetName: 'Petrol',
                previewTheme: null,
                previewColor: null,
            }),
        }),
        {
            name: 'brainsales-theme-storage',
            partialize: (state) => Object.fromEntries(
                Object.entries(state).filter(([key]) => !['previewTheme', 'previewColor'].includes(key))
            ),
        }
    )
);

'use client';

import { Check, Palette, Moon, Sun } from 'lucide-react';
import { THEME_PRESETS, type ThemePreset, useThemeStore } from '@/store/themeStore';

interface ThemeCustomizerProps {
    selectedColor: string;
    onColorChange: (color: string) => void;
}

export function ThemeCustomizer({ selectedColor, onColorChange }: ThemeCustomizerProps) {
    const { theme, toggleTheme } = useThemeStore();

    return (
        <div className="p-4 bg-surface-elevated rounded-xl border border-border shadow-sm space-y-6">
            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                    {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                    <h3 className="font-semibold">Dark Mode</h3>
                </div>
                <button
                    onClick={toggleTheme}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    style={{ backgroundColor: theme === 'dark' ? 'var(--primary)' : 'var(--muted)' }}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                    />
                </button>
            </div>

            {/* Accent Color Selection */}
            <div>
                <div className="flex items-center gap-2 mb-4 text-primary">
                    <Palette className="h-5 w-5" />
                    <h3 className="font-semibold">Accent Color</h3>
                </div>

                <div className="flex flex-wrap gap-3">
                    {THEME_PRESETS.map((color: ThemePreset) => (
                        <button
                            key={color.value}
                            onClick={() => onColorChange(color.value)}
                            className="group relative flex items-center justify-center h-10 w-10 rounded-full border-2 transition-all hover:scale-110 active:scale-95"
                            style={{
                                backgroundColor: color.value,
                                borderColor: selectedColor === color.value ? 'var(--foreground)' : 'transparent'
                            }}
                            title={color.name}
                        >
                            {selectedColor === color.value && (
                                <Check className="h-5 w-5 text-white drop-shadow-md" />
                            )}
                            <span className="sr-only">{color.name}</span>
                        </button>
                    ))}

                    {/* Custom color picker */}
                    <div className="relative h-10 w-10">
                        <input
                            type="color"
                            value={selectedColor}
                            onChange={(e) => onColorChange(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            title="Custom Color"
                        />
                        <div
                            className="h-full w-full rounded-full border-2 border-dashed border-text-muted flex items-center justify-center text-text-muted hover:border-primary hover:text-primary transition-colors"
                            style={{
                                backgroundColor: THEME_PRESETS.some(c => c.value === selectedColor) ? 'transparent' : selectedColor,
                                borderColor: THEME_PRESETS.some(c => c.value === selectedColor) ? undefined : 'var(--foreground)'
                            }}
                        >
                            {!THEME_PRESETS.some(c => c.value === selectedColor) ? (
                                <Check className="h-5 w-5 text-white drop-shadow-md" />
                            ) : (
                                <span className="font-bold">+</span>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            <p className="mt-4 text-xs text-text-muted">
                This will update the primary color across the entire application once you save your profile.
            </p>
        </div>
    );
}

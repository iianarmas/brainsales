'use client';

import { Check, Palette } from 'lucide-react';
import { THEME_PRESETS, type ThemePreset } from '@/store/themeStore';

interface ThemeCustomizerProps {
    selectedColor: string;
    onColorChange: (color: string) => void;
}

export function ThemeCustomizer({ selectedColor, onColorChange }: ThemeCustomizerProps) {
    return (
        <div className="p-4 bg-surface-elevated rounded-xl border border-border shadow-sm space-y-6">


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

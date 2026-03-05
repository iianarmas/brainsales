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

            {/* Live preview */}
            <div className="mt-5">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Preview</p>
                <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <button className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium">
                            Save Changes
                        </button>
                        <button className="px-3 py-1.5 rounded-lg border border-primary text-primary text-xs font-medium">
                            Cancel
                        </button>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                            Active
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-10 rounded-full bg-primary" />
                        <div className="space-y-1">
                            <div className="h-2 w-28 rounded bg-primary/20" />
                            <div className="h-2 w-20 rounded bg-primary/10" />
                        </div>
                    </div>
                    <p className="text-xs text-primary font-medium">Link · Selected item · Accent text</p>
                </div>
            </div>
        </div>
    );
}

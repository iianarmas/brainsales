'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { Search, X } from 'lucide-react';

// Build icon name list once, filtering out non-component exports
const ALL_ICON_NAMES: string[] = Object.keys(LucideIcons).filter((key) => {
  if (key === 'default' || key === 'createLucideIcon' || key === 'icons') return false;
  // Icon components start with uppercase and are functions/objects
  if (key[0] !== key[0].toUpperCase()) return false;
  // Filter out type exports and aliases (keep only PascalCase names)
  if (key.includes('Icon') && key !== key.replace(/Icon$/, '')) return false;
  const val = (LucideIcons as Record<string, unknown>)[key];
  return typeof val === 'function' || typeof val === 'object';
}).sort();

interface LucideIconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  /** If true, the value/onChange uses lowercase (e.g. "rocket") and converts to PascalCase for lookup */
  lowercase?: boolean;
}

export function LucideIconPicker({ value, onChange, lowercase = false }: LucideIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Resolve displayed icon
  const resolvedName = lowercase && value
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : value;
  const PreviewIcon = (LucideIcons as Record<string, any>)[resolvedName] || LucideIcons.HelpCircle;

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    if (!search.trim()) return ALL_ICON_NAMES.slice(0, 200); // Show first 200 when no search
    const q = search.toLowerCase();
    return ALL_ICON_NAMES.filter((name) => name.toLowerCase().includes(q)).slice(0, 200);
  }, [search]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus search when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch('');
    }
  }, [open]);

  const handleSelect = (iconName: string) => {
    onChange(lowercase ? iconName.toLowerCase() : iconName);
    setOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded border border-gray-200 text-gray-600 hover:bg-gray-200 hover:border-gray-300 transition-colors shrink-0"
        title="Browse icons"
      >
        <PreviewIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 bg-white rounded-xl border border-gray-200 shadow-xl">
          {/* Search bar */}
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search icons..."
                  className="w-full text-sm pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              {search ? `${filteredIcons.length} results` : `${ALL_ICON_NAMES.length} icons available`} — click to select
            </p>
          </div>

          {/* Icon grid */}
          <div className="p-2 max-h-64 overflow-y-auto grid grid-cols-8 gap-1">
            {filteredIcons.map((name) => {
              const Icon = (LucideIcons as Record<string, any>)[name];
              if (!Icon) return null;
              const isSelected = resolvedName === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelect(name)}
                  title={name}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
            {filteredIcons.length === 0 && (
              <div className="col-span-8 py-6 text-center text-sm text-gray-400">
                No icons found for &quot;{search}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

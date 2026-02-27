'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
    id: string;
    name: string;
    group?: string;
}

interface ThemedSelectProps {
    value: string;
    options: Option[];
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    labelPrefix?: string;
}

export function ThemedSelect({
    value,
    options,
    onChange,
    className = '',
    placeholder = 'Select...',
    labelPrefix = '',
}: ThemedSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find((opt) => opt.id === value);
    const displayLabel = selectedOption ? `${labelPrefix}${selectedOption.name}` : placeholder;

    const handleSelect = (id: string) => {
        onChange(id);
        setIsOpen(false);
    };

    // Group options if they have a group property
    const hasGroups = options.some(opt => opt.group);
    const groupedOptions = hasGroups
        ? options.reduce((acc, opt) => {
            const group = opt.group || 'Other';
            if (!acc[group]) acc[group] = [];
            acc[group].push(opt);
            return acc;
        }, {} as Record<string, Option[]>)
        : { 'Default': options };

    return (
        <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full appearance-none bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 text-primary dark:text-primary-light text-sm font-medium pl-3 pr-2 py-1.5 rounded-md cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary transition-all border border-transparent hover:border-primary/20"
            >
                <span className="truncate mr-2">{displayLabel}</span>
                <ChevronDown className={`h-4 w-4 text-primary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-1 w-full min-w-[200px] bg-background border border-primary/20 dark:border-white/10 rounded-lg shadow-xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="py-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {Object.entries(groupedOptions).map(([group, groupOpts], groupIdx) => (
                            <div key={group}>
                                {hasGroups && group !== 'Other' && (
                                    <div className="px-3 py-1.5 text-[10px] font-bold text-foreground/40 uppercase tracking-widest border-b border-primary/5 mb-1 bg-primary/2">
                                        {group}
                                    </div>
                                )}
                                {groupOpts.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => handleSelect(option.id)}
                                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${option.id === value
                                                ? 'bg-primary text-white'
                                                : 'text-foreground/70 hover:bg-primary/10 hover:text-primary'
                                            }`}
                                    >
                                        <span className="truncate">{option.name}</span>
                                        {option.id === value && (
                                            <div className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                                        )}
                                    </button>
                                ))}
                                {groupIdx < Object.entries(groupedOptions).length - 1 && (
                                    <div className="h-1 my-1 border-b border-primary/5" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

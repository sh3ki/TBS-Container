import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
    value: string;
    label: string;
}

interface MultiSelectProps {
    options: MultiSelectOption[];
    value: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    className?: string;
    openUpward?: boolean;
}

export function MultiSelect({
    options,
    value,
    onChange,
    placeholder = 'Select options',
    searchPlaceholder = 'Search options...',
    className,
    openUpward = false,
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const containerRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const popoverRef = React.useRef<HTMLDivElement>(null);
    const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>({});

    const updatePopoverPosition = React.useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        setPopoverStyle({
            position: 'fixed',
            top: openUpward ? undefined : rect.bottom + 4,
            bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
            left: rect.left,
            width: rect.width,
            maxHeight: Math.max(160, openUpward ? rect.top - 12 : window.innerHeight - rect.bottom - 12),
        });
    }, [openUpward]);

    React.useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node) &&
                !popoverRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    React.useEffect(() => {
        if (!open) return;
        updatePopoverPosition();
        window.addEventListener('resize', updatePopoverPosition);
        window.addEventListener('scroll', updatePopoverPosition, true);
        return () => {
            window.removeEventListener('resize', updatePopoverPosition);
            window.removeEventListener('scroll', updatePopoverPosition, true);
        };
    }, [open, updatePopoverPosition]);

    const selected = new Set(value);
    const filteredOptions = options.filter((option) =>
        option.label.toLowerCase().includes(search.toLowerCase())
    );
    const selectedLabels = options
        .filter((option) => selected.has(option.value))
        .map((option) => option.label);

    const toggleOption = (optionValue: string) => {
        onChange(selected.has(optionValue)
            ? value.filter((item) => item !== optionValue)
            : [...value, optionValue]);
    };

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <button
                type="button"
                ref={triggerRef}
                onClick={() => setOpen((current) => !current)}
                className="flex h-11 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 shadow-xs outline-none transition focus:border-[#3E9AF4] focus:ring-[3px] focus:ring-[#3E9AF4]/20"
                aria-expanded={open}
            >
                <span className={cn('truncate', selectedLabels.length === 0 && 'text-gray-400')}>
                    {selectedLabels.length === 0 ? placeholder : `${selectedLabels.length} selected`}
                </span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', open && 'rotate-180')} />
            </button>

            {open && typeof document !== 'undefined' && createPortal(
                <div ref={popoverRef} style={popoverStyle} className="z-[100] overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                    <div className="border-b border-gray-200 p-2">
                        <div className="flex items-center gap-2 rounded-md border border-gray-300 px-2.5 focus-within:border-[#3E9AF4] focus-within:ring-2 focus-within:ring-[#3E9AF4]/20">
                            <Search className="h-4 w-4 shrink-0 text-gray-400" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={searchPlaceholder}
                                className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                                autoFocus
                            />
                            {search && <button type="button" onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-700"><X className="h-4 w-4" /></button>}
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                        {filteredOptions.length === 0 ? (
                            <p className="px-3 py-6 text-center text-sm text-gray-500">No matching options.</p>
                        ) : filteredOptions.map((option) => {
                            const checked = selected.has(option.value);
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => toggleOption(option.value)}
                                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-gray-900 outline-none hover:bg-blue-50 focus:bg-blue-50"
                                >
                                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border', checked ? 'border-[#3E9AF4] bg-[#3E9AF4] text-white' : 'border-gray-300 bg-white')}>
                                        {checked && <Check className="h-3.5 w-3.5" />}
                                    </span>
                                    <span className="truncate">{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}

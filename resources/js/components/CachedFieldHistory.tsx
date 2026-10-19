import { useEffect, useState } from 'react';

type HistoryEntry = {
    key: string;
    value: string;
};

const STORAGE_KEY = 'fjpwl.field-history.v1';
const readHistory = (): HistoryEntry[] => {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(stored) ? stored : [];
    } catch {
        return [];
    }
};

export const saveFieldHistory = (entries: Record<string, string | undefined | null>) => {
    const values = Object.entries(entries).filter(([, value]) => typeof value === 'string' && value.trim());
    if (values.length === 0) return;

    let history = readHistory();
    values.forEach(([key, value]) => {
        const normalized = (value as string).trim();
        history = history.filter((entry) => !(entry.key === key && entry.value === normalized));
        history.unshift({ key, value: normalized });
    });

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 300)));
    } catch {
        // Ignore storage failures; autocomplete remains available for existing history.
    }
};

const getSuggestions = (key: string, query: string) => {
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery) return [];

    return readHistory()
        .filter((entry) => entry.key === key && entry.value.toUpperCase().startsWith(normalizedQuery))
        .map((entry) => entry.value)
        .filter((value, index, values) => values.indexOf(value) === index)
        .slice(0, 8);
};

export default function CachedFieldHistory() {
    const [activeField, setActiveField] = useState<HTMLElement | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        const update = (element: HTMLElement) => {
            const key = element.dataset.historyKey;
            if (!key) return;

            const value = (element as HTMLInputElement | HTMLTextAreaElement).value;
            const rect = element.getBoundingClientRect();
            setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
            setSuggestions(getSuggestions(key, value));
            setActiveField(value.trim() ? element : null);
        };

        const handleFocus = (event: FocusEvent) => {
            const element = event.target as HTMLElement;
            if (element.dataset.historyKey) update(element);
        };

        const handleInput = (event: Event) => {
            const element = event.target as HTMLElement;
            if (element.dataset.historyKey) update(element);
        };

        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (activeField && !activeField.contains(target)) {
                setActiveField(null);
                setSuggestions([]);
            }
        };

        document.addEventListener('focusin', handleFocus);
        document.addEventListener('input', handleInput);
        document.addEventListener('mousedown', handleOutsideClick);
        const handleViewportChange = () => activeField && update(activeField);
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        return () => {
            document.removeEventListener('focusin', handleFocus);
            document.removeEventListener('input', handleInput);
            document.removeEventListener('mousedown', handleOutsideClick);
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
        };
    }, [activeField]);

    if (!activeField || suggestions.length === 0) return null;

    const selectSuggestion = (value: string) => {
        const element = activeField as HTMLInputElement | HTMLTextAreaElement;
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
        setter?.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        setActiveField(null);
        setSuggestions([]);
    };

    return (
        <div
            className="fixed z-[10000] max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
            style={{ top: position.top, left: position.left, width: position.width }}
            onMouseDown={(event) => event.preventDefault()}
        >
            {suggestions.map((suggestion) => (
                <button
                    type="button"
                    key={suggestion}
                    className="block w-full cursor-pointer px-3 py-2 text-left text-gray-900 hover:bg-gray-100"
                    onClick={() => selectSuggestion(suggestion)}
                >
                    {suggestion}
                </button>
            ))}
        </div>
    );
}

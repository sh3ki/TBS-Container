import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

const applySuggestion = (element: HTMLElement, value: string) => {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
};

export default function CachedFieldHistory() {
    const [activeField, setActiveField] = useState<HTMLElement | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
    // Keyboard events can arrive before React has committed the state update
    // from ArrowUp/ArrowDown. Keep the current selection synchronously.
    const activeFieldRef = useRef<HTMLElement | null>(null);
    const suggestionsRef = useRef<string[]>([]);
    const highlightedIndexRef = useRef(-1);

    const setActiveHistoryField = (field: HTMLElement | null) => {
        activeFieldRef.current = field;
        setActiveField(field);
    };

    const setHistorySuggestions = (values: string[]) => {
        suggestionsRef.current = values;
        setSuggestions(values);
    };

    const setHistoryHighlightedIndex = (index: number) => {
        highlightedIndexRef.current = index;
        setHighlightedIndex(index);
    };

    useEffect(() => {
        const update = (element: HTMLElement) => {
            const key = element.dataset.historyKey;
            if (!key) return;

            const value = (element as HTMLInputElement | HTMLTextAreaElement).value;
            const rect = element.getBoundingClientRect();
            setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
            setHistorySuggestions(getSuggestions(key, value));
            setHistoryHighlightedIndex(-1);
            setActiveHistoryField(value.trim() ? element : null);
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
            const option = target instanceof Element
                ? target.closest('[data-cached-history-option]') as HTMLElement | null
                : null;

            if (option) return;

            if (activeField && !activeField.contains(target)) {
                setActiveHistoryField(null);
                setHistorySuggestions([]);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            const currentField = activeFieldRef.current;
            const currentSuggestions = suggestionsRef.current;
            if (!currentField || event.target !== currentField || currentSuggestions.length === 0) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                setHistoryHighlightedIndex((highlightedIndexRef.current + 1) % currentSuggestions.length);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                setHistoryHighlightedIndex(highlightedIndexRef.current <= 0 ? currentSuggestions.length - 1 : highlightedIndexRef.current - 1);
            } else if (event.key === 'Enter' && highlightedIndexRef.current >= 0) {
                event.preventDefault();
                event.stopPropagation();
                applySuggestion(currentField, currentSuggestions[highlightedIndexRef.current]);
                setActiveHistoryField(null);
                setHistorySuggestions([]);
                setHistoryHighlightedIndex(-1);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setActiveHistoryField(null);
                setHistorySuggestions([]);
                setHistoryHighlightedIndex(-1);
            }
        };

        document.addEventListener('focusin', handleFocus);
        document.addEventListener('input', handleInput);
        document.addEventListener('mousedown', handleOutsideClick);
        // Capture the event before form handlers can treat Enter as submit.
        document.addEventListener('keydown', handleKeyDown, true);
        const handleViewportChange = () => activeField && update(activeField);
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('scroll', handleViewportChange, true);

        return () => {
            document.removeEventListener('focusin', handleFocus);
            document.removeEventListener('input', handleInput);
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('scroll', handleViewportChange, true);
        };
    }, [activeField, suggestions, highlightedIndex]);

    if (!activeField || suggestions.length === 0) return null;

    const portalTarget = activeField.closest('[role="dialog"]') || document.body;
    const targetRect = portalTarget.getBoundingClientRect();
    const isBodyPortal = portalTarget === document.body;
    const dropdownPosition = isBodyPortal
        ? position
        : {
              top: position.top - targetRect.top,
              left: position.left - targetRect.left,
              width: position.width,
          };

    const selectSuggestion = (value: string) => {
        if (!activeField) return;
        applySuggestion(activeField, value);
        setActiveHistoryField(null);
        setHistorySuggestions([]);
        setHistoryHighlightedIndex(-1);
    };

    return createPortal(
        <div
            className={`${isBodyPortal ? 'fixed' : 'absolute'} max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg`}
            style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                zIndex: 2147483647,
                pointerEvents: 'auto',
            }}
        >
            {suggestions.map((suggestion, index) => (
                <button
                    type="button"
                    key={suggestion}
                    data-cached-history-option="true"
                    data-cached-history-value={suggestion}
                    className={`block w-full cursor-pointer px-3 py-2 text-left text-gray-900 ${index === highlightedIndex ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectSuggestion(suggestion);
                    }}
                >
                    {suggestion}
                </button>
            ))}
        </div>,
        portalTarget,
    );
}

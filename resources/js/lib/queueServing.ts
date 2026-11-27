import type { CSSProperties } from 'react';

export function servingStartedAt(servingAt: string | null | undefined): number {
    if (!servingAt) return Number.NaN;

    // MySQL timestamps have no offset. Treat offset-less values as Manila time.
    const value = servingAt.trim().replace(' ', 'T');
    const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
        ? Date.parse(value)
        : (() => {
            const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?/);
            if (!parts) return Number.NaN;
            const milliseconds = Number((parts[7] ?? '').padEnd(3, '0').slice(0, 3) || 0);
            return Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), Number(parts[4]), Number(parts[5]), Number(parts[6] ?? 0), milliseconds) - (8 * 60 * 60 * 1000);
        })();

    return timestamp;
}

export function servingElapsedSeconds(servingAt: string | null | undefined, now: Date): number {
    const timestamp = servingStartedAt(servingAt);
    if (!Number.isFinite(timestamp)) return 0;
    return Math.max(0, Math.floor((now.getTime() - timestamp) / 1000));
}

export function servingRuntime(servingAt: string | null | undefined, now: Date): string {
    const elapsed = servingElapsedSeconds(servingAt, now);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function servingCardColors(servingAt: string | null | undefined, now: Date, greenOnly = false): CSSProperties {
    if (!greenOnly) {
        const minutes = servingElapsedSeconds(servingAt, now) / 60;
        if (minutes >= 60) return { backgroundColor: '#F1D5DE', borderColor: '#9F3853', color: '#202A35' };
        if (minutes >= 45) return { backgroundColor: '#FEE2E2', borderColor: '#EF4444', color: '#7F1D1D' };
        if (minutes >= 30) return { backgroundColor: '#FFEDD5', borderColor: '#F97316', color: '#9A3412' };
        if (minutes >= 20) return { backgroundColor: '#FEF9C3', borderColor: '#EAB308', color: '#854D0E' };
    }
    return { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', color: '#065F46' };
}

export function servingAccentColors(servingAt: string | null | undefined, now: Date, greenOnly = false): CSSProperties {
    if (!greenOnly) {
        const minutes = servingElapsedSeconds(servingAt, now) / 60;
        if (minutes >= 60) return { backgroundColor: '#DFA1B2', color: '#8F2945' };
        if (minutes >= 45) return { backgroundColor: '#FECACA', color: '#B91C1C' };
        if (minutes >= 30) return { backgroundColor: '#FED7AA', color: '#C2410C' };
        if (minutes >= 20) return { backgroundColor: '#FEF08A', color: '#A16207' };
    }
    return { backgroundColor: '#D1FAE5', color: '#047857' };
}

export function servingPlateTextColor(): string {
    return '#202A35';
}

export function activeQueueTimestamp(entry: { status?: string; calling_at?: string | null; floating_at?: string | null; standby_at?: string | null }): string | null | undefined {
    return entry.status === 'floating'
        ? entry.floating_at
        : entry.status === 'calling'
            ? entry.calling_at
            : entry.status === 'standby'
                ? entry.standby_at
                : undefined;
}

export function activeQueueRuntime(entry: { status?: string; calling_at?: string | null; floating_at?: string | null; standby_at?: string | null }, now: Date): string {
    return servingRuntime(activeQueueTimestamp(entry), now);
}

export function activeQueueLabel(entry: { status?: string }): string {
    return entry.status === 'calling' ? 'Calling' : entry.status === 'floating' ? 'Floating' : entry.status === 'standby' ? 'Stand By' : '';
}

export function activeQueueCardColors(): CSSProperties {
    return { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', color: '#202A35' };
}

export function activeQueueRuntimeColor(entry: { status?: string; calling_at?: string | null; floating_at?: string | null; standby_at?: string | null }, now: Date): string {
    const minutes = servingElapsedSeconds(activeQueueTimestamp(entry), now) / 60;
    if (minutes >= 45) return '#8F2945';
    if (minutes >= 30) return '#B91C1C';
    if (minutes >= 20) return '#C2410C';
    if (minutes >= 10) return '#A16207';
    return '#047857';
}

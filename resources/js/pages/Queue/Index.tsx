import {
    ModernConfirmDialog,
    ToastContainer,
    useModernToast,
} from '@/components/modern';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { colors } from '@/lib/colors';
import {
    activeQueueCardColors,
    activeQueueLabel,
    activeQueueRuntime,
    activeQueueRuntimeColor,
    servingAccentColors,
    servingCardColors,
    servingPlateTextColor,
    servingRuntime,
} from '@/lib/queueServing';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    Flag,
    List,
    Megaphone,
    Pause,
    Radio,
    RotateCw,
    ScanLine,
    Settings,
    Truck,
    X,
} from 'lucide-react';
import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useState } from 'react';

interface QueueEntry {
    id: number;
    plate_no: string;
    direction?: 'IN' | 'OUT';
    waiting_number?: number;
    serving_number?: number;
    booking_time?: string | null;
    manual_reason?: string | null;
    manual_guard_user_id?: number | null;
    serving_at?: string | null;
    status?: string;
    calling_at?: string | null;
    floating_at?: string | null;
    standby_at?: string | null;
    standby_code?: string | null;
    size_type_size?: string | number | null;
    size_type_type?: string | null;
}
interface QueueEntryDetails {
    client?: string | null;
    size_type?: string | null;
    iso_code?: string | null;
    hauler?: string | null;
}
interface StandbyStatus {
    id: number;
    code: string;
    name: string;
    message?: string | null;
}
interface GuardAccount {
    user_id: number;
    username: string;
    full_name?: string | null;
}
interface QueueData {
    waiting_in: QueueEntry[];
    waiting_out: QueueEntry[];
    serving: QueueEntry[];
}
interface QueuePageProps {
    servingCapacity?: number;
}
const emptyQueue: QueueData = { waiting_in: [], waiting_out: [], serving: [] };

function formatBookingTime(value?: string | null): string {
    if (!value) return '--:--';
    const match = value.match(/(?:T|\s)(\d{2}):(\d{2})/);
    if (match) return `${match[1]}:${match[2]}`;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? '--:--'
        : parsed.toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
          });
}

function queueSizeType(entry: QueueEntry): string {
    const size = String(entry.size_type_size ?? '').trim();
    const type = String(entry.size_type_type ?? '').trim();
    if (!size || size === '0' || !type || type === '0') return '-';
    return `${size}${type}`;
}

function bookingTimeTextColor(
    value: string | null | undefined,
    now: Date,
): string | undefined {
    if (!value) return undefined;
    const raw = value.trim();
    const match = raw.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/,
    );
    if (!match) return undefined;

    const [, year, month, day, hour = '00', minute = '00', second = '00'] =
        match;
    const bookingDate = new Date(
        `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`,
    );
    if (Number.isNaN(bookingDate.getTime())) return undefined;

    const manilaParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    })
        .formatToParts(now)
        .reduce<Record<string, string>>((parts, part) => {
            if (part.type !== 'literal') parts[part.type] = part.value;
            return parts;
        }, {});
    const manilaNow = new Date(
        `${manilaParts.year}-${manilaParts.month}-${manilaParts.day}T${manilaParts.hour}:${manilaParts.minute}:${manilaParts.second}+08:00`,
    );
    const elapsed = manilaNow.getTime() - bookingDate.getTime();
    if (elapsed < 0) return undefined;
    if (elapsed < 60 * 60 * 1000) return '#A16207';
    if (elapsed < 2 * 60 * 60 * 1000) return '#C2410C';
    return '#DC2626';
}

function useClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    return now;
}

function autoScrollWhileDragging(clientY: number) {
    const edgeSize = Math.min(140, Math.max(72, window.innerHeight * 0.16));
    let distance = 0;
    if (clientY < edgeSize) {
        distance = -Math.ceil(((edgeSize - clientY) / edgeSize) * 22);
    } else if (clientY > window.innerHeight - edgeSize) {
        distance = Math.ceil(
            ((clientY - (window.innerHeight - edgeSize)) / edgeSize) * 22,
        );
    }
    if (distance !== 0) window.scrollBy({ top: distance, behavior: 'auto' });
}

function QueueColumn({
    title,
    direction,
    group,
    entries,
    serving = false,
    servingCapacity = 0,
    plannerMode = false,
    manualPending = false,
    canEdit,
    activeGroup,
    setActiveGroup,
    onMove,
    onCommit,
    onServe,
    onManual,
    onStandby,
    servingId,
    onStatus,
    statusId,
    now,
    onEntryClick,
}: {
    title: string;
    direction?: 'IN' | 'OUT';
    group: 'waiting_in' | 'waiting_out' | 'serving';
    entries: QueueEntry[];
    serving?: boolean;
    servingCapacity?: number;
    plannerMode?: boolean;
    manualPending?: boolean;
    canEdit: boolean;
    activeGroup: string | null;
    setActiveGroup: (group: string | null) => void;
    onMove: (from: number, to: number, direction?: 'IN' | 'OUT') => void;
    onCommit: (
        direction?: 'IN' | 'OUT',
        ids?: number[],
        planner?: boolean,
    ) => void;
    onServe?: (entry: QueueEntry) => void;
    onManual?: (entry: QueueEntry) => void;
    onStandby?: (entry: QueueEntry) => void;
    servingId?: number | null;
    onStatus?: (
        entry: QueueEntry,
        status: 'calling' | 'floating' | 'forfeited' | 'standby',
    ) => void;
    statusId?: number | null;
    now: Date;
    onEntryClick?: (entry: QueueEntry) => void;
}) {
    const [dragging, setDragging] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState<number | null>(null);
    const longestPlateLength = serving
        ? Math.max(8, ...entries.map((entry) => entry.plate_no.length))
        : 0;
    const servingCardWidth = `${longestPlateLength * 1.25 + 9}rem`;
    const handleEntryPanelClick = (event: MouseEvent<HTMLDivElement>) => {
        if (!onEntryClick || dragging !== null || activeGroup !== null) return;
        const article = (event.target as HTMLElement).closest<HTMLElement>(
            'article[data-queue-group]',
        );
        if (!article) return;
        const articleGroup = article.dataset.queueGroup;
        const articleIndex = Number(article.dataset.queueIndex);
        const source =
            articleGroup === 'serving_in'
                ? entries.filter((entry) => entry.direction === 'IN')
                : articleGroup === 'serving_out'
                  ? entries.filter((entry) => entry.direction === 'OUT')
                  : entries;
        if (Number.isInteger(articleIndex) && source[articleIndex])
            onEntryClick(source[articleIndex]);
    };
    const renderEntries = (
        list: QueueEntry[],
        listGroup: string,
        listDirection?: 'IN' | 'OUT',
    ) =>
        list.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center text-center text-[#68737b]">
                <List className="mb-3 h-8 w-8 text-[#3E9AF4]" />
                <p className="font-semibold">Queue is empty</p>
            </div>
        ) : (
            list.map((entry, index) => {
                const activeStatus =
                    entry.status === 'calling' || entry.status === 'floating';
                const isStandby = entry.status === 'standby';
                const activeColor =
                    activeStatus || isStandby
                        ? activeQueueRuntimeColor(entry, now)
                        : undefined;
                const pulseClass =
                    entry.status === 'calling'
                        ? 'queue-calling-pulse'
                        : entry.status === 'floating' ||
                            entry.status === 'standby'
                          ? 'queue-floating-pulse'
                          : '';
                const isFloating = entry.status === 'floating';
                const firstWaitingIndex = list.findIndex(
                    (item) => item.status === 'waiting',
                );
                const canDragEntry =
                    canEdit &&
                    !isStandby &&
                    (!plannerMode || (!serving && entry.status === 'calling'));
                const canDropEntry =
                    canDragEntry &&
                    (!plannerMode ||
                        (!serving &&
                            list[index]?.status === 'calling' &&
                            dragging !== null &&
                            list[dragging]?.status === 'calling'));
                const finishTouchDrag = () => {
                    if (dragging !== null && activeGroup === listGroup)
                        onCommit(
                            listDirection,
                            list
                                .filter(
                                    (item) =>
                                        !plannerMode ||
                                        item.status === 'calling',
                                )
                                .map((item) => item.id),
                            plannerMode,
                        );
                    setDragging(null);
                    setDropTarget(null);
                    setActiveGroup(null);
                };
                return (
                    <article
                        key={entry.id}
                        data-queue-group={listGroup}
                        data-queue-index={index}
                        draggable={canDragEntry}
                        onTouchStart={(event) => {
                            if (
                                !canDragEntry ||
                                (event.target as HTMLElement).closest('button')
                            )
                                return;
                            setDragging(index);
                            setActiveGroup(listGroup);
                        }}
                        onTouchMove={(event) => {
                            if (dragging === null || activeGroup !== listGroup)
                                return;
                            event.preventDefault();
                            const touch = event.touches[0];
                            autoScrollWhileDragging(touch.clientY);
                            const target = document
                                .elementFromPoint(touch.clientX, touch.clientY)
                                ?.closest<HTMLElement>('[data-queue-group]');
                            if (target?.dataset.queueGroup !== listGroup)
                                return;
                            const targetIndex = Number(
                                target.dataset.queueIndex,
                            );
                            if (
                                Number.isInteger(targetIndex) &&
                                targetIndex !== dragging &&
                                canDropEntry
                            ) {
                                onMove(dragging, targetIndex, listDirection);
                                setDragging(targetIndex);
                                setDropTarget(targetIndex);
                            }
                        }}
                        onTouchEnd={(event) => {
                            event.preventDefault();
                            finishTouchDrag();
                        }}
                        onDragStart={(event) => {
                            if (!canDragEntry) return;
                            setDragging(index);
                            setActiveGroup(listGroup);
                            event.dataTransfer.setData(
                                'queue-group',
                                listGroup,
                            );
                            event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(event) => {
                            if (activeGroup === listGroup) {
                                event.preventDefault();
                                autoScrollWhileDragging(event.clientY);
                                if (canDropEntry) {
                                    event.dataTransfer.dropEffect = 'move';
                                    setDropTarget(index);
                                    if (
                                        dragging !== null &&
                                        dragging !== index
                                    ) {
                                        onMove(dragging, index, listDirection);
                                        setDragging(index);
                                    }
                                }
                            }
                        }}
                        onDragLeave={() => setDropTarget(null)}
                        onDrop={(event) => {
                            event.preventDefault();
                            if (canDropEntry && activeGroup === listGroup)
                                onCommit(
                                    listDirection,
                                    list
                                        .filter(
                                            (item) =>
                                                !plannerMode ||
                                                item.status === 'calling',
                                        )
                                        .map((item) => item.id),
                                    plannerMode,
                                );
                            setDragging(null);
                            setDropTarget(null);
                            setActiveGroup(null);
                        }}
                        onDragEnd={() => {
                            setDragging(null);
                            setDropTarget(null);
                            setActiveGroup(null);
                        }}
                        style={
                            serving
                                ? servingCardColors(entry.serving_at, now)
                                : isStandby
                                  ? {
                                        backgroundColor: '#FEFCE8',
                                        borderColor: '#FACC15',
                                        color: '#854D0E',
                                    }
                                  : isFloating
                                    ? {
                                          backgroundColor: '#FFF7ED',
                                          borderColor: '#FDBA74',
                                          color: '#9A3412',
                                      }
                                    : activeStatus
                                      ? activeQueueCardColors()
                                      : undefined
                        }
                        className={`relative flex items-center gap-3 rounded-lg border px-3 py-3 transition-all duration-200 ease-out ${pulseClass} ${dragging === index && activeGroup === listGroup ? 'scale-[1.02] cursor-grabbing opacity-50 shadow-lg' : canDragEntry ? 'cursor-grab touch-none' : ''} ${dropTarget === index && activeGroup === listGroup ? 'border-t-4 border-t-blue-500' : ''} ${serving ? '' : isStandby ? 'border-yellow-300 bg-yellow-50' : isFloating ? 'border-orange-300 bg-orange-50' : activeStatus ? 'border-blue-200 bg-blue-50' : 'border-[#dfe3e8] bg-[#f8f9fa]'}`}
                    >
                        <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black ${serving ? '' : isStandby ? 'bg-yellow-400 text-white' : isFloating ? 'bg-orange-500 text-white' : activeStatus ? 'bg-[#3E9AF4] text-white' : 'bg-[#e5e8ec] text-[#536170]'}`}
                            style={
                                serving
                                    ? servingAccentColors(entry.serving_at, now)
                                    : undefined
                            }
                        >
                            {serving ? (
                                <Truck className="h-5 w-5" />
                            ) : entry.status === 'standby' ? (
                                <Pause className="h-5 w-5 text-white" />
                            ) : entry.status === 'calling' ? (
                                <Megaphone className="h-5 w-5" />
                            ) : entry.status === 'floating' ? (
                                <RotateCw className="h-5 w-5" />
                            ) : (
                                String(
                                    entry.waiting_number ?? index + 1,
                                ).padStart(2, '0')
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p
                                className={`${serving ? 'whitespace-nowrap' : 'break-all'} text-xl font-extrabold tracking-wide`}
                                style={{
                                    color: serving
                                        ? servingPlateTextColor()
                                        : '#202a35',
                                }}
                            >
                                {entry.plate_no}
                            </p>
                            <p
                                className={`flex items-center gap-2 text-xs font-bold ${serving ? '' : isStandby ? 'text-yellow-700' : activeStatus ? 'text-blue-700' : 'text-[#68737b]'}`}
                                style={
                                    serving
                                        ? {
                                              color: servingAccentColors(
                                                  entry.serving_at,
                                                  now,
                                              ).color,
                                          }
                                        : isStandby || activeStatus
                                          ? { color: activeColor }
                                          : undefined
                                }
                            >
                                {serving
                                    ? servingRuntime(entry.serving_at, now)
                                    : isStandby || activeStatus
                                      ? `${activeQueueLabel(entry)} - ${activeQueueRuntime(entry, now)}`
                                      : 'Waiting'}
                                {isStandby && entry.standby_code && (
                                    <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-[11px] font-black tracking-wide text-yellow-800">
                                        {entry.standby_code}
                                    </span>
                                )}
                            </p>
                        </div>
                        {!serving && canEdit && (
                            <div className="flex shrink-0 items-center gap-2">
                                <div className="flex flex-col items-stretch gap-1.5">
                                    {entry.status === 'waiting' &&
                                        index === firstWaitingIndex && (
                                            <button
                                                type="button"
                                                disabled={statusId === entry.id}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onStatus?.(
                                                        entry,
                                                        'calling',
                                                    );
                                                }}
                                                className="inline-flex items-center gap-1 rounded-lg bg-blue-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60"
                                            >
                                                <Megaphone className="h-3.5 w-3.5" />
                                                Call
                                            </button>
                                        )}
                                    {plannerMode &&
                                        entry.status === 'waiting' &&
                                        index === firstWaitingIndex && (
                                            <button
                                                type="button"
                                                disabled={statusId === entry.id}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onStandby?.(entry);
                                                }}
                                                className="inline-flex items-center gap-1 rounded-lg bg-yellow-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-yellow-600 disabled:opacity-60"
                                            >
                                                <Pause className="h-3.5 w-3.5" />
                                                Standby
                                            </button>
                                        )}
                                    {entry.status === 'standby' && (
                                        <button
                                            type="button"
                                            disabled={statusId === entry.id}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onStatus?.(entry, 'calling');
                                            }}
                                            className="inline-flex items-center gap-1 rounded-lg bg-blue-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60"
                                        >
                                            <Megaphone className="h-3.5 w-3.5" />
                                            Call
                                        </button>
                                    )}
                                    {entry.status === 'calling' && (
                                        <button
                                            type="button"
                                            disabled={statusId === entry.id}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onStatus?.(entry, 'floating');
                                            }}
                                            className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-60"
                                        >
                                            <Pause className="h-3.5 w-3.5" />
                                            Float
                                        </button>
                                    )}
                                    {!plannerMode &&
                                        entry.status === 'floating' && (
                                            <button
                                                type="button"
                                                disabled={statusId === entry.id}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onStatus?.(
                                                        entry,
                                                        'forfeited',
                                                    );
                                                }}
                                                className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-600 disabled:opacity-60"
                                            >
                                                <Flag className="h-3.5 w-3.5" />
                                                Forfeit
                                            </button>
                                        )}
                                    {plannerMode ? (
                                        <button
                                            type="button"
                                            disabled={
                                                manualPending ||
                                                Boolean(entry.manual_reason)
                                            }
                                            title={
                                                manualPending ||
                                                entry.manual_reason
                                                    ? 'Manual capture already requested.'
                                                    : 'Request manual capture'
                                            }
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onManual?.(entry);
                                            }}
                                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <ScanLine className="h-3.5 w-3.5 text-white" />
                                            Manual
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={servingId === entry.id}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onServe?.(entry);
                                            }}
                                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"
                                        >
                                            <Truck className="h-3.5 w-3.5 text-white" />
                                            {servingId === entry.id
                                                ? 'Serving...'
                                                : 'Serve'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="flex shrink-0 items-center gap-2">
                            <div className="flex flex-col items-center gap-0.5">
                                <span
                                    className={`rounded-md px-3 py-1.5 text-sm font-black tracking-wide ${serving ? '' : isStandby ? 'bg-yellow-100 text-yellow-800' : isFloating ? 'bg-orange-100 text-orange-700' : activeStatus ? 'bg-blue-100 text-blue-700' : 'bg-[#e5e8ec] text-[#536170]'}`}
                                    style={
                                        serving
                                            ? servingAccentColors(
                                                  entry.serving_at,
                                                  now,
                                              )
                                            : undefined
                                    }
                                >
                                    {entry.direction ?? direction}
                                </span>
                                <div className="flex items-center justify-center gap-0.5">
                                    <span
                                        className="text-xs font-black tracking-wide"
                                        style={{
                                            color: serving
                                                ? servingAccentColors(
                                                      entry.serving_at,
                                                      now,
                                                  ).color
                                                : isStandby
                                                  ? '#A16207'
                                                  : isFloating
                                                    ? '#C2410C'
                                                    : activeStatus
                                                      ? '#1D4ED8'
                                                      : '#536170',
                                        }}
                                    >
                                        {queueSizeType(entry)}
                                    </span>
                                    {!serving && (
                                        <span
                                            className="rounded-md bg-transparent px-0.5 py-1 text-xs font-bold text-slate-600 tabular-nums"
                                            style={{
                                                color: bookingTimeTextColor(
                                                    entry.booking_time,
                                                    now,
                                                ),
                                            }}
                                            title="Booking time"
                                        >
                                            {formatBookingTime(
                                                entry.booking_time,
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </article>
                );
            })
        );
    return (
        <section className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#d8dde3] bg-white shadow-sm">
            <header
                className="flex items-center justify-between px-4 py-3"
                style={{
                    backgroundColor: serving ? '#31393C' : '#3E9AF4',
                    color: '#fff',
                }}
            >
                <div className="flex items-center gap-2 text-lg font-extrabold tracking-wide">
                    {serving ? (
                        <Radio className="h-5 w-5" />
                    ) : (
                        <List className="h-5 w-5" />
                    )}
                    {direction ? (
                        <>
                            <span>{title}</span>
                            <Truck className="h-5 w-5" />
                            <span>{direction}</span>
                        </>
                    ) : (
                        <span>{title}</span>
                    )}
                </div>
                <span className="text-2xl font-black tabular-nums">
                    {serving
                        ? `${String(entries.length).padStart(2, '0')}/${String(servingCapacity).padStart(2, '0')}`
                        : String(entries.length).padStart(2, '0')}
                </span>
            </header>
            <div
                onClick={handleEntryPanelClick}
                className={
                    serving
                        ? 'queue-serving-content grid content-start gap-3 p-3'
                        : 'space-y-3 p-3'
                }
                style={
                    serving
                        ? ({
                              '--serving-card-width': servingCardWidth,
                          } as CSSProperties)
                        : undefined
                }
            >
                {serving ? (
                    <>
                        <div className="queue-serving-column">
                            <div className="space-y-3">
                                {renderEntries(
                                    entries.filter(
                                        (entry) => entry.direction === 'IN',
                                    ),
                                    'serving_in',
                                    'IN',
                                )}
                            </div>
                        </div>
                        <div className="queue-serving-column">
                            <div className="space-y-3">
                                {renderEntries(
                                    entries.filter(
                                        (entry) => entry.direction === 'OUT',
                                    ),
                                    'serving_out',
                                    'OUT',
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    renderEntries(entries, group, direction)
                )}
            </div>
        </section>
    );
}

export default function QueueIndex({
    plannerMode = false,
}: {
    plannerMode?: boolean;
}) {
    const now = useClock();
    const page = usePage();
    const initialServingCapacity = Number(
        (page.props as QueuePageProps).servingCapacity ?? 0,
    );
    const [servingCapacity, setServingCapacity] = useState(
        initialServingCapacity,
    );
    const auth = (
        page.props as {
            auth?: { permissions?: Array<{ page: string; acs_edit: number }> };
        }
    ).auth;
    const canEditQueue =
        Number(
            auth?.permissions?.find(
                (permission) =>
                    permission.page ===
                    (plannerMode ? 'queue-planner' : 'queue-admin'),
            )?.acs_edit ?? 0,
        ) === 1;
    const [queue, setQueue] = useState<QueueData>(emptyQueue);
    const [activeGroup, setActiveGroup] = useState<string | null>(null);
    const [capacityOpen, setCapacityOpen] = useState(false);
    const [capacity, setCapacity] = useState(String(initialServingCapacity));
    const [savingCapacity, setSavingCapacity] = useState(false);
    const [servingId, setServingId] = useState<number | null>(null);
    const [serveConfirmation, setServeConfirmation] =
        useState<QueueEntry | null>(null);
    const [manualConfirmation, setManualConfirmation] =
        useState<QueueEntry | null>(null);
    const [manualReason, setManualReason] = useState('');
    const [manualGuardUserId, setManualGuardUserId] = useState('');
    const [guardAccounts, setGuardAccounts] = useState<GuardAccount[]>([]);
    const [manualId, setManualId] = useState<number | null>(null);
    const manualPending =
        queue.waiting_in.some((entry) => Boolean(entry.manual_reason)) ||
        queue.waiting_out.some((entry) => Boolean(entry.manual_reason));
    const [statusConfirmation, setStatusConfirmation] = useState<{
        entry: QueueEntry;
        status: 'calling' | 'floating' | 'forfeited' | 'standby';
    } | null>(null);
    const [statusId, setStatusId] = useState<number | null>(null);
    const [standbyStatuses, setStandbyStatuses] = useState<StandbyStatus[]>([]);
    const [standbySelection, setStandbySelection] = useState<QueueEntry | null>(
        null,
    );
    const [selectedStandbyId, setSelectedStandbyId] = useState('');
    const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
    const [entryDetails, setEntryDetails] = useState<QueueEntryDetails | null>(
        null,
    );
    const [entryDetailsLoading, setEntryDetailsLoading] = useState(false);
    const { toasts, removeToast, success, error } = useModernToast();
    useEffect(() => {
        let active = true;
        const refresh = async () => {
            // Never overwrite the user's in-progress drag/reorder state with a
            // polling response from before the drop is committed.
            if (activeGroup !== null) return;
            try {
                const response = await axios.get('/api/queue/manage');
                if (active && response.data.success)
                    setQueue(response.data.data);
            } catch {
                /* keep the last live state */
            }
        };
        refresh();
        const timer = window.setInterval(refresh, 1000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [activeGroup]);
    useEffect(() => {
        axios
            .get('/api/queue/standby-statuses')
            .then((response) => {
                if (response.data.success)
                    setStandbyStatuses(response.data.data ?? []);
            })
            .catch(() => setStandbyStatuses([]));
    }, []);
    useEffect(() => {
        if (!plannerMode) return;
        if (!manualConfirmation) return;
        const loadGuards = () =>
            axios
                .get('/api/queue/guard-accounts')
                .then((response) => {
                    if (response.data.success)
                        setGuardAccounts(response.data.guards ?? []);
                })
                .catch(() => setGuardAccounts([]));
        loadGuards();
        const timer = window.setInterval(loadGuards, 3000);
        return () => window.clearInterval(timer);
    }, [plannerMode, manualConfirmation]);
    const moveQueueEntry = (
        group: 'waiting_in' | 'waiting_out' | 'serving_in' | 'serving_out',
        from: number,
        to: number,
    ) => {
        setQueue((current) => {
            const servingDirection =
                group === 'serving_in'
                    ? 'IN'
                    : group === 'serving_out'
                      ? 'OUT'
                      : null;
            const source = servingDirection
                ? current.serving.filter(
                      (entry) => entry.direction === servingDirection,
                  )
                : group === 'waiting_in'
                  ? current.waiting_in
                  : current.waiting_out;
            const next = [...source];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            if (!servingDirection) return { ...current, [group]: next };
            const other = current.serving.filter(
                (entry) => entry.direction !== servingDirection,
            );
            return {
                ...current,
                serving:
                    servingDirection === 'IN'
                        ? [...next, ...other]
                        : [...other, ...next],
            };
        });
    };
    const commitQueueOrder = async (
        group: 'waiting_in' | 'waiting_out' | 'serving_in' | 'serving_out',
        orderedIds?: number[],
        planner = false,
    ) => {
        const direction =
            group === 'waiting_in' || group === 'serving_in' ? 'IN' : 'OUT';
        const entries =
            group === 'serving_in' || group === 'serving_out'
                ? queue.serving.filter((entry) => entry.direction === direction)
                : queue[group];
        try {
            await axios.post('/api/gateinout/queue/reorder', {
                ids: orderedIds ?? entries.map((entry) => entry.id),
                status:
                    group === 'serving_in' || group === 'serving_out'
                        ? 'serving'
                        : 'waiting',
                direction,
                planner,
            });
        } catch {
            // The next live refresh restores the server order if the update fails.
        }
    };
    const saveCapacity = async () => {
        const value = Number(capacity);
        if (!Number.isInteger(value) || value < 0) {
            error('Enter a whole number of 0 or greater.');
            return;
        }
        setSavingCapacity(true);
        try {
            await axios.put('/queue-admin/settings', {
                serving_capacity: value,
            });
            setServingCapacity(value);
            setCapacityOpen(false);
            success('Queue settings updated successfully.');
        } catch (exception: any) {
            error(
                exception?.response?.data?.message ??
                    'Unable to save queue settings.',
            );
        } finally {
            setSavingCapacity(false);
        }
    };
    const openCapacitySettings = async () => {
        try {
            const response = await axios.get('/api/guard/queue-capacity');
            const value = Number(response.data?.serving_capacity ?? 0);
            if (Number.isFinite(value)) {
                setServingCapacity(value);
                setCapacity(String(value));
            }
        } catch {
            setCapacity(String(servingCapacity));
        }
        setCapacityOpen(true);
    };
    const serveQueueEntry = async (entry: QueueEntry) => {
        setServingId(entry.id);
        try {
            const response = await axios.post('/api/gateinout/queue/serve', {
                id: entry.id,
            });
            const served = response.data.entry;
            setQueue((current) => ({
                ...current,
                waiting_in: current.waiting_in.filter(
                    (item) => item.id !== entry.id,
                ),
                waiting_out: current.waiting_out.filter(
                    (item) => item.id !== entry.id,
                ),
                serving: [...current.serving, served],
            }));
            success(`${entry.plate_no} is now serving.`);
        } catch (exception: any) {
            error(
                exception?.response?.data?.message ??
                    'Unable to serve this queue entry.',
            );
        } finally {
            setServingId(null);
        }
    };
    const requestManualCapture = async (entry: QueueEntry) => {
        const reason = manualReason.trim();
        if (!reason) {
            error('Please enter a reason for manual capture.');
            return;
        }
        if (!manualGuardUserId) {
            error('Please select a Guard account.');
            return;
        }
        setManualId(entry.id);
        try {
            await axios.post('/api/gateinout/queue/manual', {
                id: entry.id,
                reason,
                guard_user_id: Number(manualGuardUserId),
            });
            setQueue((current) => ({
                ...current,
                waiting_in: current.waiting_in.map((item) =>
                    item.id === entry.id
                        ? {
                              ...item,
                              manual_reason: reason,
                              manual_guard_user_id: Number(manualGuardUserId),
                          }
                        : item,
                ),
                waiting_out: current.waiting_out.map((item) =>
                    item.id === entry.id
                        ? {
                              ...item,
                              manual_reason: reason,
                              manual_guard_user_id: Number(manualGuardUserId),
                          }
                        : item,
                ),
            }));
            setManualConfirmation(null);
            setManualReason('');
            setManualGuardUserId('');
            success(`Manual capture requested for ${entry.plate_no}.`);
        } catch (exception: any) {
            error(
                exception?.response?.data?.message ??
                    'Unable to request manual capture.',
            );
        } finally {
            setManualId(null);
        }
    };
    const updateQueueStatus = async (
        entry: QueueEntry,
        status: 'calling' | 'floating' | 'forfeited' | 'standby',
        standbyId?: number,
    ) => {
        setStatusId(entry.id);
        try {
            const response = await axios.post('/api/gateinout/queue/status', {
                id: entry.id,
                status,
                standby_id: status === 'standby' ? standbyId : undefined,
            });
            const updated = response.data.entry as QueueEntry;
            setQueue((current) => ({
                ...current,
                waiting_in:
                    status === 'forfeited'
                        ? current.waiting_in.filter(
                              (item) => item.id !== entry.id,
                          )
                        : current.waiting_in.map((item) =>
                              item.id === entry.id ? updated : item,
                          ),
                waiting_out:
                    status === 'forfeited'
                        ? current.waiting_out.filter(
                              (item) => item.id !== entry.id,
                          )
                        : current.waiting_out.map((item) =>
                              item.id === entry.id ? updated : item,
                          ),
            }));
            success(`${entry.plate_no} marked as ${status}.`);
        } catch (exception: any) {
            error(
                exception?.response?.data?.message ??
                    'Unable to update this queue entry.',
            );
        } finally {
            setStatusId(null);
        }
    };
    const openStandbySelection = (entry: QueueEntry) => {
        setStandbySelection(entry);
        setSelectedStandbyId('');
    };
    const confirmStandbySelection = async () => {
        if (!standbySelection || !selectedStandbyId) {
            error('Please select a standby reason.');
            return;
        }
        await updateQueueStatus(
            standbySelection,
            'standby',
            Number(selectedStandbyId),
        );
        setStandbySelection(null);
        setSelectedStandbyId('');
    };
    const openEntryDetails = async (entry: QueueEntry) => {
        setSelectedEntry(entry);
        setEntryDetails(null);
        setEntryDetailsLoading(true);
        try {
            const response = await axios.get(
                `/api/queue-internal/entry/${entry.id}`,
            );
            if (response.data.success)
                setEntryDetails(response.data.data as QueueEntryDetails);
        } catch {
            setEntryDetails(null);
        } finally {
            setEntryDetailsLoading(false);
        }
    };
    return (
        <AuthenticatedLayout>
            <Head title={plannerMode ? 'Queue Planner' : 'Queue Admin'} />
            <div className="space-y-6 overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div
                            className="rounded-xl p-3"
                            style={{ backgroundColor: colors.brand.primary }}
                        >
                            <List className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1
                                className="text-3xl font-bold"
                                style={{ color: colors.text.primary }}
                            >
                                Queue
                            </h1>
                            <p
                                className="mt-1 text-sm"
                                style={{ color: colors.text.secondary }}
                            >
                                Manage and monitor the truck queue
                            </p>
                        </div>
                    </div>
                    {canEditQueue && (
                        <button
                            type="button"
                            onClick={openCapacitySettings}
                            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white shadow-sm"
                            style={{ backgroundColor: colors.brand.primary }}
                        >
                            <Settings className="h-5 w-5" /> Queue Settings
                        </button>
                    )}
                </div>
                <div className="queue-list-grid grid min-h-0 gap-4">
                    <QueueColumn
                        title="WAITING"
                        direction="IN"
                        group="waiting_in"
                        entries={queue.waiting_in}
                        plannerMode={plannerMode}
                        manualPending={manualPending}
                        canEdit={canEditQueue}
                        activeGroup={activeGroup}
                        setActiveGroup={setActiveGroup}
                        onMove={(from, to) =>
                            moveQueueEntry('waiting_in', from, to)
                        }
                        onCommit={(_, ids, planner) =>
                            commitQueueOrder('waiting_in', ids, planner)
                        }
                        onServe={setServeConfirmation}
                        onManual={(entry) => {
                            setManualConfirmation(entry);
                            setManualReason('');
                            setManualGuardUserId('');
                        }}
                        onStandby={openStandbySelection}
                        servingId={servingId}
                        onStatus={(entry, status) =>
                            setStatusConfirmation({ entry, status })
                        }
                        statusId={statusId}
                        now={now}
                        onEntryClick={openEntryDetails}
                    />
                    <QueueColumn
                        title="WAITING"
                        direction="OUT"
                        group="waiting_out"
                        entries={queue.waiting_out}
                        plannerMode={plannerMode}
                        manualPending={manualPending}
                        canEdit={canEditQueue}
                        activeGroup={activeGroup}
                        setActiveGroup={setActiveGroup}
                        onMove={(from, to) =>
                            moveQueueEntry('waiting_out', from, to)
                        }
                        onCommit={(_, ids, planner) =>
                            commitQueueOrder('waiting_out', ids, planner)
                        }
                        onServe={setServeConfirmation}
                        onManual={(entry) => {
                            setManualConfirmation(entry);
                            setManualReason('');
                            setManualGuardUserId('');
                        }}
                        onStandby={openStandbySelection}
                        servingId={servingId}
                        onStatus={(entry, status) =>
                            setStatusConfirmation({ entry, status })
                        }
                        statusId={statusId}
                        now={now}
                        onEntryClick={openEntryDetails}
                    />
                    <QueueColumn
                        title="SERVING"
                        group="serving"
                        entries={queue.serving}
                        serving
                        servingCapacity={servingCapacity}
                        plannerMode={plannerMode}
                        canEdit={canEditQueue}
                        activeGroup={activeGroup}
                        setActiveGroup={setActiveGroup}
                        onMove={(from, to, direction) =>
                            moveQueueEntry(
                                direction === 'IN'
                                    ? 'serving_in'
                                    : 'serving_out',
                                from,
                                to,
                            )
                        }
                        onCommit={(direction) =>
                            commitQueueOrder(
                                direction === 'IN'
                                    ? 'serving_in'
                                    : 'serving_out',
                            )
                        }
                        now={now}
                        onEntryClick={openEntryDetails}
                    />
                </div>
            </div>
            <Dialog
                open={standbySelection !== null}
                onOpenChange={(open) => {
                    if (!open && statusId === null) {
                        setStandbySelection(null);
                        setSelectedStandbyId('');
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Set Truck on Standby</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <p className="text-sm text-gray-600">
                            Select the reason for placing{' '}
                            {standbySelection?.plate_no ?? 'this truck'} on
                            standby.
                        </p>
                        <Select
                            value={selectedStandbyId}
                            onValueChange={setSelectedStandbyId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select standby reason" />
                            </SelectTrigger>
                            <SelectContent>
                                {standbyStatuses.map((status) => (
                                    <SelectItem
                                        key={status.id}
                                        value={String(status.id)}
                                    >
                                        {status.code} - {status.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <button
                            type="button"
                            onClick={() => {
                                setStandbySelection(null);
                                setSelectedStandbyId('');
                            }}
                            className="rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={!selectedStandbyId || statusId !== null}
                            onClick={confirmStandbySelection}
                            className="rounded-lg bg-yellow-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            Set Standby
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ModernConfirmDialog
                open={serveConfirmation !== null}
                onOpenChange={(open) => {
                    if (!open && servingId === null) setServeConfirmation(null);
                }}
                onConfirm={async () => {
                    if (serveConfirmation)
                        await serveQueueEntry(serveConfirmation);
                }}
                title="Serve this truck?"
                description={
                    serveConfirmation
                        ? `Are you sure you want to move plate ${serveConfirmation.plate_no} to serving?`
                        : ''
                }
                confirmText="Serve Truck"
                cancelText="Cancel"
                type="success"
            />
            {manualConfirmation && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
                    onClick={() =>
                        manualId === null && setManualConfirmation(null)
                    }
                >
                    <div
                        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-5 flex items-start justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    Manual plate capture
                                </h2>
                                <p className="mt-1 text-sm text-gray-600">
                                    Request a manual photo for plate{' '}
                                    {manualConfirmation.plate_no}.
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={manualId !== null}
                                onClick={() => setManualConfirmation(null)}
                                className="text-2xl leading-none text-gray-400"
                            >
                                &times;
                            </button>
                        </div>
                        <label
                            className="block text-sm font-semibold text-gray-700"
                            htmlFor="manual-capture-reason"
                        >
                            Reason <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="manual-capture-reason"
                            required
                            autoFocus
                            value={manualReason}
                            onChange={(event) =>
                                setManualReason(event.target.value)
                            }
                            rows={4}
                            maxLength={2000}
                            placeholder="Enter the reason for manual capture"
                            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        />
                        <label
                            className="mt-4 block text-sm font-semibold text-gray-700"
                            htmlFor="manual-capture-guard"
                        >
                            Guard account{' '}
                            <span className="text-red-500">*</span>
                        </label>
                        <Select
                            value={manualGuardUserId}
                            onValueChange={setManualGuardUserId}
                            required
                        >
                            <SelectTrigger
                                id="manual-capture-guard"
                                className="mt-2 h-11"
                                aria-required="true"
                                aria-invalid={!manualGuardUserId}
                            >
                                <SelectValue placeholder="Select Guard account" />
                            </SelectTrigger>
                            <SelectContent>
                                {guardAccounts.map((guard) => (
                                    <SelectItem
                                        key={guard.user_id}
                                        value={String(guard.user_id)}
                                    >
                                        {guard.username}
                                        {guard.full_name
                                            ? ` - ${guard.full_name}`
                                            : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                disabled={manualId !== null}
                                onClick={() => setManualConfirmation(null)}
                                className="rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={
                                    manualId !== null ||
                                    !manualReason.trim() ||
                                    !manualGuardUserId
                                }
                                onClick={() =>
                                    requestManualCapture(manualConfirmation)
                                }
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                <ScanLine className="h-4 w-4" />
                                {manualId !== null
                                    ? 'Saving...'
                                    : 'Confirm Manual'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ModernConfirmDialog
                open={statusConfirmation !== null}
                onOpenChange={(open) => {
                    if (!open && statusId === null) setStatusConfirmation(null);
                }}
                onConfirm={async () => {
                    if (statusConfirmation)
                        await updateQueueStatus(
                            statusConfirmation.entry,
                            statusConfirmation.status,
                        );
                }}
                title={`${statusConfirmation?.status === 'calling' ? 'Call' : statusConfirmation?.status === 'floating' ? 'Float' : statusConfirmation?.status === 'standby' ? 'Standby' : 'Forfeit'} this truck?`}
                description={
                    statusConfirmation
                        ? `Are you sure you want to mark plate ${statusConfirmation.entry.plate_no} as ${statusConfirmation.status}?`
                        : ''
                }
                confirmText={
                    statusConfirmation?.status === 'calling'
                        ? 'Call Truck'
                        : statusConfirmation?.status === 'floating'
                          ? 'Float Truck'
                          : statusConfirmation?.status === 'standby'
                            ? 'Set Standby'
                            : 'Forfeit Truck'
                }
                cancelText="Cancel"
                type={
                    statusConfirmation?.status === 'forfeited'
                        ? 'danger'
                        : statusConfirmation?.status === 'floating'
                          ? 'warning'
                          : 'info'
                }
            />
            {capacityOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
                    onClick={() => setCapacityOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-5 flex items-start justify-between">
                            <div>
                                <h2
                                    className="text-xl font-bold"
                                    style={{ color: colors.text.primary }}
                                >
                                    Queue Settings
                                </h2>
                                <p
                                    className="mt-1 text-sm"
                                    style={{ color: colors.text.secondary }}
                                >
                                    Configure active serving capacity.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCapacityOpen(false)}
                                className="text-2xl leading-none text-gray-400"
                                aria-label="Close"
                            >
                                &times;
                            </button>
                        </div>
                        <label
                            className="block text-sm font-semibold text-gray-700"
                            htmlFor="serving-capacity"
                        >
                            Serving Capacity
                        </label>
                        <input
                            id="serving-capacity"
                            type="number"
                            min="0"
                            step="1"
                            value={capacity}
                            onChange={(event) =>
                                setCapacity(event.target.value)
                            }
                            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            Set to 0 for unlimited serving capacity.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setCapacityOpen(false)}
                                className="rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={savingCapacity}
                                onClick={saveCapacity}
                                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                                style={{
                                    backgroundColor: colors.brand.primary,
                                }}
                            >
                                {savingCapacity ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {selectedEntry && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => {
                        setSelectedEntry(null);
                        setEntryDetails(null);
                    }}
                >
                    <div
                        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-5 flex items-start justify-between">
                            <div>
                                <p className="text-xs font-bold tracking-wider text-[#68737b] uppercase">
                                    Queue Entry
                                </p>
                                <h2 className="mt-1 text-2xl font-black tracking-wide text-[#202a35]">
                                    {selectedEntry.plate_no}
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedEntry(null);
                                    setEntryDetails(null);
                                }}
                                className="rounded-lg p-1 text-[#68737b] hover:bg-gray-100"
                                aria-label="Close details"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {entryDetailsLoading ? (
                            <p className="text-sm text-[#68737b]">
                                Loading pre-inventory details...
                            </p>
                        ) : entryDetails ? (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs font-bold tracking-wider text-[#68737b] uppercase">
                                        Client
                                    </p>
                                    <p className="mt-1 text-base font-semibold text-[#202a35]">
                                        {entryDetails.client || '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold tracking-wider text-[#68737b] uppercase">
                                        Size/Type
                                    </p>
                                    <p className="mt-1 text-base font-semibold text-[#202a35]">
                                        {entryDetails.size_type &&
                                        entryDetails.size_type !== '0'
                                            ? entryDetails.size_type
                                            : '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold tracking-wider text-[#68737b] uppercase">
                                        ISO Code
                                    </p>
                                    <p className="mt-1 text-base font-semibold text-[#202a35]">
                                        {entryDetails.iso_code || '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold tracking-wider text-[#68737b] uppercase">
                                        Hauler
                                    </p>
                                    <p className="mt-1 text-base font-semibold text-[#202a35]">
                                        {entryDetails.hauler || '-'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-red-600">
                                Pre-inventory details are unavailable.
                            </p>
                        )}
                    </div>
                </div>
            )}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
}

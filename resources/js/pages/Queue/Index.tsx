import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { Flag, List, Megaphone, Pause, Radio, RotateCw, Settings, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { colors } from '@/lib/colors';
import { activeQueueCardColors, activeQueueLabel, activeQueueRuntime, activeQueueRuntimeColor, servingAccentColors, servingCardColors, servingPlateTextColor, servingRuntime } from '@/lib/queueServing';
import { ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';

interface QueueEntry { id: number; plate_no: string; direction?: 'IN' | 'OUT'; waiting_number?: number; serving_number?: number; booking_time?: string | null; serving_at?: string | null; status?: string; calling_at?: string | null; floating_at?: string | null; }
interface QueueData { waiting_in: QueueEntry[]; waiting_out: QueueEntry[]; serving: QueueEntry[]; }
interface QueuePageProps { servingCapacity?: number; }
const emptyQueue: QueueData = { waiting_in: [], waiting_out: [], serving: [] };

function formatBookingTime(value?: string | null): string {
    if (!value) return '--:--';
    const match = value.match(/(?:T|\s)(\d{2}):(\d{2})/);
    if (match) return `${match[1]}:${match[2]}`;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? '--:--'
        : parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function useClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    return now;
}

function QueueColumn({ title, direction, group, entries, serving = false, servingCapacity = 0, plannerMode = false, canEdit, activeGroup, setActiveGroup, onMove, onCommit, onServe, servingId, onStatus, statusId, now }: { title: string; direction?: 'IN' | 'OUT'; group: 'waiting_in' | 'waiting_out' | 'serving'; entries: QueueEntry[]; serving?: boolean; servingCapacity?: number; plannerMode?: boolean; canEdit: boolean; activeGroup: string | null; setActiveGroup: (group: string | null) => void; onMove: (from: number, to: number, direction?: 'IN' | 'OUT') => void; onCommit: (direction?: 'IN' | 'OUT', ids?: number[], planner?: boolean) => void; onServe?: (entry: QueueEntry) => void; servingId?: number | null; onStatus?: (entry: QueueEntry, status: 'calling' | 'floating' | 'forfeited') => void; statusId?: number | null; now: Date }) {
    const [dragging, setDragging] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState<number | null>(null);
    const longestPlateLength = serving ? Math.max(8, ...entries.map((entry) => entry.plate_no.length)) : 0;
    const servingCardWidth = `${longestPlateLength * 1.25 + 9}rem`;
    const renderEntries = (list: QueueEntry[], listGroup: string, listDirection?: 'IN' | 'OUT') => list.length === 0 ? <div className="flex min-h-[220px] flex-col items-center justify-center text-center text-[#68737b]"><List className="mb-3 h-8 w-8 text-[#3E9AF4]" /><p className="font-semibold">Queue is empty</p></div> : list.map((entry, index) => { const activeStatus = entry.status === 'calling' || entry.status === 'floating'; const activeColor = activeStatus ? activeQueueRuntimeColor(entry, now) : undefined; const pulseClass = entry.status === 'calling' ? 'queue-calling-pulse' : entry.status === 'floating' ? 'queue-floating-pulse' : ''; const isFloating = entry.status === 'floating'; const firstWaitingIndex = list.findIndex((item) => item.status === 'waiting'); const canDragEntry = canEdit && (!plannerMode || (!serving && entry.status === 'calling')); const canDropEntry = canDragEntry && (!plannerMode || (!serving && list[index]?.status === 'calling' && dragging !== null && list[dragging]?.status === 'calling')); return <article key={entry.id} draggable={canDragEntry} onDragStart={(event) => { if (!canDragEntry) return; setDragging(index); setActiveGroup(listGroup); event.dataTransfer.setData('queue-group', listGroup); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => { if (canDropEntry && activeGroup === listGroup) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(index); if (dragging !== null && dragging !== index) { onMove(dragging, index, listDirection); setDragging(index); } } }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => { event.preventDefault(); if (canDropEntry && activeGroup === listGroup) onCommit(listDirection, list.filter((item) => !plannerMode || item.status === 'calling').map((item) => item.id), plannerMode); setDragging(null); setDropTarget(null); setActiveGroup(null); }} onDragEnd={() => { setDragging(null); setDropTarget(null); setActiveGroup(null); }} style={serving ? servingCardColors(entry.serving_at, now) : isFloating ? { backgroundColor: '#FFF7ED', borderColor: '#FDBA74', color: '#9A3412' } : activeStatus ? activeQueueCardColors() : undefined} className={`relative flex items-center gap-3 rounded-lg border px-3 py-3 transition-all duration-200 ease-out ${pulseClass} ${dragging === index && activeGroup === listGroup ? 'scale-[1.02] cursor-grabbing opacity-50 shadow-lg' : canDragEntry ? 'cursor-grab' : ''} ${dropTarget === index && activeGroup === listGroup ? 'border-t-4 border-t-blue-500' : ''} ${serving ? '' : isFloating ? 'border-orange-300 bg-orange-50' : activeStatus ? 'border-blue-200 bg-blue-50' : 'border-[#dfe3e8] bg-[#f8f9fa]'}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black ${serving ? '' : isFloating ? 'bg-orange-500 text-white' : activeStatus ? 'bg-[#3E9AF4] text-white' : 'bg-[#e5e8ec] text-[#536170]'}`} style={serving ? servingAccentColors(entry.serving_at, now) : undefined}>{serving ? <Truck className="h-5 w-5" /> : entry.status === 'calling' ? <Megaphone className="h-5 w-5" /> : entry.status === 'floating' ? <RotateCw className="h-5 w-5" /> : String(entry.waiting_number ?? index + 1).padStart(2, '0')}</div>
                <div className="min-w-0 flex-1"><p className={`${serving ? 'whitespace-nowrap' : 'break-all'} text-xl font-extrabold tracking-wide`} style={{ color: serving ? servingPlateTextColor() : '#202a35' }}>{entry.plate_no}</p><p className={`text-xs font-bold ${serving ? '' : activeStatus ? 'text-blue-700' : 'text-[#68737b]'}`} style={serving ? { color: servingAccentColors(entry.serving_at, now).color } : activeStatus ? { color: activeColor } : undefined}>{serving ? servingRuntime(entry.serving_at, now) : activeStatus ? `${activeQueueLabel(entry)} - ${activeQueueRuntime(entry, now)}` : 'Waiting'}</p></div>
                {!serving && canEdit && <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold tabular-nums text-slate-600" title="Booking time">{formatBookingTime(entry.booking_time)}</span>
                    <div className="flex flex-col items-stretch gap-1.5">
                    {!plannerMode && entry.status === 'waiting' && (!plannerMode || index === firstWaitingIndex) && <button type="button" disabled={statusId === entry.id} onClick={(event) => { event.stopPropagation(); onStatus?.(entry, 'calling'); }} className="inline-flex items-center gap-1 rounded-lg bg-blue-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60"><Megaphone className="h-3.5 w-3.5" />Call</button>}
                    {!plannerMode && entry.status === 'calling' && <button type="button" disabled={statusId === entry.id} onClick={(event) => { event.stopPropagation(); onStatus?.(entry, 'floating'); }} className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-60"><Pause className="h-3.5 w-3.5" />Float</button>}
                    {!plannerMode && entry.status === 'floating' && <button type="button" disabled={statusId === entry.id} onClick={(event) => { event.stopPropagation(); onStatus?.(entry, 'forfeited'); }} className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-600 disabled:opacity-60"><Flag className="h-3.5 w-3.5" />Forfeit</button>}
                    <button type="button" disabled={servingId === entry.id} onClick={(event) => { event.stopPropagation(); onServe?.(entry); }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"><Truck className="h-3.5 w-3.5 text-white" />{servingId === entry.id ? 'Serving...' : 'Serve'}</button>
                    </div>
                </div>}
                <span className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-black tracking-wide ${serving ? '' : isFloating ? 'bg-orange-100 text-orange-700' : activeStatus ? 'bg-blue-100 text-blue-700' : 'bg-[#e5e8ec] text-[#536170]'}`} style={serving ? servingAccentColors(entry.serving_at, now) : undefined}>{entry.direction ?? direction}</span>
            </article>; });
    return <section className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#d8dde3] bg-white shadow-sm">
        <header className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: serving ? '#31393C' : '#3E9AF4', color: '#fff' }}>
            <div className="flex items-center gap-2 text-lg font-extrabold tracking-wide">
                {serving ? <Radio className="h-5 w-5" /> : <List className="h-5 w-5" />}
                {direction ? <><span>{title}</span><Truck className="h-5 w-5" /><span>{direction}</span></> : <span>{title}</span>}
            </div>
            <span className="text-2xl font-black tabular-nums">{serving ? `${String(entries.length).padStart(2, '0')}/${String(servingCapacity).padStart(2, '0')}` : String(entries.length).padStart(2, '0')}</span>
        </header>
        <div className={serving ? 'queue-serving-content grid content-start gap-3 p-3' : 'space-y-3 p-3'} style={serving ? { '--serving-card-width': servingCardWidth } as CSSProperties : undefined}>
            {serving ? <>
                <div className="queue-serving-column"><div className="space-y-3">{renderEntries(entries.filter((entry) => entry.direction === 'IN'), 'serving_in', 'IN')}</div></div>
                <div className="queue-serving-column"><div className="space-y-3">{renderEntries(entries.filter((entry) => entry.direction === 'OUT'), 'serving_out', 'OUT')}</div></div>
            </> : renderEntries(entries, group, direction)}
        </div>
    </section>;
}

export default function QueueIndex({ plannerMode = false }: { plannerMode?: boolean }) {
    const now = useClock();
    const page = usePage();
    const initialServingCapacity = Number((page.props as QueuePageProps).servingCapacity ?? 0);
    const [servingCapacity, setServingCapacity] = useState(initialServingCapacity);
    const auth = (page.props as { auth?: { permissions?: Array<{ page: string; acs_edit: number }> } }).auth;
    const canEditQueue = Number(auth?.permissions?.find((permission) => permission.page === (plannerMode ? 'queue-planner' : 'queue-admin'))?.acs_edit ?? 0) === 1;
    const [queue, setQueue] = useState<QueueData>(emptyQueue);
    const [activeGroup, setActiveGroup] = useState<string | null>(null);
    const [capacityOpen, setCapacityOpen] = useState(false);
    const [capacity, setCapacity] = useState(String(initialServingCapacity));
    const [savingCapacity, setSavingCapacity] = useState(false);
    const [servingId, setServingId] = useState<number | null>(null);
    const [serveConfirmation, setServeConfirmation] = useState<QueueEntry | null>(null);
    const [statusConfirmation, setStatusConfirmation] = useState<{ entry: QueueEntry; status: 'calling' | 'floating' | 'forfeited' } | null>(null);
    const [statusId, setStatusId] = useState<number | null>(null);
    const { toasts, removeToast, success, error } = useModernToast();
    useEffect(() => {
        let active = true;
        const refresh = async () => {
            // Never overwrite the user's in-progress drag/reorder state with a
            // polling response from before the drop is committed.
            if (activeGroup !== null) return;
            try { const response = await axios.get('/api/queue/display'); if (active && response.data.success) setQueue(response.data.data); } catch { /* keep the last live state */ }
        };
        refresh(); const timer = window.setInterval(refresh, 1000);
        return () => { active = false; window.clearInterval(timer); };
    }, [activeGroup]);
    const moveQueueEntry = (group: 'waiting_in' | 'waiting_out' | 'serving_in' | 'serving_out', from: number, to: number) => {
        setQueue((current) => {
            const servingDirection = group === 'serving_in' ? 'IN' : group === 'serving_out' ? 'OUT' : null;
            const source = servingDirection ? current.serving.filter((entry) => entry.direction === servingDirection) : (group === 'waiting_in' ? current.waiting_in : current.waiting_out);
            const next = [...source];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            if (!servingDirection) return { ...current, [group]: next };
            const other = current.serving.filter((entry) => entry.direction !== servingDirection);
            return { ...current, serving: servingDirection === 'IN' ? [...next, ...other] : [...other, ...next] };
        });
    };
    const commitQueueOrder = async (group: 'waiting_in' | 'waiting_out' | 'serving_in' | 'serving_out', orderedIds?: number[], planner = false) => {
        const direction = group === 'waiting_in' || group === 'serving_in' ? 'IN' : 'OUT';
        const entries = group === 'serving_in' || group === 'serving_out' ? queue.serving.filter((entry) => entry.direction === direction) : queue[group];
        try {
            await axios.post('/api/gateinout/queue/reorder', {
                ids: orderedIds ?? entries.map((entry) => entry.id),
                status: group === 'serving_in' || group === 'serving_out' ? 'serving' : 'waiting',
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
            await axios.put('/queue-admin/settings', { serving_capacity: value });
            setServingCapacity(value);
            setCapacityOpen(false);
            success('Queue settings updated successfully.');
        } catch (exception: any) {
            error(exception?.response?.data?.message ?? 'Unable to save queue settings.');
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
            const response = await axios.post('/api/gateinout/queue/serve', { id: entry.id });
            const served = response.data.entry;
            setQueue((current) => ({
                ...current,
                waiting_in: current.waiting_in.filter((item) => item.id !== entry.id),
                waiting_out: current.waiting_out.filter((item) => item.id !== entry.id),
                serving: [...current.serving, served],
            }));
            success(`${entry.plate_no} is now serving.`);
        } catch (exception: any) {
            error(exception?.response?.data?.message ?? 'Unable to serve this queue entry.');
        } finally {
            setServingId(null);
        }
    };
    const updateQueueStatus = async (entry: QueueEntry, status: 'calling' | 'floating' | 'forfeited') => {
        setStatusId(entry.id);
        try {
            const response = await axios.post('/api/gateinout/queue/status', { id: entry.id, status });
            const updated = response.data.entry as QueueEntry;
            setQueue((current) => ({
                ...current,
                waiting_in: status === 'forfeited' ? current.waiting_in.filter((item) => item.id !== entry.id) : current.waiting_in.map((item) => item.id === entry.id ? updated : item),
                waiting_out: status === 'forfeited' ? current.waiting_out.filter((item) => item.id !== entry.id) : current.waiting_out.map((item) => item.id === entry.id ? updated : item),
            }));
            success(`${entry.plate_no} marked as ${status}.`);
        } catch (exception: any) {
            error(exception?.response?.data?.message ?? 'Unable to update this queue entry.');
        } finally {
            setStatusId(null);
        }
    };
    return (
        <AuthenticatedLayout>
            <Head title={plannerMode ? 'Queue Planner' : 'Queue Admin'} />
            <div className="space-y-6 overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl p-3" style={{ backgroundColor: colors.brand.primary }}>
                            <List className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>Queue</h1>
                            <p className="mt-1 text-sm" style={{ color: colors.text.secondary }}>
                                Manage and monitor the truck queue
                            </p>
                        </div>
                    </div>
                    {canEditQueue && <button type="button" onClick={openCapacitySettings} className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white shadow-sm" style={{ backgroundColor: colors.brand.primary }}><Settings className="h-5 w-5" /> Queue Settings</button>}
                </div>
                <div className="queue-list-grid grid min-h-0 gap-4">
                    <QueueColumn title="WAITING" direction="IN" group="waiting_in" entries={queue.waiting_in} plannerMode={plannerMode} canEdit={canEditQueue} activeGroup={activeGroup} setActiveGroup={setActiveGroup} onMove={(from, to) => moveQueueEntry('waiting_in', from, to)} onCommit={(_, ids, planner) => commitQueueOrder('waiting_in', ids, planner)} onServe={setServeConfirmation} servingId={servingId} onStatus={(entry, status) => setStatusConfirmation({ entry, status })} statusId={statusId} now={now} />
                    <QueueColumn title="WAITING" direction="OUT" group="waiting_out" entries={queue.waiting_out} plannerMode={plannerMode} canEdit={canEditQueue} activeGroup={activeGroup} setActiveGroup={setActiveGroup} onMove={(from, to) => moveQueueEntry('waiting_out', from, to)} onCommit={(_, ids, planner) => commitQueueOrder('waiting_out', ids, planner)} onServe={setServeConfirmation} servingId={servingId} onStatus={(entry, status) => setStatusConfirmation({ entry, status })} statusId={statusId} now={now} />
                    <QueueColumn title="SERVING" group="serving" entries={queue.serving} serving servingCapacity={servingCapacity} plannerMode={plannerMode} canEdit={canEditQueue} activeGroup={activeGroup} setActiveGroup={setActiveGroup} onMove={(from, to, direction) => moveQueueEntry(direction === 'IN' ? 'serving_in' : 'serving_out', from, to)} onCommit={(direction) => commitQueueOrder(direction === 'IN' ? 'serving_in' : 'serving_out')} now={now} />
                </div>
            </div>
            <ModernConfirmDialog
                open={serveConfirmation !== null}
                onOpenChange={(open) => { if (!open && servingId === null) setServeConfirmation(null); }}
                onConfirm={async () => {
                    if (serveConfirmation) await serveQueueEntry(serveConfirmation);
                }}
                title="Serve this truck?"
                description={serveConfirmation ? `Are you sure you want to move plate ${serveConfirmation.plate_no} to serving?` : ''}
                confirmText="Serve Truck"
                cancelText="Cancel"
                type="success"
            />
            <ModernConfirmDialog
                open={statusConfirmation !== null}
                onOpenChange={(open) => { if (!open && statusId === null) setStatusConfirmation(null); }}
                onConfirm={async () => {
                    if (statusConfirmation) await updateQueueStatus(statusConfirmation.entry, statusConfirmation.status);
                }}
                title={`${statusConfirmation?.status === 'calling' ? 'Call' : statusConfirmation?.status === 'floating' ? 'Float' : 'Forfeit'} this truck?`}
                description={statusConfirmation ? `Are you sure you want to mark plate ${statusConfirmation.entry.plate_no} as ${statusConfirmation.status}?` : ''}
                confirmText={statusConfirmation?.status === 'calling' ? 'Call Truck' : statusConfirmation?.status === 'floating' ? 'Float Truck' : 'Forfeit Truck'}
                cancelText="Cancel"
                type={statusConfirmation?.status === 'forfeited' ? 'danger' : statusConfirmation?.status === 'floating' ? 'warning' : 'info'}
            />
            {capacityOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setCapacityOpen(false)}>
                <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
                    <div className="mb-5 flex items-start justify-between"><div><h2 className="text-xl font-bold" style={{ color: colors.text.primary }}>Queue Settings</h2><p className="mt-1 text-sm" style={{ color: colors.text.secondary }}>Configure active serving capacity.</p></div><button type="button" onClick={() => setCapacityOpen(false)} className="text-2xl leading-none text-gray-400" aria-label="Close">&times;</button></div>
                    <label className="block text-sm font-semibold text-gray-700" htmlFor="serving-capacity">Serving Capacity</label>
                    <input id="serving-capacity" type="number" min="0" step="1" value={capacity} onChange={(event) => setCapacity(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
                    <p className="mt-2 text-xs text-gray-500">Set to 0 for unlimited serving capacity.</p>
                    <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setCapacityOpen(false)} className="rounded-lg bg-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700">Cancel</button><button type="button" disabled={savingCapacity} onClick={saveCapacity} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: colors.brand.primary }}>{savingCapacity ? 'Saving...' : 'Save Settings'}</button></div>
                </div>
            </div>}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
}

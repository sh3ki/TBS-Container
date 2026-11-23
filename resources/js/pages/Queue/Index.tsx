import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import { List, Radio, Settings, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { colors } from '@/lib/colors';
import { activeQueueCardColors, activeQueueLabel, activeQueueRuntime, activeQueueRuntimeColor, servingAccentColors, servingCardColors, servingPlateTextColor, servingRuntime } from '@/lib/queueServing';
import { ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';

interface QueueEntry { id: number; plate_no: string; direction?: 'IN' | 'OUT'; waiting_number?: number; serving_number?: number; serving_at?: string | null; status?: string; calling_at?: string | null; floating_at?: string | null; }
interface QueueData { waiting_in: QueueEntry[]; waiting_out: QueueEntry[]; serving: QueueEntry[]; }
interface QueuePageProps { servingCapacity?: number; }
const emptyQueue: QueueData = { waiting_in: [], waiting_out: [], serving: [] };

function useClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    return now;
}

function QueueColumn({ title, direction, group, entries, serving = false, canEdit, activeGroup, setActiveGroup, onMove, onCommit, onServe, servingId, now }: { title: string; direction?: 'IN' | 'OUT'; group: 'waiting_in' | 'waiting_out' | 'serving'; entries: QueueEntry[]; serving?: boolean; canEdit: boolean; activeGroup: string | null; setActiveGroup: (group: string | null) => void; onMove: (from: number, to: number, direction?: 'IN' | 'OUT') => void; onCommit: (direction?: 'IN' | 'OUT', ids?: number[]) => void; onServe?: (entry: QueueEntry) => void; servingId?: number | null; now: Date }) {
    const [dragging, setDragging] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState<number | null>(null);
    const renderEntries = (list: QueueEntry[], listGroup: string, listDirection?: 'IN' | 'OUT') => list.length === 0 ? <div className="flex min-h-[220px] flex-col items-center justify-center text-center text-[#68737b]"><List className="mb-3 h-8 w-8 text-[#3E9AF4]" /><p className="font-semibold">Queue is empty</p></div> : list.map((entry, index) => { const activeStatus = entry.status === 'calling' || entry.status === 'floating'; const activeColor = activeStatus ? activeQueueRuntimeColor(entry, now) : undefined; return <article key={entry.id} draggable={canEdit} onDragStart={(event) => { setDragging(index); setActiveGroup(listGroup); event.dataTransfer.setData('queue-group', listGroup); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => { if (canEdit && activeGroup === listGroup) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(index); if (dragging !== null && dragging !== index) { onMove(dragging, index, listDirection); setDragging(index); } } }} onDragLeave={() => setDropTarget(null)} onDrop={(event) => { event.preventDefault(); if (canEdit && activeGroup === listGroup) onCommit(listDirection, list.map((item) => item.id)); setDragging(null); setDropTarget(null); setActiveGroup(null); }} onDragEnd={() => { setDragging(null); setDropTarget(null); setActiveGroup(null); }} style={serving ? servingCardColors(entry.serving_at, now) : activeStatus ? activeQueueCardColors() : undefined} className={`relative flex items-center gap-3 rounded-lg border px-3 py-3 transition-all duration-200 ease-out ${dragging === index && activeGroup === listGroup ? 'scale-[1.02] cursor-grabbing opacity-50 shadow-lg' : canEdit ? 'cursor-grab' : ''} ${dropTarget === index && activeGroup === listGroup ? 'border-t-4 border-t-blue-500' : ''} ${serving ? '' : activeStatus || index === 0 ? 'border-blue-200 bg-blue-50' : 'border-[#dfe3e8] bg-[#f8f9fa]'}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black ${serving ? '' : activeStatus || index === 0 ? 'bg-[#3E9AF4] text-white' : 'bg-[#e5e8ec] text-[#536170]'}`} style={serving ? servingAccentColors(entry.serving_at, now) : undefined}>{serving ? <Truck className="h-5 w-5" /> : String(index + 1).padStart(2, '0')}</div>
                <div className="min-w-0 flex-1"><p className="break-all text-xl font-extrabold tracking-wide" style={{ color: serving ? servingPlateTextColor() : '#202a35' }}>{entry.plate_no}</p><p className={`text-xs font-bold ${serving ? '' : activeStatus || index === 0 ? 'text-blue-700' : 'text-[#68737b]'}`} style={serving ? { color: servingAccentColors(entry.serving_at, now).color } : activeStatus ? { color: activeColor } : undefined}>{serving ? servingRuntime(entry.serving_at, now) : activeStatus ? `${activeQueueLabel(entry)} - ${activeQueueRuntime(entry, now)}` : index === 0 ? 'Next in line' : 'Waiting'}</p></div>
                {!serving && canEdit && <button type="button" disabled={servingId === entry.id} onClick={(event) => { event.stopPropagation(); onServe?.(entry); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"><Truck className="h-4 w-4 text-white" />{servingId === entry.id ? 'Serving...' : 'Serve'}</button>}
                <span className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-black tracking-wide ${serving ? '' : activeStatus || index === 0 ? 'bg-blue-100 text-blue-700' : 'bg-[#e5e8ec] text-[#536170]'}`} style={serving ? servingAccentColors(entry.serving_at, now) : undefined}>{entry.direction ?? direction}</span>
            </article>; });
    return <section className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-xl border border-[#d8dde3] bg-white shadow-sm">
        <header className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: serving ? '#31393C' : '#3E9AF4', color: '#fff' }}>
            <div className="flex items-center gap-2 text-lg font-extrabold tracking-wide">
                {serving ? <Radio className="h-5 w-5" /> : <List className="h-5 w-5" />}
                <span>{title}{direction ? ` ${direction}` : ''}</span>
                {!serving && <Truck className="h-5 w-5" />}
            </div>
            <span className="text-2xl font-black tabular-nums">{String(entries.length).padStart(2, '0')}</span>
        </header>
        <div className={serving ? 'grid grid-cols-2 content-start gap-3 p-3' : 'space-y-3 p-3'}>
            {serving ? <>
                <div><div className="space-y-3">{renderEntries(entries.filter((entry) => entry.direction === 'IN'), 'serving_in', 'IN')}</div></div>
                <div><div className="space-y-3">{renderEntries(entries.filter((entry) => entry.direction === 'OUT'), 'serving_out', 'OUT')}</div></div>
            </> : renderEntries(entries, group, direction)}
        </div>
    </section>;
}

export default function QueueIndex() {
    const now = useClock();
    const page = usePage();
    const servingCapacity = Number((page.props as QueuePageProps).servingCapacity ?? 0);
    const auth = (page.props as { auth?: { permissions?: Array<{ page: string; acs_edit: number }> } }).auth;
    const canEditQueue = Number(auth?.permissions?.find((permission) => permission.page === 'queuelist')?.acs_edit ?? 0) === 1;
    const [queue, setQueue] = useState<QueueData>(emptyQueue);
    const [activeGroup, setActiveGroup] = useState<string | null>(null);
    const [capacityOpen, setCapacityOpen] = useState(false);
    const [capacity, setCapacity] = useState(String(servingCapacity));
    const [savingCapacity, setSavingCapacity] = useState(false);
    const [servingId, setServingId] = useState<number | null>(null);
    const [serveConfirmation, setServeConfirmation] = useState<QueueEntry | null>(null);
    const { toasts, removeToast, success, error } = useModernToast();
    useEffect(() => {
        let active = true;
        const refresh = async () => {
            // Never overwrite the user's in-progress drag/reorder state with a
            // polling response from before the drop is committed.
            if (activeGroup !== null) return;
            try { const response = await axios.get('/api/queue/display'); if (active && response.data.success) setQueue(response.data.data); } catch { /* keep the last live state */ }
        };
        refresh(); const timer = window.setInterval(refresh, 5000);
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
    const commitQueueOrder = async (group: 'waiting_in' | 'waiting_out' | 'serving_in' | 'serving_out', orderedIds?: number[]) => {
        const direction = group === 'waiting_in' || group === 'serving_in' ? 'IN' : 'OUT';
        const entries = group === 'serving_in' || group === 'serving_out' ? queue.serving.filter((entry) => entry.direction === direction) : queue[group];
        try {
            await axios.post('/api/gateinout/queue/reorder', {
                ids: orderedIds ?? entries.map((entry) => entry.id),
                status: group === 'serving_in' || group === 'serving_out' ? 'serving' : 'waiting',
                direction,
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
            await axios.put('/queuelist/settings', { serving_capacity: value });
            success('Queue settings updated successfully.');
        } catch (exception: any) {
            error(exception?.response?.data?.message ?? 'Unable to save queue settings.');
        } finally {
            setSavingCapacity(false);
        }
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
    return (
        <AuthenticatedLayout>
            <Head title="Queue" />
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
                    {canEditQueue && <button type="button" onClick={() => { setCapacity(String(servingCapacity)); setCapacityOpen(true); }} className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold text-white shadow-sm" style={{ backgroundColor: colors.brand.primary }}><Settings className="h-5 w-5" /> Queue Settings</button>}
                </div>
                <div className="queue-list-grid grid min-h-0 gap-4">
                    <QueueColumn title="WAITING" direction="IN" group="waiting_in" entries={queue.waiting_in} canEdit={canEditQueue} activeGroup={activeGroup} setActiveGroup={setActiveGroup} onMove={(from, to) => moveQueueEntry('waiting_in', from, to)} onCommit={(_, ids) => commitQueueOrder('waiting_in', ids)} onServe={setServeConfirmation} servingId={servingId} now={now} />
                    <QueueColumn title="WAITING" direction="OUT" group="waiting_out" entries={queue.waiting_out} canEdit={canEditQueue} activeGroup={activeGroup} setActiveGroup={setActiveGroup} onMove={(from, to) => moveQueueEntry('waiting_out', from, to)} onCommit={(_, ids) => commitQueueOrder('waiting_out', ids)} onServe={setServeConfirmation} servingId={servingId} now={now} />
                    <QueueColumn title="SERVING" group="serving" entries={queue.serving} serving canEdit={canEditQueue} activeGroup={activeGroup} setActiveGroup={setActiveGroup} onMove={(from, to, direction) => moveQueueEntry(direction === 'IN' ? 'serving_in' : 'serving_out', from, to)} onCommit={(direction) => commitQueueOrder(direction === 'IN' ? 'serving_in' : 'serving_out')} now={now} />
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

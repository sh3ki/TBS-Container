import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { BellRing, Box, CircleHelp, List, Megaphone, Radio, RotateCw, Truck, X } from 'lucide-react';
import { activeQueueCardColors, activeQueueLabel, activeQueueRuntime, activeQueueRuntimeColor, servingAccentColors, servingCardColors, servingPlateTextColor, servingRuntime } from '@/lib/queueServing';

interface QueueEntry {
    id: number;
    plate_no: string;
    direction?: 'IN' | 'OUT';
    waiting_number?: number;
    serving_number?: number;
    serving_at?: string | null;
    status?: 'waiting' | 'calling' | 'floating' | 'serving' | 'completed' | 'forfeited';
    calling_at?: string | null;
    floating_at?: string | null;
    size_type_size?: string | number | null;
    size_type_type?: string | null;
}

interface QueueEntryDetails {
    plate_no: string;
    client: string;
    size_type: string;
    iso_code: string;
    hauler: string;
}

interface QueueData {
    waiting_in: QueueEntry[];
    waiting_out: QueueEntry[];
    serving: QueueEntry[];
    serving_capacity?: number;
}

function normalizePlate(value: string | null | undefined): string {
    return String(value ?? '').replace(/[\s-]+/g, '').toUpperCase();
}

function filterWaitingEntries(entries: QueueEntry[], plateNo: string): QueueEntry[] {
    if (!plateNo) return entries;
    const matchingIndexes = entries
        .map((entry, index) => normalizePlate(entry.plate_no) === plateNo ? index : -1)
        .filter((index) => index >= 0);
    if (matchingIndexes.length === 0) return [];
    return entries.slice(0, Math.max(...matchingIndexes) + 1);
}

function queueSizeType(entry: QueueEntry): string {
    const size = String(entry.size_type_size ?? '').trim();
    const type = String(entry.size_type_type ?? '').trim();
    if (!size || size === '0' || !type || type === '0') return '-';
    return `${size}${type}`;
}

const emptyQueue: QueueData = { waiting_in: [], waiting_out: [], serving: [] };

function useClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    return now;
}

function QueuePanel({ title, direction, entries, kind, servingCapacity = 0, now, greenServing, onEntryClick }: { title: string; direction?: 'IN' | 'OUT'; entries: QueueEntry[]; kind: 'waiting' | 'serving'; servingCapacity?: number; now: Date; greenServing: boolean; onEntryClick?: (entry: QueueEntry) => void }) {
    const serving = kind === 'serving';
    const servingInEntries = entries.filter((entry) => entry.direction === 'IN');
    const servingOutEntries = entries.filter((entry) => entry.direction === 'OUT');
    const longestPlateLength = serving ? Math.max(8, ...entries.map((entry) => entry.plate_no.length)) : 0;
    const servingCardWidth = `${longestPlateLength * 1.25 + 9}rem`;

    return (
        <section className="queue-panel flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#d8dde3] shadow-sm" style={{ backgroundColor: '#FFFFFF', color: '#31393C' }}>
            <header className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5" style={{ backgroundColor: serving ? '#31393C' : '#3E9AF4', color: '#FFFFFF' }}>
                <div className="flex min-w-0 items-center gap-3">
                    {serving ? <Radio className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" strokeWidth={2.4} /> : <List className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" strokeWidth={2.4} />}
                    <h2 className="flex items-center gap-2 leading-none tracking-wide" style={{ fontWeight: 900, fontSize: 'clamp(1.25rem, 2vw, 2rem)' }}>
                        {direction ? <><span>{title}</span><Truck className="h-5 w-8 shrink-0 sm:h-6 sm:w-10" strokeWidth={2.5} /><span>{direction}</span></> : title}
                    </h2>
                </div>
                <div className="tabular-nums" style={{ color: '#FFFFFF', fontWeight: 900, fontSize: 'clamp(1.8rem, 3vw, 2.75rem)', lineHeight: 1 }}>{serving ? `${String(entries.length).padStart(2, '0')}/${String(servingCapacity).padStart(2, '0')}` : String(entries.length).padStart(2, '0')}</div>
            </header>
            <div className={`min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 ${serving ? 'queue-serving-content grid content-start gap-3 sm:gap-4' : 'space-y-3 sm:space-y-4'}`} style={{ backgroundColor: '#FFFFFF', ...(serving ? { '--serving-card-width': servingCardWidth } as CSSProperties : {}) }}>
                {entries.length === 0 ? (
                    <div className={`flex h-full min-h-[180px] flex-col items-center justify-center px-4 text-center ${serving ? 'col-span-2' : ''}`}>
                        {serving ? <Truck className="mb-4 h-10 w-10 text-emerald-600" /> : <List className="mb-4 h-10 w-10 text-[#3E9AF4]" />}
                        <p className="text-xl font-bold text-[#31393C]">{serving ? 'No trucks being served' : 'Queue is empty'}</p>
                        <p className="mt-2 text-sm text-[#68737b]">{serving ? 'Serving trucks will appear here.' : 'Waiting trucks will appear here.'}</p>
                    </div>
                ) : entries.map((entry, index) => {
                    const activeStatus = entry.status === 'calling' || entry.status === 'floating';
                    const activeColor = activeStatus ? activeQueueRuntimeColor(entry, now) : undefined;
                    const pulseClass = entry.status === 'calling' ? 'queue-calling-pulse' : entry.status === 'floating' ? 'queue-floating-pulse' : '';
                    const isFloating = entry.status === 'floating';
                    return <article key={entry.id} onClick={() => onEntryClick?.(entry)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onEntryClick?.(entry); }} role={onEntryClick ? 'button' : undefined} tabIndex={onEntryClick ? 0 : undefined} style={serving ? { ...servingCardColors(entry.serving_at, now, greenServing), gridColumn: entry.direction === 'OUT' ? 2 : 1, gridRow: (entry.direction === 'OUT' ? servingOutEntries : servingInEntries).indexOf(entry) + 1 } : isFloating ? { backgroundColor: '#FFF7ED', borderColor: '#FDBA74', color: '#9A3412' } : activeStatus ? activeQueueCardColors() : undefined} className={`flex items-center gap-3 rounded-xl border px-3 py-3 sm:gap-4 sm:px-4 ${pulseClass} ${serving ? 'queue-serving-card' : isFloating ? 'border-orange-300 bg-orange-50' : activeStatus ? 'border-blue-200 bg-blue-50' : 'border-[#dfe3e8] bg-[#f8f9fa]'} ${onEntryClick ? 'cursor-pointer transition hover:brightness-95' : ''}`}>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg sm:h-12 sm:w-12 sm:text-xl ${serving ? '' : isFloating ? 'bg-orange-500 text-white' : activeStatus ? 'bg-[#3E9AF4] text-white' : 'bg-[#e5e8ec] text-[#536170]'}`} style={{ fontWeight: 900, ...(serving ? servingAccentColors(entry.serving_at, now, greenServing) : {}) }}>
                            {serving ? <Truck className="h-7 w-7" /> : entry.status === 'calling' ? <Megaphone className="h-6 w-6" /> : entry.status === 'floating' ? <RotateCw className="h-6 w-6" /> : String(entry.waiting_number ?? index + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className={`${serving ? 'whitespace-nowrap' : 'break-all'} text-2xl leading-tight sm:text-3xl`} style={{ fontWeight: 800, letterSpacing: '0.04em', color: serving ? servingPlateTextColor() : '#202a35' }}>{entry.plate_no}</p>
                            <p className={`mt-1 text-xs sm:text-sm ${serving ? '' : activeStatus ? 'text-blue-700' : 'text-[#68737b]'}`} style={{ fontWeight: 700, ...(serving ? { color: servingAccentColors(entry.serving_at, now, greenServing).color } : activeStatus ? { color: activeColor } : {}) }}>
                                {serving ? (greenServing ? 'NOW SERVING' : servingRuntime(entry.serving_at, now)) : activeStatus ? `${activeQueueLabel(entry)} - ${activeQueueRuntime(entry, now)}` : 'Waiting'}
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className={`rounded-md px-3 py-1.5 text-sm font-black tracking-wide ${serving ? '' : isFloating ? 'bg-orange-100 text-orange-700' : activeStatus ? 'bg-blue-100 text-blue-700' : 'bg-[#e5e8ec] text-[#536170]'}`} style={serving ? servingAccentColors(entry.serving_at, now, greenServing) : undefined}>{entry.direction ?? direction}</span>
                            {onEntryClick && <span className="text-xs font-black tracking-wide" style={{ color: serving ? servingAccentColors(entry.serving_at, now, greenServing).color : isFloating ? '#C2410C' : activeStatus ? '#1D4ED8' : '#536170' }}>{queueSizeType(entry)}</span>}
                        </div>
                    </article>;
                })}
            </div>
        </section>
    );
}

export default function QueueDisplay({ greenServing = true, visiblePlateNo, showAll = false, showRulesModal = false, interactive = false, onSessionExpired }: { greenServing?: boolean; visiblePlateNo?: string; showAll?: boolean; showRulesModal?: boolean; interactive?: boolean; onSessionExpired?: () => void } = {}) {
    const now = useClock();
    const [queue, setQueue] = useState<QueueData>(emptyQueue);
    const [servingCapacity, setServingCapacity] = useState(0);
    const [rulesOpen, setRulesOpen] = useState(showRulesModal);
    const [advisoryLanguage, setAdvisoryLanguage] = useState<'en' | 'tl'>('en');
    const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
    const [entryDetails, setEntryDetails] = useState<QueueEntryDetails | null>(null);
    const [entryDetailsLoading, setEntryDetailsLoading] = useState(false);
    const time = new Intl.DateTimeFormat('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
    const date = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).format(now);
    const normalizedVisiblePlate = normalizePlate(visiblePlateNo);

    const openEntryDetails = async (entry: QueueEntry) => {
        if (!interactive) return;
        setSelectedEntry(entry);
        setEntryDetails(null);
        setEntryDetailsLoading(true);
        try {
            const response = await axios.get(`/api/queue-internal/entry/${entry.id}`);
            setEntryDetails(response.data.data as QueueEntryDetails);
        } catch (error: any) {
            if (error?.response?.status === 401) onSessionExpired?.();
            setEntryDetails(null);
        } finally {
            setEntryDetailsLoading(false);
        }
    };

    useEffect(() => {
        let active = true;
        const refresh = async () => {
            try {
                const response = await axios.get('/api/queue/display');
                if (active && response.data.success) {
                    const live = response.data.data as QueueData;
                    setQueue({
                        waiting_in: Array.isArray(live.waiting_in) ? live.waiting_in : [],
                        waiting_out: Array.isArray(live.waiting_out) ? live.waiting_out : [],
                        serving: Array.isArray(live.serving) ? live.serving : [],
                    });
                    setServingCapacity(Number(live.serving_capacity ?? 0));
                }
            } catch (error: any) {
                if (error?.response?.status === 401) onSessionExpired?.();
                console.error('Failed to refresh queue display', error);
            }
        };
        refresh();
        const timer = window.setInterval(refresh, 5000);
        return () => { active = false; window.clearInterval(timer); };
    }, []);

    return (
        <>
            <Head title="Container Queue" />
            {!rulesOpen && <main className="flex flex-col overflow-hidden" style={{ height: '100dvh', backgroundColor: '#EDEEEB', color: '#202a35', colorScheme: 'light' }}>
                <header className="flex w-full shrink-0 items-center justify-between gap-2 bg-[#3E9AF4] px-2 py-2 text-white shadow-sm sm:gap-4 sm:px-6 sm:py-4">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white p-1 sm:h-14 sm:w-14"><img src="/apple-touch-icon.png" alt="TBS logo" className="h-full w-full object-contain" /></div>
                        <div className="min-w-0">
                            <div className="text-base leading-tight sm:text-3xl" style={{ fontWeight: 900 }}>TBS Container Yard</div>
                            <div className="text-[10px] leading-tight text-white/95 sm:text-base" style={{ fontWeight: 700 }}>Container Yard Management System</div>
                        </div>
                    </div>
                    <div className="hidden shrink-0 items-center px-3 py-2 text-base uppercase tracking-wider text-white md:flex lg:text-2xl" style={{ fontWeight: 900 }}><BellRing className="mr-2 h-5 w-5 fill-current" />Live Truck Queue</div>
                    <div className="shrink-0 text-right">
                        <div className="text-lg leading-tight tabular-nums sm:text-4xl" style={{ fontWeight: 900 }}>{time}</div>
                        <div className="text-[9px] leading-tight text-white/95 sm:text-xl" style={{ fontWeight: 900 }}>{date}</div>
                    </div>
                </header>

                <div className="queue-page-content flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto p-3 sm:gap-5 sm:p-6 lg:p-8" style={{ color: '#202a35', boxSizing: 'border-box' }}>
                    <div className="queue-grid grid min-h-0 gap-3 md:gap-4">
                        <QueuePanel title="WAITING" direction="IN" entries={showAll ? queue.waiting_in : filterWaitingEntries(queue.waiting_in, normalizedVisiblePlate)} kind="waiting" now={now} greenServing={greenServing} onEntryClick={interactive ? openEntryDetails : undefined} />
                        <QueuePanel title="WAITING" direction="OUT" entries={showAll ? queue.waiting_out : filterWaitingEntries(queue.waiting_out, normalizedVisiblePlate)} kind="waiting" now={now} greenServing={greenServing} onEntryClick={interactive ? openEntryDetails : undefined} />
                        <QueuePanel title="SERVING" entries={queue.serving} kind="serving" servingCapacity={servingCapacity} now={now} greenServing={greenServing} onEntryClick={interactive ? openEntryDetails : undefined} />
                    </div>

                    <aside className="queue-driver-notice flex shrink-0 items-start gap-3 rounded-xl border border-[#d8dde3] px-4 py-3 shadow-sm sm:items-center sm:px-5" style={{ backgroundColor: '#FFFFFF', color: '#31393C' }}>
                        <CircleHelp className="mt-0.5 h-6 w-6 shrink-0 text-[#3E9AF4] sm:mt-0" />
                        <div>
                            <p className="text-sm font-semibold sm:text-lg" style={{ color: '#31393C' }}>Attention to all drivers</p>
                            <p className="mt-1 text-xs sm:text-base" style={{ color: '#68737b' }}>Please wait until your plate number is next in line.</p>
                        </div>
                        <Box className="ml-auto hidden h-7 w-7 shrink-0 text-[#3E9AF4] sm:block" />
                    </aside>
                </div>
            </main>}
            {interactive && selectedEntry && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="queue-entry-details-title">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" style={{ color: '#202a35' }}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-[#68737b]">Queue Entry</p>
                                <h2 id="queue-entry-details-title" className="mt-1 text-2xl font-black tracking-wide">{selectedEntry.plate_no}</h2>
                            </div>
                            <button type="button" onClick={() => { setSelectedEntry(null); setEntryDetails(null); }} className="rounded-lg p-1 text-[#68737b] hover:bg-gray-100" aria-label="Close details"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="mt-6 space-y-4">
                            {entryDetailsLoading ? <p className="text-sm text-[#68737b]">Loading pre-inventory details...</p> : entryDetails ? <>
                                <div><p className="text-xs font-bold uppercase tracking-wider text-[#68737b]">Client</p><p className="mt-1 text-base font-semibold">{entryDetails.client || '-'}</p></div>
                                <div><p className="text-xs font-bold uppercase tracking-wider text-[#68737b]">Size/Type</p><p className="mt-1 text-base font-semibold">{entryDetails.size_type && entryDetails.size_type !== '0' ? entryDetails.size_type : '-'}</p></div>
                                <div><p className="text-xs font-bold uppercase tracking-wider text-[#68737b]">ISO Code</p><p className="mt-1 text-base font-semibold">{entryDetails.iso_code || '-'}</p></div>
                                <div><p className="text-xs font-bold uppercase tracking-wider text-[#68737b]">Hauler</p><p className="mt-1 text-base font-semibold">{entryDetails.hauler || '-'}</p></div>
                            </> : <p className="text-sm text-red-600">Pre-inventory details are unavailable.</p>}
                        </div>
                    </div>
                </div>
            )}
            {rulesOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="queue-rules-title">
                    <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ color: '#202a35' }}>
                        <div className="bg-[#3E9AF4] px-4 py-5 text-white sm:px-8">
                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm sm:h-14 sm:w-14">
                                    <img src="/apple-touch-icon.png" alt="TBS logo" className="h-full w-full object-contain" />
                                </div>
                                <div className="min-w-0">
                                    <h2 id="queue-rules-title" className="whitespace-nowrap text-xl font-black tracking-normal sm:text-2xl sm:tracking-wide">OFFICIAL ADVISORY</h2>
                                    <p className="mt-1 text-sm text-white/90">Important service notice</p>
                                </div>
                            </div>
                        </div>
                        <div className="max-h-[65vh] overflow-y-auto px-6 py-6 sm:px-8">
                            <div className="text-justify">
                                {advisoryLanguage === 'en' ? <>
                                    <p className="text-sm leading-6 text-[#263238] sm:text-base">Dear Valued Clients and Trucking Partners,</p>
                                    <p className="mt-4 text-sm leading-6 text-[#263238] sm:text-base">Please be informed that TBS Container Yard OPC is currently implementing improvements to its <strong className="text-[#3E9AF4]">Truck Queue Management System</strong> as part of our ongoing commitment to enhancing yard operations and service efficiency.</p>
                                    <p className="mt-4 text-sm leading-6 text-[#263238] sm:text-base">This initiative aims to establish a more systematic, organized, and efficient truck queuing process, ensuring smoother traffic flow and a more convenient experience for all stakeholders.</p>
                                    <p className="mt-4 text-sm leading-6 text-[#263238] sm:text-base">We sincerely appreciate your patience, understanding, and continued cooperation as we implement these improvements.</p>
                                    <p className="mt-4 text-sm leading-6 text-[#263238] sm:text-base">Thank you for your continued trust and support.</p>
                                    <p className="mt-4 text-sm font-bold leading-6 text-[#263238] sm:text-base">TBS CONTAINER YARD OPC</p>
                                </> : <>
                                    <p className="text-sm leading-6 text-[#263238] sm:text-base">Sa aming mga Pinahahalagahang Kliyente at Trucking Partners,</p>
                                    <p className="mt-4 text-sm leading-6 text-[#263238] sm:text-base">Ipinababatid po namin na kasalukuyang isinasagawa ng TBS Container Yard OPC ang pagpapahusay ng aming <strong className="text-[#3E9AF4]">Truck Queue Management System</strong> bilang bahagi ng patuloy na pagsisikap na mapabuti ang operasyon at kahusayan ng aming serbisyo sa loob ng yard.</p>
                                    <p className="mt-4 text-sm leading-6 text-[#263238] sm:text-base">Layunin ng inisyatibong ito na magkaroon ng mas sistematiko, maayos, at episyenteng proseso ng pagpila ng mga truck upang mas mapadali ang daloy ng trapiko at maging mas maginhawa ang transaksyon para sa lahat.</p>
                                    <p className="mt-4 text-sm leading-6 text-[#263238] sm:text-base">Lubos po kaming nagpapasalamat sa inyong pang-unawa, pasensya, at patuloy na pakikipagtulungan habang isinasagawa ang mga pagbabagong ito.</p>
                                    <p className="mt-4 text-sm leading-6 text-[#263238] sm:text-base">Maraming salamat po sa inyong patuloy na tiwala at suporta.</p>
                                    <p className="mt-4 text-sm font-bold leading-6 text-[#263238] sm:text-base">TBS CONTAINER YARD OPC</p>
                                </>}
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 border-t border-gray-200 px-6 py-4 sm:px-8">
                            <div className="inline-flex rounded-lg bg-[#eef2f6] p-1" role="tablist" aria-label="Advisory language">
                                <button type="button" role="tab" aria-selected={advisoryLanguage === 'en'} onClick={() => setAdvisoryLanguage('en')} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${advisoryLanguage === 'en' ? 'bg-white text-[#3E9AF4] shadow-sm' : 'text-[#68737b]'}`}>English</button>
                                <button type="button" role="tab" aria-selected={advisoryLanguage === 'tl'} onClick={() => setAdvisoryLanguage('tl')} className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${advisoryLanguage === 'tl' ? 'bg-white text-[#3E9AF4] shadow-sm' : 'text-[#68737b]'}`}>Tagalog</button>
                            </div>
                            <button type="button" onClick={() => {}} className="rounded-lg bg-[#3E9AF4] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#2785dc]">I UNDERSTAND</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

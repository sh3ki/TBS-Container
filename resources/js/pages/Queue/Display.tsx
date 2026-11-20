import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { BellRing, Box, CircleHelp, List, Radio, Truck } from 'lucide-react';

interface QueueEntry {
    id: number;
    plate_no: string;
    direction?: 'IN' | 'OUT';
    waiting_number?: number;
    serving_number?: number;
}

interface QueueData {
    waiting_in: QueueEntry[];
    waiting_out: QueueEntry[];
    serving: QueueEntry[];
}

const makeDemoEntries = (label: string, count: number, serving = false): QueueEntry[] =>
    Array.from({ length: count }, (_, index) => ({
        id: -((serving ? 100 : label === 'IN' ? 200 : 300) + index + 1),
        plate_no: `${label === 'IN' ? 'ABC' : label === 'OUT' ? 'XYZ' : 'TBS'}${String((label === 'IN' ? 1001 : label === 'OUT' ? 2001 : 3001) + index)}`,
        direction: label === 'IN' || label === 'OUT' ? label : undefined,
        waiting_number: serving ? undefined : index + 1,
        serving_number: serving ? index + 1 : undefined,
    }));

const demoQueue: QueueData = {
    waiting_in: makeDemoEntries('IN', 15),
    waiting_out: makeDemoEntries('OUT', 12),
    serving: makeDemoEntries('SV', 20, true),
};

function useClock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    return now;
}

function QueuePanel({ title, direction, entries, kind }: { title: string; direction?: 'IN' | 'OUT'; entries: QueueEntry[]; kind: 'waiting' | 'serving' }) {
    const serving = kind === 'serving';

    return (
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#d8dde3] shadow-sm" style={{ backgroundColor: '#FFFFFF', color: '#31393C' }}>
            <header className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5" style={{ backgroundColor: serving ? '#31393C' : '#3E9AF4', color: '#FFFFFF' }}>
                <div className="flex min-w-0 items-center gap-3">
                    {serving ? <Radio className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" strokeWidth={2.4} /> : <List className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" strokeWidth={2.4} />}
                    <h2 className="flex items-center gap-2 leading-none tracking-wide" style={{ fontWeight: 900, fontSize: 'clamp(1.25rem, 2vw, 2rem)' }}>
                        {direction ? <><span>{title}</span><Truck className="h-5 w-8 shrink-0 sm:h-6 sm:w-10" strokeWidth={2.5} /><span>{direction}</span></> : title}
                    </h2>
                </div>
                <div className="tabular-nums" style={{ color: '#FFFFFF', fontWeight: 900, fontSize: 'clamp(1.8rem, 3vw, 2.75rem)', lineHeight: 1 }}>{String(entries.length).padStart(2, '0')}</div>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:space-y-4 sm:p-4" style={{ backgroundColor: '#FFFFFF' }}>
                {entries.length === 0 ? (
                    <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-4 text-center">
                        {serving ? <Truck className="mb-4 h-10 w-10 text-emerald-600" /> : <List className="mb-4 h-10 w-10 text-[#3E9AF4]" />}
                        <p className="text-xl font-bold text-[#31393C]">{serving ? 'No trucks being served' : 'Queue is empty'}</p>
                        <p className="mt-2 text-sm text-[#68737b]">{serving ? 'Serving trucks will appear here.' : 'Waiting trucks will appear here.'}</p>
                    </div>
                ) : entries.map((entry, index) => (
                    <article key={entry.id} className={`flex items-center gap-3 rounded-xl border px-3 py-3 sm:gap-4 sm:px-4 ${serving ? 'border-emerald-200 bg-emerald-50' : index === 0 ? 'border-blue-200 bg-blue-50' : 'border-[#dfe3e8] bg-[#f8f9fa]'}`}>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg sm:h-12 sm:w-12 sm:text-xl ${serving ? 'bg-emerald-100 text-emerald-700' : index === 0 ? 'bg-[#3E9AF4] text-white' : 'bg-[#e5e8ec] text-[#536170]'}`} style={{ fontWeight: 900 }}>
                            {serving ? <Truck className="h-7 w-7" /> : String(entry.waiting_number ?? index + 1).padStart(2, '0')}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="break-all text-2xl leading-tight text-[#202a35] sm:text-3xl" style={{ fontWeight: 800, letterSpacing: '0.04em' }}>{entry.plate_no}</p>
                            <p className={`mt-1 text-xs sm:text-sm ${serving ? 'text-emerald-700' : index === 0 ? 'text-blue-700' : 'text-[#68737b]'}`} style={{ fontWeight: 700 }}>
                                {serving ? 'Now serving' : index === 0 ? 'Next in line' : 'Waiting'}
                            </p>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default function QueueDisplay() {
    const now = useClock();
    const [queue, setQueue] = useState<QueueData>(demoQueue);
    const time = new Intl.DateTimeFormat('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
    const date = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).format(now);

    useEffect(() => {
        let active = true;
        const refresh = async () => {
            try {
                const response = await axios.get('/api/queue/display');
                if (active && response.data.success) {
                    const live = response.data.data as QueueData;
                    setQueue({
                        waiting_in: live.waiting_in?.length ? live.waiting_in : demoQueue.waiting_in,
                        waiting_out: live.waiting_out?.length ? live.waiting_out : demoQueue.waiting_out,
                        serving: live.serving?.length ? live.serving : demoQueue.serving,
                    });
                }
            } catch (error) {
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
            <main className="flex flex-col overflow-hidden" style={{ height: '100dvh', backgroundColor: '#EDEEEB', color: '#202a35', colorScheme: 'light' }}>
                <header className="flex w-full shrink-0 items-center justify-between gap-4 bg-[#3E9AF4] px-4 py-3 text-white shadow-sm sm:px-6 sm:py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white p-1 sm:h-14 sm:w-14"><img src="/apple-touch-icon.png" alt="TBS logo" className="h-full w-full object-contain" /></div>
                        <div className="min-w-0">
                            <div className="text-xl leading-tight sm:text-3xl" style={{ fontWeight: 900 }}>TBS Container Yard</div>
                            <div className="text-xs text-white/95 sm:text-base" style={{ fontWeight: 700 }}>Container Yard Management System</div>
                        </div>
                    </div>
                    <div className="hidden shrink-0 items-center px-3 py-2 text-base uppercase tracking-wider text-white md:flex lg:text-lg" style={{ fontWeight: 900 }}><BellRing className="mr-2 h-5 w-5 fill-current" />Live Queue</div>
                    <div className="shrink-0 text-right">
                        <div className="text-2xl leading-tight tabular-nums sm:text-5xl" style={{ fontWeight: 900 }}>{time}</div>
                        <div className="mt-1 text-xs text-white/95 sm:text-xl" style={{ fontWeight: 900 }}>{date}</div>
                    </div>
                </header>

                <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden p-3 sm:gap-5 sm:p-6 lg:p-8" style={{ color: '#202a35', boxSizing: 'border-box' }}>
                    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-3 gap-3 md:grid-cols-3 md:grid-rows-1 md:gap-4" style={{ flex: '1 1 0%', minHeight: 0 }}>
                        <QueuePanel title="WAITING" direction="IN" entries={queue.waiting_in} kind="waiting" />
                        <QueuePanel title="WAITING" direction="OUT" entries={queue.waiting_out} kind="waiting" />
                        <QueuePanel title="SERVING" entries={queue.serving} kind="serving" />
                    </div>

                    <aside className="flex items-start gap-3 rounded-xl border border-[#d8dde3] px-4 py-3 shadow-sm sm:items-center sm:px-5" style={{ backgroundColor: '#FFFFFF', color: '#31393C' }}>
                        <CircleHelp className="mt-0.5 h-6 w-6 shrink-0 text-[#3E9AF4] sm:mt-0" />
                        <div>
                            <p className="text-sm font-semibold sm:text-lg" style={{ color: '#31393C' }}>Attention to all drivers</p>
                            <p className="mt-1 text-xs sm:text-base" style={{ color: '#68737b' }}>Please wait until your plate number is next in line.</p>
                        </div>
                        <Box className="ml-auto hidden h-7 w-7 shrink-0 text-[#3E9AF4] sm:block" />
                    </aside>
                </div>
            </main>
        </>
    );
}

import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { BellRing, Box, CircleHelp, List, Radio, Truck } from 'lucide-react';

function useClock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    return now;
}

const previewQueue: string[] = [];
const previewServing: string[] = [];

function QueuePanel({ serving = false }: { serving?: boolean }) {
    const containers = serving ? previewServing : previewQueue;

    return (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#d8dde3] shadow-sm" style={{ backgroundColor: '#FFFFFF', color: '#31393C' }}>
            <header className="flex items-center justify-between gap-3 px-5 py-2 sm:px-7 sm:py-3" style={{ backgroundColor: serving ? '#31393C' : '#3E9AF4', color: '#FFFFFF' }}>
                <div className="flex min-w-0 items-center gap-5 sm:gap-7">
                    {serving ? <Radio className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" strokeWidth={2.4} /> : <List className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" strokeWidth={2.4} />}
                    <div>
                        <h2 className="leading-none tracking-wide" style={{ fontWeight: 900, fontSize: 'clamp(1.9rem, 2.8vw, 3.25rem)' }}>{serving ? 'SERVING' : 'QUEUE'}</h2>
                    </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="tabular-nums" style={{ color: '#FFFFFF', fontWeight: 900, fontSize: 'clamp(2.5rem, 3.5vw, 3.75rem)', lineHeight: 1 }}>{String(containers.length).padStart(2, '0')}</div>
                </div>
            </header>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:space-y-4 sm:p-5" style={{ backgroundColor: '#FFFFFF' }}>
                {containers.length === 0 ? (
                    <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
                        {serving ? <Truck className="mb-4 h-12 w-12 text-emerald-600" /> : <List className="mb-4 h-12 w-12 text-[#3E9AF4]" />}
                        <p className="text-2xl font-bold text-[#31393C]">{serving ? 'No trucks being served' : 'Queue is empty'}</p>
                        <p className="mt-2 text-base text-[#68737b]">{serving ? 'Serving trucks will appear here.' : 'Waiting trucks will appear here.'}</p>
                    </div>
                ) : containers.map((container, index) => serving ? (
                    <article key={container} className="flex items-center gap-6 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 sm:gap-8 sm:py-3.5" style={{ paddingLeft: '1.5rem', paddingRight: '2.5rem' }}>
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center text-emerald-700 sm:h-14 sm:w-14"><Truck className="h-10 w-10 sm:h-11 sm:w-11" strokeWidth={2.6} /></div>
                        <div className="min-w-0 flex-1">
                            <p className="break-all text-4xl leading-tight text-[#202a35] sm:text-5xl" style={{ fontWeight: 800, letterSpacing: '0.06em' }}>{container}</p>
                            <p className="mt-0 text-base text-emerald-700 sm:text-lg" style={{ fontWeight: 700 }}>Now serving</p>
                        </div>
                    </article>
                ) : (
                    <article key={container} className={`flex items-center gap-6 rounded-xl border py-2.5 sm:gap-8 sm:py-3.5 ${index === 0 ? 'border-blue-200 bg-blue-50' : 'border-[#dfe3e8] bg-[#f8f9fa]'}`} style={{ paddingLeft: '1.5rem', paddingRight: '2.5rem' }}>
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl sm:h-14 sm:w-14 sm:text-2xl ${index === 0 ? 'bg-[#3E9AF4] text-white' : 'bg-[#e5e8ec] text-[#536170]'}`} style={{ fontWeight: 900 }}>{String(index + 1).padStart(2, '0')}</div>
                        <div className="min-w-0 flex-1">
                            <p className="break-all text-4xl leading-tight text-[#202a35] sm:text-5xl" style={{ fontWeight: 800, letterSpacing: '0.06em' }}>{container}</p>
                            <p className={`mt-0 text-sm sm:text-base ${index === 0 ? 'text-blue-700' : 'text-[#68737b]'}`} style={{ fontWeight: 700 }}>{index === 0 ? 'Next in line' : 'Waiting'}</p>
                        </div>
                        <span className="text-amber-600" aria-label="Waiting"><span className="inline-block h-3 w-3 rounded-full border-2 border-current" /></span>
                    </article>
                ))}
            </div>
        </section>
    );
}

export default function QueueDisplay() {
    const now = useClock();
    const time = new Intl.DateTimeFormat('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
    const date = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).format(now);

    return (
        <>
            <Head title="Container Queue" />
            <main className="flex flex-col overflow-hidden" style={{ height: '100dvh', backgroundColor: '#EDEEEB', color: '#202a35', colorScheme: 'light' }}>
                <header className="mx-auto flex w-full shrink-0 items-center justify-between gap-4 rounded-b-2xl bg-[#3E9AF4] px-4 py-3 text-white shadow-sm sm:px-6 sm:py-4 lg:w-[min(100%,1600px)]">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white p-1 sm:h-14 sm:w-14">
                            <img src="/apple-touch-icon.png" alt="TBS logo" className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-2xl leading-tight sm:text-3xl" style={{ fontWeight: 900 }}>TBS Container Yard</div>
                            <div className="text-sm text-white/95 sm:text-base" style={{ fontWeight: 700 }}>Container Yard Management System</div>
                        </div>
                    </div>
                    <div className="hidden shrink-0 items-center px-3 py-2 text-base uppercase tracking-wider text-white md:flex lg:text-lg" style={{ fontWeight: 900 }}><BellRing className="mr-2 h-5 w-5 fill-current" />Live Preview</div>
                    <div className="shrink-0 text-right">
                        <div className="text-3xl leading-tight tabular-nums sm:text-5xl" style={{ fontWeight: 900 }}>{time}</div>
                        <div className="mt-1 text-base text-white/95 sm:text-xl" style={{ fontWeight: 900 }}>{date}</div>
                    </div>
                </header>

                <div className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden p-4 sm:gap-5 sm:p-6 lg:w-[min(100%,1600px)] lg:p-8" style={{ color: '#202a35', boxSizing: 'border-box' }}>
                    <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-4 lg:grid-cols-2 lg:grid-rows-1 lg:gap-5" style={{ flex: '1 1 0%', minHeight: 0 }}>
                        <QueuePanel />
                        <QueuePanel serving />
                    </div>

                    <aside className="flex items-start gap-3 rounded-xl border border-[#d8dde3] px-4 py-4 shadow-sm sm:items-center sm:px-5" style={{ backgroundColor: '#FFFFFF', color: '#31393C' }}>
                        <CircleHelp className="mt-0.5 h-6 w-6 shrink-0 text-[#3E9AF4] sm:mt-0" />
                        <div>
                            <p className="text-base font-semibold sm:text-lg" style={{ color: '#31393C' }}>Attention to all drivers</p>
                            <p className="mt-1 text-sm sm:text-base" style={{ color: '#68737b' }}>Please wait until your plate number appears in the serving section.</p>
                        </div>
                        <Box className="ml-auto hidden h-7 w-7 shrink-0 text-[#3E9AF4] sm:block" />
                    </aside>
                </div>
            </main>
        </>
    );
}

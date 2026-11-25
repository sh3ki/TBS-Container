import { Head } from '@inertiajs/react';
import { Home, List, LogIn, SearchX } from 'lucide-react';

interface NotFoundProps {
    authenticated?: boolean;
}

export default function NotFound({ authenticated = false }: NotFoundProps) {
    return (
        <>
            <Head title="Page Not Found" />
            <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#123d69] px-4" style={{ colorScheme: 'light' }}>
                <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden bg-[#123d69]">
                    <div className="login-background-drift absolute -inset-[2%] bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/tbs-maritime-login-bg.png')" }} />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,30,56,.66)_0%,rgba(8,44,77,.18)_46%,rgba(3,21,42,.38)_100%)]" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,31,57,.1)_0%,transparent_45%,rgba(1,15,30,.35)_100%)]" />
                </div>

                <div className="absolute left-5 top-9 z-10 flex items-center gap-4 sm:left-10 lg:left-16 xl:left-20">
                    <div className="flex h-[74px] w-[74px] items-center justify-center rounded-[20px] bg-white shadow-[0_12px_35px_rgba(3,24,44,.18)]">
                        <img src="/apple-touch-icon.png" alt="TBS logo" className="h-[58px] w-[58px] object-contain" />
                    </div>
                    <div>
                        <div className="text-[2.1rem] font-bold leading-none tracking-[-.04em] text-white">TBS</div>
                        <div className="mt-1 text-sm font-medium tracking-[-.01em] text-white/90 sm:text-base">Container Yard Management Suite</div>
                    </div>
                </div>

                <section className="relative z-10 w-full max-w-md rounded-2xl border border-white bg-white p-8 text-center shadow-2xl sm:p-10" style={{ color: '#111827', backgroundColor: '#FFFFFF' }}>
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eaf4ff] text-[#3E9AF4]">
                        <SearchX className="h-8 w-8" strokeWidth={1.8} />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#206aa7]">Error 404</p>
                    <h1 className="mt-3 text-2xl font-bold text-[#101828]">Page not found</h1>
                    <p className="mt-3 text-sm leading-6 text-[#64748b]">Sorry, the page you are looking for does not exist or may have been moved.</p>
                    <div className="mt-7 grid gap-3 sm:grid-cols-2">
                        <a href={authenticated ? '/dashboard' : '/login'} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3E9AF4] px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-[#2785dc]">
                            {authenticated ? <Home className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                            {authenticated ? 'Dashboard' : 'Login'}
                        </a>
                        {!authenticated && <a href="/queue" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#3E9AF4] px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-[#2785dc]"><List className="h-4 w-4" />Open Queue</a>}
                    </div>
                </section>
            </main>
        </>
    );
}

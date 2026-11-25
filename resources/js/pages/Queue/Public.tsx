import { Head } from '@inertiajs/react';
import axios from 'axios';
import { Lock } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import QueueDisplay from './Display';

export default function QueuePublic() {
    const [checking, setChecking] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [authenticatedPlate, setAuthenticatedPlate] = useState('');
    const [fullAccess, setFullAccess] = useState(false);
    const [plateNo, setPlateNo] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        axios.get('/api/queue/session')
            .then((response) => {
                setAuthenticated(response.data.authenticated === true);
                setAuthenticatedPlate(String(response.data.plate_no ?? ''));
                setFullAccess(response.data.full_access === true);
            })
            .catch(() => setAuthenticated(false))
            .finally(() => setChecking(false));
    }, []);

    const login = async (event: FormEvent) => {
        event.preventDefault();
        if (!plateNo.trim() || submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const response = await axios.post('/api/queue/login', { plate_no: plateNo.trim().toUpperCase().replace(/[\s-]+/g, '') });
            if (response.data.authenticated === true) {
                setAuthenticated(true);
                setAuthenticatedPlate(String(response.data.plate_no ?? '').replace(/[\s-]+/g, '').toUpperCase());
                setFullAccess(response.data.full_access === true);
                setPlateNo('');
            } else {
                setError('Unable to unlock Queue.');
            }
        } catch (exception: any) {
            setError(exception?.response?.data?.message ?? 'Invalid plate number.');
        } finally {
            setSubmitting(false);
        }
    };

    if (checking) return <main className="flex min-h-screen items-center justify-center bg-[#0d2238]" />;
    if (authenticated) return <QueueDisplay visiblePlateNo={authenticatedPlate} showAll={fullAccess} showRulesModal onSessionExpired={() => setAuthenticated(false)} />;

    return <>
        <Head title="Queue" />
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#123d69] px-4" style={{ colorScheme: 'light' }}>
            <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden bg-[#123d69]">
                <div className="login-background-drift absolute -inset-[2%] bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/tbs-maritime-login-bg.png')" }} />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,30,56,.66)_0%,rgba(8,44,77,.18)_46%,rgba(3,21,42,.38)_100%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,31,57,.1)_0%,transparent_45%,rgba(1,15,30,.35)_100%)]" />
            </div>
            <div className="absolute left-5 top-9 z-10 flex items-center gap-4 sm:left-10 lg:left-16 xl:left-20">
                <div className="flex h-[74px] w-[74px] items-center justify-center rounded-[20px] bg-white shadow-[0_12px_35px_rgba(3,24,44,.18)]"><img src="/apple-touch-icon.png" alt="TBS logo" className="h-[58px] w-[58px] object-contain" /></div>
                <div><div className="text-[2.1rem] font-bold leading-none tracking-[-.04em] text-white">TBS</div><div className="mt-1 text-sm font-medium tracking-[-.01em] text-white/90 sm:text-base">Container Yard Management Suite</div></div>
            </div>
            <form onSubmit={login} className="relative z-10 w-full max-w-md rounded-2xl border border-white bg-white p-8 shadow-2xl sm:p-10" style={{ color: '#111827', backgroundColor: '#FFFFFF', opacity: 1 }}>
                <div className="mb-7 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3E9AF4] shadow-lg"><Lock className="h-8 w-8 text-white" /></div>
                    <h1 className="mt-2 text-2xl font-bold" style={{ color: '#111827' }}>TBS QUEUE</h1>
                    <p className="mt-2 text-sm" style={{ color: '#68737B' }}>Enter your plate number to view the queue.</p>
                </div>
                <label htmlFor="queue-plate-login" className="block text-center text-sm font-semibold" style={{ color: '#111827' }}>PLATE NUMBER</label>
                <input id="queue-plate-login" type="text" value={plateNo} autoFocus autoComplete="off" onChange={(event) => setPlateNo(event.target.value)} onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onPaste={(event) => event.preventDefault()} className="mt-2 h-12 w-full rounded-xl border border-[#cbd5e1] bg-white px-4 text-base font-bold tracking-[0.08em] outline-none focus:border-[#3E9AF4] focus:ring-2 focus:ring-[#3E9AF4]/20" style={{ color: '#111827', backgroundColor: '#FFFFFF', colorScheme: 'light' }} />
                {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
                <button type="submit" disabled={!plateNo.trim() || submitting} className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-[#3E9AF4] text-sm font-semibold text-white shadow-lg transition hover:bg-[#2785dc] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Unlocking...' : 'Unlock Queue'}</button>
            </form>
        </main>
    </>;
}

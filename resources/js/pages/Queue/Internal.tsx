import { Head } from '@inertiajs/react';
import axios from 'axios';
import { Lock } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import QueueDisplay from './Display';

export default function QueueInternal() {
    const [checking, setChecking] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        axios.get('/api/queue-internal/session')
            .then((response) => setAuthenticated(response.data.authenticated === true))
            .catch(() => setAuthenticated(false))
            .finally(() => setChecking(false));
    }, []);

    const login = async (event: FormEvent) => {
        event.preventDefault();
        if (!password || submitting) return;
        setSubmitting(true);
        setError('');
        try {
            const response = await axios.post('/api/queue-internal/login', { password, remember });
            if (response.data.authenticated === true) {
                setAuthenticated(true);
                setPassword('');
            } else {
                setError('Unable to unlock Queue Internal.');
            }
        } catch (exception: any) {
            setError(exception?.response?.data?.message ?? 'Invalid password.');
        } finally {
            setSubmitting(false);
        }
    };

    if (checking) {
        return <main className="flex min-h-screen items-center justify-center bg-[#0d2238]" />;
    }
    if (authenticated) return <QueueDisplay />;

    return (
        <>
            <Head title="Queue Internal" />
            <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d2238] px-4" style={{ colorScheme: 'light' }}>
                <div className="login-background-drift absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/tbs-maritime-login-bg.png')" }} />
                <div className="absolute inset-0 bg-[#071a2d]/70" />
                <div className="absolute left-6 top-6 z-10 flex items-center gap-4 sm:left-10 sm:top-9">
                    <div className="flex items-center justify-center rounded-[18px] bg-white shadow-[0_12px_35px_rgba(3,24,44,.18)]" style={{ width: 68, height: 68 }}><img src="/apple-touch-icon.png" alt="TBS logo" style={{ width: 54, height: 54, objectFit: 'contain', display: 'block' }} /></div>
                    <div><div className="text-3xl font-bold leading-none tracking-tight" style={{ color: '#FFFFFF' }}>TBS</div><div className="mt-1 text-sm font-medium" style={{ color: 'rgba(255,255,255,.9)' }}>Container Yard Management Suite</div></div>
                </div>
                <form onSubmit={login} className="relative z-10 w-full max-w-md rounded-2xl border border-white bg-white p-8 shadow-2xl sm:p-10" style={{ color: '#111827', backgroundColor: '#FFFFFF', opacity: 1 }}>
                    <div className="mb-7 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3E9AF4] shadow-lg"><Lock className="h-8 w-8 text-white" /></div>
                        <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>TBS Internals</h1>
                        <p className="mt-2 text-sm" style={{ color: '#68737B' }}>Enter the password to view the internal queue.</p>
                    </div>
                    <label htmlFor="queue-internal-password-login" className="block text-sm font-semibold" style={{ color: '#111827' }}>PASSWORD</label>
                    <input id="queue-internal-password-login" type="password" value={password} autoFocus autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onPaste={(event) => event.preventDefault()} className="mt-2 h-12 w-full rounded-xl border border-[#cbd5e1] bg-white px-4 outline-none focus:border-[#3E9AF4] focus:ring-2 focus:ring-[#3E9AF4]/20" style={{ color: '#111827', backgroundColor: '#FFFFFF', colorScheme: 'light' }} />
                    <label className="mt-4 flex items-center gap-2 text-sm" style={{ color: '#536170' }}><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#3E9AF4] focus:ring-[#3E9AF4]" /> Remember me</label>
                    {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
                    <button type="submit" disabled={!password || submitting} className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-[#3E9AF4] text-sm font-semibold text-white shadow-lg transition hover:bg-[#2785dc] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Unlocking...' : 'Unlock Queue'}</button>
                </form>
            </main>
        </>
    );
}

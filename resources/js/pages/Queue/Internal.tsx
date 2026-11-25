import { Head } from '@inertiajs/react';
import axios from 'axios';
import { Lock } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import QueueDisplay from './Display';

const rememberedPasswordKey = 'tbs_queue_internal_remembered_password';
const rememberedPasswordEncryptionKey = 'tbs_queue_internal_remembered_password_key';

function toBase64(bytes: Uint8Array) {
    return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function getRememberedPasswordKey() {
    const existing = localStorage.getItem(rememberedPasswordEncryptionKey);
    if (existing) return crypto.subtle.importKey('raw', fromBase64(existing), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const exported = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(rememberedPasswordEncryptionKey, toBase64(new Uint8Array(exported)));
    return key;
}

async function saveRememberedPassword(value: string) {
    const key = await getRememberedPasswordKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
    localStorage.setItem(rememberedPasswordKey, JSON.stringify({
        encrypted: toBase64(new Uint8Array(encrypted)),
        iv: toBase64(iv),
    }));
}

async function loadRememberedPassword() {
    const stored = localStorage.getItem(rememberedPasswordKey);
    if (!stored) return '';
    try {
        const parsed = JSON.parse(stored) as { encrypted: string; iv: string };
        const key = await getRememberedPasswordKey();
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(parsed.iv) }, key, fromBase64(parsed.encrypted));
        return new TextDecoder().decode(decrypted);
    } catch {
        localStorage.removeItem(rememberedPasswordKey);
        return '';
    }
}

export default function QueueInternal() {
    const [checking, setChecking] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        void loadRememberedPassword().then((savedPassword) => {
            if (savedPassword) {
                setPassword(savedPassword);
                setRemember(true);
            }
        });
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
                if (remember) {
                    await saveRememberedPassword(password);
                } else {
                    localStorage.removeItem(rememberedPasswordKey);
                }
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
    if (authenticated) return <QueueDisplay greenServing={false} onSessionExpired={() => setAuthenticated(false)} />;

    return (
        <>
            <Head title="Queue Internal" />
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
                <div className="relative z-10 flex w-full max-w-md flex-col items-center">
                    <form onSubmit={login} className="w-full rounded-2xl border border-white bg-white p-8 shadow-2xl sm:p-10" style={{ color: '#111827', backgroundColor: '#FFFFFF', opacity: 1 }}>
                    <div className="mb-7 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3E9AF4] shadow-lg"><Lock className="h-8 w-8 text-white" /></div>
                        <h1 className="mt-2 text-2xl font-bold" style={{ color: '#111827' }}>TBS QUEUE INTERNALS</h1>
                        <p className="mt-2 text-sm" style={{ color: '#68737B' }}>Enter the password to view the internal queue.</p>
                    </div>
                    <label htmlFor="queue-internal-password-login" className="block text-sm font-semibold" style={{ color: '#111827' }}>PASSWORD</label>
                    <input id="queue-internal-password-login" type="password" value={password} autoFocus autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onPaste={(event) => event.preventDefault()} className="mt-2 h-12 w-full rounded-xl border border-[#cbd5e1] bg-white px-4 outline-none focus:border-[#3E9AF4] focus:ring-2 focus:ring-[#3E9AF4]/20" style={{ color: '#111827', backgroundColor: '#FFFFFF', colorScheme: 'light' }} />
                    <label className="mt-4 flex items-center gap-2 text-sm" style={{ color: '#536170' }}><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#3E9AF4] focus:ring-[#3E9AF4]" /> Remember me</label>
                    {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
                    <button type="submit" disabled={!password || submitting} className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-[#3E9AF4] text-sm font-semibold text-white shadow-lg transition hover:bg-[#2785dc] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Unlocking...' : 'Unlock Queue'}</button>
                    </form>
                </div>
            </main>
        </>
    );
}

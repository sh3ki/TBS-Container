import React, { useEffect, useRef, useState } from 'react';
import { Head, Form } from '@inertiajs/react';
import { BarChart3, Container, Eye, EyeOff, Lock, ShieldCheck, UserRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { ModernButton } from '@/components/modern';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

const rememberedAccountsKey = 'tbs_remembered_accounts';
const encryptionKeyKey = 'tbs_remembered_accounts_key';

interface RememberedAccount {
    username: string;
    encryptedPassword: string;
    iv: string;
    updatedAt: number;
}

function toBase64(bytes: Uint8Array) {
    return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function getRememberedAccountsKey() {
    const existing = localStorage.getItem(encryptionKeyKey);
    if (existing) return crypto.subtle.importKey('raw', fromBase64(existing), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const exported = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(encryptionKeyKey, toBase64(new Uint8Array(exported)));
    return key;
}

async function encryptRememberedPassword(password: string) {
    const key = await getRememberedAccountsKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(password));
    return { encryptedPassword: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}

async function decryptRememberedPassword(account: RememberedAccount) {
    const key = await getRememberedAccountsKey();
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(account.iv) }, key, fromBase64(account.encryptedPassword));
    return new TextDecoder().decode(decrypted);
}

function MaritimeBackground() {
    return (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden bg-[#123d69]">
            <div className="login-background-drift absolute -inset-[2%] bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/images/tbs-maritime-login-bg.png')" }} />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,30,56,.66)_0%,rgba(8,44,77,.18)_46%,rgba(3,21,42,.38)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,31,57,.1)_0%,transparent_45%,rgba(1,15,30,.35)_100%)]" />
            <div className="login-water-shimmer absolute -bottom-20 left-[-12%] h-72 w-[124%] bg-[repeating-linear-gradient(174deg,transparent_0,transparent_22px,rgba(220,245,255,.15)_24px,transparent_26px)] blur-[1px]" />
            <div className="login-scan absolute left-0 top-0 h-full w-1/4 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
    );
}

function Feature({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-100/30 bg-cyan-100/10 text-cyan-100 backdrop-blur-sm"><Icon className="h-5 w-5" strokeWidth={1.8} /></div>
            <div><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-1 max-w-[220px] text-xs leading-5 text-blue-50/80">{children}</p></div>
        </div>
    );
}

function LoginBranding() {
    return (
        <div className="relative z-10 flex min-h-screen w-full max-w-[670px] flex-col justify-between px-8 py-9 sm:px-12 lg:px-16 xl:px-20">
            <div className="flex items-center gap-4">
                <div className="flex h-[74px] w-[74px] items-center justify-center rounded-[20px] bg-white shadow-[0_12px_35px_rgba(3,24,44,.18)]"><img src="/apple-touch-icon.png" alt="TBS logo" className="h-[58px] w-[58px] object-contain" /></div>
                <div><div className="text-[2.1rem] font-bold leading-none tracking-[-.04em] text-white">TBS</div><div className="mt-1 text-sm font-medium tracking-[-.01em] text-white/90 sm:text-base">Container Yard Management Suite</div></div>
            </div>
            <div className="max-w-[390px] pb-4 pt-16">
                <div className="mb-7 h-px w-20 bg-cyan-100/50" />
                <h1 className="text-[3.35rem] font-semibold leading-[.98] tracking-[-.055em] text-white sm:text-[4.35rem]">Smarter<br />Container<br /><span className="text-[#b9e7ff]">Operations.</span></h1>
                <p className="mt-7 max-w-[315px] text-base leading-7 text-white/85">A unified platform for efficient container terminal management.</p>
                <div className="mt-10 space-y-6"><Feature icon={Container} title="Real-time Tracking">Monitor container movements and inventory status in real-time.</Feature><Feature icon={ShieldCheck} title="Secure Operations">Gate-in/out management with comprehensive audit trails.</Feature><Feature icon={BarChart3} title="Efficient Workflows">Automated booking, billing, and reporting systems.</Feature></div>
            </div>
            <div className="text-[11px] uppercase tracking-[.2em] text-white/55">Connected operations / 24.7</div>
        </div>
    );
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberChecked, setRememberChecked] = useState(false);
    const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [secureTransport, setSecureTransport] = useState(false);
    const pendingCredentials = useRef<{ username: string; password: string } | null>(null);

    useEffect(() => {
        setSecureTransport(window.location.protocol === 'https:');
        void (async () => {
            try {
                const raw = localStorage.getItem(rememberedAccountsKey);
                const parsed = raw ? JSON.parse(raw) : [];
                const safeAccounts = (Array.isArray(parsed) ? parsed : []).filter((account: RememberedAccount) => account?.username && account?.encryptedPassword && account?.iv).sort((a: RememberedAccount, b: RememberedAccount) => b.updatedAt - a.updatedAt).slice(0, 5) as RememberedAccount[];
                localStorage.setItem(rememberedAccountsKey, JSON.stringify(safeAccounts));
                setRememberedAccounts(safeAccounts);
                if (safeAccounts[0]) {
                    const rememberedPassword = await decryptRememberedPassword(safeAccounts[0]);
                    setUsername(safeAccounts[0].username);
                    setPassword(rememberedPassword);
                    setRememberChecked(true);
                }
            } catch {
                // Ignore malformed local storage data.
            }
        })();
    }, []);

    useEffect(() => {
        let active = true;
        const credentialsApi = navigator.credentials as (Credentials & { get?: (options: unknown) => Promise<unknown> }) | undefined;
        if (!credentialsApi?.get || !window.isSecureContext) return () => { active = false; };

        void credentialsApi.get({ password: true, mediation: 'optional' }).then((credential: unknown) => {
            if (!active || !credential) return;
            const saved = credential as { id?: string; password?: string };
            if (saved.id) setUsername(saved.id);
            if (saved.password) setPassword(saved.password);
            if (saved.id || saved.password) setRememberChecked(true);
        }).catch(() => {
            // The browser may deny credential access or have no saved credential.
        });

        return () => { active = false; };
    }, []);

    async function saveRememberedAccount(value: string, plainPassword: string) {
        if (!value || !plainPassword) return;
        const encrypted = await encryptRememberedPassword(plainPassword);
        const next: RememberedAccount[] = [{ username: value, ...encrypted, updatedAt: Date.now() }, ...rememberedAccounts.filter((item) => item.username !== value)].slice(0, 5);
        localStorage.setItem(rememberedAccountsKey, JSON.stringify(next));
        setRememberedAccounts(next);
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#123d69] text-[#101828]">
            <Head title="Log in" />
            <MaritimeBackground />
            <div className="relative z-10 flex min-h-screen w-full items-center justify-between gap-10 lg:px-8 xl:px-14">
                <div className="hidden min-h-screen shrink-0 lg:flex lg:w-[58%] xl:w-[61%]"><LoginBranding /></div>
                <main className="flex min-h-screen w-full items-center justify-center px-5 py-8 sm:px-10 lg:w-[42%] lg:px-0 xl:w-[39%] xl:pr-10">
                    <section className="w-full max-w-[470px] rounded-[24px] border border-white/75 bg-[#f7fafd]/95 p-7 shadow-[0_28px_80px_rgba(4,24,46,.26)] backdrop-blur-xl sm:p-10">
                        <div className="mb-8"><p className="mb-3 text-xs font-semibold uppercase tracking-[.22em] text-[#206aa7]">Operations portal</p><h2 className="text-[2rem] font-semibold tracking-[-.045em] text-[#101828]">Welcome Back</h2><p className="mt-2 text-sm text-[#64748b]">Sign in to your TBS account</p></div>
                        {status && <div role="status" className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{status}</div>}
                        <Form action={store.url()} method="post" autoComplete="on" resetOnSuccess={['password']} className="space-y-5" onSubmitCapture={(event: React.FormEvent<HTMLFormElement>) => {
                            const formData = new FormData(event.currentTarget);
                            const submittedUsername = String(formData.get('username') ?? username);
                            const submittedPassword = String(formData.get('password') ?? '');
                            pendingCredentials.current = { username: submittedUsername, password: submittedPassword };
                        }} onSuccess={() => {
                            const credentialsApi = navigator.credentials as (Credentials & { store?: (credential: unknown) => Promise<unknown> }) | undefined;
                            const saved = pendingCredentials.current;
                            if (rememberChecked && saved?.username && saved.password) void saveRememberedAccount(saved.username, saved.password);
                            const PasswordCredentialConstructor = (window as Window & { PasswordCredential?: new (data: { id: string; password: string; name?: string }) => unknown }).PasswordCredential;
                            if (saved?.username && saved.password && credentialsApi?.store && PasswordCredentialConstructor && window.isSecureContext) {
                                void credentialsApi.store(new PasswordCredentialConstructor({ id: saved.username, password: saved.password, name: 'TBS Container Yard Management Suite' })).catch(() => {
                                    // Browser password managers may require their own user confirmation.
                                });
                            }
                        }}>
                            {({ processing, errors }) => <>
                                <div className="relative"><Label htmlFor="username" className="mb-2 block text-sm font-medium text-[#101828]">Username</Label><div className="relative"><UserRound aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-[#6c86a8]" /><Input id="username" type="text" name="username" required autoFocus autoComplete="username" placeholder="Enter your username" value={username} onChange={(event) => { setUsername(event.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} className="h-12 rounded-xl border-[#d6e1ee] bg-white/90 pl-12 pr-4 text-sm shadow-[0_2px_8px_rgba(30,80,130,.04)] placeholder:text-[#91a5c1] focus:border-[#3c98ee] focus:ring-[#3c98ee]/20" /></div><InputError message={errors.username} />{showSuggestions && rememberedAccounts.length > 0 && <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{rememberedAccounts.filter((item) => item.username.toLowerCase().includes(username.toLowerCase())).map((item) => <button key={item.username} type="button" onMouseDown={async () => { setUsername(item.username); setPassword(await decryptRememberedPassword(item)); setRememberChecked(true); setShowSuggestions(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">{item.username}</button>)}</div>}</div>
                                <div><div className="mb-2"><Label htmlFor="password" className="text-sm font-medium text-[#101828]">Password</Label></div><div className="relative"><Lock aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-[#6c86a8]" /><Input id="password" type={showPassword ? 'text' : 'password'} name="password" required autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-xl border-[#d6e1ee] bg-white/90 pl-12 pr-12 text-sm shadow-[0_2px_8px_rgba(30,80,130,.04)] placeholder:text-[#91a5c1] focus:border-[#3c98ee] focus:ring-[#3c98ee]/20" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-md p-1.5 text-[#6c86a8] transition hover:bg-[#eaf3fb] hover:text-[#206aa7] focus:outline-none focus:ring-2 focus:ring-[#3c98ee]/40">{showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}</button></div><InputError message={errors.password} /></div>
                                <div className="flex items-center justify-between pt-1"><div className="flex items-center gap-2.5"><Checkbox id="remember" name="remember_client" checked={rememberChecked} onCheckedChange={(value) => setRememberChecked(Boolean(value))} /><Label htmlFor="remember" className="cursor-pointer text-sm text-[#64748b]">Remember me</Label></div>{canResetPassword && <TextLink href={request()} className="text-xs font-medium text-[#2b8ce5] hover:underline">Forgot password?</TextLink>}</div>
                                <ModernButton type="submit" variant="primary" disabled={processing} data-test="login-button" className="h-12 w-full rounded-xl bg-[#3c98ee] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(60,152,238,.25)] transition hover:bg-[#2785dc] focus-visible:ring-2 focus-visible:ring-[#206aa7] focus-visible:ring-offset-2">{processing ? <Spinner className="h-5 w-5" /> : <Lock className="h-4 w-4" />} Sign In</ModernButton>
                                <div className="flex items-center justify-center gap-2 pt-2 text-center text-[11px] text-[#7890ad]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#24b6d3]" /> {secureTransport ? 'Secure connection with encrypted data transmission' : 'Secure session controls enabled'}</div>
                            </>}
                        </Form>
                        <p className="mt-8 border-t border-[#dbe6f1] pt-5 text-center text-[11px] text-[#7890ad]">© {new Date().getFullYear()} TBS Container Yard Management Suite. All rights reserved.</p>
                    </section>
                </main>
            </div>
            <div className="relative z-10 px-6 pb-6 text-center text-[11px] text-white/65 lg:hidden">TBS Container Yard Management Suite</div>
        </div>
    );
}

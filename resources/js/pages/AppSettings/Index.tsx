import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import axios from 'axios';
import { useState } from 'react';
import { Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { colors } from '@/lib/colors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModernButton, ModernCard, ToastContainer, useModernToast } from '@/components/modern';

interface AppSettingsProps {
    settings: {
        incoming_rate: number;
        outgoing_rate: number;
        hauler_exceptions: string;
        preout_hauler_exceptions: string;
        prein_hauler_exceptions: string;
        booking_scraping_enabled: boolean;
        booking_system_url: string;
        booking_system_login_url: string;
        booking_system_username: string;
        booking_system_timeout: number;
    };
}

export default function AppSettings({ settings }: AppSettingsProps) {
    const [incomingRate, setIncomingRate] = useState(String(settings.incoming_rate));
    const [outgoingRate, setOutgoingRate] = useState(String(settings.outgoing_rate));
    const [haulerExceptions, setHaulerExceptions] = useState(settings.hauler_exceptions);
    const [preoutHaulerExceptions, setPreoutHaulerExceptions] = useState(settings.preout_hauler_exceptions);
    const [preinHaulerExceptions, setPreinHaulerExceptions] = useState(settings.prein_hauler_exceptions);
    const [bookingScrapingEnabled, setBookingScrapingEnabled] = useState(settings.booking_scraping_enabled);
    const [bookingSystemUrl, setBookingSystemUrl] = useState(settings.booking_system_url);
    const [bookingSystemLoginUrl, setBookingSystemLoginUrl] = useState(settings.booking_system_login_url);
    const [bookingSystemUsername, setBookingSystemUsername] = useState(settings.booking_system_username);
    const [bookingSystemPassword, setBookingSystemPassword] = useState('');
    const [bookingSystemTimeout, setBookingSystemTimeout] = useState(String(settings.booking_system_timeout));
    const [saving, setSaving] = useState<'docs' | 'queue' | 'credentials' | null>(null);
    const { toasts, removeToast, success, error } = useModernToast();

    const saveDocsSettings = async () => {
        setSaving('docs');
        try {
            const response = await axios.put('/app-settings', {
                section: 'docs_fee',
                incoming_rate: Number(incomingRate),
                outgoing_rate: Number(outgoingRate),
                hauler_exceptions: haulerExceptions,
            });
            success(response.data.message || 'Docs Fee settings updated successfully.');
        } catch (exception) {
            console.error('Failed to update Docs Fee settings:', exception);
            error('Rates must be numbers greater than 0.');
        } finally {
            setSaving(null);
        }
    };

    const saveQueueSettings = async () => {
        setSaving('queue');
        try {
            const response = await axios.put('/app-settings', {
                section: 'queue',
                booking_scraping_enabled: bookingScrapingEnabled,
                preout_hauler_exceptions: preoutHaulerExceptions,
                prein_hauler_exceptions: preinHaulerExceptions,
            });
            success(response.data.message || 'Booking System Scraping settings updated successfully.');
        } catch (exception) {
            console.error('Failed to update Booking System Scraping settings:', exception);
            error('Failed to update Booking System Scraping settings.');
        } finally {
            setSaving(null);
        }
    };

    const saveBookingCredentials = async () => {
        setSaving('credentials');
        try {
            const response = await axios.put('/app-settings', {
                section: 'booking_credentials',
                booking_system_url: bookingSystemUrl,
                booking_system_login_url: bookingSystemLoginUrl || null,
                booking_system_username: bookingSystemUsername,
                ...(bookingSystemPassword ? { booking_system_password: bookingSystemPassword } : {}),
                booking_system_timeout: Number(bookingSystemTimeout),
            });
            setBookingSystemPassword('');
            success(response.data.message || 'Booking System credentials updated successfully.');
        } catch (exception) {
            console.error('Failed to update Booking System credentials:', exception);
            error('Please check the Booking System credential fields.');
        } finally {
            setSaving(null);
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="App Settings" />

            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl p-3" style={{ backgroundColor: colors.brand.primary }}>
                        <Settings className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">App Settings</h1>
                        <p className="mt-1 text-sm text-gray-600">Manage application settings</p>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                <ModernCard title="Booking System Scraping Settings" subtitle="Configure Booking System verification for Add Pre-In and Add Pre-Out" icon={<Settings className="h-5 w-5 text-white" />}>
                    <div className="flex max-w-4xl items-center justify-between rounded-lg border border-gray-200 p-4">
                        <div>
                            <p className="font-semibold text-gray-900">Booking System Scraping</p>
                            <p className="mt-1 text-sm text-gray-600">
                                {bookingScrapingEnabled ? 'Verified booking checks are enabled for both queue entry modals.' : 'Booking checks are disabled for both queue entry modals.'}
                            </p>
                        </div>
                        <ModernButton type="button" variant={bookingScrapingEnabled ? 'primary' : 'secondary'} size="sm" icon={bookingScrapingEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />} onClick={() => setBookingScrapingEnabled((enabled) => !enabled)}>
                            {bookingScrapingEnabled ? 'ON' : 'OFF'}
                        </ModernButton>
                    </div>
                    <div className="mt-4 max-w-4xl">
                        <Label htmlFor="preout-hauler-exceptions" className="text-sm font-semibold text-gray-900">PRE-OUT HAULER EXCEPTIONS</Label>
                        <Input id="preout-hauler-exceptions" type="text" value={preoutHaulerExceptions} onChange={(event) => setPreoutHaulerExceptions(event.target.value.toUpperCase())} placeholder="HAULER ONE, HAULER TWO" className="mt-2 h-11 uppercase" />
                        <p className="mt-1 text-xs text-gray-500">Separate haulers with commas. These haulers appear in Add Pre-Out as “Not in Booking” options and bypass Booking System verification.</p>
                    </div>
                    <div className="mt-4 max-w-4xl">
                        <Label htmlFor="prein-hauler-exceptions" className="text-sm font-semibold text-gray-900">PRE-IN HAULER EXCEPTIONS</Label>
                        <Input id="prein-hauler-exceptions" type="text" value={preinHaulerExceptions} onChange={(event) => setPreinHaulerExceptions(event.target.value.toUpperCase())} placeholder="HAULER ONE, HAULER TWO" className="mt-2 h-11 uppercase" />
                        <p className="mt-1 text-xs text-gray-500">Separate haulers with commas. These haulers appear in Add Pre-In as “Not in Booking” options and bypass Booking System verification.</p>
                    </div>
                    <div className="mt-6 flex items-center gap-3">
                        <ModernButton type="button" variant="primary" loading={saving === 'queue'} onClick={saveQueueSettings}>Save Settings</ModernButton>
                    </div>
                </ModernCard>

                <ModernCard title="Booking System Credentials" subtitle="Configure the account and connection used for Booking System scraping" icon={<Settings className="h-5 w-5 text-white" />}>
                    <div className="grid max-w-4xl gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <Label htmlFor="booking-system-url" className="text-sm font-semibold text-gray-900">BOOKING SYSTEM URL</Label>
                            <Input id="booking-system-url" type="url" value={bookingSystemUrl} onChange={(event) => setBookingSystemUrl(event.target.value)} className="mt-2 h-11" />
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="booking-system-login-url" className="text-sm font-semibold text-gray-900">LOGIN URL</Label>
                            <Input id="booking-system-login-url" type="url" value={bookingSystemLoginUrl} onChange={(event) => setBookingSystemLoginUrl(event.target.value)} className="mt-2 h-11" />
                        </div>
                        <div>
                            <Label htmlFor="booking-system-username" className="text-sm font-semibold text-gray-900">USERNAME</Label>
                            <Input id="booking-system-username" type="text" value={bookingSystemUsername} onChange={(event) => setBookingSystemUsername(event.target.value)} className="mt-2 h-11" />
                        </div>
                        <div>
                            <Label htmlFor="booking-system-password" className="text-sm font-semibold text-gray-900">PASSWORD</Label>
                            <Input id="booking-system-password" type="password" value={bookingSystemPassword} onChange={(event) => setBookingSystemPassword(event.target.value)} placeholder="Leave blank to keep current password" className="mt-2 h-11" />
                        </div>
                        <div>
                            <Label htmlFor="booking-system-timeout" className="text-sm font-semibold text-gray-900">TIMEOUT (SECONDS)</Label>
                            <Input id="booking-system-timeout" type="number" min="1" max="300" value={bookingSystemTimeout} onChange={(event) => setBookingSystemTimeout(event.target.value)} className="mt-2 h-11" />
                        </div>
                        <div className="flex items-center gap-3 md:col-span-2">
                            <ModernButton type="button" variant="primary" loading={saving === 'credentials'} onClick={saveBookingCredentials}>Save Settings</ModernButton>
                        </div>
                    </div>
                </ModernCard>

                <ModernCard
                    title="Docs Fee Settings"
                    subtitle="Configure incoming and outgoing Docs Fee rates"
                    icon={<Settings className="h-5 w-5 text-white" />}
                >
                    <div className="grid max-w-4xl gap-6 md:grid-cols-3">
                        <div>
                            <Label htmlFor="incoming-rate" className="text-sm font-semibold text-gray-900">
                                INCOMING RATE
                            </Label>
                            <Input
                                id="incoming-rate"
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={incomingRate}
                                onChange={(event) => setIncomingRate(event.target.value)}
                                className="mt-2 h-11"
                            />
                        </div>

                        <div>
                            <Label htmlFor="outgoing-rate" className="text-sm font-semibold text-gray-900">
                                OUTGOING RATE
                            </Label>
                            <Input
                                id="outgoing-rate"
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={outgoingRate}
                                onChange={(event) => setOutgoingRate(event.target.value)}
                                className="mt-2 h-11"
                            />
                        </div>

                        <div>
                            <Label htmlFor="hauler-exceptions" className="text-sm font-semibold text-gray-900">
                                HAULER EXCEPTIONS
                            </Label>
                            <Input
                                id="hauler-exceptions"
                                type="text"
                                value={haulerExceptions}
                                onChange={(event) => setHaulerExceptions(event.target.value.toUpperCase())}
                                placeholder="HAULER ONE, HAULER TWO"
                                className="mt-2 h-11 uppercase"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Separate haulers with commas. These haulers receive a 0 Docs Fee rate.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 md:col-span-3">
                            <ModernButton type="button" variant="primary" loading={saving === 'docs'} onClick={saveDocsSettings}>
                                Save Settings
                            </ModernButton>
                        </div>
                    </div>
                </ModernCard>
                </div>
            </div>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
}

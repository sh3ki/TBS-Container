import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import axios from 'axios';
import { useState } from 'react';
import { Settings } from 'lucide-react';
import { colors } from '@/lib/colors';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModernButton, ModernCard } from '@/components/modern';

interface AppSettingsProps {
    settings: {
        incoming_rate: number;
        outgoing_rate: number;
        hauler_exceptions: string;
    };
}

export default function AppSettings({ settings }: AppSettingsProps) {
    const [incomingRate, setIncomingRate] = useState(String(settings.incoming_rate));
    const [outgoingRate, setOutgoingRate] = useState(String(settings.outgoing_rate));
    const [haulerExceptions, setHaulerExceptions] = useState(settings.hauler_exceptions);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const saveSettings = async () => {
        setSaving(true);
        setMessage('');

        try {
            const response = await axios.put('/app-settings', {
                incoming_rate: Number(incomingRate),
                outgoing_rate: Number(outgoingRate),
                hauler_exceptions: haulerExceptions,
            });
            setMessage(response.data.message || 'Docs Fee settings updated successfully.');
        } catch (error) {
            console.error('Failed to update Docs Fee settings:', error);
            setMessage('Rates must be numbers greater than 0.');
        } finally {
            setSaving(false);
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
                                Separate multiple haulers with a comma. Matching haulers receive a 0 Docs Fee rate.
                            </p>
                        </div>

                        <div className="flex items-center gap-3 md:col-span-3">
                            <ModernButton type="button" variant="primary" loading={saving} onClick={saveSettings}>
                                Save Settings
                            </ModernButton>
                            {message && <span className="text-sm text-gray-600">{message}</span>}
                        </div>
                    </div>
                </ModernCard>
            </div>
        </AuthenticatedLayout>
    );
}

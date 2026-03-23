import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { colors } from '@/lib/colors';
import { Activity, Clock3, ListChecks, Mail, RefreshCcw } from 'lucide-react';

type StatusPayload = {
    config: {
        enabled: boolean;
        incoming_enabled: boolean;
        reply_enabled: boolean;
        scheduled_enabled: boolean;
        loop_sleep_seconds: number;
    };
    tables: {
        email_automation_logs: boolean;
        email_reply_queue: boolean;
        notification_table: string | null;
    };
    last_cycle_at: string | null;
    last_24h: {
        incoming: { ok: number; error: number; skipped: number };
        scheduled: { ok: number; error: number; skipped: number };
        reply: { ok: number; error: number; skipped: number };
    };
    reply_queue: {
        pending: number;
        sent: number;
        failed: number;
        total: number;
    };
    scheduled: {
        pending: number;
        delivered: number;
        failed: number;
        table: string | null;
    };
};

export default function EmailAutomationStatus() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<StatusPayload | null>(null);

    const fetchStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('/api/dashboard/email-automation-status');
            if (response.data?.success) {
                setData(response.data.data as StatusPayload);
            } else {
                setError('API returned an unsuccessful response.');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch status';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    return (
        <AuthenticatedLayout>
            <Head title="Email Automation Status" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                            <Mail className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Email Automation Status</h1>
                            <p className="text-sm text-gray-600">Live monitor for POP3 intake, scheduled sends, and auto replies.</p>
                        </div>
                    </div>

                    <button
                        onClick={fetchStatus}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white"
                        style={{ backgroundColor: colors.brand.secondary }}
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {loading && (
                    <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-600">Loading automation status...</div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">{error}</div>
                )}

                {!loading && !error && data && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                                <div className="text-xs uppercase text-gray-500">Automation</div>
                                <div className={`mt-2 text-xl font-bold ${data.config.enabled ? 'text-green-600' : 'text-red-600'}`}>
                                    {data.config.enabled ? 'Enabled' : 'Disabled'}
                                </div>
                                <div className="text-sm text-gray-500 mt-1">Loop sleep: {data.config.loop_sleep_seconds}s</div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                                <div className="text-xs uppercase text-gray-500">Last Cycle</div>
                                <div className="mt-2 text-base font-semibold text-gray-900 break-all">
                                    {data.last_cycle_at ?? 'No cycle recorded'}
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                                <div className="text-xs uppercase text-gray-500">Reply Queue</div>
                                <div className="mt-2 text-xl font-bold text-gray-900">{data.reply_queue.pending} pending</div>
                                <div className="text-sm text-gray-500 mt-1">Sent: {data.reply_queue.sent} | Failed: {data.reply_queue.failed}</div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-4">
                                <div className="text-xs uppercase text-gray-500">Scheduled Email</div>
                                <div className="mt-2 text-xl font-bold text-gray-900">{data.scheduled.pending} due now</div>
                                <div className="text-sm text-gray-500 mt-1">Delivered: {data.scheduled.delivered} | Failed: {data.scheduled.failed}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {[
                                { key: 'incoming', title: 'Incoming', icon: <Mail className="w-4 h-4" /> },
                                { key: 'scheduled', title: 'Scheduled', icon: <Clock3 className="w-4 h-4" /> },
                                { key: 'reply', title: 'Reply', icon: <Activity className="w-4 h-4" /> },
                            ].map((item) => {
                                const stats = data.last_24h[item.key as keyof StatusPayload['last_24h']];
                                return (
                                    <div key={item.key} className="bg-white border border-gray-200 rounded-xl p-5">
                                        <div className="flex items-center gap-2 text-gray-800 font-semibold">
                                            {item.icon}
                                            {item.title} last 24h
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                                            <div>
                                                <div className="text-green-600 text-xl font-bold">{stats.ok}</div>
                                                <div className="text-xs text-gray-500">OK</div>
                                            </div>
                                            <div>
                                                <div className="text-red-600 text-xl font-bold">{stats.error}</div>
                                                <div className="text-xs text-gray-500">Error</div>
                                            </div>
                                            <div>
                                                <div className="text-yellow-600 text-xl font-bold">{stats.skipped}</div>
                                                <div className="text-xs text-gray-500">Skipped</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-5">
                            <div className="flex items-center gap-2 text-gray-800 font-semibold mb-3">
                                <ListChecks className="w-4 h-4" />
                                Backing Tables
                            </div>
                            <div className="space-y-2 text-sm text-gray-900">
                                <div>email_automation_logs: {data.tables.email_automation_logs ? 'present' : 'missing'}</div>
                                <div>email_reply_queue: {data.tables.email_reply_queue ? 'present' : 'missing'}</div>
                                <div>notification table: {data.tables.notification_table ?? 'not found'}</div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

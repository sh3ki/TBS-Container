import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import axios from 'axios';
import { useState } from 'react';
import { Check, Smartphone, ToggleLeft, ToggleRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModernButton, ModernCard } from '@/components/modern';
import { colors } from '@/lib/colors';

type AppCode = 'CHECKER' | 'GUARD';
interface AppSettings { app_version: string; apk_url: string; update_app_modal: boolean; }
interface MobileSettingsProps { settings: Partial<Record<AppCode, AppSettings>>; }
const defaults: AppSettings = { app_version: '', apk_url: '', update_app_modal: false };

export default function MobileSettings({ settings }: MobileSettingsProps) {
    const [values, setValues] = useState<Record<AppCode, AppSettings>>({
        CHECKER: { ...defaults, ...(settings.CHECKER ?? {}) },
        GUARD: { ...defaults, ...(settings.GUARD ?? {}) },
    });
    const [saving, setSaving] = useState<AppCode | null>(null);
    const [message, setMessage] = useState<Record<AppCode, string>>({ CHECKER: '', GUARD: '' });
    const update = (app: AppCode, field: keyof AppSettings, value: string | boolean) => setValues((current) => ({ ...current, [app]: { ...current[app], [field]: value } }));
    const saveSettings = async (app: AppCode) => {
        setSaving(app); setMessage((current) => ({ ...current, [app]: '' }));
        try {
            const response = await axios.put('/mobile-settings', { app_code: app, ...values[app] });
            setMessage((current) => ({ ...current, [app]: response.data.message || 'Settings updated successfully.' }));
        } catch (error) {
            console.error(`Failed to update ${app} mobile settings:`, error);
            setMessage((current) => ({ ...current, [app]: 'Failed to update settings.' }));
        } finally { setSaving(null); }
    };
    return (
        <AuthenticatedLayout>
            <Head title="Mobile Settings" />
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl p-3" style={{ backgroundColor: colors.brand.primary }}><Smartphone className="h-6 w-6 text-white" /></div>
                    <div><h1 className="text-3xl font-bold text-gray-900">Mobile Settings</h1><p className="mt-1 text-sm text-gray-600">Manage checker and guard application settings</p></div>
                </div>
                {(['CHECKER', 'GUARD'] as AppCode[]).map((app) => (
                    <ModernCard key={app} title={`${app} App Settings`} subtitle={`Manage ${app.toLowerCase()} mobile application updates`} icon={<Smartphone className="h-5 w-5 text-white" />}>
                        <div className="max-w-xl space-y-6">
                            <div><Label htmlFor={`${app}-version`} className="text-sm font-semibold text-gray-900">App Version</Label><Input id={`${app}-version`} value={values[app].app_version} onChange={(event) => update(app, 'app_version', event.target.value)} placeholder="1.0.0" className="mt-2 h-11" /></div>
                            <div><Label htmlFor={`${app}-apk-url`} className="text-sm font-semibold text-gray-900">APK Download URL</Label><Input id={`${app}-apk-url`} type="url" value={values[app].apk_url} onChange={(event) => update(app, 'apk_url', event.target.value)} placeholder="https://github.com/.../app-release.apk" className="mt-2 h-11" /><p className="mt-1 text-xs text-gray-500">Required when Update App Modal is ON.</p></div>
                            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4"><div><p className="font-semibold text-gray-900">Update App Modal</p><p className="mt-1 text-sm text-gray-600">{values[app].update_app_modal ? 'The update app modal is enabled.' : 'The update app modal is disabled.'}</p></div><ModernButton type="button" variant={values[app].update_app_modal ? 'primary' : 'secondary'} size="sm" icon={values[app].update_app_modal ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />} onClick={() => update(app, 'update_app_modal', !values[app].update_app_modal)}>{values[app].update_app_modal ? 'ON' : 'OFF'}</ModernButton></div>
                            <div className="flex items-center gap-3"><ModernButton type="button" variant="primary" loading={saving === app} icon={<Check className="h-4 w-4" />} onClick={() => saveSettings(app)}>Update Settings</ModernButton>{message[app] && <span className="text-sm text-gray-600">{message[app]}</span>}</div>
                        </div>
                    </ModernCard>
                ))}
            </div>
        </AuthenticatedLayout>
    );
}

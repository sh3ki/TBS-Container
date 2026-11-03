import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import axios from 'axios';
import { useState } from 'react';
import { Check, Smartphone, ToggleLeft, ToggleRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModernButton, ModernCard } from '@/components/modern';
import { colors } from '@/lib/colors';

interface MobileSettingsProps {
    settings: {
        app_version: string;
        apk_url: string;
        update_app_modal: boolean;
    };
}

export default function MobileSettings({ settings }: MobileSettingsProps) {
    const [appVersion, setAppVersion] = useState(settings.app_version);
    const [apkUrl, setApkUrl] = useState(settings.apk_url);
    const [updateAppModal, setUpdateAppModal] = useState(settings.update_app_modal);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const saveSettings = async () => {
        setSaving(true);
        setMessage('');

        try {
            const response = await axios.put('/mobile-settings', {
                app_version: appVersion,
                apk_url: apkUrl,
                update_app_modal: updateAppModal,
            });
            setMessage(response.data.message || 'Mobile settings updated successfully.');
        } catch (error) {
            console.error('Failed to update mobile settings:', error);
            setMessage('Failed to update mobile settings.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Mobile Settings" />

            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl p-3" style={{ backgroundColor: colors.brand.primary }}>
                        <Smartphone className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Mobile Settings</h1>
                        <p className="mt-1 text-sm text-gray-600">Manage mobile application settings</p>
                    </div>
                </div>

                <ModernCard
                    title="Mobile App Settings"
                    subtitle="Manage mobile application settings"
                    icon={<Smartphone className="h-5 w-5 text-white" />}
                >
                    <div className="max-w-xl space-y-6">
                        <div>
                            <Label htmlFor="app-version" className="text-sm font-semibold text-gray-900">
                                App Version
                            </Label>
                            <Input
                                id="app-version"
                                value={appVersion}
                                onChange={(event) => setAppVersion(event.target.value)}
                                placeholder="2.5.0"
                                className="mt-2 h-11"
                            />
                        </div>

                        <div>
                            <Label htmlFor="apk-url" className="text-sm font-semibold text-gray-900">
                                APK Download URL
                            </Label>
                            <Input
                                id="apk-url"
                                type="url"
                                value={apkUrl}
                                onChange={(event) => setApkUrl(event.target.value)}
                                placeholder="https://github.com/.../releases/download/.../app-release.apk"
                                className="mt-2 h-11"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Required when Update App Modal is ON.
                            </p>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                            <div>
                                <p className="font-semibold text-gray-900">Update App Modal</p>
                                <p className="mt-1 text-sm text-gray-600">
                                    {updateAppModal ? 'The update app modal is enabled.' : 'The update app modal is disabled.'}
                                </p>
                            </div>
                            <ModernButton
                                type="button"
                                variant={updateAppModal ? 'primary' : 'secondary'}
                                size="sm"
                                icon={updateAppModal ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                                onClick={() => setUpdateAppModal((enabled) => !enabled)}
                            >
                                {updateAppModal ? 'ON' : 'OFF'}
                            </ModernButton>
                        </div>

                        <div className="flex items-center gap-3">
                            <ModernButton
                                type="button"
                                variant="primary"
                                loading={saving}
                                icon={<Check className="h-4 w-4" />}
                                onClick={saveSettings}
                            >
                                Update Settings
                            </ModernButton>
                            {message && <span className="text-sm text-gray-600">{message}</span>}
                        </div>
                    </div>
                </ModernCard>
            </div>
        </AuthenticatedLayout>
    );
}

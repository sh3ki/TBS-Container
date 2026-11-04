import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Settings } from 'lucide-react';
import { colors } from '@/lib/colors';

export default function AppSettings() {
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
            </div>
        </AuthenticatedLayout>
    );
}

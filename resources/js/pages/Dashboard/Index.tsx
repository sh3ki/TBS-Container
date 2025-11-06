import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function Dashboard() {
    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="p-8">
                <h1 className="text-4xl font-bold text-gray-800">
                    Dashboard
                </h1>
                <p className="text-lg text-gray-600 mt-4">
                    Welcome to FJPWL Container Management System
                </p>
            </div>
        </AuthenticatedLayout>
    );
}

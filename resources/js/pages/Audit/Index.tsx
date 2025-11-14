import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { ModernTable, ModernCard, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Search } from 'lucide-react';
import { colors } from '@/lib/colors';

interface AuditLog extends Record<string, unknown> {
    a_id: number;
    hashed_id: string;
    username: string;
    full_name: string;
    action: string;
    description: string;
    date_added: string;
    ip_address: string;
    module: string;
}

interface User {
    user_id: number;
    username: string;
    full_name: string;
}

export default function Index() {
    const { toasts, removeToast, success: showSuccess, error: showError } = useModernToast();
    const toast = { success: showSuccess, error: showError };
    
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState('all');
    const [action, setAction] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const actions = [
        'CREATE',
        'UPDATE',
        'DELETE',
        'VIEW',
        'EDIT',
        'LOGIN',
        'LOGOUT',
        'GATE_IN',
        'GATE_OUT',
        'EXPORT',
        'PRINT',
        'ARCHIVE',
        'RESTORE',
    ];

    useEffect(() => {
        loadUsers();
        loadAllAuditLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadUsers = async () => {
        try {
            const response = await axios.get('/api/audit/filters/users');
            setUsers(response.data.data || []);
        } catch {
            toast.error('Failed to load users');
        }
    };

    const loadAllAuditLogs = async () => {
        setLoading(true);
        try {
            // Get last 7 days
            const today = new Date();
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);
            
            const dateFromDefault = sevenDaysAgo.toISOString().split('T')[0];
            const dateToDefault = today.toISOString().split('T')[0];
            
            // Set default date values
            setDateFrom(dateFromDefault);
            setDateTo(dateToDefault);
            
            const response = await axios.get('/api/audit', {
                params: {
                    date_from: dateFromDefault,
                    date_to: dateToDefault
                }
            });
            setAuditLogs(Array.isArray(response.data) ? response.data : (response.data.data || []));
            setCurrentPage(1);
        } catch {
            toast.error('Failed to load audit logs');
            setAuditLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const params: Record<string, string | undefined> = {};
            
            if (userId !== 'all') params.user_id = userId;
            if (action !== 'all') params.action = action;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;
            if (searchTerm) params.search = searchTerm;

            const response = await axios.get('/api/audit', {
                params: Object.keys(params).length > 0 ? params : undefined
            });
            const logs = Array.isArray(response.data) ? response.data : (response.data.data || []);
            setAuditLogs(logs);
            setCurrentPage(1);
            toast.success(`${logs.length} audit logs found`);
        } catch {
            toast.error('Failed to generate audit logs');
            setAuditLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
        if (safeAuditLogs.length === 0) {
            toast.error('No data to export. Please generate audit logs first.');
            return;
        }

        try {
            const response = await axios.post('/api/audit/export', {
                user_id: userId === 'all' ? undefined : userId,
                action: action === 'all' ? undefined : action,
                date_from: dateFrom,
                date_to: dateTo,
                search: searchTerm || undefined,
            }, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit_logs_${dateFrom}_to_${dateTo}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            toast.success('Audit logs exported successfully');
        } catch {
            toast.error('Failed to export audit logs');
        }
    };

    const getActionColor = (action: string): string => {
        const actionUpper = action.toUpperCase();
        const colors: Record<string, string> = {
            'ADD': 'bg-green-100 text-green-700',
            'CREATE': 'bg-green-100 text-green-700',
            'UPDATE': 'bg-blue-100 text-blue-700',
            'EDIT': 'bg-blue-100 text-blue-700',
            'DELETE': 'bg-red-100 text-red-700',
            'LOGIN': 'bg-yellow-100 text-yellow-700',
            'LOGOUT': 'bg-yellow-100 text-yellow-700',
            'APPROVE': 'bg-emerald-100 text-emerald-700',
            'REPORTS': 'bg-sky-100 text-sky-700',
        };
        return colors[actionUpper] || 'bg-gray-100 text-gray-700';
    };

    // Pagination
    const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
    const filteredLogs = safeAuditLogs.filter(log => {
        const matchesSearch = !searchTerm || 
            log.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.ip_address.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

    return (
        <AuthenticatedLayout>
            <Head title="Audit Logs" />

            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                Audit Logs
                            </h1>
                            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                System activity and audit trail
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ 
                                backgroundColor: colors.brand.primary, 
                                color: 'white',
                                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
                            }}
                        >
                            <FileText className="w-4 h-4" />
                            Generate
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={loading || auditLogs.length === 0}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ 
                                backgroundColor: '#10b981', 
                                color: 'white',
                                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)'
                            }}
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    </div>
                </div>

                {/* Filters Section */}
                <ModernCard title="Search & Filter Audit Logs" subtitle="Filter audit logs by user, action, and date range" icon={<Search className="w-5 h-5" />}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <Label className="text-sm font-semibold mb-2" style={{ color: colors.text.secondary }}>
                                    Users
                                </Label>
                                <Select value={userId} onValueChange={setUserId}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="All Users" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Users</SelectItem>
                                        {users.map((user) => (
                                            <SelectItem key={user.user_id} value={user.user_id.toString()}>
                                                {user.full_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2" style={{ color: colors.text.secondary }}>
                                    Actions
                                </Label>
                                <Select value={action} onValueChange={setAction}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="All Actions" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Actions</SelectItem>
                                        {actions.map((act) => (
                                            <SelectItem key={act} value={act}>
                                                {act}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2" style={{ color: colors.text.secondary }}>
                                    Date From
                                </Label>
                                <Input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="h-11"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2" style={{ color: colors.text.secondary }}>
                                    Date To
                                </Label>
                                <Input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="h-11"
                                />
                            </div>
                        </div>

                        <div>
                            <Label className="text-sm font-semibold mb-2" style={{ color: colors.text.secondary }}>
                                Search
                            </Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search by user, action, description, or IP address..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-11"
                                />
                            </div>
                        </div>

                        <div className="border-t pt-4 border-gray-200">
                            <p className="text-sm text-gray-600">
                                <span className="font-semibold text-gray-900">{filteredLogs.length}</span> {filteredLogs.length === 1 ? 'audit' : 'audits'} found
                            </p>
                        </div>
                    </div>
                </ModernCard>

                {/* Audit Logs Table */}
                <ModernTable
                    columns={[
                        {
                            key: 'full_name',
                            label: 'User',
                            render: (item: AuditLog) => (
                                <div>
                                    <div className="font-medium" style={{ color: colors.text.primary }}>
                                        {item.full_name}
                                    </div>
                                    <div className="text-xs mt-0.5" style={{ color: colors.text.secondary }}>
                                        @{item.username}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            key: 'action',
                            label: 'Action',
                            render: (item: AuditLog) => (
                                <span 
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(item.action)}`}
                                >
                                    {item.action}
                                </span>
                            ),
                        },
                        {
                            key: 'description',
                            label: 'Description',
                            render: (item: AuditLog) => (
                                <div 
                                    className="max-w-md text-sm" 
                                    style={{ color: colors.text.primary }}
                                    title={item.description}
                                >
                                    {item.description}
                                </div>
                            ),
                        },
                        {
                            key: 'date_added',
                            label: 'Date Added',
                            render: (item: AuditLog) => (
                                <div className="text-sm" style={{ color: colors.text.primary }}>
                                    {new Date(item.date_added).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                            ),
                        },
                        {
                            key: 'ip_address',
                            label: 'IP Address',
                            render: (item: AuditLog) => (
                                <div className="font-mono text-xs" style={{ color: colors.text.secondary }}>
                                    {item.ip_address}
                                </div>
                            ),
                        },
                    ]}
                    data={paginatedLogs}
                    loading={loading}
                    emptyMessage="No audit logs found."
                    pagination={{
                        currentPage,
                        totalPages,
                        total: filteredLogs.length,
                        perPage: itemsPerPage,
                        onPageChange: setCurrentPage
                    }}
                />
            </div>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
}

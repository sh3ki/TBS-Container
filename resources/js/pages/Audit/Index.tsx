import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ModernButton, ModernCard, ModernTable, ModernBadge } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
    FileText, 
    RefreshCw, 
    Download, 
    Eye, 
    Search, 
    Filter, 
    X,
    User,
    Calendar,
    Shield,
    Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';
import axios from 'axios';

interface AuditLog extends Record<string, unknown> {
    hashed_id: string;
    a_id: number;
    action: string;
    description: string;
    user_id: number;
    username: string;
    full_name: string;
    date_added: string;
    ip_address: string;
    module: string;
    action_type: string;
}

interface User {
    user_id: number;
    full_name: string;
    username: string;
}

export default function Index() {
    const { toast } = useToast();
    
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterUser, setFilterUser] = useState('');
    const [filterModule, setFilterModule] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    
    const [page, setPage] = useState(1);
    const [perPage] = useState(100);
    const [total, setTotal] = useState(0);
    const [lastPage, setLastPage] = useState(1);
    
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    
    const modules = [
        'clients',
        'booking',
        'billing',
        'inventory',
        'gateinout',
        'users',
        'audit',
        'reports',
        'sizetype',
        'bancon',
    ];
    
    const actions = [
        'CREATE',
        'UPDATE',
        'DELETE',
        'LOGIN',
        'LOGOUT',
        'GATE_IN',
        'GATE_OUT',
        'VIEW',
        'EXPORT',
        'PRINT',
    ];

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        fetchAuditLogs();
    }, [page, searchTerm, filterUser, filterModule, filterAction, dateFrom, dateTo]);

    const fetchUsers = async () => {
        try {
            const response = await axios.get('/api/audit/filters/users');
            setUsers(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    const fetchAuditLogs = async () => {
        setRefreshing(true);
        try {
            const response = await axios.get('/api/audit', {
                params: {
                    page: page,
                    per_page: perPage,
                    search: searchTerm,
                    user_id: filterUser,
                    module: filterModule,
                    action: filterAction,
                    date_from: dateFrom,
                    date_to: dateTo,
                },
            });

            setAuditLogs(response.data.data || []);
            setTotal(response.data.total || 0);
            setLastPage(response.data.last_page || 1);
        } catch (error) {
            toast({ title: "Error", description: "Failed to fetch audit logs", variant: "destructive" });
        } finally {
            setRefreshing(false);
        }
    };

    const handleViewDetails = async (hashedId: string) => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/audit/${hashedId}`);
            setSelectedLog(response.data.data);
            setShowDetailModal(true);
        } catch (error) {
            toast({ title: "Error", description: "Failed to load audit log details", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleExportToExcel = async () => {
        setLoading(true);
        try {
            const response = await axios.post('/api/audit/export', {
                user_id: filterUser,
                module: filterModule,
                action: filterAction,
                date_from: dateFrom,
                date_to: dateTo,
            });

            const data = response.data.data;
            if (data.length === 0) {
                toast({ title: "No Data", description: "No audit logs to export" });
                return;
            }

            const headers = Object.keys(data[0]);
            const csv = [
                headers.join(','),
                ...data.map((row: Record<string, unknown>) =>
                    headers.map(header => JSON.stringify(row[header] || '')).join(',')
                ),
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = response.data.filename || 'Audit_Log.csv';
            link.click();
            window.URL.revokeObjectURL(url);

            toast({ title: "Success", description: "Audit logs exported successfully" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to export audit logs", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setFilterUser('');
        setFilterModule('');
        setFilterAction('');
        setDateFrom('');
        setDateTo('');
        setPage(1);
    };

    const getActionBadgeVariant = (actionType: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
        const variants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
            CREATE: 'success',
            UPDATE: 'info',
            DELETE: 'error',
            LOGIN: 'info',
            LOGOUT: 'default',
            GATE_IN: 'success',
            GATE_OUT: 'warning',
            VIEW: 'info',
            EXPORT: 'warning',
            PRINT: 'warning',
        };

        return variants[actionType] || 'default';
    };

    return (
        <AuthenticatedLayout>
            <Head title="Audit Trail" />

            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                Audit Trail
                            </h1>
                            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                {total} activity logs recorded
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <ModernButton variant="secondary" onClick={fetchAuditLogs} disabled={refreshing}>
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </ModernButton>
                        <ModernButton variant="primary" onClick={handleExportToExcel} disabled={loading}>
                            <Download className="w-4 h-4" />
                            Export CSV
                        </ModernButton>
                    </div>
                </div>

                {/* Filters Card */}
                <ModernCard 
                    title="Filters" 
                    subtitle="Filter audit logs by user, module, action, and date range"
                    icon={<Filter className="w-5 h-5" />}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <Label className="text-sm font-semibold mb-2">User</Label>
                            <Select value={filterUser || 'all'} onValueChange={(val) => setFilterUser(val === 'all' ? '' : val)}>
                                <SelectTrigger>
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
                            <Label className="text-sm font-semibold mb-2">Module</Label>
                            <Select value={filterModule || 'all'} onValueChange={(val) => setFilterModule(val === 'all' ? '' : val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Modules" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Modules</SelectItem>
                                    {modules.map((module) => (
                                        <SelectItem key={module} value={module}>
                                            {module.charAt(0).toUpperCase() + module.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-sm font-semibold mb-2">Action</Label>
                            <Select value={filterAction || 'all'} onValueChange={(val) => setFilterAction(val === 'all' ? '' : val)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Actions" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Actions</SelectItem>
                                    {actions.map((action) => (
                                        <SelectItem key={action} value={action}>
                                            {action}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="text-sm font-semibold mb-2">Date From</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="h-11"
                            />
                        </div>

                        <div>
                            <Label className="text-sm font-semibold mb-2">Date To</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="h-11"
                            />
                        </div>

                        <div>
                            <Label className="text-sm font-semibold mb-2">Search</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search logs..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-11"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end mt-4">
                        <ModernButton variant="secondary" onClick={handleClearFilters}>
                            <X className="w-4 h-4" />
                            Clear Filters
                        </ModernButton>
                    </div>
                </ModernCard>

                {/* Audit Logs Table */}
                <ModernCard 
                    title="Activity Logs" 
                    subtitle={`Total: ${total} records`}
                    icon={<Activity className="w-5 h-5" />}
                >
                    <ModernTable
                        columns={[
                            {
                                key: 'a_id',
                                label: 'ID',
                                render: (item: AuditLog) => (
                                    <div className="font-mono text-xs" style={{ color: colors.text.secondary }}>
                                        #{item.a_id}
                                    </div>
                                ),
                            },
                            {
                                key: 'date_added',
                                label: 'Date & Time',
                                render: (item: AuditLog) => (
                                    <div className="text-sm">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" style={{ color: colors.text.secondary }} />
                                            <span style={{ color: colors.text.primary }}>
                                                {new Date(item.date_added).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                            {new Date(item.date_added).toLocaleTimeString()}
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'full_name',
                                label: 'User',
                                render: (item: AuditLog) => (
                                    <div>
                                        <div className="flex items-center gap-1">
                                            <User className="w-3 h-3" style={{ color: colors.text.secondary }} />
                                            <span className="font-medium" style={{ color: colors.text.primary }}>
                                                {item.full_name}
                                            </span>
                                        </div>
                                        <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                            @{item.username}
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'module',
                                label: 'Module',
                                render: (item: AuditLog) => (
                                    <ModernBadge variant="default">
                                        {item.module.charAt(0).toUpperCase() + item.module.slice(1)}
                                    </ModernBadge>
                                ),
                            },
                            {
                                key: 'action_type',
                                label: 'Action',
                                render: (item: AuditLog) => (
                                    <ModernBadge variant={getActionBadgeVariant(item.action_type)}>
                                        {item.action_type}
                                    </ModernBadge>
                                ),
                            },
                            {
                                key: 'description',
                                label: 'Description',
                                render: (item: AuditLog) => (
                                    <div className="max-w-md truncate text-sm" style={{ color: colors.text.primary }}>
                                        {item.description}
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
                            {
                                key: 'actions',
                                label: 'Actions',
                                render: (item: AuditLog) => (
                                    <ModernButton 
                                        variant="primary" 
                                        size="sm"
                                        onClick={() => handleViewDetails(item.hashed_id)}
                                    >
                                        <Eye className="w-3 h-3" />
                                    </ModernButton>
                                ),
                            },
                        ]}
                        data={auditLogs}
                        loading={refreshing}
                        emptyMessage="No audit logs found"
                        currentPage={page}
                        totalPages={lastPage}
                        onPageChange={setPage}
                    />
                </ModernCard>
            </div>

            {/* Detail Modal */}
            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded" style={{ backgroundColor: colors.brand.primary + '20' }}>
                                <FileText className="w-5 h-5" style={{ color: colors.brand.primary }} />
                            </div>
                            Audit Log Details
                        </DialogTitle>
                        <DialogDescription>
                            Complete audit entry information
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLog && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-semibold" style={{ color: colors.text.secondary }}>
                                        Audit ID
                                    </Label>
                                    <div className="font-mono text-sm mt-1" style={{ color: colors.text.primary }}>
                                        #{selectedLog.a_id}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold" style={{ color: colors.text.secondary }}>
                                        Date/Time
                                    </Label>
                                    <div className="text-sm mt-1" style={{ color: colors.text.primary }}>
                                        {new Date(selectedLog.date_added).toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold" style={{ color: colors.text.secondary }}>
                                        User
                                    </Label>
                                    <div className="font-medium mt-1" style={{ color: colors.text.primary }}>
                                        {selectedLog.full_name}
                                    </div>
                                    <div className="text-xs" style={{ color: colors.text.secondary }}>
                                        @{selectedLog.username}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold" style={{ color: colors.text.secondary }}>
                                        IP Address
                                    </Label>
                                    <div className="font-mono text-sm mt-1" style={{ color: colors.text.primary }}>
                                        {selectedLog.ip_address}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold mb-2" style={{ color: colors.text.secondary }}>
                                        Module
                                    </Label>
                                    <div className="mt-1">
                                        <ModernBadge variant="default">
                                            {selectedLog.module.charAt(0).toUpperCase() + selectedLog.module.slice(1)}
                                        </ModernBadge>
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold mb-2" style={{ color: colors.text.secondary }}>
                                        Action Type
                                    </Label>
                                    <div className="mt-1">
                                        <ModernBadge variant={getActionBadgeVariant(selectedLog.action_type)}>
                                            {selectedLog.action_type}
                                        </ModernBadge>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2" style={{ color: colors.text.secondary }}>
                                    Description
                                </Label>
                                <div className="mt-2 p-4 rounded-lg" style={{ backgroundColor: colors.table.header + '10', border: `1px solid ${colors.table.border}` }}>
                                    <p style={{ color: colors.text.primary }}>
                                        {selectedLog.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}

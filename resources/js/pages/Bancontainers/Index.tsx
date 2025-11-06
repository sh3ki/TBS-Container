import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ModernButton, ModernCard, ModernTable, ModernBadge, ModernStatCard } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
    Ban,
    Search,
    Plus,
    Edit,
    Trash2,
    Eye,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Shield,
    FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';
import axios from 'axios';

interface BanContainer extends Record<string, unknown> {
    b_id: number;
    container_no: string;
    notes: string;
    date_added: string;
    banned_by?: string;
    is_active: boolean;
    status: string;
}

interface Stats {
    total_banned: number;
    active_bans: number;
    blocked_in_inventory: number;
}

export default function Index() {
    const { toast } = useToast();
    
    const [banContainers, setBanContainers] = useState<BanContainer[]>([]);
    const [filteredContainers, setFilteredContainers] = useState<BanContainer[]>([]);
    const [stats, setStats] = useState<Stats>({ total_banned: 0, active_bans: 0, blocked_in_inventory: 0 });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');

    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [showBulkDialog, setShowBulkDialog] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [viewingBan, setViewingBan] = useState<BanContainer | null>(null);

    const [formData, setFormData] = useState({
        container_no: '',
        notes: '',
    });

    const [bulkFormData, setBulkFormData] = useState({
        container_numbers: '',
        notes: '',
    });

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [searchTerm, statusFilter, banContainers]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [bansResponse, statsResponse] = await Promise.all([
                axios.get('/api/bancontainers'),
                axios.get('/api/bancontainers/stats')
            ]);

            setBanContainers(bansResponse.data.data);
            setStats(statsResponse.data.data);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to load ban containers',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...banContainers];

        if (searchTerm) {
            filtered = filtered.filter(ban =>
                ban.container_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ban.notes.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(ban => ban.status === statusFilter);
        }

        setFilteredContainers(filtered);
    };

    const handleAdd = async () => {
        if (!formData.container_no || formData.container_no.length !== 11) {
            toast({
                title: 'Validation Error',
                description: 'Container number must be exactly 11 characters',
                variant: 'destructive',
            });
            return;
        }

        if (!formData.notes) {
            toast({
                title: 'Validation Error',
                description: 'Please provide a reason for banning this container',
                variant: 'destructive',
            });
            return;
        }

        try {
            await axios.post('/api/bancontainers', formData);
            toast({
                title: 'Success',
                description: `Container ${formData.container_no} added to ban list`,
            });
            setShowAddDialog(false);
            setFormData({ container_no: '', notes: '' });
            loadData();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to add container to ban list',
                variant: 'destructive',
            });
        }
    };

    const handleEdit = async (id: number) => {
        try {
            const response = await axios.get(`/api/bancontainers/${id}`);
            setFormData({
                container_no: response.data.data.container_no,
                notes: response.data.data.notes,
            });
            setEditingId(id);
            setShowEditDialog(true);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to load ban details',
                variant: 'destructive',
            });
        }
    };

    const handleUpdate = async () => {
        if (!formData.notes) {
            toast({
                title: 'Validation Error',
                description: 'Please provide a reason for banning this container',
                variant: 'destructive',
            });
            return;
        }

        try {
            await axios.put(`/api/bancontainers/${editingId}`, { notes: formData.notes });
            toast({
                title: 'Success',
                description: 'Ban record updated successfully',
            });
            setShowEditDialog(false);
            setEditingId(null);
            setFormData({ container_no: '', notes: '' });
            loadData();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to update ban record',
                variant: 'destructive',
            });
        }
    };

    const handleDelete = async (id: number, containerNo: string) => {
        if (!confirm(`Are you sure you want to remove ban for container ${containerNo}?`)) {
            return;
        }

        try {
            await axios.delete(`/api/bancontainers/${id}`);
            toast({
                title: 'Success',
                description: `Container ${containerNo} removed from ban list`,
            });
            loadData();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to remove ban',
                variant: 'destructive',
            });
        }
    };

    const handleView = async (id: number) => {
        try {
            const response = await axios.get(`/api/bancontainers/${id}`);
            setViewingBan(response.data.data);
            setShowViewDialog(true);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to load ban details',
                variant: 'destructive',
            });
        }
    };

    const handleBulkAdd = async () => {
        if (!bulkFormData.container_numbers || !bulkFormData.notes) {
            toast({
                title: 'Validation Error',
                description: 'Please provide container numbers and reason',
                variant: 'destructive',
            });
            return;
        }

        const containerNumbers = bulkFormData.container_numbers
            .split(/[\n,]/)
            .map(c => c.trim())
            .filter(c => c.length === 11);

        if (containerNumbers.length === 0) {
            toast({
                title: 'Validation Error',
                description: 'No valid container numbers found (must be 11 characters each)',
                variant: 'destructive',
            });
            return;
        }

        try {
            const response = await axios.post('/api/bancontainers/bulk-add', {
                container_numbers: containerNumbers,
                notes: bulkFormData.notes,
            });
            toast({
                title: 'Success',
                description: response.data.message,
            });
            setShowBulkDialog(false);
            setBulkFormData({ container_numbers: '', notes: '' });
            loadData();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Bulk add failed',
                variant: 'destructive',
            });
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Ban Containers" />

            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.actions.delete }}>
                            <Ban className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                Banned Containers
                            </h1>
                            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                Manage containers blocked from gate-in operations
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <ModernButton variant="secondary" onClick={() => setShowBulkDialog(true)}>
                            <FileText className="w-4 h-4" />
                            Bulk Add
                        </ModernButton>
                        <ModernButton variant="delete" onClick={() => setShowAddDialog(true)}>
                            <Plus className="w-4 h-4" />
                            Add Ban
                        </ModernButton>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ModernStatCard
                        title="Total Banned"
                        value={stats.total_banned}
                        icon={<Ban className="w-6 h-6" />}
                        iconColor={colors.text.secondary}
                    />
                    <ModernStatCard
                        title="Active Bans"
                        value={stats.active_bans}
                        icon={<Shield className="w-6 h-6" />}
                        iconColor={colors.status.success}
                    />
                    <ModernStatCard
                        title="Blocked in Inventory"
                        value={stats.blocked_in_inventory}
                        icon={<AlertTriangle className="w-6 h-6" />}
                        iconColor={colors.actions.delete}
                    />
                </div>

                {/* Main Table */}
                <ModernCard 
                    title="Banned Containers List" 
                    subtitle={`${filteredContainers.length} container(s) in ban list`}
                >
                    {/* Filters */}
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search container number or reason..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <ModernButton
                                variant={statusFilter === 'all' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setStatusFilter('all')}
                            >
                                All
                            </ModernButton>
                            <ModernButton
                                variant={statusFilter === 'active' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setStatusFilter('active')}
                            >
                                Active
                            </ModernButton>
                            <ModernButton
                                variant={statusFilter === 'blocked' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setStatusFilter('blocked')}
                            >
                                In Inventory
                            </ModernButton>
                        </div>
                    </div>

                    {/* Table */}
                    <ModernTable
                        columns={[
                            {
                                key: 'container_no',
                                label: 'Container No',
                                render: (item: BanContainer) => (
                                    <div className="font-mono font-bold text-lg" style={{ color: colors.actions.delete }}>
                                        {item.container_no}
                                    </div>
                                ),
                            },
                            {
                                key: 'status',
                                label: 'Status',
                                render: (item: BanContainer) => (
                                    <div>
                                        {item.status === 'active' ? (
                                            <ModernBadge 
                                                variant="success"
                                                icon={<CheckCircle className="w-3 h-3" />}
                                            >
                                                Active Ban
                                            </ModernBadge>
                                        ) : (
                                            <ModernBadge 
                                                variant="error"
                                                icon={<XCircle className="w-3 h-3" />}
                                            >
                                                In Inventory
                                            </ModernBadge>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'notes',
                                label: 'Reason',
                                render: (item: BanContainer) => (
                                    <div className="max-w-md truncate" style={{ color: colors.text.primary }}>
                                        {item.notes}
                                    </div>
                                ),
                            },
                            {
                                key: 'date_added',
                                label: 'Banned Date',
                                render: (item: BanContainer) => (
                                    <div className="text-sm" style={{ color: colors.text.secondary }}>
                                        {new Date(item.date_added).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </div>
                                ),
                            },
                            {
                                key: 'banned_by',
                                label: 'Banned By',
                                render: (item: BanContainer) => (
                                    <div className="text-sm" style={{ color: colors.text.primary }}>
                                        {item.banned_by || '-'}
                                    </div>
                                ),
                            },
                            {
                                key: 'actions',
                                label: 'Actions',
                                render: (item: BanContainer) => (
                                    <div className="flex items-center gap-2">
                                        <ModernButton 
                                            variant="secondary" 
                                            size="sm"
                                            onClick={() => handleView(item.b_id)}
                                        >
                                            <Eye className="w-3 h-3" />
                                        </ModernButton>
                                        <ModernButton 
                                            variant="edit" 
                                            size="sm"
                                            onClick={() => handleEdit(item.b_id)}
                                        >
                                            <Edit className="w-3 h-3" />
                                        </ModernButton>
                                        <ModernButton 
                                            variant="delete" 
                                            size="sm"
                                            onClick={() => handleDelete(item.b_id, item.container_no)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </ModernButton>
                                    </div>
                                ),
                            },
                        ]}
                        data={filteredContainers}
                        loading={loading}
                        emptyMessage="No banned containers found"
                    />
                </ModernCard>
            </div>

            {/* Add Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded" style={{ backgroundColor: colors.actions.delete + '20' }}>
                                <Ban className="w-5 h-5" style={{ color: colors.actions.delete }} />
                            </div>
                            Add Banned Container
                        </DialogTitle>
                        <DialogDescription>
                            Add a container to the ban list to prevent gate-in operations
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Container Number <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="ABCD1234567 (11 characters)"
                                value={formData.container_no}
                                onChange={(e) => setFormData({ ...formData, container_no: e.target.value.toUpperCase() })}
                                maxLength={11}
                                className="font-mono"
                            />
                        </div>
                        <div>
                            <Label>Reason <span className="text-red-500">*</span></Label>
                            <Textarea
                                placeholder="Reason for banning this container..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton 
                            variant="secondary" 
                            onClick={() => setShowAddDialog(false)}
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton variant="delete" onClick={handleAdd}>
                            <Plus className="w-4 h-4" />
                            Add to Ban List
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Add Dialog */}
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded" style={{ backgroundColor: colors.brand.primary + '20' }}>
                                <FileText className="w-5 h-5" style={{ color: colors.brand.primary }} />
                            </div>
                            Bulk Add Banned Containers
                        </DialogTitle>
                        <DialogDescription>
                            Add multiple containers to ban list (one per line or comma-separated)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Container Numbers <span className="text-red-500">*</span></Label>
                            <Textarea
                                placeholder="ABCD1234567, EFGH8901234&#10;IJKL2345678&#10;MNOP6789012..."
                                value={bulkFormData.container_numbers}
                                onChange={(e) => setBulkFormData({ ...bulkFormData, container_numbers: e.target.value })}
                                rows={6}
                                className="font-mono"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Enter container numbers separated by commas or new lines. Each must be exactly 11 characters.
                            </p>
                        </div>
                        <div>
                            <Label>Reason <span className="text-red-500">*</span></Label>
                            <Textarea
                                placeholder="Reason for banning these containers..."
                                value={bulkFormData.notes}
                                onChange={(e) => setBulkFormData({ ...bulkFormData, notes: e.target.value })}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton 
                            variant="secondary" 
                            onClick={() => setShowBulkDialog(false)}
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton variant="add" onClick={handleBulkAdd}>
                            <Plus className="w-4 h-4" />
                            Add to Ban List
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded" style={{ backgroundColor: colors.actions.edit + '20' }}>
                                <Edit className="w-5 h-5" style={{ color: colors.actions.edit }} />
                            </div>
                            Edit Ban Record
                        </DialogTitle>
                        <DialogDescription>
                            Update the reason for banning this container
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Container Number</Label>
                            <Input
                                value={formData.container_no}
                                disabled
                                className="bg-gray-100 font-mono"
                            />
                        </div>
                        <div>
                            <Label>Reason <span className="text-red-500">*</span></Label>
                            <Textarea
                                placeholder="Reason for banning this container..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton 
                            variant="secondary" 
                            onClick={() => setShowEditDialog(false)}
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton variant="edit" onClick={handleUpdate}>
                            <Edit className="w-4 h-4" />
                            Update
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Dialog */}
            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded" style={{ backgroundColor: colors.brand.primary + '20' }}>
                                <Eye className="w-5 h-5" style={{ color: colors.brand.primary }} />
                            </div>
                            Ban Details
                        </DialogTitle>
                        <DialogDescription>
                            Complete information about this banned container
                        </DialogDescription>
                    </DialogHeader>
                    {viewingBan && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-gray-600">Container Number</Label>
                                    <div className="font-mono font-bold text-xl mt-1" style={{ color: colors.actions.delete }}>
                                        {viewingBan.container_no}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-gray-600">Status</Label>
                                    <div className="mt-1">
                                        {viewingBan.status === 'active' ? (
                                            <ModernBadge 
                                                variant="success"
                                                icon={<CheckCircle className="w-3 h-3" />}
                                            >
                                                Active Ban
                                            </ModernBadge>
                                        ) : (
                                            <ModernBadge 
                                                variant="error"
                                                icon={<XCircle className="w-3 h-3" />}
                                            >
                                                In Inventory
                                            </ModernBadge>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-gray-600">Banned Date</Label>
                                    <div className="mt-1" style={{ color: colors.text.primary }}>
                                        {new Date(viewingBan.date_added).toLocaleString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-gray-600">Banned By</Label>
                                    <div className="mt-1" style={{ color: colors.text.primary }}>
                                        {viewingBan.banned_by || 'Unknown'}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-gray-600">Reason</Label>
                                <div className="mt-2 p-4 rounded-lg border" style={{ backgroundColor: '#F9FAFB', color: colors.text.primary }}>
                                    {viewingBan.notes}
                                </div>
                            </div>
                            {viewingBan.status === 'blocked' && (
                                <div className="rounded-lg p-4 border-2" style={{ backgroundColor: '#FEF2F2', borderColor: colors.actions.delete }}>
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="w-6 h-6 mt-0.5" style={{ color: colors.actions.delete }} />
                                        <div>
                                            <div className="font-semibold text-lg" style={{ color: colors.actions.delete }}>
                                                Container is in Inventory
                                            </div>
                                            <div className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                                This container is currently in the inventory despite being banned. 
                                                Please investigate and take appropriate action immediately.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <ModernButton 
                            variant="secondary" 
                            onClick={() => setShowViewDialog(false)}
                        >
                            Close
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}

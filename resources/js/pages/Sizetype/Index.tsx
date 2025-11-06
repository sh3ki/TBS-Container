import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ModernButton, ModernCard, ModernTable, ModernBadge, ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
    Package,
    Plus,
    Edit,
    Trash2,
    Eye,
    Power,
    Search
} from 'lucide-react';
import { colors } from '@/lib/colors';
import axios from 'axios';

interface SizeType {
    s_id: number;
    size: string;
    type: string;
    description: string;
    archived: number;
    date_added: string;
    usage_count?: number;
}

interface PageProps {
    auth: {
        user: {
            name: string;
        };
    };
}

export default function Index({ auth }: PageProps) {
    const { toasts, success, error, removeToast } = useModernToast();
    
    const [sizeTypes, setSizeTypes] = useState<SizeType[]>([]);
    const [filteredSizeTypes, setFilteredSizeTypes] = useState<SizeType[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    
    // Dialog states
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showViewDialog, setShowViewDialog] = useState(false);
    
    // Confirmation states
    const [confirmDeleteSizeType, setConfirmDeleteSizeType] = useState(false);
    const [confirmToggleStatus, setConfirmToggleStatus] = useState(false);
    
    // Selected items
    const [sizeTypeToDelete, setSizeTypeToDelete] = useState<SizeType | null>(null);
    const [sizeTypeToToggle, setSizeTypeToToggle] = useState<SizeType | null>(null);
    const [sizeTypeToView, setSizeTypeToView] = useState<SizeType | null>(null);
    
    // Form data
    const [formData, setFormData] = useState({
        size: '',
        type: '',
        description: '',
    });
    
    const [editFormData, setEditFormData] = useState({
        s_id: 0,
        size: '',
        type: '',
        description: '',
    });

    useEffect(() => {
        fetchSizeTypes();
    }, []);

    useEffect(() => {
        filterSizeTypes();
    }, [sizeTypes, searchQuery, statusFilter]);

    const fetchSizeTypes = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/sizetype');
            setSizeTypes(response.data.data);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            error(e.response?.data?.message || 'Failed to load size types');
        } finally {
            setLoading(false);
        }
    };

    const filterSizeTypes = () => {
        let filtered = [...sizeTypes];
        
        // Apply search filter
        if (searchQuery) {
            filtered = filtered.filter(st => 
                st.size.toLowerCase().includes(searchQuery.toLowerCase()) ||
                st.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                st.description.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        
        // Apply status filter
        if (statusFilter === 'active') {
            filtered = filtered.filter(st => st.archived === 0);
        } else if (statusFilter === 'inactive') {
            filtered = filtered.filter(st => st.archived === 1);
        }
        
        setFilteredSizeTypes(filtered);
    };

    const handleAddSizeType = async () => {
        try {
            const response = await axios.post('/api/sizetype', formData);
            if (response.data.success) {
                success('Size & Type added successfully');
                setShowAddDialog(false);
                setFormData({ size: '', type: '', description: '' });
                fetchSizeTypes();
            }
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            error(e.response?.data?.message || 'Failed to add size & type');
        }
    };

    const handleEditSizeType = async () => {
        try {
            const response = await axios.put(`/api/sizetype/${editFormData.s_id}`, {
                size: editFormData.size,
                type: editFormData.type,
                description: editFormData.description,
            });
            if (response.data.success) {
                success('Size & Type updated successfully');
                setShowEditDialog(false);
                fetchSizeTypes();
            }
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            error(e.response?.data?.message || 'Failed to update size & type');
        }
    };

    const handleDeleteSizeType = async () => {
        if (!sizeTypeToDelete) return;
        
        try {
            const response = await axios.delete(`/api/sizetype/${sizeTypeToDelete.s_id}`);
            if (response.data.success) {
                success('Size & Type deleted successfully');
                setSizeTypeToDelete(null);
                setConfirmDeleteSizeType(false);
                fetchSizeTypes();
            }
        } catch (err: unknown) {
            setConfirmDeleteSizeType(false);
            const e = err as { response?: { data?: { message?: string } } };
            error(e.response?.data?.message || 'Failed to delete size & type');
        }
    };

    const handleToggleStatus = async () => {
        if (!sizeTypeToToggle) return;
        
        try {
            const response = await axios.post(`/api/sizetype/${sizeTypeToToggle.s_id}/toggle-status`);
            if (response.data.success) {
                success(`Size & Type ${sizeTypeToToggle.archived === 0 ? 'deactivated' : 'activated'} successfully`);
                setSizeTypeToToggle(null);
                setConfirmToggleStatus(false);
                fetchSizeTypes();
            }
        } catch (err: unknown) {
            setConfirmToggleStatus(false);
            const e = err as { response?: { data?: { message?: string } } };
            error(e.response?.data?.message || 'Failed to toggle status');
        }
    };

    const openEditDialog = (sizeType: SizeType) => {
        setEditFormData({
            s_id: sizeType.s_id,
            size: sizeType.size,
            type: sizeType.type,
            description: sizeType.description,
        });
        setShowEditDialog(true);
    };

    const openViewDialog = (sizeType: SizeType) => {
        setSizeTypeToView(sizeType);
        setShowViewDialog(true);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const columns = [
        { 
            key: 'size', 
            label: 'SIZE',
            render: (value: string) => (
                <span className="font-semibold text-gray-900">{value}</span>
            )
        },
        { 
            key: 'type', 
            label: 'TYPE',
            render: (value: string) => (
                <span className="font-medium text-gray-700">{value}</span>
            )
        },
        { 
            key: 'description', 
            label: 'DESCRIPTION',
            render: (value: string) => (
                <span className="text-gray-600">{value || '-'}</span>
            )
        },
        { 
            key: 'archived', 
            label: 'STATUS',
            render: (value: number) => (
                <ModernBadge variant={value === 0 ? 'success' : 'danger'}>
                    {value === 0 ? 'Active' : 'Inactive'}
                </ModernBadge>
            )
        },
        { 
            key: 'date_added', 
            label: 'DATE CREATED',
            render: (value: string) => (
                <span className="text-gray-600">{formatDate(value)}</span>
            )
        },
    ];

    const actions = [
        {
            icon: Eye,
            label: 'View',
            onClick: (row: SizeType) => openViewDialog(row),
            variant: 'info' as const
        },
        {
            icon: Edit,
            label: 'Edit',
            onClick: (row: SizeType) => openEditDialog(row),
            variant: 'warning' as const
        },
        {
            icon: Power,
            label: (row: SizeType) => row.archived === 0 ? 'Deactivate' : 'Activate',
            onClick: (row: SizeType) => {
                setSizeTypeToToggle(row);
                setConfirmToggleStatus(true);
            },
            variant: 'secondary' as const
        },
        {
            icon: Trash2,
            label: 'Delete',
            onClick: (row: SizeType) => {
                setSizeTypeToDelete(row);
                setConfirmDeleteSizeType(true);
            },
            variant: 'danger' as const
        },
    ];

    return (
        <AuthenticatedLayout
            header={
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-800">Size & Type Management</h2>
                </div>
            }
        >
            <Head title="Size & Type" />
            
            <ModernCard 
                title="Size & Type Management"
                description="Manage container sizes and types"
                icon={Package}
                iconColor={colors.primary.hex}
                action={
                    <ModernButton
                        onClick={() => setShowAddDialog(true)}
                        icon={Plus}
                    >
                        Add New Size & Type
                    </ModernButton>
                }
            >
                <div style={{ 
                    backgroundColor: colors.primary.hex,
                    padding: '1.5rem',
                    borderRadius: '8px',
                    marginBottom: '1.5rem'
                }}>
                    <h3 style={{ color: 'white', fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        Search & Filter Size & Type
                    </h3>
                    <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.875rem' }}>
                        Find size & type combinations quickly
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <Label>Search Size & Type</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <Input
                                type="text"
                                placeholder="Search by size, type, or description..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <Label>Status Filter</Label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-gray-600">
                        <span className="font-semibold">{filteredSizeTypes.length}</span> size & type combinations found
                    </p>
                </div>

                <ModernTable
                    data={filteredSizeTypes}
                    columns={columns}
                    actions={actions}
                    loading={loading}
                />
            </ModernCard>

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Size & Type</DialogTitle>
                        <DialogDescription>
                            Create a new container size and type combination
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="add-size">Size <span className="text-red-500">*</span></Label>
                            <Input
                                id="add-size"
                                type="text"
                                maxLength={2}
                                placeholder="e.g., 20, 40, 45"
                                value={formData.size}
                                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="add-type">Type <span className="text-red-500">*</span></Label>
                            <Input
                                id="add-type"
                                type="text"
                                maxLength={3}
                                placeholder="e.g., GP, HC, OT"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value.toUpperCase() })}
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="add-description">Description (Optional)</Label>
                            <Textarea
                                id="add-description"
                                placeholder="Enter description..."
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={3}
                            />
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <ModernButton
                            variant="secondary"
                            onClick={() => {
                                setShowAddDialog(false);
                                setFormData({ size: '', type: '', description: '' });
                            }}
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton
                            onClick={handleAddSizeType}
                            disabled={!formData.size || !formData.type}
                        >
                            Add Size & Type
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Size & Type</DialogTitle>
                        <DialogDescription>
                            Update container size and type information
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="edit-size">Size <span className="text-red-500">*</span></Label>
                            <Input
                                id="edit-size"
                                type="text"
                                maxLength={2}
                                value={editFormData.size}
                                onChange={(e) => setEditFormData({ ...editFormData, size: e.target.value })}
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="edit-type">Type <span className="text-red-500">*</span></Label>
                            <Input
                                id="edit-type"
                                type="text"
                                maxLength={3}
                                value={editFormData.type}
                                onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value.toUpperCase() })}
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="edit-description">Description (Optional)</Label>
                            <Textarea
                                id="edit-description"
                                value={editFormData.description}
                                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                rows={3}
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
                        <ModernButton
                            onClick={handleEditSizeType}
                            disabled={!editFormData.size || !editFormData.type}
                        >
                            Update Size & Type
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Size & Type Details</DialogTitle>
                        <DialogDescription>
                            View container size and type information
                        </DialogDescription>
                    </DialogHeader>
                    
                    {sizeTypeToView && (
                        <div className="space-y-4">
                            <div>
                                <Label className="text-gray-600">Size</Label>
                                <p className="text-lg font-semibold">{sizeTypeToView.size}</p>
                            </div>
                            
                            <div>
                                <Label className="text-gray-600">Type</Label>
                                <p className="text-lg font-semibold">{sizeTypeToView.type}</p>
                            </div>
                            
                            <div>
                                <Label className="text-gray-600">Description</Label>
                                <p className="text-gray-900">{sizeTypeToView.description || '-'}</p>
                            </div>
                            
                            <div>
                                <Label className="text-gray-600">Status</Label>
                                <div className="mt-1">
                                    <ModernBadge variant={sizeTypeToView.archived === 0 ? 'success' : 'danger'}>
                                        {sizeTypeToView.archived === 0 ? 'Active' : 'Inactive'}
                                    </ModernBadge>
                                </div>
                            </div>
                            
                            <div>
                                <Label className="text-gray-600">Date Created</Label>
                                <p className="text-gray-900">{formatDate(sizeTypeToView.date_added)}</p>
                            </div>
                            
                            {sizeTypeToView.usage_count !== undefined && (
                                <div>
                                    <Label className="text-gray-600">Usage Count</Label>
                                    <p className="text-gray-900">{sizeTypeToView.usage_count} containers</p>
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

            <ModernConfirmDialog
                open={confirmDeleteSizeType}
                onOpenChange={setConfirmDeleteSizeType}
                type="danger"
                title="Delete Size & Type?"
                description={`Are you sure you want to delete "${sizeTypeToDelete?.size}/${sizeTypeToDelete?.type}"? This action cannot be undone.`}
                confirmText="Yes, Delete"
                onConfirm={handleDeleteSizeType}
            />

            <ModernConfirmDialog
                open={confirmToggleStatus}
                onOpenChange={setConfirmToggleStatus}
                type="warning"
                title={`${sizeTypeToToggle?.archived === 0 ? 'Deactivate' : 'Activate'} Size & Type?`}
                description={`Are you sure you want to ${sizeTypeToToggle?.archived === 0 ? 'deactivate' : 'activate'} "${sizeTypeToToggle?.size}/${sizeTypeToToggle?.type}"?`}
                confirmText={`Yes, ${sizeTypeToToggle?.archived === 0 ? 'Deactivate' : 'Activate'}`}
                onConfirm={handleToggleStatus}
            />

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
}

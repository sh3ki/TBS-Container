import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ModernButton, ModernCard, ModernBadge } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, CheckCircle, Search, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';
import axios from 'axios';

// Interfaces matching the new controller
interface PreInventoryRecord {
    hashed_id: string;
    container_no: string;
    client_name: string;
    client_code: string;
    plate_no: string;
    hauler: string;
    gate_status: 'IN' | 'OUT';
    status: 'pending' | 'processed';
    runtime: number; // minutes
    runtime_color: 'green' | 'orange' | 'red';
    date_added: string;
    mr: string; // JSON string with [edit, delete] permissions
}

interface Client {
    c_id: number;
    client_name: string;
    client_code: string;
}

interface PageAccess {
    module_edit: boolean;
    module_delete: boolean;
}

export default function Index() {
    const { toast } = useToast();
    
    // Data States
    const [preInventoryList, setPreInventoryList] = useState<PreInventoryRecord[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [pageAccess, setPageAccess] = useState<PageAccess>({ module_edit: false, module_delete: false });
    
    // UI States
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal States
    const [showAddPreInModal, setShowAddPreInModal] = useState(false);
    const [showAddPreOutModal, setShowAddPreOutModal] = useState(false);
    const [showEditPreInModal, setShowEditPreInModal] = useState(false);
    const [showEditPreOutModal, setShowEditPreOutModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; container: string } | null>(null);
    const [processConfirm, setProcessConfirm] = useState<{ id: string; container: string; type: 'IN' | 'OUT' } | null>(null);
    
    // Form States
    const [preInForm, setPreInForm] = useState({
        container_no: '',
        client_id: '',
        plate_no: '',
        hauler: ''
    });
    
    const [preOutForm, setPreOutForm] = useState({
        container_no: '',
        plate_no: '',
        hauler: ''
    });
    
    const [editPreInForm, setEditPreInForm] = useState({
        id: '',
        container_no: '',
        client_id: '',
        plate_no: '',
        hauler: ''
    });
    
    const [editPreOutForm, setEditPreOutForm] = useState({
        id: '',
        container_no: '',
        plate_no: '',
        hauler: ''
    });

    // ============================================
    // DATA FETCHING
    // ============================================
    
    useEffect(() => {
        loadPreInventoryList();
        loadClients();
        loadPageAccess();
    }, []);

    const loadPreInventoryList = async () => {
        try {
            setLoading(true);
            const response = await axios.post('/api/gateinout/list', {
                search: searchTerm
            });
            
            if (response.data.success) {
                setPreInventoryList(response.data.prelist || []);
            } else {
                setPreInventoryList([]);
            }
        } catch (error: any) {
            console.error('Error loading pre-inventory list:', error);
            setPreInventoryList([]);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to load list'
            });
        } finally {
            setLoading(false);
        }
    };

    const loadClients = async () => {
        try {
            const response = await axios.get('/api/gateinout/clients');
            if (response.data.success) {
                setClients(response.data.clients || []);
            } else {
                setClients([]);
            }
        } catch (error) {
            console.error('Error loading clients:', error);
            setClients([]);
        }
    };

    const loadPageAccess = async () => {
        try {
            const response = await axios.get('/api/gateinout/page-record-access');
            if (response.data.success) {
                setPageAccess({
                    module_edit: response.data.module_edit || false,
                    module_delete: response.data.module_delete || false
                });
            } else {
                setPageAccess({ module_edit: false, module_delete: false });
            }
        } catch (error) {
            console.error('Error loading page access:', error);
            setPageAccess({ module_edit: false, module_delete: false });
        }
    };

    // ============================================
    // SEARCH HANDLING
    // ============================================
    
    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            loadPreInventoryList();
        }, 500);
        
        return () => clearTimeout(delayDebounce);
    }, [searchTerm]);

    // ============================================
    // ADD PRE-IN
    // ============================================
    
    const handleAddPreIn = async () => {
        if (!preInForm.container_no || !preInForm.client_id) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Container No. and Client are required'
            });
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post('/api/gateinout/check-container-in', preInForm);
            
            if (response.data.success) {
                toast({
                    title: 'Success',
                    description: 'Pre-IN added successfully'
                });
                setShowAddPreInModal(false);
                setPreInForm({ container_no: '', client_id: '', plate_no: '', hauler: '' });
                loadPreInventoryList();
            }
        } catch (error: any) {
            console.error('Error adding pre-in:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to add Pre-IN'
            });
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // ADD PRE-OUT
    // ============================================
    
    const handleAddPreOut = async () => {
        if (!preOutForm.container_no) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Container No. is required'
            });
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post('/api/gateinout/check-container-out', preOutForm);
            
            if (response.data.success) {
                toast({
                    title: 'Success',
                    description: 'Pre-OUT added successfully'
                });
                setShowAddPreOutModal(false);
                setPreOutForm({ container_no: '', plate_no: '', hauler: '' });
                loadPreInventoryList();
            }
        } catch (error: any) {
            console.error('Error adding pre-out:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to add Pre-OUT'
            });
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // EDIT PRE-IN
    // ============================================
    
    const handleEditPreInClick = async (record: PreInventoryRecord) => {
        try {
            setLoading(true);
            const response = await axios.post('/api/gateinout/get-prein-details', { id: record.hashed_id });
            
            if (response.data.success) {
                const data = response.data.data;
                setEditPreInForm({
                    id: record.hashed_id,
                    container_no: data.container_no,
                    client_id: data.client_id.toString(),
                    plate_no: data.plate_no || '',
                    hauler: data.hauler || ''
                });
                setShowEditPreInModal(true);
            }
        } catch (error: any) {
            console.error('Error loading pre-in details:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to load details'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePreIn = async () => {
        if (!editPreInForm.container_no || !editPreInForm.client_id) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Container No. and Client are required'
            });
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post('/api/gateinout/update-prein', editPreInForm);
            
            if (response.data.success) {
                toast({
                    title: 'Success',
                    description: 'Pre-IN updated successfully'
                });
                setShowEditPreInModal(false);
                loadPreInventoryList();
            }
        } catch (error: any) {
            console.error('Error updating pre-in:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to update Pre-IN'
            });
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // EDIT PRE-OUT
    // ============================================
    
    const handleEditPreOutClick = async (record: PreInventoryRecord) => {
        try {
            setLoading(true);
            const response = await axios.post('/api/gateinout/get-preout-details', { id: record.hashed_id });
            
            if (response.data.success) {
                const data = response.data.data;
                setEditPreOutForm({
                    id: record.hashed_id,
                    container_no: data.container_no,
                    plate_no: data.plate_no || '',
                    hauler: data.hauler || ''
                });
                setShowEditPreOutModal(true);
            }
        } catch (error: any) {
            console.error('Error loading pre-out details:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to load details'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePreOut = async () => {
        try {
            setLoading(true);
            const response = await axios.post('/api/gateinout/update-preout', editPreOutForm);
            
            if (response.data.success) {
                toast({
                    title: 'Success',
                    description: 'Pre-OUT updated successfully'
                });
                setShowEditPreOutModal(false);
                loadPreInventoryList();
            }
        } catch (error: any) {
            console.error('Error updating pre-out:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to update Pre-OUT'
            });
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // DELETE
    // ============================================
    
    const handleDelete = async () => {
        if (!deleteConfirm) return;

        try {
            setLoading(true);
            const response = await axios.post('/api/gateinout/delete-pre', { id: deleteConfirm.id });
            
            if (response.data.success) {
                toast({
                    title: 'Success',
                    description: 'Record deleted successfully'
                });
                setDeleteConfirm(null);
                loadPreInventoryList();
            }
        } catch (error: any) {
            console.error('Error deleting record:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to delete record'
            });
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // PROCESS (APPROVE)
    // ============================================
    
    const handleProcess = async () => {
        if (!processConfirm) return;

        try {
            setLoading(true);
            const endpoint = processConfirm.type === 'IN' 
                ? '/api/gateinout/process-prein' 
                : '/api/gateinout/process-preout';
            
            const response = await axios.post(endpoint, { id: processConfirm.id });
            
            if (response.data.success) {
                toast({
                    title: 'Success',
                    description: `Gate-${processConfirm.type} processed successfully`
                });
                setProcessConfirm(null);
                loadPreInventoryList();
            }
        } catch (error: any) {
            console.error('Error processing record:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to process record'
            });
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // ADD PRE-IN HANDLERS
    // ============================================
    
    const handleAddPreIn = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Step 1: Validate container number length (11 chars)
        if (preInForm.container_no.length !== 11) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Container number should be 11 characters length!'
            });
            return;
        }
        
        // Step 2: Validate client selected
        if (!preInForm.client_id) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Please select a client'
            });
            return;
        }
        
        setLoading(true);
        
        try {
            // Step 3: Send to backend for validation and insertion
            const response = await axios.post('/api/gateinout/check-in', {
                cno: preInForm.container_no.toUpperCase(),
                client: preInForm.client_id
            });
            
            // Step 4: Check backend response
            if (response.data.message) {
                const [type, msg] = response.data.message;
                
                if (type === 'success') {
                    // Success - reload list and close modal
                    toast({
                        variant: 'default',
                        title: 'Success',
                        description: 'Pre-In has been added successfully!'
                    });
                    setShowAddPreInModal(false);
                    setPreInForm({ container_no: '', client_id: '', plate_no: '', hauler: '' });
                    loadPreInventoryList();
                } else {
                    // Validation failed (already in, banned, etc.)
                    toast({
                        variant: 'destructive',
                        title: 'Validation Failed',
                        description: msg.replace(/<[^>]*>/g, '') // Strip HTML tags
                    });
                }
            }
        } catch (error: any) {
            console.error('Error adding Pre-In:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to add Pre-In record'
            });
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // ADD PRE-OUT HANDLERS
    // ============================================
    
    const handleAddPreOut = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Step 1: Validate plate number not empty
        if (!preOutForm.plate_no.trim()) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Plate number is required!'
            });
            return;
        }
        
        // Step 2: Validate hauler not empty
        if (!preOutForm.hauler.trim()) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Hauler is required!'
            });
            return;
        }
        
        setLoading(true);
        
        try {
            // Step 3: Send to backend for insertion
            const response = await axios.post('/api/gateinout/check-out', {
                pno: preOutForm.plate_no,
                hauler: preOutForm.hauler
            });
            
            // Step 4: Check backend response
            if (response.data.message) {
                const [type, msg] = response.data.message;
                
                if (type === 'success') {
                    // Success - reload list and close modal
                    toast({
                        variant: 'default',
                        title: 'Success',
                        description: 'Pre-Out has been added successfully!'
                    });
                    setShowAddPreOutModal(false);
                    setPreOutForm({ container_no: '', plate_no: '', hauler: '' });
                    loadPreInventoryList();
                } else {
                    // Validation failed
                    toast({
                        variant: 'destructive',
                        title: 'Validation Failed',
                        description: msg.replace(/<[^>]*>/g, '') // Strip HTML tags
                    });
                }
            }
        } catch (error: any) {
            console.error('Error adding Pre-Out:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.response?.data?.message || 'Failed to add Pre-Out record'
            });
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // PERMISSION HELPERS
    // ============================================
    
    const canEdit = (record: PreInventoryRecord): boolean => {
        try {
            const mr = JSON.parse(record.mr);
            return mr[0] === '1' && pageAccess.module_edit;
        } catch {
            return false;
        }
    };

    const canDelete = (record: PreInventoryRecord): boolean => {
        try {
            const mr = JSON.parse(record.mr);
            return mr[1] === '1' && pageAccess.module_delete;
        } catch {
            return false;
        }
    };

    // ============================================
    // RENDER
    // ============================================
    
    return (
        <AuthenticatedLayout header="Gate In & Out">
            <Head title="Gate In & Out" />

            <ModernCard>
                {/* Header with Add Pre In/Out Buttons */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold" style={{ color: colors.text.primary }}>
                            Pre-Gate List
                        </h2>
                        <p className="text-sm" style={{ color: colors.text.secondary }}>
                            Manage pre-gate records and process approvals
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <ModernButton 
                            variant="add" 
                            onClick={() => setShowAddPreInModal(true)}
                        >
                            <Plus className="w-4 h-4" />
                            Add Pre In
                        </ModernButton>
                        <ModernButton 
                            variant="delete" 
                            onClick={() => setShowAddPreOutModal(true)}
                        >
                            <Plus className="w-4 h-4" />
                            Add Pre Out
                        </ModernButton>
                    </div>
                </div>

                {/* Search Box */}
                <div className="mb-6">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: colors.text.secondary }} />
                        <Input
                            type="text"
                            placeholder="Search by container or plate no..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Main Table */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: colors.text.primary }}>ContainerNo</th>
                                <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: colors.text.primary }}>Client Name</th>
                                <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: colors.text.primary }}>PlateNo</th>
                                <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: colors.text.primary }}>Hauler</th>
                                <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: colors.text.primary }}>GateStatus</th>
                                <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: colors.text.primary }}>Status</th>
                                <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: colors.text.primary }}>RunTime</th>
                                <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: colors.text.primary }}>Date Created</th>
                                <th className="text-left py-3 px-4 font-semibold text-sm" style={{ color: colors.text.primary }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && preInventoryList.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-8">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                                            <span style={{ color: colors.text.secondary }}>Loading...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : preInventoryList.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-8">
                                        <AlertCircle className="w-12 h-12 mx-auto mb-2" style={{ color: colors.text.secondary }} />
                                        <p style={{ color: colors.text.secondary }}>No records found</p>
                                    </td>
                                </tr>
                            ) : (
                                preInventoryList.map((record) => (
                                    <tr key={record.hashed_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                        <td className="py-3 px-4">
                                            <span className="font-mono font-medium" style={{ color: colors.text.primary }}>
                                                {record.container_no}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="text-sm text-gray-900">
                                                <div className="font-medium">{record.client_name}</div>
                                                <div className="text-xs text-gray-500">{record.client_code}</div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">{record.plate_no}</td>
                                        <td className="py-3 px-4">{record.hauler}</td>
                                        <td className="py-3 px-4">
                                            <ModernBadge variant={record.gate_status === 'IN' ? 'success' : 'error'}>
                                                {record.gate_status}
                                            </ModernBadge>
                                        </td>
                                        <td className="py-3 px-4">
                                            <ModernBadge variant={record.status === 'pending' ? 'warning' : 'default'}>
                                                {record.status.toUpperCase()}
                                            </ModernBadge>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span 
                                                className="font-semibold"
                                                style={{ 
                                                    color: record.runtime_color === 'green' ? '#10b981' : 
                                                           record.runtime_color === 'orange' ? '#f59e0b' : '#ef4444'
                                                }}
                                            >
                                                {record.runtime} min
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="text-sm" style={{ color: colors.text.secondary }}>
                                                {new Date(record.date_added).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: true
                                                })}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                {/* Process Button (Green) - Only for pending records */}
                                                {record.status === 'pending' && (
                                                    <ModernButton
                                                        variant="add"
                                                        size="sm"
                                                        onClick={() => setProcessConfirm({
                                                            id: record.hashed_id,
                                                            container: record.container_no,
                                                            type: record.gate_status
                                                        })}
                                                    >
                                                        <CheckCircle className="w-3 h-3" />
                                                        Process
                                                    </ModernButton>
                                                )}
                                                
                                                {/* Edit Button - Only if has permission */}
                                                {canEdit(record) && (
                                                    <ModernButton
                                                        variant="edit"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (record.gate_status === 'IN') {
                                                                handleEditPreInClick(record);
                                                            } else {
                                                                handleEditPreOutClick(record);
                                                            }
                                                        }}
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                    </ModernButton>
                                                )}
                                                
                                                {/* Delete Button - Only if has permission */}
                                                {canDelete(record) && (
                                                    <ModernButton
                                                        variant="delete"
                                                        size="sm"
                                                        onClick={() => setDeleteConfirm({
                                                            id: record.hashed_id,
                                                            container: record.container_no
                                                        })}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </ModernButton>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </ModernCard>

            {/* ============================================ */}
            {/* ADD PRE-IN MODAL */}
            {/* ============================================ */}
            <Dialog open={showAddPreInModal} onOpenChange={setShowAddPreInModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Pre In</DialogTitle>
                        <DialogDescription>
                            Register a new container for gate-in approval
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label>Client <span className="text-red-500">*</span></Label>
                            <Select 
                                value={preInForm.client_id} 
                                onValueChange={(value) => setPreInForm({ ...preInForm, client_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((client) => (
                                        <SelectItem key={client.c_id} value={client.c_id.toString()}>
                                            {client.client_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Container No. <span className="text-red-500">*</span></Label>
                            <Input
                                value={preInForm.container_no}
                                onChange={(e) => setPreInForm({ ...preInForm, container_no: e.target.value.toUpperCase() })}
                                placeholder="ABCD1234567"
                                maxLength={11}
                            />
                            <p className="text-xs text-gray-500 mt-1">Must be exactly 11 characters</p>
                        </div>
                        <div>
                            <Label>Plate No.</Label>
                            <Input
                                value={preInForm.plate_no}
                                onChange={(e) => setPreInForm({ ...preInForm, plate_no: e.target.value })}
                                placeholder="ABC-1234"
                            />
                        </div>
                        <div>
                            <Label>Hauler</Label>
                            <Input
                                value={preInForm.hauler}
                                onChange={(e) => setPreInForm({ ...preInForm, hauler: e.target.value })}
                                placeholder="Hauler name"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setShowAddPreInModal(false)}>
                            Cancel
                        </ModernButton>
                        <ModernButton variant="add" onClick={handleAddPreIn} disabled={loading}>
                            <Plus className="w-4 h-4" />
                            Add Pre In
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ============================================ */}
            {/* ADD PRE-OUT MODAL */}
            {/* ============================================ */}
            <Dialog open={showAddPreOutModal} onOpenChange={setShowAddPreOutModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Pre Out</DialogTitle>
                        <DialogDescription>
                            Register a container for gate-out approval
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label>Container No. <span className="text-red-500">*</span></Label>
                            <Input
                                value={preOutForm.container_no}
                                onChange={(e) => setPreOutForm({ ...preOutForm, container_no: e.target.value.toUpperCase() })}
                                placeholder="ABCD1234567"
                            />
                            <p className="text-xs text-gray-500 mt-1">Container must be in yard</p>
                        </div>
                        <div>
                            <Label>Plate No.</Label>
                            <Input
                                value={preOutForm.plate_no}
                                onChange={(e) => setPreOutForm({ ...preOutForm, plate_no: e.target.value })}
                                placeholder="ABC-1234"
                            />
                        </div>
                        <div>
                            <Label>Hauler</Label>
                            <Input
                                value={preOutForm.hauler}
                                onChange={(e) => setPreOutForm({ ...preOutForm, hauler: e.target.value })}
                                placeholder="Hauler name"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setShowAddPreOutModal(false)}>
                            Cancel
                        </ModernButton>
                        <ModernButton variant="delete" onClick={handleAddPreOut} disabled={loading}>
                            <Plus className="w-4 h-4" />
                            Add Pre Out
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ============================================ */}
            {/* EDIT PRE-IN MODAL */}
            {/* ============================================ */}
            <Dialog open={showEditPreInModal} onOpenChange={setShowEditPreInModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Pre In</DialogTitle>
                        <DialogDescription>
                            Update Pre-IN record details
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label>Client <span className="text-red-500">*</span></Label>
                            <Select 
                                value={editPreInForm.client_id} 
                                onValueChange={(value) => setEditPreInForm({ ...editPreInForm, client_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((client) => (
                                        <SelectItem key={client.c_id} value={client.c_id.toString()}>
                                            {client.client_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Container No. <span className="text-red-500">*</span></Label>
                            <Input
                                value={editPreInForm.container_no}
                                onChange={(e) => setEditPreInForm({ ...editPreInForm, container_no: e.target.value.toUpperCase() })}
                                maxLength={11}
                            />
                        </div>
                        <div>
                            <Label>Plate No.</Label>
                            <Input
                                value={editPreInForm.plate_no}
                                onChange={(e) => setEditPreInForm({ ...editPreInForm, plate_no: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Hauler</Label>
                            <Input
                                value={editPreInForm.hauler}
                                onChange={(e) => setEditPreInForm({ ...editPreInForm, hauler: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setShowEditPreInModal(false)}>
                            Cancel
                        </ModernButton>
                        <ModernButton variant="edit" onClick={handleUpdatePreIn} disabled={loading}>
                            <Edit className="w-4 h-4" />
                            Update
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ============================================ */}
            {/* EDIT PRE-OUT MODAL */}
            {/* ============================================ */}
            <Dialog open={showEditPreOutModal} onOpenChange={setShowEditPreOutModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Pre Out</DialogTitle>
                        <DialogDescription>
                            Update Pre-OUT record details
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label>Container No.</Label>
                            <Input
                                value={editPreOutForm.container_no}
                                disabled
                                className="bg-gray-100"
                            />
                            <p className="text-xs text-gray-500 mt-1">Container No. cannot be changed for Pre-OUT</p>
                        </div>
                        <div>
                            <Label>Plate No.</Label>
                            <Input
                                value={editPreOutForm.plate_no}
                                onChange={(e) => setEditPreOutForm({ ...editPreOutForm, plate_no: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Hauler</Label>
                            <Input
                                value={editPreOutForm.hauler}
                                onChange={(e) => setEditPreOutForm({ ...editPreOutForm, hauler: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setShowEditPreOutModal(false)}>
                            Cancel
                        </ModernButton>
                        <ModernButton variant="edit" onClick={handleUpdatePreOut} disabled={loading}>
                            <Edit className="w-4 h-4" />
                            Update
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ============================================ */}
            {/* DELETE CONFIRMATION MODAL */}
            {/* ============================================ */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete record for container <strong>{deleteConfirm?.container}</strong>?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setDeleteConfirm(null)}>
                            Cancel
                        </ModernButton>
                        <ModernButton variant="delete" onClick={handleDelete} disabled={loading}>
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ============================================ */}
            {/* PROCESS CONFIRMATION MODAL */}
            {/* ============================================ */}
            <Dialog open={!!processConfirm} onOpenChange={() => setProcessConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Process</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to process Gate-{processConfirm?.type} for container <strong>{processConfirm?.container}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setProcessConfirm(null)}>
                            Cancel
                        </ModernButton>
                        <ModernButton variant="add" onClick={handleProcess} disabled={loading}>
                            <CheckCircle className="w-4 h-4" />
                            Process
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}

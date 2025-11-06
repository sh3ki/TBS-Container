import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ModernButton, ModernCard, ModernTable, ModernBadge } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
    LogIn, 
    LogOut, 
    Plus, 
    Trash2, 
    CheckCircle, 
    RefreshCw, 
    Search,
    AlertCircle,
    Truck,
    User,
    Lock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';
import axios from 'axios';

interface PreInRecord extends Record<string, unknown> {
    hashed_id: string;
    container_no: string;
    client_name: string;
    size: string;
    type: string;
    cnt_class: string;
    plate_no: string;
    hauler: string;
    remarks: string;
    full_name: string;
    date_added: string;
    is_banned?: boolean;
    ban_notes?: string;
}

interface PreOutRecord extends Record<string, unknown> {
    hashed_id: string;
    container_no: string;
    client_name: string;
    size: string;
    type: string;
    plate_no: string;
    remarks: string;
    full_name: string;
    date_added: string;
    is_on_hold?: boolean;
    hold_notes?: string;
}

interface Client {
    c_id: number;
    client_name: string;
    client_code: string;
}

interface SizeType {
    s_id: number;
    size: string;
    type: string;
    description: string;
}

interface Container {
    container_no: string;
    client_name: string;
    size: string;
    type: string;
}

export default function Index() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('pre-in');
    
    const [preInList, setPreInList] = useState<PreInRecord[]>([]);
    const [preOutList, setPreOutList] = useState<PreOutRecord[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [sizeTypes, setSizeTypes] = useState<SizeType[]>([]);
    const [containersInYard, setContainersInYard] = useState<Container[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [page, setPage] = useState(0);
    const [pageSize] = useState(25);
    const [totalRecords, setTotalRecords] = useState(0);
    
    const [showPreInModal, setShowPreInModal] = useState(false);
    const [showPreOutModal, setShowPreOutModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'pre-in' | 'pre-out'; id: string } | null>(null);
    const [approveConfirm, setApproveConfirm] = useState<{ type: 'gate-in' | 'gate-out'; id: string; container: string } | null>(null);
    
    const [preInForm, setPreInForm] = useState({
        container_no: '',
        client_id: '',
        size_type: '',
        cnt_class: 'E',
        plate_no: '',
        hauler: '',
        remarks: '',
    });
    
    const [preOutForm, setPreOutForm] = useState({
        container_no: '',
        plate_no: '',
        remarks: '',
    });

    useEffect(() => {
        fetchClients();
        fetchSizeTypes();
        fetchContainersInYard();
    }, []);

    useEffect(() => {
        if (activeTab === 'pre-in' || activeTab === 'gate-in') {
            fetchPreInList();
        } else if (activeTab === 'pre-out' || activeTab === 'gate-out') {
            fetchPreOutList();
        }
    }, [activeTab, page, searchTerm]);

    const fetchClients = async () => {
        try {
            const response = await axios.get('/api/gateinout/clients');
            setClients(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch clients:', error);
        }
    };

    const fetchSizeTypes = async () => {
        try {
            const response = await axios.get('/api/gateinout/size-types');
            setSizeTypes(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch size types:', error);
        }
    };

    const fetchContainersInYard = async () => {
        try {
            const response = await axios.get('/api/gateinout/containers-in-yard');
            setContainersInYard(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch containers:', error);
        }
    };

    const fetchPreInList = async () => {
        setRefreshing(true);
        try {
            const response = await axios.post('/api/gateinout/pre-in/list', {
                start: page * pageSize,
                length: pageSize,
                search: searchTerm,
            });
            setPreInList(response.data.data || []);
            setTotalRecords(response.data.total || 0);
        } catch (error) {
            toast({ title: "Error", description: "Failed to fetch pre-in list", variant: "destructive" });
        } finally {
            setRefreshing(false);
        }
    };

    const fetchPreOutList = async () => {
        setRefreshing(true);
        try {
            const response = await axios.post('/api/gateinout/pre-out/list', {
                start: page * pageSize,
                length: pageSize,
            });
            setPreOutList(response.data.data || []);
            setTotalRecords(response.data.total || 0);
        } catch (error) {
            toast({ title: "Error", description: "Failed to fetch pre-out list", variant: "destructive" });
        } finally {
            setRefreshing(false);
        }
    };

    const handleAddPreIn = async () => {
        if (!preInForm.container_no || !preInForm.client_id || !preInForm.size_type) {
            toast({ title: "Error", description: "Container No, Client, and Size/Type are required", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('/api/gateinout/pre-in', preInForm);
            toast({ title: "Success", description: response.data.message });
            if (response.data.warning) {
                toast({ title: "Warning", description: response.data.warning, variant: "destructive" });
            }
            setShowPreInModal(false);
            setPreInForm({
                container_no: '',
                client_id: '',
                size_type: '',
                cnt_class: 'E',
                plate_no: '',
                hauler: '',
                remarks: '',
            });
            fetchPreInList();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({ title: "Error", description: err.response?.data?.message || 'Failed to add pre-in record', variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleAddPreOut = async () => {
        if (!preOutForm.container_no || !preOutForm.plate_no) {
            toast({ title: "Error", description: "Container No and Plate No are required", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('/api/gateinout/pre-out', preOutForm);
            toast({ title: "Success", description: response.data.message });
            if (response.data.warning) {
                toast({ title: "Warning", description: response.data.warning, variant: "destructive" });
            }
            setShowPreOutModal(false);
            setPreOutForm({
                container_no: '',
                plate_no: '',
                remarks: '',
            });
            fetchPreOutList();
            fetchContainersInYard();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({ title: "Error", description: err.response?.data?.message || 'Failed to add pre-out record', variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePreIn = async (hashedId: string) => {
        setLoading(true);
        try {
            await axios.delete(`/api/gateinout/pre-in/${hashedId}`);
            toast({ title: "Success", description: "Pre-In record deleted successfully" });
            setDeleteConfirm(null);
            fetchPreInList();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({ title: "Error", description: err.response?.data?.message || 'Failed to delete record', variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePreOut = async (hashedId: string) => {
        setLoading(true);
        try {
            await axios.delete(`/api/gateinout/pre-out/${hashedId}`);
            toast({ title: "Success", description: "Pre-Out record deleted successfully" });
            setDeleteConfirm(null);
            fetchPreOutList();
            fetchContainersInYard();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({ title: "Error", description: err.response?.data?.message || 'Failed to delete record', variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleApproveGateIn = async (hashedId: string) => {
        setLoading(true);
        try {
            const response = await axios.post(`/api/gateinout/gate-in/approve/${hashedId}`);
            toast({ title: "Success", description: response.data.message });
            setApproveConfirm(null);
            fetchPreInList();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({ title: "Error", description: err.response?.data?.message || 'Failed to approve gate-in', variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleApproveGateOut = async (hashedId: string) => {
        setLoading(true);
        try {
            const response = await axios.post(`/api/gateinout/gate-out/approve/${hashedId}`);
            toast({ title: "Success", description: response.data.message });
            setApproveConfirm(null);
            fetchPreOutList();
            fetchContainersInYard();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({ title: "Error", description: err.response?.data?.message || 'Failed to approve gate-out', variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Gate In & Out Operations" />

            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                        <LogIn className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                            Gate In & Out Operations
                        </h1>
                        <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                            Manage container movements in and out of the yard
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b">
                    <button
                        onClick={() => { setActiveTab('pre-in'); setPage(0); setSearchTerm(''); }}
                        className={`px-6 py-3 font-semibold transition-colors ${
                            activeTab === 'pre-in'
                                ? 'border-b-2 text-white'
                                : 'text-gray-600 hover:text-gray-800'
                        }`}
                        style={activeTab === 'pre-in' ? { borderColor: colors.brand.primary, color: colors.brand.primary } : {}}
                    >
                        <div className="flex items-center gap-2">
                            <LogIn className="w-4 h-4" />
                            PRE-IN (Guards)
                        </div>
                    </button>
                    <button
                        onClick={() => { setActiveTab('pre-out'); setPage(0); setSearchTerm(''); }}
                        className={`px-6 py-3 font-semibold transition-colors ${
                            activeTab === 'pre-out'
                                ? 'border-b-2 text-white'
                                : 'text-gray-600 hover:text-gray-800'
                        }`}
                        style={activeTab === 'pre-out' ? { borderColor: colors.brand.primary, color: colors.brand.primary } : {}}
                    >
                        <div className="flex items-center gap-2">
                            <LogOut className="w-4 h-4" />
                            PRE-OUT (Guards)
                        </div>
                    </button>
                    <button
                        onClick={() => { setActiveTab('gate-in'); setPage(0); setSearchTerm(''); }}
                        className={`px-6 py-3 font-semibold transition-colors ${
                            activeTab === 'gate-in'
                                ? 'border-b-2 text-white'
                                : 'text-gray-600 hover:text-gray-800'
                        }`}
                        style={activeTab === 'gate-in' ? { borderColor: colors.brand.primary, color: colors.brand.primary } : {}}
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            GATE-IN (Checkers)
                        </div>
                    </button>
                    <button
                        onClick={() => { setActiveTab('gate-out'); setPage(0); setSearchTerm(''); }}
                        className={`px-6 py-3 font-semibold transition-colors ${
                            activeTab === 'gate-out'
                                ? 'border-b-2 text-white'
                                : 'text-gray-600 hover:text-gray-800'
                        }`}
                        style={activeTab === 'gate-out' ? { borderColor: colors.brand.primary, color: colors.brand.primary } : {}}
                    >
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            GATE-OUT (Checkers)
                        </div>
                    </button>
                </div>

                {/* PRE-IN Tab */}
                {activeTab === 'pre-in' && (
                    <div className="space-y-4">
                        <ModernCard>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <Input
                                        placeholder="Search container number..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="max-w-md h-11"
                                    />
                                    <ModernButton variant="secondary" onClick={fetchPreInList} disabled={refreshing}>
                                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                    </ModernButton>
                                </div>
                                <ModernButton variant="add" onClick={() => setShowPreInModal(true)}>
                                    <Plus className="w-4 h-4" />
                                    Add Pre-In
                                </ModernButton>
                            </div>
                        </ModernCard>

                        <ModernCard title="Pre-In Records" subtitle={`${preInList.length} pending entries`}>
                            <ModernTable
                                columns={[
                                    {
                                        key: 'container_no',
                                        label: 'Container',
                                        render: (item: PreInRecord) => (
                                            <div>
                                                <div className="font-bold" style={{ color: colors.text.primary }}>
                                                    {item.container_no}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <ModernBadge variant={item.cnt_class === 'F' ? 'warning' : 'default'}>
                                                        {item.cnt_class === 'F' ? 'Full' : 'Empty'}
                                                    </ModernBadge>
                                                    {item.is_banned && (
                                                        <ModernBadge variant="error" icon={<AlertCircle className="w-3 h-3" />}>
                                                            BANNED
                                                        </ModernBadge>
                                                    )}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'client_name',
                                        label: 'Client & Details',
                                        render: (item: PreInRecord) => (
                                            <div>
                                                <div className="font-medium" style={{ color: colors.text.primary }}>
                                                    {item.client_name}
                                                </div>
                                                <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                                    {item.size}" {item.type}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'plate_no',
                                        label: 'Transport',
                                        render: (item: PreInRecord) => (
                                            <div className="text-sm">
                                                {item.plate_no && (
                                                    <div className="flex items-center gap-1 mb-1">
                                                        <Truck className="w-3 h-3" style={{ color: colors.text.secondary }} />
                                                        <span style={{ color: colors.text.primary }}>{item.plate_no}</span>
                                                    </div>
                                                )}
                                                {item.hauler && (
                                                    <div className="text-xs" style={{ color: colors.text.secondary }}>
                                                        {item.hauler}
                                                    </div>
                                                )}
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'full_name',
                                        label: 'Created By',
                                        render: (item: PreInRecord) => (
                                            <div>
                                                <div className="flex items-center gap-1">
                                                    <User className="w-3 h-3" style={{ color: colors.text.secondary }} />
                                                    <span className="text-sm" style={{ color: colors.text.primary }}>
                                                        {item.full_name}
                                                    </span>
                                                </div>
                                                <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                                    {new Date(item.date_added).toLocaleString()}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'actions',
                                        label: 'Actions',
                                        render: (item: PreInRecord) => (
                                            <ModernButton
                                                variant="delete"
                                                size="sm"
                                                onClick={() => setDeleteConfirm({ type: 'pre-in', id: item.hashed_id })}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </ModernButton>
                                        ),
                                    },
                                ]}
                                data={preInList}
                                loading={refreshing}
                                emptyMessage="No pre-in records found"
                            />
                        </ModernCard>
                    </div>
                )}

                {/* PRE-OUT Tab */}
                {activeTab === 'pre-out' && (
                    <div className="space-y-4">
                        <ModernCard>
                            <div className="flex items-center justify-between">
                                <ModernButton variant="secondary" onClick={fetchPreOutList} disabled={refreshing}>
                                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                    Refresh
                                </ModernButton>
                                <ModernButton variant="add" onClick={() => setShowPreOutModal(true)}>
                                    <Plus className="w-4 h-4" />
                                    Add Pre-Out
                                </ModernButton>
                            </div>
                        </ModernCard>

                        <ModernCard title="Pre-Out Records" subtitle={`${preOutList.length} pending exits`}>
                            <ModernTable
                                columns={[
                                    {
                                        key: 'container_no',
                                        label: 'Container',
                                        render: (item: PreOutRecord) => (
                                            <div>
                                                <div className="font-bold" style={{ color: colors.text.primary }}>
                                                    {item.container_no}
                                                </div>
                                                {item.is_on_hold && (
                                                    <ModernBadge variant="error" icon={<Lock className="w-3 h-3" />}>
                                                        ON HOLD
                                                    </ModernBadge>
                                                )}
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'client_name',
                                        label: 'Client & Details',
                                        render: (item: PreOutRecord) => (
                                            <div>
                                                <div className="font-medium" style={{ color: colors.text.primary }}>
                                                    {item.client_name}
                                                </div>
                                                <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                                    {item.size}" {item.type}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'plate_no',
                                        label: 'Plate No',
                                        render: (item: PreOutRecord) => (
                                            <div className="flex items-center gap-1">
                                                <Truck className="w-3 h-3" style={{ color: colors.text.secondary }} />
                                                <span style={{ color: colors.text.primary }}>{item.plate_no}</span>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'full_name',
                                        label: 'Created By',
                                        render: (item: PreOutRecord) => (
                                            <div>
                                                <div className="flex items-center gap-1">
                                                    <User className="w-3 h-3" style={{ color: colors.text.secondary }} />
                                                    <span className="text-sm" style={{ color: colors.text.primary }}>
                                                        {item.full_name}
                                                    </span>
                                                </div>
                                                <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                                    {new Date(item.date_added).toLocaleString()}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'actions',
                                        label: 'Actions',
                                        render: (item: PreOutRecord) => (
                                            <ModernButton
                                                variant="delete"
                                                size="sm"
                                                onClick={() => setDeleteConfirm({ type: 'pre-out', id: item.hashed_id })}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </ModernButton>
                                        ),
                                    },
                                ]}
                                data={preOutList}
                                loading={refreshing}
                                emptyMessage="No pre-out records found"
                            />
                        </ModernCard>
                    </div>
                )}

                {/* GATE-IN Tab */}
                {activeTab === 'gate-in' && (
                    <div className="space-y-4">
                        <ModernCard>
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                                    Pending Pre-In Approvals
                                </h2>
                                <ModernButton variant="secondary" onClick={fetchPreInList} disabled={refreshing}>
                                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                    Refresh
                                </ModernButton>
                            </div>
                        </ModernCard>

                        <ModernCard title="Approve Gate In" subtitle={`${preInList.length} containers awaiting approval`}>
                            <ModernTable
                                columns={[
                                    {
                                        key: 'container_no',
                                        label: 'Container',
                                        render: (item: PreInRecord) => (
                                            <div>
                                                <div className="font-bold" style={{ color: colors.text.primary }}>
                                                    {item.container_no}
                                                </div>
                                                <ModernBadge variant={item.cnt_class === 'F' ? 'warning' : 'default'}>
                                                    {item.cnt_class === 'F' ? 'Full' : 'Empty'}
                                                </ModernBadge>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'client_name',
                                        label: 'Client & Details',
                                        render: (item: PreInRecord) => (
                                            <div>
                                                <div className="font-medium" style={{ color: colors.text.primary }}>
                                                    {item.client_name}
                                                </div>
                                                <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                                    {item.size}" {item.type}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'plate_no',
                                        label: 'Transport',
                                        render: (item: PreInRecord) => (
                                            <div className="text-sm">
                                                {item.plate_no && (
                                                    <div className="flex items-center gap-1">
                                                        <Truck className="w-3 h-3" style={{ color: colors.text.secondary }} />
                                                        <span>{item.plate_no}</span>
                                                    </div>
                                                )}
                                                {item.hauler && (
                                                    <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                                        {item.hauler}
                                                    </div>
                                                )}
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'full_name',
                                        label: 'Created By',
                                        render: (item: PreInRecord) => (
                                            <div>
                                                <div className="text-sm" style={{ color: colors.text.primary }}>
                                                    {item.full_name}
                                                </div>
                                                <div className="text-xs" style={{ color: colors.text.secondary }}>
                                                    {new Date(item.date_added).toLocaleString()}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'actions',
                                        label: 'Actions',
                                        render: (item: PreInRecord) => (
                                            <ModernButton
                                                variant="add"
                                                size="sm"
                                                onClick={() => setApproveConfirm({ type: 'gate-in', id: item.hashed_id, container: item.container_no })}
                                            >
                                                <CheckCircle className="w-3 h-3" />
                                                Approve
                                            </ModernButton>
                                        ),
                                    },
                                ]}
                                data={preInList}
                                loading={refreshing}
                                emptyMessage="No pending approvals"
                            />
                        </ModernCard>
                    </div>
                )}

                {/* GATE-OUT Tab */}
                {activeTab === 'gate-out' && (
                    <div className="space-y-4">
                        <ModernCard>
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                                    Pending Pre-Out Approvals
                                </h2>
                                <ModernButton variant="secondary" onClick={fetchPreOutList} disabled={refreshing}>
                                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                    Refresh
                                </ModernButton>
                            </div>
                        </ModernCard>

                        <ModernCard title="Approve Gate Out" subtitle={`${preOutList.length} containers awaiting approval`}>
                            <ModernTable
                                columns={[
                                    {
                                        key: 'container_no',
                                        label: 'Container',
                                        render: (item: PreOutRecord) => (
                                            <div className="font-bold" style={{ color: colors.text.primary }}>
                                                {item.container_no}
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'client_name',
                                        label: 'Client & Details',
                                        render: (item: PreOutRecord) => (
                                            <div>
                                                <div className="font-medium" style={{ color: colors.text.primary }}>
                                                    {item.client_name}
                                                </div>
                                                <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                                    {item.size}" {item.type}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'plate_no',
                                        label: 'Plate No',
                                        render: (item: PreOutRecord) => (
                                            <div className="flex items-center gap-1">
                                                <Truck className="w-3 h-3" style={{ color: colors.text.secondary }} />
                                                <span>{item.plate_no}</span>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'full_name',
                                        label: 'Created By',
                                        render: (item: PreOutRecord) => (
                                            <div>
                                                <div className="text-sm" style={{ color: colors.text.primary }}>
                                                    {item.full_name}
                                                </div>
                                                <div className="text-xs" style={{ color: colors.text.secondary }}>
                                                    {new Date(item.date_added).toLocaleString()}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'actions',
                                        label: 'Actions',
                                        render: (item: PreOutRecord) => (
                                            <ModernButton
                                                variant="add"
                                                size="sm"
                                                onClick={() => setApproveConfirm({ type: 'gate-out', id: item.hashed_id, container: item.container_no })}
                                            >
                                                <CheckCircle className="w-3 h-3" />
                                                Approve
                                            </ModernButton>
                                        ),
                                    },
                                ]}
                                data={preOutList}
                                loading={refreshing}
                                emptyMessage="No pending approvals"
                            />
                        </ModernCard>
                    </div>
                )}
            </div>

            {/* Pre-In Modal */}
            <Dialog open={showPreInModal} onOpenChange={setShowPreInModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded" style={{ backgroundColor: colors.actions.add + '20' }}>
                                <LogIn className="w-5 h-5" style={{ color: colors.actions.add }} />
                            </div>
                            Add Pre-In Record
                        </DialogTitle>
                        <DialogDescription>
                            Register a new container entry for gate-in approval
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div>
                            <Label>Container No <span className="text-red-500">*</span></Label>
                            <Input
                                value={preInForm.container_no}
                                onChange={(e) => setPreInForm({ ...preInForm, container_no: e.target.value.toUpperCase() })}
                                placeholder="ABCD1234567"
                            />
                        </div>
                        <div>
                            <Label>Client <span className="text-red-500">*</span></Label>
                            <Select value={preInForm.client_id} onValueChange={(value) => setPreInForm({ ...preInForm, client_id: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select client" />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map((client) => (
                                        <SelectItem key={client.c_id} value={client.c_id.toString()}>
                                            {client.client_code} - {client.client_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Size/Type <span className="text-red-500">*</span></Label>
                            <Select value={preInForm.size_type} onValueChange={(value) => setPreInForm({ ...preInForm, size_type: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select size/type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sizeTypes.map((st) => (
                                        <SelectItem key={st.s_id} value={st.s_id.toString()}>
                                            {st.size}" {st.type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Condition</Label>
                            <Select value={preInForm.cnt_class} onValueChange={(value) => setPreInForm({ ...preInForm, cnt_class: value })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="E">Empty</SelectItem>
                                    <SelectItem value="F">Full</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Plate No</Label>
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
                        <div className="col-span-2">
                            <Label>Remarks</Label>
                            <Input
                                value={preInForm.remarks}
                                onChange={(e) => setPreInForm({ ...preInForm, remarks: e.target.value })}
                                placeholder="Optional remarks"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setShowPreInModal(false)}>
                            Cancel
                        </ModernButton>
                        <ModernButton variant="add" onClick={handleAddPreIn} disabled={loading}>
                            <Plus className="w-4 h-4" />
                            Add Pre-In
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pre-Out Modal */}
            <Dialog open={showPreOutModal} onOpenChange={setShowPreOutModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded" style={{ backgroundColor: colors.actions.delete + '20' }}>
                                <LogOut className="w-5 h-5" style={{ color: colors.actions.delete }} />
                            </div>
                            Add Pre-Out Record
                        </DialogTitle>
                        <DialogDescription>
                            Register a container exit for gate-out approval
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <Label>Container No <span className="text-red-500">*</span></Label>
                            <Select value={preOutForm.container_no} onValueChange={(value) => setPreOutForm({ ...preOutForm, container_no: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select container" />
                                </SelectTrigger>
                                <SelectContent>
                                    {containersInYard.map((container) => (
                                        <SelectItem key={container.container_no} value={container.container_no}>
                                            {container.container_no} - {container.client_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Plate No <span className="text-red-500">*</span></Label>
                            <Input
                                value={preOutForm.plate_no}
                                onChange={(e) => setPreOutForm({ ...preOutForm, plate_no: e.target.value })}
                                placeholder="ABC-1234"
                            />
                        </div>
                        <div>
                            <Label>Remarks</Label>
                            <Input
                                value={preOutForm.remarks}
                                onChange={(e) => setPreOutForm({ ...preOutForm, remarks: e.target.value })}
                                placeholder="Optional remarks"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setShowPreOutModal(false)}>
                            Cancel
                        </ModernButton>
                        <ModernButton variant="add" onClick={handleAddPreOut} disabled={loading}>
                            <Plus className="w-4 h-4" />
                            Add Pre-Out
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: colors.actions.delete + '20' }}>
                                <Trash2 className="w-5 h-5" style={{ color: colors.actions.delete }} />
                            </div>
                            Confirm Deletion
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this {deleteConfirm?.type === 'pre-in' ? 'Pre-In' : 'Pre-Out'} record?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setDeleteConfirm(null)}>
                            Cancel
                        </ModernButton>
                        <ModernButton
                            variant="delete"
                            onClick={() => {
                                if (deleteConfirm?.type === 'pre-in') {
                                    handleDeletePreIn(deleteConfirm.id);
                                } else if (deleteConfirm?.type === 'pre-out') {
                                    handleDeletePreOut(deleteConfirm.id);
                                }
                            }}
                            disabled={loading}
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approve Confirmation */}
            <Dialog open={!!approveConfirm} onOpenChange={() => setApproveConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: colors.actions.add + '20' }}>
                                <CheckCircle className="w-5 h-5" style={{ color: colors.actions.add }} />
                            </div>
                            Confirm {approveConfirm?.type === 'gate-in' ? 'Gate-In' : 'Gate-Out'} Approval
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to approve {approveConfirm?.type === 'gate-in' ? 'gate-in' : 'gate-out'} for container <strong>{approveConfirm?.container}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setApproveConfirm(null)}>
                            Cancel
                        </ModernButton>
                        <ModernButton
                            variant="add"
                            onClick={() => {
                                if (approveConfirm?.type === 'gate-in') {
                                    handleApproveGateIn(approveConfirm.id);
                                } else if (approveConfirm?.type === 'gate-out') {
                                    handleApproveGateOut(approveConfirm.id);
                                }
                            }}
                            disabled={loading}
                        >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}

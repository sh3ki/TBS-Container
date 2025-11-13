import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ModernButton, ModernCard, ModernTable, ModernBadge, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Package, 
    Search, 
    Eye, 
    Pencil, 
    Trash2, 
    Download, 
    ChevronDown, 
    ChevronUp, 
    RotateCcw,
    Lock,
    Unlock,
    Ship,
    Calendar,
    MapPin,
    AlertCircle
} from 'lucide-react';
import { colors } from '@/lib/colors';
import ViewDetailsModal from './ViewDetailsModal';
import EditInventoryModal from './EditInventoryModal';

interface InventoryRecord extends Record<string, unknown> {
    inv_id: number;
    hashed_id: string;
    container_no: string;
    container_size: string;
    container_type: string;
    load_type: string;
    booking: string | null;
    shipper: string | null;
    vessel: string | null;
    voyage: string | null;
    date_in: string;
    time_in: string;
    date_out: string | null;
    time_out: string | null;
    slot: string | null;
    status: string;
    hold: boolean;
    damage: boolean;
    remarks: string | null;
    client?: {
        client_code: string;
        client_name: string;
    };
}

interface ClientOption {
    c_id: number;
    hashed_id: string;
    client_code: string;
    client_name: string;
}

export default function Index() {
    const { toasts, removeToast, success, error } = useModernToast();
    const axios = (window as any).axios;
    
    const [inventory, setInventory] = useState<InventoryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [quickSearch, setQuickSearch] = useState('');
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [recordsTotal, setRecordsTotal] = useState(0);
    const [recordsPerPage] = useState(25);
    
    const [filters, setFilters] = useState<any>({
        status: 'all',
        size: 'all',
        load_type: 'all',
    });
    
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [sizes, setSizes] = useState<string[]>([]);
    const [types, setTypes] = useState<string[]>([]);

    const [showViewModal, setShowViewModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState<string>('');
    const [selectedRecord, setSelectedRecord] = useState<InventoryRecord | null>(null);

    useEffect(() => {
        fetchInventory();
        fetchDropdownData();
    }, [currentPage, statusFilter]);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const response = await axios.post('/api/inventory/list', {
                start: (currentPage - 1) * recordsPerPage,
                length: recordsPerPage,
                status: statusFilter === 'all' ? '' : statusFilter,
            });
            
            if (response.data.success) {
                setInventory(response.data.data || []);
                setRecordsTotal(response.data.recordsFiltered || 0);
            }
        } catch (err) {
            console.error('Failed to fetch inventory:', err);
            error('Failed to load inventory');
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdownData = async () => {
        try {
            const [clientsRes, sizesRes, typesRes] = await Promise.all([
                axios.get('/api/inventory/clients'),
                axios.get('/api/inventory/sizes'),
                axios.get('/api/inventory/types'),
            ]);

            if (clientsRes.data.success) setClients(clientsRes.data.data || []);
            if (sizesRes.data.success) setSizes(sizesRes.data.data || []);
            if (typesRes.data.success) setTypes(typesRes.data.data || []);
        } catch (error) {
            console.error('Error fetching dropdown data:', error);
        }
    };

    const handleQuickSearch = async () => {
        if (!quickSearch.trim()) {
            fetchInventory();
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post('/api/inventory/search', {
                container_no: quickSearch.trim(),
            });
            
            if (response.data.success) {
                setInventory(response.data.data || []);
                setRecordsTotal(response.data.total || 0);
                success(`Found ${response.data.total} records`);
            }
        } catch (err) {
            console.error('Error searching:', err);
            error('Search failed');
        } finally {
            setLoading(false);
        }
    };

    const handleAdvancedSearch = async () => {
        try {
            setLoading(true);
            const searchFilters = Object.fromEntries(
                Object.entries(filters).filter(([_, value]) => value && value !== 'all')
            );

            const response = await axios.post('/api/inventory/search', searchFilters);
            
            if (response.data.success) {
                setInventory(response.data.data || []);
                setRecordsTotal(response.data.total || 0);
                success(`Found ${response.data.total} records`);
            }
        } catch (err) {
            console.error('Error searching:', err);
            error('Search failed');
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setFilters({
            status: 'all',
            size: 'all',
            load_type: 'all',
        });
        setQuickSearch('');
        setStatusFilter('all');
        setCurrentPage(1);
        fetchInventory();
        success('Filters cleared');
    };

    const handleExportToExcel = async () => {
        try {
            const response = await axios.post('/api/inventory/export', {
                status: statusFilter !== 'all' ? statusFilter : undefined,
            }, {
                responseType: 'blob',
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Inventory_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            success('Inventory exported to Excel');
        } catch (err) {
            console.error('Error exporting:', err);
            error('Export failed');
        }
    };

    const handleViewDetails = (hashedId: string) => {
        setSelectedRecordId(hashedId);
        setShowViewModal(true);
    };

    const handleEdit = (record: InventoryRecord) => {
        setSelectedRecord(record);
        setShowEditModal(true);
    };

    const handleEditSuccess = () => {
        setShowEditModal(false);
        setSelectedRecord(null);
        fetchInventory();
    };

    const handleDelete = async (record: InventoryRecord) => {
        if (!confirm(`Delete container ${record.container_no}?`)) return;

        try {
            const response = await axios.delete(`/api/inventory/${record.hashed_id}`);
            
            if (response.data.success) {
                success('Container deleted successfully');
                fetchInventory();
            }
        } catch (err) {
            console.error('Error deleting:', err);
            error('Delete failed');
        }
    };

    const handleHoldToggle = async (record: InventoryRecord) => {
        const action = record.hold ? 'unhold' : 'hold';
        const confirmMsg = record.hold 
            ? `Remove hold from container ${record.container_no}?`
            : `Put container ${record.container_no} on hold?`;

        if (!confirm(confirmMsg)) return;

        try {
            const response = await axios.post(`/api/inventory/${record.hashed_id}/${action}`);
            
            if (response.data.success) {
                success(record.hold ? 'Hold removed' : 'Container on hold');
                fetchInventory();
            }
        } catch (err) {
            console.error('Error toggling hold:', err);
            error('Hold toggle failed');
        }
    };

    const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
        switch (status) {
            case 'IN':
                return 'info';
            case 'OUT':
                return 'warning';
            case 'COMPLETE':
                return 'success';
            default:
                return 'default';
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Inventory Management" />

            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                            <Package className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                Inventory Management
                            </h1>
                            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                {recordsTotal} containers in yard
                            </p>
                        </div>
                    </div>
                    <ModernButton variant="primary" size="lg" onClick={handleExportToExcel}>
                        <Download className="w-4 h-4" />
                        Export to Excel
                    </ModernButton>
                </div>

                {/* Quick Search */}
                <ModernCard title="Quick Search" subtitle="Search by container number" icon={<Search className="w-5 h-5" />}>
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <Input
                                type="text"
                                placeholder="Enter container number..."
                                value={quickSearch}
                                onChange={(e) => setQuickSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleQuickSearch()}
                                className="h-11"
                            />
                        </div>
                        <ModernButton variant="primary" onClick={handleQuickSearch}>
                            <Search className="w-4 h-4" />
                            Search
                        </ModernButton>
                        <ModernButton 
                            variant="secondary" 
                            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                        >
                            {showAdvancedSearch ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            Advanced
                        </ModernButton>
                        <ModernButton variant="secondary" onClick={handleClearFilters}>
                            <RotateCcw className="w-4 h-4" />
                            Reset
                        </ModernButton>
                    </div>
                </ModernCard>

                {/* Advanced Search */}
                {showAdvancedSearch && (
                    <ModernCard 
                        title="Advanced Search Filters" 
                        subtitle="Use multiple criteria to filter inventory"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <Label className="text-sm font-semibold mb-2">Container No</Label>
                                <Input
                                    value={filters.container_no || ''}
                                    onChange={(e) => setFilters({ ...filters, container_no: e.target.value })}
                                    placeholder="Container number"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Client</Label>
                                <Select
                                    value={filters.client_id || 'all'}
                                    onValueChange={(value) =>
                                        setFilters({ ...filters, client_id: value === 'all' ? undefined : value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All clients" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Clients</SelectItem>
                                        {clients.map((client) => (
                                            <SelectItem key={client.c_id} value={client.hashed_id}>
                                                {client.client_code} - {client.client_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Booking</Label>
                                <Input
                                    value={filters.booking || ''}
                                    onChange={(e) => setFilters({ ...filters, booking: e.target.value })}
                                    placeholder="Booking number"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Status</Label>
                                <Select
                                    value={filters.status || 'all'}
                                    onValueChange={(value) => setFilters({ ...filters, status: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="IN">IN</SelectItem>
                                        <SelectItem value="OUT">OUT</SelectItem>
                                        <SelectItem value="COMPLETE">COMPLETE</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Size</Label>
                                <Select
                                    value={filters.size || 'all'}
                                    onValueChange={(value) => setFilters({ ...filters, size: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Sizes</SelectItem>
                                        {sizes.map((size) => (
                                            <SelectItem key={size} value={size}>
                                                {size}"
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Type</Label>
                                <Select
                                    value={filters.type || 'all'}
                                    onValueChange={(value) =>
                                        setFilters({ ...filters, type: value === 'all' ? undefined : value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        {types.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Condition</Label>
                                <Select
                                    value={filters.load_type || 'all'}
                                    onValueChange={(value) => setFilters({ ...filters, load_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="E">Empty</SelectItem>
                                        <SelectItem value="F">Full</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Shipper</Label>
                                <Input
                                    value={filters.shipper || ''}
                                    onChange={(e) => setFilters({ ...filters, shipper: e.target.value })}
                                    placeholder="Shipper name"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Vessel</Label>
                                <Input
                                    value={filters.vessel || ''}
                                    onChange={(e) => setFilters({ ...filters, vessel: e.target.value })}
                                    placeholder="Vessel name"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Date In From</Label>
                                <Input
                                    type="date"
                                    value={filters.date_in_from || ''}
                                    onChange={(e) => setFilters({ ...filters, date_in_from: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Date In To</Label>
                                <Input
                                    type="date"
                                    value={filters.date_in_to || ''}
                                    onChange={(e) => setFilters({ ...filters, date_in_to: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <ModernButton variant="secondary" onClick={handleClearFilters}>
                                Clear Filters
                            </ModernButton>
                            <ModernButton variant="primary" onClick={handleAdvancedSearch}>
                                <Search className="w-4 h-4" />
                                Search
                            </ModernButton>
                        </div>
                    </ModernCard>
                )}

                {/* Status Filter & Inventory Table */}
                <ModernCard 
                    title="Container Inventory" 
                    subtitle={`Total: ${recordsTotal} containers`}
                    headerActions={
                        <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium">Filter:</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="IN">IN</SelectItem>
                                    <SelectItem value="OUT">OUT</SelectItem>
                                    <SelectItem value="COMPLETE">COMPLETE</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    }
                >
                    <ModernTable
                        columns={[
                            {
                                key: 'container_no',
                                label: 'Container',
                                render: (item: InventoryRecord) => (
                                    <div>
                                        <div className="font-bold" style={{ color: colors.text.primary }}>
                                            {item.container_no}
                                        </div>
                                        <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                            {item.container_size}" {item.container_type}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <ModernBadge variant={getStatusVariant(item.status)}>
                                                {item.status}
                                            </ModernBadge>
                                            {item.load_type && (
                                                <ModernBadge variant={item.load_type === 'F' ? 'warning' : 'default'}>
                                                    {item.load_type === 'F' ? 'Full' : 'Empty'}
                                                </ModernBadge>
                                            )}
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'client',
                                label: 'Client',
                                render: (item: InventoryRecord) => (
                                    <div>
                                        {item.client ? (
                                            <>
                                                <div className="font-medium" style={{ color: colors.text.primary }}>
                                                    {item.client.client_name}
                                                </div>
                                                <div className="text-xs" style={{ color: colors.text.secondary }}>
                                                    {item.client.client_code}
                                                </div>
                                            </>
                                        ) : (
                                            <span style={{ color: colors.text.secondary }}>-</span>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'booking',
                                label: 'Booking & Vessel',
                                render: (item: InventoryRecord) => (
                                    <div className="text-sm">
                                        {item.booking && (
                                            <div className="flex items-center gap-1 mb-1">
                                                <Calendar className="w-3 h-3" style={{ color: colors.text.secondary }} />
                                                <span style={{ color: colors.text.primary }}>{item.booking}</span>
                                            </div>
                                        )}
                                        {item.vessel && (
                                            <div className="flex items-center gap-1">
                                                <Ship className="w-3 h-3" style={{ color: colors.text.secondary }} />
                                                <span style={{ color: colors.text.secondary }}>
                                                    {item.vessel} {item.voyage && `(${item.voyage})`}
                                                </span>
                                            </div>
                                        )}
                                        {!item.booking && !item.vessel && (
                                            <span style={{ color: colors.text.secondary }}>-</span>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'dates',
                                label: 'In/Out Dates',
                                render: (item: InventoryRecord) => (
                                    <div className="text-sm">
                                        <div style={{ color: colors.text.primary }}>
                                            <strong>IN:</strong> {item.date_in} {item.time_in}
                                        </div>
                                        {item.date_out ? (
                                            <div style={{ color: colors.text.secondary }} className="mt-1">
                                                <strong>OUT:</strong> {item.date_out} {item.time_out}
                                            </div>
                                        ) : (
                                            <div style={{ color: colors.text.secondary }} className="mt-1">
                                                <strong>OUT:</strong> ---
                                            </div>
                                        )}
                                    </div>
                                ),
                            },
                            {
                                key: 'location',
                                label: 'Location & Info',
                                render: (item: InventoryRecord) => (
                                    <div className="text-sm">
                                        {item.slot && (
                                            <div className="flex items-center gap-1 mb-1">
                                                <MapPin className="w-3 h-3" style={{ color: colors.brand.primary }} />
                                                <span className="font-medium" style={{ color: colors.text.primary }}>
                                                    Slot: {item.slot}
                                                </span>
                                            </div>
                                        )}
                                        {item.shipper && (
                                            <div className="text-xs" style={{ color: colors.text.secondary }}>
                                                {item.shipper}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                            {item.hold && (
                                                <ModernBadge variant="error" icon={<Lock className="w-3 h-3" />}>
                                                    HOLD
                                                </ModernBadge>
                                            )}
                                            {item.damage && (
                                                <ModernBadge variant="warning" icon={<AlertCircle className="w-3 h-3" />}>
                                                    DMG
                                                </ModernBadge>
                                            )}
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'actions',
                                label: 'Actions',
                                render: (item: InventoryRecord) => (
                                    <div className="flex items-center gap-2">
                                        <ModernButton 
                                            variant="primary" 
                                            size="sm"
                                            onClick={() => handleViewDetails(item.hashed_id)}
                                        >
                                            <Eye className="w-3 h-3" />
                                        </ModernButton>
                                        <ModernButton 
                                            variant="edit" 
                                            size="sm"
                                            onClick={() => handleEdit(item)}
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </ModernButton>
                                        <ModernButton 
                                            variant="toggle" 
                                            size="sm"
                                            onClick={() => handleHoldToggle(item)}
                                        >
                                            {item.hold ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                        </ModernButton>
                                        <ModernButton 
                                            variant="delete" 
                                            size="sm"
                                            onClick={() => handleDelete(item)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </ModernButton>
                                    </div>
                                ),
                            },
                        ]}
                        data={inventory}
                        loading={loading}
                        emptyMessage="No inventory records found"
                        currentPage={currentPage}
                        totalPages={Math.ceil(recordsTotal / recordsPerPage)}
                        onPageChange={setCurrentPage}
                    />
                </ModernCard>
            </div>

            {/* Modals */}
            {showViewModal && selectedRecordId && (
                <ViewDetailsModal
                    open={showViewModal}
                    hashedId={selectedRecordId}
                    onClose={() => {
                        setShowViewModal(false);
                        setSelectedRecordId('');
                    }}
                />
            )}

            {showEditModal && selectedRecord && (
                <EditInventoryModal
                    open={showEditModal}
                    record={selectedRecord}
                    onClose={() => {
                        setShowEditModal(false);
                        setSelectedRecord(null);
                    }}
                    onSuccess={handleEditSuccess}
                />
            )}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
}

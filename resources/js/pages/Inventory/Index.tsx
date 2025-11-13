import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { ModernButton, ModernTable, ModernBadge, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ModernConfirmDialog } from '@/components/modern';
import { Textarea } from '@/components/ui/textarea';
import { Package, FileText, Download, CheckCircle, Lock, Unlock, Truck, Eye, Pencil, Trash2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { colors } from '@/lib/colors';

interface Client {
    id: string;
    c_id: number;
    code: string;
    name: string;
    text: string;
}

interface InventoryRecord {
    i_id: number;
    hashed_id?: string;
    eir_no: string;
    container_no: string;
    client: string;
    client_code: string;
    client_id?: string;
    size: string;
    size_type_id?: number;
    iso_code?: string;
    gate: string;
    date: string;
    time: string;
    days: number;
    status: string;
    status_id?: string;
    class: string;
    dmf: string;
    location: string;
    eir_notes: string;
    app_notes: string;
    approval_date?: string;
    is_hold?: boolean;
    container_status_id?: number;
    vessel?: string;
    voyage?: string;
    checker?: string;
    ex_consignee?: string;
    load?: string;
    load_id?: string;
    plate_no?: string;
    hauler?: string;
    hauler_driver?: string;
    license_no?: string;
    chasis?: string;
    contact_no?: string;
    bill_of_lading?: string;
    [key: string]: unknown;
}

const Index: React.FC = () => {
    const { toasts, removeToast, success, error } = useModernToast();
    
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [sizeTypes, setSizeTypes] = useState<{ value: string; label: string }[]>([]);
    const [statusesIn, setStatusesIn] = useState<string[]>([]);
    const [statusesOut, setStatusesOut] = useState<string[]>([]);
    const [reportData, setReportData] = useState<InventoryRecord[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Approval modal states
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<InventoryRecord | null>(null);
    const [approvalNotes, setApprovalNotes] = useState('');

    // Hold modal states
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [holdNotes, setHoldNotes] = useState('');
    const [holdingRecord, setHoldingRecord] = useState(false);

    // Repo/Available action state
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // View modal state
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewRecord, setViewRecord] = useState<InventoryRecord | null>(null);

    // Confirmation dialog states
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    const [showHoldConfirm, setShowHoldConfirm] = useState(false);
    const [showUnholdConfirm, setShowUnholdConfirm] = useState(false);
    const [showRepoToggleConfirm, setShowRepoToggleConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showEditConfirm, setShowEditConfirm] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<InventoryRecord | null>(null);
    const [recordForAction, setRecordForAction] = useState<InventoryRecord | null>(null);

    // Edit modal states
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState<InventoryRecord | null>(null);

    // Dropdown options for edit modal
    const [statusOptions, setStatusOptions] = useState<Array<{ s_id: number; status: string }>>([]);
    const [sizeTypeOptions, setSizeTypeOptions] = useState<Array<{ s_id: number; size: string; type: string }>>([]);
    const [loadOptions, setLoadOptions] = useState<Array<{ l_id: number; type: string }>>([]);
    
    // Filter collapse state
    const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(true);
    
    // Search state
    const [searchTerm, setSearchTerm] = useState('');

    // Filter states
    const [filters, setFilters] = useState({
        client: 'all',
        iso_code: '',
        container_no: '',
        date_out_from: '',
        date_in_from: '',
        date_out_to: '',
        date_in_to: '',
        hauler_out: '',
        checker: '',
        vessel_out: '',
        consignee: '',
        shipper: '',
        hauler_in: '',
        destination: '',
        vessel_in: '',
        booking_number: '',
        plate_no_in: '',
        seal_no: '',
        status_in: 'all',
        contact_no: '',
        size_type: 'all',
        bill_of_lading: '',
        status_out: 'all',
        auto_clear: false,
    });

    useEffect(() => {
        loadDropdownData();
        loadAllInventory();
        fetchDropdownOptions();
    }, []);

    const fetchDropdownOptions = async () => {
        try {
            const [statusRes, sizeTypeRes, loadRes] = await Promise.all([
                axios.get('/api/gateinout/status-options'),
                axios.get('/api/gateinout/sizetype-options'),
                axios.get('/api/gateinout/load-options'),
            ]);

            if (statusRes.data.success) {
                setStatusOptions(statusRes.data.data);
            }
            if (sizeTypeRes.data.success) {
                setSizeTypeOptions(sizeTypeRes.data.data);
            }
            if (loadRes.data.success) {
                setLoadOptions(loadRes.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch dropdown options:', err);
        }
    };

    const loadDropdownData = async () => {
        try {
            // Load clients
            const clientsResponse = await axios.get('/api/reports/clients');
            if (clientsResponse.data.success) {
                setClients(clientsResponse.data.data);
            }

            // Load size types (combined)
            const sizeTypesResponse = await axios.get('/api/inventory/size-types');
            if (sizeTypesResponse.data.success) {
                const combined = sizeTypesResponse.data.data.map((st: { size: string; type: string }) => ({
                    value: `${st.size}${st.type}`,
                    label: `${st.size}${st.type}`
                }));
                setSizeTypes(combined);
            }

            // Load statuses
            const statusesResponse = await axios.get('/api/inventory/statuses');
            if (statusesResponse.data.success) {
                setStatusesIn(statusesResponse.data.statuses || []);
                setStatusesOut(statusesResponse.data.statuses || []);
            }
        } catch (err) {
            console.error('Failed to load dropdown data:', err);
        }
    };

    const loadAllInventory = async () => {
        setLoading(true);
        try {
            const response = await axios.post('/api/inventory/search', {});
            
            if (response.data.success) {
                setReportData(response.data.data || []);
            }
        } catch (err) {
            console.error('Failed to load inventory:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (field: string, value: string | boolean) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const buildFilterPayload = () => {
        const payload: Record<string, unknown> = {};

        Object.entries(filters).forEach(([key, value]) => {
            if (key === 'auto_clear') {
                return;
            }

            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed && trimmed.toLowerCase() !== 'all') {
                    payload[key] = trimmed;
                }
            }
        });

        return payload;
    };

    // Apply search filter to reportData
    const filteredReportData = reportData.filter(record => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return record.container_no.toLowerCase().includes(search) || 
               record.eir_no.toLowerCase().includes(search);
    });

    // Format date to "Jan 01, 2025"
    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    // Format time to "11:00:01 AM"
    const formatTime = (timeString: string) => {
        if (!timeString) return '-';
        try {
            // If timeString is already in HH:MM:SS format, convert to 12-hour format
            const timeParts = timeString.split(':');
            if (timeParts.length >= 2) {
                const hours = parseInt(timeParts[0]);
                const minutes = timeParts[1];
                const seconds = timeParts[2] || '00';
                const ampm = hours >= 12 ? 'PM' : 'AM';
                const hour12 = hours % 12 || 12;
                return `${hour12}:${minutes}:${seconds} ${ampm}`;
            }
            return timeString;
        } catch {
            return timeString;
        }
    };

    const handleOpenApprovalModal = (record: InventoryRecord) => {
        setSelectedRecord(record);
        setApprovalNotes('');
        setShowApprovalModal(true);
    };

    const handleSubmitApprovalNotes = () => {
        if (!approvalNotes.trim()) {
            error('Please enter approval notes');
            return;
        }
        if (approvalNotes.length > 300) {
            error('Approval notes cannot exceed 300 characters');
            return;
        }
        setShowApprovalModal(false);
        setShowApproveConfirm(true);
    };

    const handleApproveContainer = async () => {
        if (!selectedRecord || !approvalNotes.trim()) {
            error('Please enter approval notes');
            return;
        }

        try {
            const response = await axios.post(`/api/inventory/${selectedRecord.i_id}/approve`, {
                approval_notes: approvalNotes.trim()
            });

            if (response.data.success) {
                success('Container approved successfully!');
                setShowApproveConfirm(false);
                setSelectedRecord(null);
                setApprovalNotes('');
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to approve container');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to approve container');
        }
    };

    const handleOpenHoldModal = (record: InventoryRecord) => {
        setSelectedRecord(record);
        setHoldNotes('');
        setShowHoldConfirm(true);
    };

    const handleConfirmHold = () => {
        setShowHoldConfirm(false);
        setShowHoldModal(true);
    };

    const handleHoldContainer = async () => {
        if (!selectedRecord || !holdNotes.trim()) {
            error('Please enter hold notes');
            return;
        }

        setHoldingRecord(true);
        try {
            const response = await axios.post(`/api/inventory/${selectedRecord.i_id}/hold`, {
                notes: holdNotes.trim()
            });

            if (response.data.success) {
                success('Container placed on hold successfully!');
                setShowHoldModal(false);
                setSelectedRecord(null);
                setHoldNotes('');
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to hold container');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to hold container');
        } finally {
            setHoldingRecord(false);
        }
    };

    const handleOpenUnholdConfirm = (record: InventoryRecord) => {
        setRecordForAction(record);
        setShowUnholdConfirm(true);
    };

    const handleUnholdContainer = async () => {
        if (!recordForAction) return;

        setUpdatingStatus(true);
        try {
            const response = await axios.post(`/api/inventory/${recordForAction.i_id}/unhold`);

            if (response.data.success) {
                success('Container removed from hold successfully!');
                setShowUnholdConfirm(false);
                setRecordForAction(null);
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to unhold container');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to unhold container');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleOpenRepoToggleConfirm = (record: InventoryRecord) => {
        setRecordForAction(record);
        setShowRepoToggleConfirm(true);
    };

    const handleToggleRepoStatus = async () => {
        if (!recordForAction) return;

        const isRepo = recordForAction.container_status_id === 8;
        const action = isRepo ? 'Available' : 'Repo';

        setUpdatingStatus(true);
        try {
            const response = await axios.post(`/api/inventory/${recordForAction.i_id}/toggle-repo`);

            if (response.data.success) {
                success(`Container updated to ${action} successfully!`);
                setShowRepoToggleConfirm(false);
                setRecordForAction(null);
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to update container status');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to update container status');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleViewRecord = async (record: InventoryRecord) => {
        if (!record.i_id) {
            error('Invalid record identifier');
            return;
        }

        try {
            // Use hashed_id if available, otherwise use i_id directly
            const identifier = record.hashed_id || record.i_id;
            const response = await axios.get(`/api/inventory/${identifier}`);
            
            if (response.data.success) {
                const data = response.data.data;
                // Map API response to InventoryRecord format
                const mappedRecord: InventoryRecord = {
                    i_id: data.i_id,
                    hashed_id: data.hashed_id,
                    eir_no: data.i_id?.toString() || '',
                    container_no: data.container_no,
                    client: data.client_name || '',
                    client_id: data.client_id?.toString(),
                    size: data.container_size || '',
                    size_type_id: data.size_type_id,
                    iso_code: data.iso_code,
                    gate: data.gate_status,
                    date: data.date_in,
                    time: data.time_in,
                    days: data.days_in_yard,
                    status: data.container_status || '',
                    status_id: data.container_status_id,
                    class: data.condition || '',
                    dmf: data.date_manufactured || '',
                    location: data.location || '',
                    eir_notes: data.remarks || '',
                    app_notes: data.approval_notes || '',
                    approval_date: data.approval_date,
                    is_hold: data.is_hold,
                    container_status_id: data.container_status_id,
                    vessel: data.vessel,
                    voyage: data.voyage,
                    checker: data.checker,
                    ex_consignee: data.ex_consignee,
                    load: data.load_type,
                    load_id: data.load_type_id,
                    plate_no: data.plate_no,
                    hauler: data.hauler,
                    hauler_driver: data.hauler_driver,
                    license_no: data.license_no,
                    chasis: data.chasis,
                    contact_no: data.contact_no,
                    bill_of_lading: data.bill_of_lading,
                };
                setViewRecord(mappedRecord);
                setShowViewModal(true);
            } else {
                error(response.data.message || 'Failed to load container details');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to load container details');
        }
    };

    const handleOpenEditModal = async (record: InventoryRecord) => {
        if (!record.i_id) {
            error('Invalid record identifier');
            return;
        }

        try {
            // Use hashed_id if available, otherwise use i_id directly
            const identifier = record.hashed_id || record.i_id;
            const response = await axios.get(`/api/inventory/${identifier}`);
            
            if (response.data.success) {
                const data = response.data.data;
                // Map API response to InventoryRecord format
                const mappedRecord: InventoryRecord = {
                    i_id: data.i_id,
                    hashed_id: data.hashed_id,
                    eir_no: data.i_id?.toString() || '',
                    container_no: data.container_no,
                    client: data.client_name || '',
                    client_id: data.client_id?.toString(),
                    size: data.container_size || '',
                    size_type_id: data.size_type_id,
                    iso_code: data.iso_code,
                    gate: data.gate_status,
                    date: data.date_in,
                    time: data.time_in,
                    days: data.days_in_yard,
                    status: data.container_status || '',
                    status_id: data.container_status_id,
                    class: data.condition || '',
                    dmf: data.date_manufactured || '',
                    location: data.location || '',
                    eir_notes: data.remarks || '',
                    app_notes: data.approval_notes || '',
                    approval_date: data.approval_date,
                    is_hold: data.is_hold,
                    container_status_id: data.container_status_id,
                    vessel: data.vessel,
                    voyage: data.voyage,
                    checker: data.checker,
                    ex_consignee: data.ex_consignee,
                    load: data.load_type,
                    load_id: data.load_type_id,
                    plate_no: data.plate_no,
                    hauler: data.hauler,
                    hauler_driver: data.hauler_driver,
                    license_no: data.license_no,
                    chasis: data.chasis,
                    contact_no: data.contact_no,
                    bill_of_lading: data.bill_of_lading,
                };
                setEditFormData(mappedRecord);
                setShowEditModal(true);
            } else {
                error(response.data.message || 'Failed to load container details');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to load container details');
        }
    };

    const handleSubmitEdit = () => {
        setShowEditModal(false);
        setShowEditConfirm(true);
    };

    const handleConfirmEdit = async () => {
        if (!editFormData) return;
        
        setLoading(true);
        try {
            const identifier = editFormData.hashed_id || editFormData.i_id;
            
            // Prepare update payload
            const payload: Record<string, unknown> = {
                container_no: editFormData.container_no,
                client_id: editFormData.client_id,
                size_type: editFormData.size_type_id,
                container_status: editFormData.status_id,
                class: editFormData.class,
                vessel: editFormData.vessel,
                voyage: editFormData.voyage,
                location: editFormData.location,
                remarks: editFormData.eir_notes,
                plate_no: editFormData.plate_no,
                hauler: editFormData.hauler,
                iso_code: editFormData.iso_code,
                origin: editFormData.checker,
                ex_consignee: editFormData.ex_consignee,
                hauler_driver: editFormData.hauler_driver,
                license_no: editFormData.license_no,
                chasis: editFormData.chasis,
                seal_no: editFormData.seal_no,
                date_manufactured: editFormData.dmf,
                contact_no: editFormData.contact_no,
                bill_of_lading: editFormData.bill_of_lading,
            };

            const response = await axios.put(`/api/inventory/${identifier}`, payload);

            if (response.data.success) {
                success('Container updated successfully!');
                setShowEditConfirm(false);
                setEditFormData(null);
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to update container');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to update container');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRecord = async () => {
        if (!recordToDelete) return;

        try {
            const identifier = recordToDelete.hashed_id || recordToDelete.i_id;
            const response = await axios.delete(`/api/inventory/${identifier}`);

            if (response.data.success) {
                success('Container deleted successfully!');
                setShowDeleteConfirm(false);
                setRecordToDelete(null);
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to delete container');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to delete container');
        }
    };

    const handleSearch = async () => {
        setLoading(true);
        setCurrentPage(1);

        try {
            const payload = buildFilterPayload();
            const response = await axios.post('/api/inventory/search', payload);
            
            if (response.data.success) {
                setReportData(response.data.data || []);
                success(`Found ${response.data.data?.length || 0} records`);
                
                if (filters.auto_clear) {
                    setFilters({
                        client: 'all',
                        iso_code: '',
                        container_no: '',
                        date_out_from: '',
                        date_in_from: '',
                        date_out_to: '',
                        date_in_to: '',
                        hauler_out: '',
                        checker: '',
                        vessel_out: '',
                        consignee: '',
                        shipper: '',
                        hauler_in: '',
                        destination: '',
                        vessel_in: '',
                        booking_number: '',
                        plate_no_in: '',
                        seal_no: '',
                        status_in: 'all',
                        contact_no: '',
                        size_type: 'all',
                        bill_of_lading: '',
                        status_out: 'all',
                        auto_clear: filters.auto_clear,
                    });
                }
            } else {
                error(response.data.message || 'Failed to load inventory data');
                setReportData([]);
            }
        } catch (error_caught: unknown) {
            const err = error_caught as { response?: { data?: { message?: string } } };
            error(err.response?.data?.message || 'Failed to search inventory');
            setReportData([]);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setLoading(true);

        try {
            const payload = buildFilterPayload();
            const response = await axios.post('/api/inventory/export', payload, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
            const link = document.createElement('a');
            link.href = url;
            const filename = `Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            success('Inventory exported successfully');
        } catch (error_caught: unknown) {
            const err = error_caught as { response?: { data?: { message?: string } } };
            error(err.response?.data?.message || 'Failed to export inventory');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Inventory" />
            <div className="space-y-6 overflow-hidden">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                            <Package className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                Inventory
                            </h1>
                            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                Search and manage container inventory
                            </p>
                        </div>
                    </div>
                    
                    {/* Generate and Export Buttons */}
                    <div className="flex items-center gap-3">
                        <ModernButton 
                            variant="primary" 
                            onClick={handleSearch} 
                            disabled={loading}
                            className="px-6 py-3"
                        >
                            <FileText className="w-5 h-5" />
                            {loading ? 'Generating...' : 'Generate'}
                        </ModernButton>
                        <ModernButton 
                            variant="add" 
                            onClick={handleExport} 
                            disabled={loading || reportData.length === 0}
                            className="px-6 py-3"
                        >
                            <Download className="w-5 h-5" />
                            Export
                        </ModernButton>
                    </div>
                </div>

                {/* Filter Section */}
                <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                    {/* Filter Header */}
                    <div 
                        className="cursor-pointer flex items-center justify-between px-6 py-5"
                        onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
                        style={{ backgroundColor: colors.brand.primary }}
                    >
                        <div className="flex items-center gap-3">
                            <Search className="w-5 h-5 text-white" />
                            <div>
                                <h2 className="text-xl font-bold text-white">Search & Filter Inventory</h2>
                                <p className="text-sm text-white/90 mt-0.5">Find containers quickly</p>
                            </div>
                        </div>
                        {isFiltersCollapsed ? (
                            <ChevronDown className="w-5 h-5 text-white" />
                        ) : (
                            <ChevronUp className="w-5 h-5 text-white" />
                        )}
                    </div>
                    
                    {/* Filter Content */}
                    {!isFiltersCollapsed && (
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Column 1 */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm font-semibold mb-2">Client</Label>
                                <Select value={filters.client} onValueChange={(value) => handleFilterChange('client', value)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {clients.map((client) => (
                                            <SelectItem key={client.id} value={client.id}>
                                                {client.text}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Date In (From)</Label>
                                <Input
                                    type="date"
                                    value={filters.date_in_from}
                                    onChange={(e) => handleFilterChange('date_in_from', e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Date In (To)</Label>
                                <Input
                                    type="date"
                                    value={filters.date_in_to}
                                    onChange={(e) => handleFilterChange('date_in_to', e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Hauler In</Label>
                                <Input
                                    type="text"
                                    value={filters.hauler_in}
                                    onChange={(e) => handleFilterChange('hauler_in', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Vessel In</Label>
                                <Input
                                    type="text"
                                    value={filters.vessel_in}
                                    onChange={(e) => handleFilterChange('vessel_in', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Seal No.</Label>
                                <Input
                                    type="text"
                                    value={filters.seal_no}
                                    onChange={(e) => handleFilterChange('seal_no', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Bill of Lading</Label>
                                <Input
                                    type="text"
                                    value={filters.bill_of_lading}
                                    onChange={(e) => handleFilterChange('bill_of_lading', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>


                            <div>
                                <Label className="text-sm font-semibold mb-2">Status In</Label>
                                <Select value={filters.status_in} onValueChange={(value) => handleFilterChange('status_in', value)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {statusesIn.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm font-semibold mb-2">ISO Code</Label>
                                <Input
                                    type="text"
                                    value={filters.iso_code}
                                    onChange={(e) => handleFilterChange('iso_code', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Date Out (From)</Label>
                                <Input
                                    type="date"
                                    value={filters.date_out_from}
                                    onChange={(e) => handleFilterChange('date_out_from', e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Date Out (To)</Label>
                                <Input
                                    type="date"
                                    value={filters.date_out_to}
                                    onChange={(e) => handleFilterChange('date_out_to', e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Hauler Out</Label>
                                <Input
                                    type="text"
                                    value={filters.hauler_out}
                                    onChange={(e) => handleFilterChange('hauler_out', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Vessel Out</Label>
                                <Input
                                    type="text"
                                    value={filters.vessel_out}
                                    onChange={(e) => handleFilterChange('vessel_out', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Destination</Label>
                                <Input
                                    type="text"
                                    value={filters.destination}
                                    onChange={(e) => handleFilterChange('destination', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Booking Number</Label>
                                <Input
                                    type="text"
                                    value={filters.booking_number}
                                    onChange={(e) => handleFilterChange('booking_number', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Status Out</Label>
                                <Select value={filters.status_out} onValueChange={(value) => handleFilterChange('status_out', value)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {statusesOut.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                        </div>

                        {/* Column 3 */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm font-semibold mb-2">Container No.</Label>
                                <Input
                                    type="text"
                                    value={filters.container_no}
                                    onChange={(e) => handleFilterChange('container_no', e.target.value)}
                                    className="mt-1.5"
                                    placeholder="Search container..."
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Checker</Label>
                                <Input
                                    type="text"
                                    value={filters.checker}
                                    onChange={(e) => handleFilterChange('checker', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Consignee</Label>
                                <Input
                                    type="text"
                                    value={filters.consignee}
                                    onChange={(e) => handleFilterChange('consignee', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Plate No. In</Label>
                                <Input
                                    type="text"
                                    value={filters.plate_no_in}
                                    onChange={(e) => handleFilterChange('plate_no_in', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Shipper</Label>
                                <Input
                                    type="text"
                                    value={filters.shipper}
                                    onChange={(e) => handleFilterChange('shipper', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Contact No.</Label>
                                <Input
                                    type="text"
                                    value={filters.contact_no}
                                    onChange={(e) => handleFilterChange('contact_no', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Size/Type</Label>
                                <Select value={filters.size_type} onValueChange={(value) => handleFilterChange('size_type', value)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {sizeTypes.map((st) => (
                                            <SelectItem key={st.value} value={st.value}>
                                                {st.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center space-x-2 mt-2">
                                <Checkbox
                                    id="auto-clear"
                                    checked={filters.auto_clear}
                                    onCheckedChange={(checked) => handleFilterChange('auto_clear', checked as boolean)}
                                />
                                <Label htmlFor="auto-clear" className="text-sm font-semibold cursor-pointer">
                                    Auto Clear Fields
                                </Label>
                            </div>
                        </div>
                    </div>
                        </div>
                    )}
                    
                    {/* Search Bar */}
                    <div className="px-6 py-4 bg-white">
                        <Label className="text-sm font-semibold mb-2 text-gray-900">Search Containers</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <Input
                                type="text"
                                placeholder="Search by container number or EIR number..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-11"
                            />
                        </div>
                    </div>
                    
                    {/* Container Count */}
                    <div className="px-6 py-4 bg-white border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                            <span className="font-semibold text-gray-900">{filteredReportData.length}</span> container{filteredReportData.length !== 1 ? 's' : ''} found
                        </p>
                    </div>
                </div>

                {/* Results Table */}
                <div className="w-full max-w-full overflow-x-auto">
                    {loading ? (
                        <div className="text-center py-12">
                            <p style={{ color: colors.text.secondary }}>Loading inventory...</p>
                        </div>
                    ) : filteredReportData.length > 0 ? (
                        <ModernTable
                            columns={[
                                { 
                                    key: 'eir_no', 
                                    label: 'EIR No.',
                                    render: (row: InventoryRecord) => (
                                        <div className="font-semibold text-gray-900 min-w-[80px]">{row.eir_no}</div>
                                    )
                                },
                                { 
                                    key: 'container_no', 
                                    label: 'Cont. No.',
                                    render: (row: InventoryRecord) => (
                                        <div className="font-medium text-gray-900 min-w-[110px]">{row.container_no}</div>
                                    )
                                },
                                { 
                                    key: 'client', 
                                    label: 'Client',
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-900 min-w-[120px] max-w-[150px]">
                                            <div className="font-medium">{row.client}</div>
                                            <div className="text-xs text-gray-500">{row.client_code}</div>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'size', 
                                    label: 'Size',
                                    render: (row: InventoryRecord) => {
                                        let variant: 'success' | 'error' | 'warning' | 'info' | 'default' = 'default';
                                        const size = row.size;
                                        
                                        // Distinct colors for each size type (cycling through 4 colors)
                                        if (size === '10DJH') variant = 'success';
                                        else if (size === '20FR') variant = 'error';
                                        else if (size === '20HR') variant = 'warning';
                                        else if (size === '20OT') variant = 'info';
                                        else if (size === '20RF') variant = 'success';
                                        else if (size === '20RH') variant = 'error';
                                        else if (size === '40DC') variant = 'warning';
                                        else if (size === '40FR') variant = 'info';
                                        else if (size === '40HC') variant = 'success';
                                        else if (size === '40OT') variant = 'error';
                                        else if (size === '40RH') variant = 'warning';
                                        
                                        return (
                                            <div className="min-w-[70px]">
                                                <ModernBadge variant={variant}>{row.size || '-'}</ModernBadge>
                                            </div>
                                        );
                                    }
                                },
                                { 
                                    key: 'gate', 
                                    label: 'Gate',
                                    render: (row: InventoryRecord) => (
                                        <div className="min-w-[60px]">
                                            <ModernBadge variant={row.gate === 'IN' ? 'success' : 'warning'}>
                                                {row.gate}
                                            </ModernBadge>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'date', 
                                    label: 'Date',
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-600 min-w-[100px]">{formatDate(row.date)}</div>
                                    )
                                },
                                { 
                                    key: 'time', 
                                    label: 'Time',
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-600 min-w-[95px]">{formatTime(row.time)}</div>
                                    )
                                },
                                { 
                                    key: 'days', 
                                    label: 'Days',
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm font-medium text-gray-900 min-w-[50px]">{row.days}</div>
                                    )
                                },
                                { 
                                    key: 'status', 
                                    label: 'Status',
                                    render: (row: InventoryRecord) => {
                                        let variant: 'success' | 'error' | 'warning' | 'info' | 'default' = 'default';
                                        const status = row.status;
                                        
                                        // Distinct colors for each status (cycling through 4 colors)
                                        if (status === 'ASIS') variant = 'success';
                                        else if (status === 'AVL') variant = 'error';
                                        else if (status === 'DMG') variant = 'warning';
                                        else if (status === 'FSV') variant = 'info';
                                        else if (status === 'HLD') variant = 'success';
                                        else if (status === 'REPO') variant = 'error';
                                        else if (status === 'RPR') variant = 'warning';
                                        else if (status === 'WSH') variant = 'info';
                                        
                                        return (
                                            <div className="min-w-[80px]">
                                                <ModernBadge variant={variant}>
                                                    {row.status || '-'}
                                                </ModernBadge>
                                            </div>
                                        );
                                    }
                                },
                                { 
                                    key: 'class', 
                                    label: 'Class',
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-600 min-w-[50px]">{row.class}</div>
                                    )
                                },
                                { 
                                    key: 'dmf', 
                                    label: 'DMF',
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-600 min-w-[100px]">{formatDate(row.dmf)}</div>
                                    )
                                },
                                { 
                                    key: 'location', 
                                    label: 'Loc',
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-600 min-w-[50px]">{row.location}</div>
                                    )
                                },
                                { 
                                    key: 'eir_notes', 
                                    label: 'EIR Notes',
                                    render: (row: InventoryRecord) => (
                                        <div className="min-w-[200px] max-w-[250px]">
                                            <span className="text-sm text-gray-600 break-words" title={row.eir_notes}>{row.eir_notes || '-'}</span>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'app_notes', 
                                    label: 'App Notes',
                                    render: (row: InventoryRecord) => (
                                        <div className="flex items-center gap-2 min-w-[120px]">
                                            {row.app_notes && row.app_notes.trim() ? (
                                                <span className="text-sm text-gray-600">{row.app_notes}</span>
                                            ) : (
                                                <ModernButton
                                                    variant="add"
                                                    size="sm"
                                                    onClick={() => handleOpenApprovalModal(row)}
                                                    title="Approve Container"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </ModernButton>
                                            )}
                                        </div>
                                    )
                                },
                                { 
                                    key: 'actions', 
                                    label: 'Actions',
                                    render: (row: InventoryRecord) => (
                                        <div className="flex items-center justify-end gap-2">
                                            {/* View Button */}
                                            <ModernButton 
                                                variant="primary" 
                                                size="sm" 
                                                onClick={() => handleViewRecord(row)}
                                                title="View Details"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </ModernButton>

                                            {/* Edit Button */}
                                            <ModernButton 
                                                variant="edit" 
                                                size="sm" 
                                                onClick={() => handleOpenEditModal(row)}
                                                title="Edit Container"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </ModernButton>

                                            {/* Hold/Unhold Button */}
                                            {row.is_hold ? (
                                                <ModernButton
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleOpenUnholdConfirm(row)}
                                                    title="Remove from Hold"
                                                    disabled={updatingStatus}
                                                >
                                                    <Unlock className="w-3.5 h-3.5" />
                                                </ModernButton>
                                            ) : (
                                                <ModernButton
                                                    variant="toggle"
                                                    size="sm"
                                                    onClick={() => handleOpenHoldModal(row)}
                                                    title="Place on Hold"
                                                    disabled={updatingStatus}
                                                >
                                                    <Lock className="w-3.5 h-3.5" />
                                                </ModernButton>
                                            )}
                                            
                                            {/* Repo/Available Button with Truck Icon */}
                                            <ModernButton
                                                variant={row.container_status_id === 8 ? "add" : "edit"}
                                                size="sm"
                                                onClick={() => handleOpenRepoToggleConfirm(row)}
                                                title={row.container_status_id === 8 ? "Update to Available" : "Update to Repo"}
                                                disabled={updatingStatus}
                                            >
                                                <Truck className="w-3.5 h-3.5" />
                                            </ModernButton>

                                            {/* Delete Button */}
                                            <ModernButton 
                                                variant="delete" 
                                                size="sm" 
                                                onClick={() => {
                                                    setRecordToDelete(row);
                                                    setShowDeleteConfirm(true);
                                                }}
                                                title="Delete Container"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </ModernButton>
                                        </div>
                                    )
                                },
                            ]}
                            data={filteredReportData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                            pagination={{
                                currentPage: currentPage,
                                totalPages: Math.ceil(filteredReportData.length / itemsPerPage),
                                total: filteredReportData.length,
                                perPage: itemsPerPage,
                                onPageChange: setCurrentPage,
                            }}
                        />
                    ) : (
                        <div className="text-center py-12">
                            <p style={{ color: colors.text.secondary }}>No inventory records found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Hold Modal */}
            <Dialog open={showHoldModal} onOpenChange={setShowHoldModal}>
                <DialogContent className="max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900">Place Container on Hold</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {selectedRecord && (
                            <div className="space-y-2">
                                <div className="text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">Container No:</span> {selectedRecord.container_no}
                                </div>
                                <div className="text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">Client:</span> {selectedRecord.client}
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="hold-notes" className="text-gray-900">Hold Notes *</Label>
                            <Textarea
                                id="hold-notes"
                                value={holdNotes}
                                onChange={(e) => setHoldNotes(e.target.value)}
                                placeholder="Enter reason for hold..."
                                rows={4}
                                className="resize-none text-gray-900 bg-white border-gray-300"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton
                            variant="secondary"
                            onClick={() => setShowHoldModal(false)}
                            disabled={holdingRecord}
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton
                            variant="delete"
                            onClick={handleHoldContainer}
                            disabled={holdingRecord || !holdNotes.trim()}
                        >
                            {holdingRecord ? 'Processing...' : 'Place on Hold'}
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approval Modal */}
            <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
                <DialogContent className="max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900">Approve Container</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {selectedRecord && (
                            <div className="space-y-2">
                                <div className="text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">Container No:</span> {selectedRecord.container_no}
                                </div>
                                <div className="text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">Client:</span> {selectedRecord.client}
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="approval-notes" className="text-gray-900">Approval Notes (Max 300 characters) *</Label>
                            <Textarea
                                id="approval-notes"
                                value={approvalNotes}
                                onChange={(e) => setApprovalNotes(e.target.value)}
                                placeholder="Enter approval notes..."
                                maxLength={300}
                                rows={4}
                                className="resize-none text-gray-900 bg-white border-gray-300"
                            />
                            <div className="text-xs text-gray-600 text-right">
                                {approvalNotes.length}/300
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton
                            variant="secondary"
                            onClick={() => setShowApprovalModal(false)}
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton
                            variant="primary"
                            onClick={handleSubmitApprovalNotes}
                            disabled={!approvalNotes.trim()}
                        >
                            Continue
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Details Modal */}
            <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
                <DialogContent className="min-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
                            Container Details
                        </DialogTitle>
                    </DialogHeader>
                    {viewRecord && (
                        <div className="grid gap-4 py-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: colors.brand.primary }}>
                                    <Package className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900">{viewRecord.container_no}</h3>
                                    <p className="text-sm text-gray-600">{viewRecord.client}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-6 pt-4 border-t">
                                {/* Column 1 */}
                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                                            <FileText className="w-3.5 h-3.5" />
                                            Container No.
                                        </Label>
                                        <p className="mt-1 text-gray-900 font-medium">{viewRecord.container_no}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Client</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.client}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Gate In Date</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.date}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Gate In Time</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.time}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Date Manufactured</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.dmf || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Status</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.status}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Size/Type</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.size}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">ISO Code</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.iso_code || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Column 2 */}
                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Class</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.class}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Vessel</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.vessel || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Voyage</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.voyage || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Checker</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.checker || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Consignee</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.ex_consignee || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Load</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.load || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Plate No.</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.plate_no || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Hauler</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.hauler || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Column 3 */}
                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Hauler Driver</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.hauler_driver || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">License No.</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.license_no || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Location</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.location}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Chasis</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.chasis || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Contact No.</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.contact_no || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Bill of Lading</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.bill_of_lading || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Days in Yard</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.days} days</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Gate Status</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.gate}</p>
                                    </div>
                                </div>

                                {/* Full-width fields */}
                                <div className="col-span-3 space-y-3">
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Remarks (EIR Notes)</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.eir_notes || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Approval Notes</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.app_notes || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <ModernButton variant="toggle" onClick={() => setShowViewModal(false)}>
                            Close
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                <DialogContent className="min-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
                            Edit Container
                        </DialogTitle>
                        <DialogDescription className="text-gray-600">
                            Update container information
                        </DialogDescription>
                    </DialogHeader>
                    {editFormData && (
                        <div className="grid grid-cols-3 gap-6 py-4">
                            {/* Column 1 */}
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-gray-900">Container No. <span className="text-red-500">*</span></Label>
                                    <Input 
                                        value={editFormData.container_no} 
                                        onChange={(e) => setEditFormData({...editFormData, container_no: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Client</Label>
                                    <Select 
                                        value={editFormData.client_id?.toString() || ''} 
                                        onValueChange={(value) => {
                                            const selectedClient = clients.find(c => c.c_id.toString() === value);
                                            setEditFormData({
                                                ...editFormData, 
                                                client_id: value,
                                                client: selectedClient?.name || ''
                                            });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                        <SelectContent>
                                            {clients.map((client) => (
                                                <SelectItem key={client.c_id} value={client.c_id.toString()}>
                                                    {client.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-gray-900">Gate In Date</Label>
                                    <Input 
                                        type="date"
                                        value={editFormData.date} 
                                        onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Gate In Time</Label>
                                    <Input 
                                        type="time"
                                        value={editFormData.time} 
                                        onChange={(e) => setEditFormData({...editFormData, time: e.target.value})}
                                        className="bg-white cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Date Manufactured</Label>
                                    <Input 
                                        type="date"
                                        value={editFormData.dmf} 
                                        onChange={(e) => setEditFormData({...editFormData, dmf: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Status</Label>
                                    <Select 
                                        value={editFormData.status_id?.toString() || ''} 
                                        onValueChange={(value) => {
                                            const selectedStatus = statusOptions.find(s => s.s_id.toString() === value);
                                            setEditFormData({
                                                ...editFormData, 
                                                status_id: value,
                                                status: selectedStatus?.status || ''
                                            });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                        <SelectContent>
                                            {statusOptions.map((status) => (
                                                <SelectItem key={status.s_id} value={status.s_id.toString()}>
                                                    {status.status}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-gray-900">Size/Type</Label>
                                    <Select 
                                        value={editFormData.size_type_id?.toString() || ''} 
                                        onValueChange={(value) => {
                                            const selectedSize = sizeTypeOptions.find(s => s.s_id.toString() === value);
                                            setEditFormData({
                                                ...editFormData, 
                                                size_type_id: parseInt(value),
                                                size: selectedSize ? `${selectedSize.size}${selectedSize.type}` : ''
                                            });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select size/type" /></SelectTrigger>
                                        <SelectContent>
                                            {sizeTypeOptions.map((size) => (
                                                <SelectItem key={size.s_id} value={size.s_id.toString()}>
                                                    {size.size}{size.type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-gray-900">ISO Code</Label>
                                    <Input 
                                        value={editFormData.iso_code || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, iso_code: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* Column 2 */}
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-gray-900">Class</Label>
                                    <Select 
                                        value={editFormData.class} 
                                        onValueChange={(value) => setEditFormData({...editFormData, class: value})}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="A">A</SelectItem>
                                            <SelectItem value="B">B</SelectItem>
                                            <SelectItem value="C">C</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-gray-900">Vessel</Label>
                                    <Input 
                                        value={editFormData.vessel || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, vessel: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Voyage</Label>
                                    <Input 
                                        value={editFormData.voyage || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, voyage: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Checker</Label>
                                    <Input 
                                        value={editFormData.checker || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, checker: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Consignee</Label>
                                    <Input 
                                        value={editFormData.ex_consignee || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, ex_consignee: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Load</Label>
                                    <Select 
                                        value={editFormData.load_id?.toString() || ''} 
                                        onValueChange={(value) => {
                                            const selectedLoad = loadOptions.find(l => l.l_id.toString() === value);
                                            setEditFormData({
                                                ...editFormData, 
                                                load_id: value,
                                                load: selectedLoad?.type || ''
                                            });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select load" /></SelectTrigger>
                                        <SelectContent>
                                            {loadOptions.map((load) => (
                                                <SelectItem key={load.l_id} value={load.l_id.toString()}>
                                                    {load.type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-gray-900">Plate No.</Label>
                                    <Input 
                                        value={editFormData.plate_no || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, plate_no: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Hauler</Label>
                                    <Input 
                                        value={editFormData.hauler || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, hauler: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* Column 3 */}
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-gray-900">Hauler Driver</Label>
                                    <Input 
                                        value={editFormData.hauler_driver || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, hauler_driver: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">License No.</Label>
                                    <Input 
                                        value={editFormData.license_no || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, license_no: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Location</Label>
                                    <Input 
                                        value={editFormData.location} 
                                        onChange={(e) => setEditFormData({...editFormData, location: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Chasis</Label>
                                    <Input 
                                        value={editFormData.chasis || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, chasis: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Contact No.</Label>
                                    <Input 
                                        value={editFormData.contact_no || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, contact_no: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Bill of Lading</Label>
                                    <Input 
                                        value={editFormData.bill_of_lading || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, bill_of_lading: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Remarks (EIR Notes)</Label>
                                    <Textarea 
                                        value={editFormData.eir_notes} 
                                        onChange={(e) => setEditFormData({...editFormData, eir_notes: e.target.value})}
                                        className="min-h-[80px]"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Approval Notes</Label>
                                    <Textarea 
                                        value={editFormData.app_notes} 
                                        onChange={(e) => setEditFormData({...editFormData, app_notes: e.target.value})}
                                        className="min-h-[80px]"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <ModernButton
                            variant="toggle"
                            onClick={() => setShowEditModal(false)}
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton
                            variant="edit"
                            onClick={handleSubmitEdit}
                        >
                            <Pencil className="w-4 h-4" />
                            Update Container
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approve Confirmation Dialog */}
            <ModernConfirmDialog
                open={showApproveConfirm}
                onOpenChange={setShowApproveConfirm}
                type="success"
                title="Approve Container?"
                description={`Are you sure you want to approve container ${selectedRecord?.container_no}?`}
                confirmText="Yes, Approve"
                onConfirm={handleApproveContainer}
            />

            {/* Hold Confirmation Dialog */}
            <ModernConfirmDialog
                open={showHoldConfirm}
                onOpenChange={setShowHoldConfirm}
                type="warning"
                title="Place Container on Hold?"
                description={`Are you sure you want to place container ${selectedRecord?.container_no} on hold?`}
                confirmText="Yes, Place on Hold"
                onConfirm={handleConfirmHold}
            />

            {/* Unhold Confirmation Dialog */}
            <ModernConfirmDialog
                open={showUnholdConfirm}
                onOpenChange={setShowUnholdConfirm}
                type="success"
                title="Remove from Hold?"
                description={`Are you sure you want to remove container ${recordForAction?.container_no} from hold?`}
                confirmText="Yes, Remove Hold"
                onConfirm={handleUnholdContainer}
            />

            {/* Repo/Available Toggle Confirmation Dialog */}
            <ModernConfirmDialog
                open={showRepoToggleConfirm}
                onOpenChange={setShowRepoToggleConfirm}
                type="warning"
                title={`Update to ${recordForAction?.container_status_id === 8 ? 'Available' : 'Repo'}?`}
                description={`Are you sure you want to update container ${recordForAction?.container_no} to ${recordForAction?.container_status_id === 8 ? 'Available' : 'Repo'}?`}
                confirmText={`Yes, Update to ${recordForAction?.container_status_id === 8 ? 'Available' : 'Repo'}`}
                onConfirm={handleToggleRepoStatus}
            />

            {/* Delete Confirmation Dialog */}
            <ModernConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                type="danger"
                title="Delete Container?"
                description={`Are you sure you want to delete container ${recordToDelete?.container_no}? This action cannot be undone.`}
                confirmText="Yes, Delete"
                onConfirm={handleDeleteRecord}
            />

            {/* Edit Confirmation Dialog */}
            <ModernConfirmDialog
                open={showEditConfirm}
                onOpenChange={setShowEditConfirm}
                type="warning"
                title="Edit Container?"
                description={`Are you sure you want to edit container ${editFormData?.container_no}?`}
                confirmText="Yes, Edit"
                onConfirm={handleConfirmEdit}
            />

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
};

export default Index;

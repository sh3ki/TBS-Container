import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { ModernButton, ModernTable, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Search, Download, Eye, Pencil } from 'lucide-react';
import { colors } from '@/lib/colors';

interface Client {
    id: string;
    c_id: number;
    code: string;
    name: string;
    text: string;
}

interface SizeType {
    s_id: number;
    size: string;
    type: string;
    description: string;
}

interface InventoryRecord {
    eir_no: string;
    container_no: string;
    client: string;
    size: string;
    gate: string;
    date: string;
    time: string;
    days: number;
    status: string;
    class: string;
    dmf: string;
    location: string;
    eir_notes: string;
    appliances: string;
    [key: string]: unknown;
}

const Index: React.FC = () => {
    const { toasts, removeToast, success, error } = useModernToast();
    
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [sizes, setSizes] = useState<string[]>([]);
    const [types, setTypes] = useState<{ value: string; label: string }[]>([]);
    const [statusesIn, setStatusesIn] = useState<string[]>([]);
    const [statusesOut, setStatusesOut] = useState<string[]>([]);
    const [reportData, setReportData] = useState<InventoryRecord[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

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
        size: 'all',
        type: 'all',
        bill_of_lading: '',
        status_out: 'all',
        gate_status: 'CURRENTLY',
        auto_clear: false,
    });

    useEffect(() => {
        loadDropdownData();
    }, []);

    const loadDropdownData = async () => {
        try {
            // Load clients
            const clientsResponse = await axios.get('/api/reports/clients');
            if (clientsResponse.data.success) {
                setClients(clientsResponse.data.data);
            }

            // Load sizes and types
            const sizesResponse = await axios.get('/api/inventory/sizes-types');
            if (sizesResponse.data.success) {
                setSizes(sizesResponse.data.sizes || []);
                setTypes(sizesResponse.data.types || []);
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

    const handleFilterChange = (field: string, value: string | boolean) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleSearch = async () => {
        setLoading(true);
        setCurrentPage(1);

        try {
            const response = await axios.post('/api/inventory/search', filters);
            
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
                        size: 'all',
                        type: 'all',
                        bill_of_lading: '',
                        status_out: 'all',
                        gate_status: 'CURRENTLY',
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
            const response = await axios.post('/api/inventory/export', filters, { responseType: 'blob' });

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
                            <Search className="w-5 h-5" />
                            {loading ? 'Searching...' : 'Search'}
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
                <div className="p-6 rounded-xl shadow-sm" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-4">
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
                                <Label className="text-sm font-semibold mb-2">Plate No. In</Label>
                                <Input
                                    type="text"
                                    value={filters.plate_no_in}
                                    onChange={(e) => handleFilterChange('plate_no_in', e.target.value)}
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

                            <div>
                                <Label className="text-sm font-semibold mb-2">Size/Type</Label>
                                <div className="flex gap-2 mt-1.5">
                                    <Select value={filters.size} onValueChange={(value) => handleFilterChange('size', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            {sizes.map((size) => (
                                                <SelectItem key={size} value={size}>
                                                    {size}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            {types.map((type) => (
                                                <SelectItem key={type.value} value={type.value}>
                                                    {type.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-4">
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
                                <Label className="text-sm font-semibold mb-2">Shipper</Label>
                                <Input
                                    type="text"
                                    value={filters.shipper}
                                    onChange={(e) => handleFilterChange('shipper', e.target.value)}
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
                                <Label className="text-sm font-semibold mb-2">Seal No.</Label>
                                <Input
                                    type="text"
                                    value={filters.seal_no}
                                    onChange={(e) => handleFilterChange('seal_no', e.target.value)}
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
                                <Label className="text-sm font-semibold mb-2">Bill of Lading</Label>
                                <Input
                                    type="text"
                                    value={filters.bill_of_lading}
                                    onChange={(e) => handleFilterChange('bill_of_lading', e.target.value)}
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

                            <div>
                                <Label className="text-sm font-semibold mb-2">In/Out</Label>
                                <Select value={filters.gate_status} onValueChange={(value) => handleFilterChange('gate_status', value)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="Real Time Inventory" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CURRENTLY">Real Time Inventory</SelectItem>
                                        <SelectItem value="IN">In</SelectItem>
                                        <SelectItem value="OUT">Out</SelectItem>
                                        <SelectItem value="BOTH">Both</SelectItem>
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

                {/* Results Table */}
                {reportData.length > 0 && (
                    <div className="w-full max-w-full overflow-x-auto">
                        <ModernTable
                            columns={[
                                { key: 'eir_no', label: 'EIR No.' },
                                { key: 'container_no', label: 'Cont. No.' },
                                { key: 'client', label: 'Client' },
                                { key: 'size', label: 'Size' },
                                { key: 'gate', label: 'Gate' },
                                { key: 'date', label: 'Date' },
                                { key: 'time', label: 'Time' },
                                { key: 'days', label: 'Days' },
                                { key: 'status', label: 'Status' },
                                { key: 'class', label: 'Class' },
                                { key: 'dmf', label: 'DMF' },
                                { key: 'location', label: 'Loc' },
                                { key: 'eir_notes', label: 'EIR/Notes' },
                                { key: 'appliances', label: 'Appliances' },
                                { 
                                    key: 'actions', 
                                    label: 'Action',
                                    render: (row: InventoryRecord) => (
                                        <div className="flex gap-2">
                                            <ModernButton
                                                variant="primary"
                                                size="sm"
                                                onClick={() => {/* View details */}}
                                            >
                                                <Eye className="w-4 h-4" />
                                            </ModernButton>
                                            <ModernButton
                                                variant="edit"
                                                size="sm"
                                                onClick={() => {/* Edit record */}}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </ModernButton>
                                        </div>
                                    )
                                },
                            ]}
                            data={reportData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                            pagination={{
                                currentPage: currentPage,
                                totalPages: Math.ceil(reportData.length / itemsPerPage),
                                total: reportData.length,
                                perPage: itemsPerPage,
                                onPageChange: setCurrentPage,
                            }}
                        />
                    </div>
                )}
            </div>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
};

export default Index;

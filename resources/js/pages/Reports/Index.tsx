import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { ModernButton, ModernConfirmDialog, ModernTable, ModernBadge, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Download, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { colors } from '@/lib/colors';

interface Client {
    id: string;
    c_id: number;
    code: string;
    name: string;
    text: string;
}

type TabType = 'incoming' | 'outgoing' | 'dmr' | 'dcr';

interface FieldCheckboxes {
    [key: string]: boolean;
}

const Index: React.FC = () => {
    const { toasts, removeToast, success, error } = useModernToast();
    
    const [activeTab, setActiveTab] = useState<TabType>('incoming');
    const [clientId, setClientId] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [singleDate, setSingleDate] = useState('');
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);
    const [showExportConfirm, setShowExportConfirm] = useState(false);
    const [incomingData, setIncomingData] = useState<Record<string, unknown>[]>([]);
    const [outgoingData, setOutgoingData] = useState<Record<string, unknown>[]>([]);
    const [dmrData, setDmrData] = useState<Record<string, unknown>[]>([]);
    const [dcrData, setDcrData] = useState<Record<string, unknown>[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;
    const [isFieldsCollapsed, setIsFieldsCollapsed] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [incomingFields, setIncomingFields] = useState<FieldCheckboxes>({
        eir_no: true,
        date: true,
        time: true,
        container_no: true,
        size_type: true,
        status: true,
        vessel: true,
        voyage: true,
        class: true,
        date_manufactured: true,
        ex_consignee: true,
        hauler: true,
        plate_no: true,
        load: true,
        origin: true,
        chasis: true,
    });

    const [outgoingFields, setOutgoingFields] = useState<FieldCheckboxes>({
        eir_no: true,
        date: true,
        time: true,
        container_no: true,
        size_type: true,
        status: true,
        vessel: true,
        voyage: true,
        shipper: true,
        hauler: true,
        booking: true,
        destination: true,
        plate_no: true,
        load: true,
        chasis: true,
        seal_no: true,
    });

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        try {
            const response = await axios.get('/api/reports/clients');
            if (response.data.success) {
                setClients(response.data.data);
            }
        } catch (err) {
            console.error('Failed to load clients:', err);
            error('Failed to load clients');
        }
    };

    const handleExportClick = () => {
        if (activeTab === 'incoming' || activeTab === 'outgoing') {
            if (!startDate || !endDate) {
                error('Please select both start and end dates');
                return;
            }
        } else {
            if (!singleDate) {
                error('Please select a date');
                return;
            }
        }
        setShowExportConfirm(true);
    };

    const handleExportConfirm = async () => {
        setShowExportConfirm(false);
        setLoading(true);

        try {
            let endpoint = '';
            const params: Record<string, string> = {};

            switch (activeTab) {
                case 'incoming':
                    endpoint = '/api/reports/incoming/export';
                    params.client_id = clientId !== 'all' ? clientId : '';
                    params.start_date = startDate;
                    params.end_date = endDate;
                    params.fields = JSON.stringify(incomingFields);
                    break;
                case 'outgoing':
                    endpoint = '/api/reports/outgoing/export';
                    params.client_id = clientId !== 'all' ? clientId : '';
                    params.start_date = startDate;
                    params.end_date = endDate;
                    params.fields = JSON.stringify(outgoingFields);
                    break;
                case 'dmr':
                    endpoint = '/api/reports/dmr/export';
                    params.client_id = clientId !== 'all' ? clientId : '';
                    params.date = singleDate;
                    break;
                case 'dcr':
                    endpoint = '/api/reports/dcr/export';
                    params.date = singleDate;
                    break;
            }

            const response = await axios.post(endpoint, params, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
            const link = document.createElement('a');
            link.href = url;
            const filename = `${activeTab.toUpperCase()}_Report_${new Date().toISOString().split('T')[0]}.csv`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            success('Report exported successfully');
        } catch (error_caught: unknown) {
            const err = error_caught as { response?: { data?: { message?: string } } };
            error(err.response?.data?.message || 'Failed to export report');
        } finally {
            setLoading(false);
        }
    };

    const handleDocsFeeExport = async () => {
        if (!singleDate) {
            error('Please select a date');
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('/api/reports/docs-fee/export', { date: singleDate });
            
            if (response.data.success) {
                const data = response.data.data;
                
                // Create CSV content
                let csvContent = 'TBS\n';
                csvContent += 'INCOMING & OUTGOING REPORT\n';
                csvContent += `DATE: ${new Date(singleDate).toLocaleDateString()}\n\n\n`;
                csvContent += 'EIR,Time,Container No.,Size/Type,Hauler,Plate No.,Amount,Client\n';
                
                // Add incoming data
                data.incoming.forEach((row: Record<string, unknown>) => {
                    csvContent += `${row.eir_no},${row.time},${row.container_no},${row.size_type},${row.hauler || ''},${row.plate_no || ''},${row.amount},${row.client_name}\n`;
                });
                
                csvContent += `,,,,,,${data.summary.incoming_total},TOTAL INCOMING: ${data.summary.incoming_count}\n\n\n`;
                
                csvContent += 'TBS\n';
                csvContent += 'OUTGOING\n';
                csvContent += `DATE: ${new Date(singleDate).toLocaleDateString()}\n\n\n`;
                csvContent += 'EIR,Time,Container No.,Size/Type,Hauler,Plate No.,Amount,Client\n';
                
                // Add outgoing data
                data.outgoing.forEach((row: Record<string, unknown>) => {
                    csvContent += `${row.eir_no},${row.time},${row.container_no},${row.size_type},${row.hauler || ''},${row.plate_no || ''},${row.amount},${row.client_name}\n`;
                });
                
                csvContent += `,,,,,,${data.summary.outgoing_total},TOTAL OUTGOING: ${data.summary.outgoing_count}\n\n\n`;
                csvContent += 'REGULAR\n';
                csvContent += `INCOMING,${data.summary.incoming_total}\n`;
                csvContent += `OUTGOING,${data.summary.outgoing_total}\n`;
                csvContent += `TOTAL,${data.summary.grand_total}\n`;
                
                // Create blob and download
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const filename = `DOCS_FEE_${new Date(singleDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).replace(/,/g, '').replace(/ /g, '_')}.csv`;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                
                success('Docs Fee report exported successfully');
            }
        } catch (error_caught: unknown) {
            const err = error_caught as { response?: { data?: { message?: string } } };
            error(err.response?.data?.message || 'Failed to export Docs Fee report');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (activeTab === 'incoming' || activeTab === 'outgoing') {
            if (!startDate || !endDate) {
                error('Please select both start and end dates');
                return;
            }
        } else {
            if (!singleDate) {
                error('Please select a date');
                return;
            }
        }

        setLoading(true);
        setCurrentPage(1);

        try {
            let endpoint = '';
            const params: Record<string, string> = {};

            switch (activeTab) {
                case 'incoming':
                    endpoint = '/api/reports/incoming';
                    params.client_id = clientId !== 'all' ? clientId : '';
                    params.start_date = startDate;
                    params.end_date = endDate;
                    break;
                case 'outgoing':
                    endpoint = '/api/reports/outgoing';
                    params.client_id = clientId !== 'all' ? clientId : '';
                    params.start_date = startDate;
                    params.end_date = endDate;
                    break;
                case 'dmr':
                    endpoint = '/api/reports/dmr';
                    params.client_id = clientId !== 'all' ? clientId : '';
                    params.date = singleDate;
                    break;
                case 'dcr':
                    endpoint = '/api/reports/dcr';
                    params.date = singleDate;
                    break;
            }

            const response = await axios.get(endpoint, { params });
            
            if (response.data.success) {
                const data = response.data.data || [];
                switch (activeTab) {
                    case 'incoming':
                        setIncomingData(data);
                        break;
                    case 'outgoing':
                        setOutgoingData(data);
                        break;
                    case 'dmr':
                        setDmrData(data);
                        break;
                    case 'dcr':
                        setDcrData(data);
                        break;
                }
                success(`Found ${data.length} records`);
            } else {
                error(response.data.message || 'Failed to load report data');
                switch (activeTab) {
                    case 'incoming':
                        setIncomingData([]);
                        break;
                    case 'outgoing':
                        setOutgoingData([]);
                        break;
                    case 'dmr':
                        setDmrData([]);
                        break;
                    case 'dcr':
                        setDcrData([]);
                        break;
                }
            }
        } catch (error_caught: unknown) {
            const err = error_caught as { response?: { data?: { message?: string } } };
            error(err.response?.data?.message || 'Failed to load report data');
            switch (activeTab) {
                case 'incoming':
                    setIncomingData([]);
                    break;
                case 'outgoing':
                    setOutgoingData([]);
                    break;
                case 'dmr':
                    setDmrData([]);
                    break;
                case 'dcr':
                    setDcrData([]);
                    break;
            }
        } finally {
            setLoading(false);
        }
    };

    // Get current tab's data
    const getCurrentTabData = () => {
        switch (activeTab) {
            case 'incoming':
                return incomingData;
            case 'outgoing':
                return outgoingData;
            case 'dmr':
                return dmrData;
            case 'dcr':
                return dcrData;
            default:
                return [];
        }
    };

    // Format date to "Oct 07, 2025"
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

    // Get badge variant for size/type
    const getSizeTypeBadgeVariant = (sizeType: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
        if (!sizeType) return 'default';
        if (sizeType.includes('20DC')) return 'success';
        else if (sizeType.includes('20RF')) return 'success';
        else if (sizeType.includes('20RH')) return 'error';
        else if (sizeType.includes('40DC')) return 'warning';
        else if (sizeType.includes('40FR')) return 'info';
        else if (sizeType.includes('40HC')) return 'success';
        else if (sizeType.includes('40OT')) return 'error';
        else if (sizeType.includes('40RH')) return 'warning';
        return 'default';
    };

    // Get badge variant for status
    const getStatusBadgeVariant = (status: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
        if (!status) return 'default';
        if (status === 'ASIS') return 'success';
        else if (status === 'AVL') return 'error';
        else if (status === 'DMG') return 'warning';
        else if (status === 'FSV') return 'info';
        else if (status === 'HLD') return 'success';
        else if (status === 'REPO') return 'error';
        else if (status === 'RPR') return 'warning';
        else if (status === 'WSH') return 'info';
        return 'default';
    };

    // Get badge variant for load
    const getLoadBadgeVariant = (load: string): 'success' | 'warning' | 'default' => {
        if (!load) return 'default';
        const loadUpper = load.toUpperCase();
        if (loadUpper === 'EMPTY' || loadUpper === 'E') return 'warning';
        else if (loadUpper === 'LADEN' || loadUpper === 'L') return 'success';
        return 'default';
    };

    // Filter report data based on search term
    const filteredReportData = getCurrentTabData().filter((row) => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        const containerNo = String(row.container_no || '').toLowerCase();
        const eirNo = String(row.eir_no || '').toLowerCase();
        return containerNo.includes(search) || eirNo.includes(search);
    });

    const renderIncomingTab = () => (
        <div className="space-y-6">
            {/* Merged Filter and Fields Section */}
            <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                {/* Header */}
                <div 
                    className="cursor-pointer flex items-center justify-between px-6 py-5"
                    onClick={() => setIsFieldsCollapsed(!isFieldsCollapsed)}
                    style={{ backgroundColor: colors.brand.primary }}
                >
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-white" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Search & Filter Reports</h2>
                            <p className="text-sm text-white/90 mt-0.5">Generate and export container reports</p>
                        </div>
                    </div>
                    {isFieldsCollapsed ? (
                        <ChevronDown className="w-5 h-5 text-white" />
                    ) : (
                        <ChevronUp className="w-5 h-5 text-white" />
                    )}
                </div>
                
                {/* Content */}
                <div className="p-6">
                    {/* Filter Section */}
                    <div className="mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <Label className="text-sm font-semibold mb-2">Client <span className="text-red-500">*</span></Label>
                                <Select value={clientId} onValueChange={setClientId}>
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
                                <Label className="text-sm font-semibold mb-2">Date From <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Date To <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-6">
                        <Label className="text-sm font-semibold mb-2 block">Search Containers</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                                placeholder="Search by container number or EIR number..."
                            />
                        </div>
                    </div>

                    {/* Fields Section */}
                    {!isFieldsCollapsed && (
                        <div className="mb-6">
                            <Label className="text-sm font-semibold mb-4 block">Fields to display: <span className="text-red-500">*</span></Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { key: 'eir_no', label: 'EIR No.' },
                                    { key: 'date', label: 'Date' },
                                    { key: 'time', label: 'Time' },
                                    { key: 'container_no', label: 'Cont. No.' },
                                    { key: 'size_type', label: 'Size/Type' },
                                    { key: 'status', label: 'Status' },
                                    { key: 'vessel', label: 'Vessel' },
                                    { key: 'voyage', label: 'Voyage' },
                                    { key: 'class', label: 'Class' },
                                    { key: 'date_manufactured', label: 'Date mfd' },
                                    { key: 'ex_consignee', label: 'Ex-Consignee' },
                                    { key: 'hauler', label: 'Hauler' },
                                    { key: 'plate_no', label: 'Plate No.' },
                                    { key: 'load', label: 'Load' },
                                    { key: 'origin', label: 'Origin' },
                                    { key: 'chasis', label: 'Chasis' },
                                ].map(({ key, label }) => (
                                    <div key={key} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`incoming-${key}`}
                                            checked={incomingFields[key]}
                                            onCheckedChange={(checked) =>
                                                setIncomingFields({ ...incomingFields, [key]: checked === true })
                                            }
                                        />
                                        <label
                                            htmlFor={`incoming-${key}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            style={{ color: colors.text.primary }}
                                        >
                                            {label}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="w-full h-px" style={{ backgroundColor: colors.table.border }}></div>
                <div className="px-6 py-4 bg-gray-50">
                    <p className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                        <span className="font-bold" style={{ color: colors.text.primary }}>{filteredReportData.length}</span> containers found
                    </p>
                </div>
            </div>

            {filteredReportData.length > 0 ? (
                <div className="w-full max-w-full overflow-x-auto">
                    <ModernTable
                        columns={[
                            { key: 'eir_no', label: 'EIR No.' },
                            { key: 'date', label: 'Date' },
                            { key: 'time', label: 'Time' },
                            { key: 'container_no', label: 'Cont. No.' },
                            { key: 'size_type', label: 'Size/Type' },
                            { key: 'status', label: 'Status' },
                            { key: 'vessel', label: 'Vessel' },
                            { key: 'voyage', label: 'Voyage' },
                            { key: 'class', label: 'Class' },
                            { key: 'date_manufactured', label: 'Date mfd' },
                            { key: 'ex_consignee', label: 'Ex-Consignee' },
                            { key: 'hauler', label: 'Hauler' },
                            { key: 'plate_no', label: 'Plate No.' },
                            { key: 'load', label: 'Load' },
                            { key: 'origin', label: 'Origin' },
                            { key: 'chasis', label: 'Chasis' },
                        ].filter(col => incomingFields[col.key as keyof typeof incomingFields])}
                        data={filteredReportData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                        pagination={{
                            currentPage: currentPage,
                            totalPages: Math.ceil(filteredReportData.length / itemsPerPage),
                            total: filteredReportData.length,
                            perPage: itemsPerPage,
                            onPageChange: setCurrentPage,
                        }}
                    />
                </div>
            ) : null}
        </div>
    );

    const renderOutgoingTab = () => (
        <div className="space-y-6">
            {/* Merged Filter and Fields Section */}
            <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                {/* Header */}
                <div 
                    className="cursor-pointer flex items-center justify-between px-6 py-5"
                    onClick={() => setIsFieldsCollapsed(!isFieldsCollapsed)}
                    style={{ backgroundColor: colors.brand.primary }}
                >
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-white" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Search & Filter Reports</h2>
                            <p className="text-sm text-white/90 mt-0.5">Generate and export container reports</p>
                        </div>
                    </div>
                    {isFieldsCollapsed ? (
                        <ChevronDown className="w-5 h-5 text-white" />
                    ) : (
                        <ChevronUp className="w-5 h-5 text-white" />
                    )}
                </div>
                
                {/* Content */}
                <div className="p-6">
                    {/* Filter Section */}
                    <div className="mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <Label className="text-sm font-semibold mb-2">Client <span className="text-red-500">*</span></Label>
                                <Select value={clientId} onValueChange={setClientId}>
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
                                <Label className="text-sm font-semibold mb-2">Date From <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Date To <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-6">
                        <Label className="text-sm font-semibold mb-2 block">Search Containers</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                                placeholder="Search by container number or EIR number..."
                            />
                        </div>
                    </div>

                    {/* Fields Section */}
                    {!isFieldsCollapsed && (
                        <div className="mb-6">
                            <Label className="text-sm font-semibold mb-4 block">Fields to display: <span className="text-red-500">*</span></Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { key: 'eir_no', label: 'EIR No.' },
                                { key: 'date', label: 'Date' },
                                { key: 'time', label: 'Time' },
                                { key: 'container_no', label: 'Container No.' },
                                { key: 'size_type', label: 'Size/Type' },
                                { key: 'status', label: 'Status' },
                                { key: 'vessel', label: 'Vessel' },
                                { key: 'voyage', label: 'Voyage' },
                                { key: 'shipper', label: 'Shipper' },
                                { key: 'hauler', label: 'Hauler' },
                                { key: 'booking', label: 'Booking' },
                                { key: 'destination', label: 'Destination' },
                                { key: 'plate_no', label: 'Plate No.' },
                                { key: 'load', label: 'Load' },
                                { key: 'chasis', label: 'Chasis' },
                                { key: 'seal_no', label: 'Seal No.' },
                            ].map(({ key, label}) => (
                                <div key={key} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`outgoing-${key}`}
                                        checked={outgoingFields[key]}
                                        onCheckedChange={(checked) =>
                                            setOutgoingFields({ ...outgoingFields, [key]: checked === true })
                                        }
                                    />
                                    <label
                                        htmlFor={`outgoing-${key}`}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        style={{ color: colors.text.primary }}
                                    >
                                        {label}
                                    </label>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="w-full h-px" style={{ backgroundColor: colors.table.border }}></div>
                <div className="px-6 py-4 bg-gray-50">
                    <p className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                        <span className="font-bold" style={{ color: colors.text.primary }}>{filteredReportData.length}</span> containers found
                    </p>
                </div>
            </div>

            {filteredReportData.length > 0 ? (
                <div className="w-full max-w-full overflow-x-auto">
                    <ModernTable
                        columns={[
                            { key: 'eir_no', label: 'EIR No.' },
                            { key: 'date', label: 'Date' },
                            { key: 'time', label: 'Time' },
                            { key: 'container_no', label: 'Container No.' },
                            { key: 'size_type', label: 'Size/Type' },
                            { key: 'status', label: 'Status' },
                            { key: 'vessel', label: 'Vessel' },
                            { key: 'voyage', label: 'Voyage' },
                            { key: 'shipper', label: 'Shipper' },
                            { key: 'hauler', label: 'Hauler' },
                            { key: 'booking', label: 'Booking' },
                            { key: 'destination', label: 'Destination' },
                            { key: 'plate_no', label: 'Plate No.' },
                            { key: 'load', label: 'Load' },
                            { key: 'chasis', label: 'Chasis' },
                            { key: 'seal_no', label: 'Seal No.' },
                        ].filter(col => outgoingFields[col.key as keyof typeof outgoingFields])}
                        data={filteredReportData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                        pagination={{
                            currentPage: currentPage,
                            totalPages: Math.ceil(filteredReportData.length / itemsPerPage),
                            total: filteredReportData.length,
                            perPage: itemsPerPage,
                            onPageChange: setCurrentPage,
                        }}
                    />
                </div>
            ) : null}
        </div>
    );

    const renderDMRTab = () => (
        <div className="space-y-6">
            {/* Filter Section - Non-collapsible */}
            <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                {/* Header */}
                <div 
                    className="px-6 py-5"
                    style={{ backgroundColor: colors.brand.primary }}
                >
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-white" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Search & Filter Reports</h2>
                            <p className="text-sm text-white/90 mt-0.5">Generate and export container reports</p>
                        </div>
                    </div>
                </div>
                
                {/* Content */}
                <div className="p-6">
                    {/* Filter Section */}
                    <div className="mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Label className="text-sm font-semibold mb-2">Client <span className="text-red-500">*</span></Label>
                                <Select value={clientId} onValueChange={setClientId}>
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
                                <Label className="text-sm font-semibold mb-2">Date <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={singleDate}
                                    onChange={(e) => setSingleDate(e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-6">
                        <Label className="text-sm font-semibold mb-2 block">Search Containers</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                                placeholder="Search by container number or EIR number..."
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="w-full h-px" style={{ backgroundColor: colors.table.border }}></div>
                <div className="px-6 py-4 bg-gray-50">
                    <p className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                        <span className="font-bold" style={{ color: colors.text.primary }}>{filteredReportData.length}</span> containers found
                    </p>
                </div>
            </div>

            {filteredReportData.length > 0 && (
                <div className="w-full max-w-full overflow-x-auto">
                    <ModernTable
                        columns={[
                            { key: 'container_no', label: 'Container No.' },
                            { key: 'size_type', label: 'Size/Type' },
                            { key: 'status', label: 'Status' },
                            { key: 'load', label: 'Load' },
                            { key: 'client', label: 'Client' },
                            { key: 'date', label: 'Date' },
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
                </div>
            )}
        </div>
    );

    const renderDCRTab = () => (
        <div className="space-y-6">
            {/* Filter Section - Non-collapsible */}
            <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                {/* Header */}
                <div 
                    className="px-6 py-5"
                    style={{ backgroundColor: colors.brand.primary }}
                >
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-white" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Search & Filter Reports</h2>
                            <p className="text-sm text-white/90 mt-0.5">Generate and export container reports</p>
                        </div>
                    </div>
                </div>
                
                {/* Content */}
                <div className="p-6">
                    {/* Filter Section */}
                    <div className="mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <Label className="text-sm font-semibold mb-2">Date <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={singleDate}
                                    onChange={(e) => setSingleDate(e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-6">
                        <Label className="text-sm font-semibold mb-2 block">Search Containers</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                                placeholder="Search by container number or EIR number..."
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="w-full h-px" style={{ backgroundColor: colors.table.border }}></div>
                <div className="px-6 py-4 bg-gray-50">
                    <p className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                        <span className="font-bold" style={{ color: colors.text.primary }}>{filteredReportData.length}</span> containers found
                    </p>
                </div>
            </div>

            {filteredReportData.length > 0 && (
                <div className="w-full max-w-full overflow-x-auto">
                    <ModernTable
                        columns={[
                            { key: 'container_no', label: 'Container No.' },
                            { key: 'size_type', label: 'Size/Type' },
                            { key: 'status', label: 'Status' },
                            { key: 'load', label: 'Load' },
                            { key: 'date', label: 'Date' },
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
                </div>
            )}
        </div>
    );

    return (
        <AuthenticatedLayout>
            <Head title="Reports" />
            <div className="space-y-6 overflow-hidden">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                Reports
                            </h1>
                            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                Generate and export container reports
                            </p>
                        </div>
                    </div>
                    
                    {/* Generate and Export Buttons at Top */}
                    <div className="flex items-center gap-3">
                        <ModernButton 
                            variant="primary" 
                            onClick={handleSearch} 
                            disabled={loading || (activeTab === 'incoming' || activeTab === 'outgoing' ? (!startDate || !endDate) : !singleDate)}
                            className="px-6 py-3"
                        >
                            <FileText className="w-5 h-5" />
                            {loading ? 'Generating...' : 'Generate'}
                        </ModernButton>
                        {activeTab === 'dcr' && (
                            <ModernButton
                                variant="primary"
                                onClick={handleDocsFeeExport}
                                disabled={loading || !singleDate}
                                className="px-6 py-3"
                            >
                                <Download className="w-5 h-5" />
                                Docs Fee
                            </ModernButton>
                        )}
                        <ModernButton 
                            variant="add" 
                            onClick={handleExportClick} 
                            disabled={loading}
                            className="px-6 py-3"
                        >
                            <Download className="w-5 h-5" />
                            Export
                        </ModernButton>
                    </div>
                </div>

                <ModernConfirmDialog
                    open={showExportConfirm}
                    onOpenChange={setShowExportConfirm}
                    onConfirm={handleExportConfirm}
                    title="Export Report Data"
                    description={`Are you sure you want to export the ${activeTab.toUpperCase()} report?`}
                    confirmText="Export"
                    cancelText="Cancel"
                />

                <div className="p-2 rounded-xl shadow-sm flex gap-2" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                    <button
                        onClick={() => setActiveTab('incoming')}
                        className={`flex-1 px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
                            activeTab === 'incoming' ? 'shadow-md' : 'hover:bg-opacity-50'
                        }`}
                        style={{
                            backgroundColor: activeTab === 'incoming' ? colors.brand.primary : 'transparent',
                            color: activeTab === 'incoming' ? '#FFFFFF' : colors.text.primary,
                        }}
                    >
                        Incoming
                    </button>
                    <button
                        onClick={() => setActiveTab('outgoing')}
                        className={`flex-1 px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
                            activeTab === 'outgoing' ? 'shadow-md' : 'hover:bg-opacity-50'
                        }`}
                        style={{
                            backgroundColor: activeTab === 'outgoing' ? colors.brand.primary : 'transparent',
                            color: activeTab === 'outgoing' ? '#FFFFFF' : colors.text.primary,
                        }}
                    >
                        Outgoing
                    </button>
                    <button
                        onClick={() => setActiveTab('dmr')}
                        className={`flex-1 px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
                            activeTab === 'dmr' ? 'shadow-md' : 'hover:bg-opacity-50'
                        }`}
                        style={{
                            backgroundColor: activeTab === 'dmr' ? colors.brand.primary : 'transparent',
                            color: activeTab === 'dmr' ? '#FFFFFF' : colors.text.primary,
                        }}
                    >
                        DMR
                    </button>
                    <button
                        onClick={() => setActiveTab('dcr')}
                        className={`flex-1 px-6 py-3 rounded-lg font-semibold text-sm transition-all ${
                            activeTab === 'dcr' ? 'shadow-md' : 'hover:bg-opacity-50'
                        }`}
                        style={{
                            backgroundColor: activeTab === 'dcr' ? colors.brand.primary : 'transparent',
                            color: activeTab === 'dcr' ? '#FFFFFF' : colors.text.primary,
                        }}
                    >
                        DCR
                    </button>
                </div>

                <div className="mt-6">
                    {activeTab === 'incoming' && renderIncomingTab()}
                    {activeTab === 'outgoing' && renderOutgoingTab()}
                    {activeTab === 'dmr' && renderDMRTab()}
                    {activeTab === 'dcr' && renderDCRTab()}
                </div>
            </div>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
};

export default Index;

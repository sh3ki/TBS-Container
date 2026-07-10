import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
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
    const [showDocsFeeConfirm, setShowDocsFeeConfirm] = useState(false);
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
        } else if (activeTab === 'dmr') {
            if (!singleDate) {
                error('Please select a date');
                return;
            }
            if (!clientId || clientId === 'all' || clientId === '') {
                error('Please select a client');
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

            // Determine MIME type based on content-type header or tab type
            const contentType = response.headers['content-type'] || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType }));
            const link = document.createElement('a');
            link.href = url;
            
            // Get filename from content-disposition header
            let filename = '';
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                // Try to extract filename from content-disposition header
                const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }
            
            // If filename not found, generate one
            if (!filename) {
                if (activeTab === 'incoming') {
                    filename = `IncomingReport_${startDate}_to_${endDate}.xlsx`;
                } else if (activeTab === 'outgoing') {
                    filename = `OutgoingReport_${startDate}_to_${endDate}.xlsx`;
                } else if (activeTab === 'dmr') {
                    filename = `DMR_Report_${singleDate}.xlsx`;
                } else if (activeTab === 'dcr') {
                    filename = `DCR_Report_${singleDate}.csv`;
                }
            }
            
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

    const handleDocsFeeExportClick = () => {
        if (!singleDate) {
            error('Please select a date');
            return;
        }
        setShowDocsFeeConfirm(true);
    };

    const handleDocsFeeExport = async () => {
        setShowDocsFeeConfirm(false);
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
        } else if (activeTab === 'dmr') {
            if (!singleDate) {
                error('Please select a date');
                return;
            }
            if (!clientId || clientId === 'all' || clientId === '') {
                error('Please select a client');
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
                        success(`Found ${data.length} records`);
                        break;
                    case 'outgoing':
                        setOutgoingData(data);
                        success(`Found ${data.length} records`);
                        break;
                    case 'dmr':
                        setDmrData(data);
                        success(`Found ${data.length} records`);
                        break;
                    case 'dcr':
                        setDcrData(data);
                        const inOutCount = data.in_out?.length || 0;
                        success(`Generated DCR report with ${inOutCount} clients`);
                        break;
                }
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
                        setDcrData({});
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
                    setDcrData({});
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

    // Group data by client
    const groupDataByClient = (data: Record<string, unknown>[]) => {
        const grouped = new Map<string, Record<string, unknown>[]>();
        
        data.forEach((row) => {
            const client = String(row.client || 'Unknown');
            if (!grouped.has(client)) {
                grouped.set(client, []);
            }
            grouped.get(client)!.push(row);
        });
        
        return Array.from(grouped.entries()).map(([clientName, records]) => ({
            clientName,
            records,
        }));
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

    // Get badge variant for size/type (matching Inventory exactly)
    const getSizeTypeBadgeVariant = (sizeType: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
        if (!sizeType) return 'default';
        const size = sizeType.trim();
        if (size === '10/DJH') return 'success';
        else if (size === '20/FR') return 'error';
        else if (size === '20/HR') return 'warning';
        else if (size === '20/OT') return 'info';
        else if (size === '20/RF') return 'success';
        else if (size === '20/RH') return 'error';
        else if (size === '40/DC') return 'warning';
        else if (size === '40/FR') return 'info';
        else if (size === '40/HC') return 'success';
        else if (size === '40/OT') return 'error';
        else if (size === '40/RH') return 'warning';
        return 'default';
    };

    // Get badge variant for status
    const getStatusBadgeVariant = (status: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
        if (status === 'ASIS') return 'warning';
        else if (status === 'AVL') return 'success';
        else if (status === 'DMG') return 'error';
        else if (status === 'FSV') return 'info';
        else if (status === 'HLD') return 'error';
        else if (status === 'REPO') return 'warning';
        else if (status === 'RPR') return 'success';
        else if (status === 'WSH') return 'info';
                                        
    };

    // Get badge variant for load
    const getLoadBadgeVariant = (load: string): 'success' | 'info' | 'default' => {
        if (!load) return 'default';
        const loadUpper = load.toUpperCase();
        if (loadUpper === 'EMPTY' || loadUpper === 'E') return 'info';
        else if (loadUpper === 'LADEN' || loadUpper === 'L' || loadUpper === 'FULL' || loadUpper === 'F') return 'success';
        return 'default';
    };

    // Filter report data based on search term
    const filteredReportData = (() => {
        const data = getCurrentTabData();
        // DCR returns an object with in_out, teus, billing - not an array
        if (activeTab === 'dcr' && typeof data === 'object' && !Array.isArray(data)) {
            return data.in_out || [];
        }
        // Other tabs return arrays
        if (!Array.isArray(data)) return [];
        return data.filter((row) => {
            if (!searchTerm) return true;
            const search = searchTerm.toLowerCase();
            const containerNo = String(row.container_no || '').toLowerCase();
            const eirNo = String(row.eir_no || '').toLowerCase();
            return containerNo.includes(search) || eirNo.includes(search);
        });
    })();

    const renderIncomingTab = () => {
        const allClientGroups = groupDataByClient(filteredReportData);
        const clientGroupsPerPage = 1; // Show 1 client group per "page"
        const clientGroups = allClientGroups.slice(
            (currentPage - 1) * clientGroupsPerPage,
            currentPage * clientGroupsPerPage
        );

        return (
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
                            <span className="font-bold" style={{ color: colors.text.primary }}>{filteredReportData.length}</span> containers found in <span className="font-bold" style={{ color: colors.text.primary }}>{allClientGroups.length}</span> client groups
                        </p>
                    </div>
                </div>

                {/* Display grouped data */}
                {clientGroups.length > 0 ? (
                    <div className="space-y-8">
                        {clientGroups.map((group, idx) => (
                            <div key={idx} className="space-y-4">
                                {/* Client Header */}
                                <div className="px-6 py-3 rounded-lg" style={{ backgroundColor: colors.brand.primary }}>
                                    <h3 className="text-lg font-bold text-white">{group.clientName}</h3>
                                </div>
                                
                                {/* Client Data Table */}
                                <div className="w-full max-w-full overflow-x-auto">
                                    <ModernTable
                                        columns={[
                                            { key: 'eir_no', label: 'EIR No.', render: (row: Record<string, unknown>) => <div className="text-sm font-semibold text-gray-900">{String(row.eir_no || '-')}</div> },
                                            { key: 'container_no', label: 'Cont. No.', render: (row: Record<string, unknown>) => <div className="text-sm font-semibold text-gray-900">{String(row.container_no || '-')}</div> },
                                            { key: 'date', label: 'Date', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600 min-w-[100px]">{formatDate(String(row.date || ''))}</div> },
                                            { key: 'time', label: 'Time', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600 min-w-[95px]">{formatTime(String(row.time || ''))}</div> },
                                            { key: 'size_type', label: 'Size/Type', render: (row: Record<string, unknown>) => <div className="min-w-[70px]"><ModernBadge variant={getSizeTypeBadgeVariant(String(row.size_type || ''))}>{String(row.size_type || '-')}</ModernBadge></div> },
                                            { key: 'status', label: 'Status', render: (row: Record<string, unknown>) => <div className="min-w-[80px]"><ModernBadge variant={getStatusBadgeVariant(String(row.status || ''))}>{String(row.status || '-')}</ModernBadge></div> },
                                            { key: 'vessel', label: 'Vessel', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.vessel || '-')}</div> },
                                            { key: 'voyage', label: 'Voyage', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.voyage || '-')}</div> },
                                            { key: 'class', label: 'Class', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.class || '-')}</div> },
                                            { key: 'date_manufactured', label: 'Date mfd', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600 min-w-[100px]">{formatDate(String(row.date_manufactured || ''))}</div> },
                                            { key: 'ex_consignee', label: 'Ex-Consignee', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.ex_consignee || '-')}</div> },
                                            { key: 'hauler', label: 'Hauler', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.hauler || '-')}</div> },
                                            { key: 'plate_no', label: 'Plate No.', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.plate_no || '-')}</div> },
                                            { key: 'load', label: 'Load', render: (row: Record<string, unknown>) => <div className="min-w-[70px]"><ModernBadge variant={getLoadBadgeVariant(String(row.load || ''))}>{String(row.load || '-')}</ModernBadge></div> },
                                            { key: 'origin', label: 'Origin', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.origin || '-')}</div> },
                                            { key: 'chasis', label: 'Chasis', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.chasis || '-')}</div> },
                                        ].filter(col => incomingFields[col.key as keyof typeof incomingFields])}
                                        data={group.records}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}

                {/* Pagination by client groups */}
                {allClientGroups.length > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: colors.table.border }}>
                        <div className="text-sm" style={{ color: colors.text.secondary }}>
                            Showing client group <span className="font-bold" style={{ color: colors.text.primary }}>{currentPage}</span> of <span className="font-bold" style={{ color: colors.text.primary }}>{allClientGroups.length}</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: colors.brand.primary, color: 'white' }}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(Math.min(allClientGroups.length, currentPage + 1))}
                                disabled={currentPage === allClientGroups.length}
                                className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: colors.brand.primary, color: 'white' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderOutgoingTab = () => {
        const allClientGroups = groupDataByClient(filteredReportData);
        const clientGroupsPerPage = 1;
        const clientGroups = allClientGroups.slice(
            (currentPage - 1) * clientGroupsPerPage,
            currentPage * clientGroupsPerPage
        );

        return (
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
                            <span className="font-bold" style={{ color: colors.text.primary }}>{filteredReportData.length}</span> containers found in <span className="font-bold" style={{ color: colors.text.primary }}>{allClientGroups.length}</span> client groups
                        </p>
                    </div>
                </div>

                {/* Display grouped data */}
                {clientGroups.length > 0 ? (
                    <div className="space-y-8">
                        {clientGroups.map((group, idx) => (
                            <div key={idx} className="space-y-4">
                                {/* Client Header */}
                                <div className="px-6 py-3 rounded-lg" style={{ backgroundColor: colors.brand.primary }}>
                                    <h3 className="text-lg font-bold text-white">{group.clientName}</h3>
                                </div>
                                
                                {/* Client Data Table */}
                                <div className="w-full max-w-full overflow-x-auto">
                                    <ModernTable
                                        columns={[
                                            { key: 'eir_no', label: 'EIR No.', render: (row: Record<string, unknown>) => <div className="text-sm font-semibold text-gray-900">{String(row.eir_no || '-')}</div> },
                                            { key: 'container_no', label: 'Container No.', render: (row: Record<string, unknown>) => <div className="text-sm font-semibold text-gray-900">{String(row.container_no || '-')}</div> },
                                            { key: 'date', label: 'Date', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600 min-w-[100px]">{formatDate(String(row.date || ''))}</div> },
                                            { key: 'time', label: 'Time', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600 min-w-[95px]">{formatTime(String(row.time || ''))}</div> },
                                            { key: 'size_type', label: 'Size/Type', render: (row: Record<string, unknown>) => <div className="min-w-[70px]"><ModernBadge variant={getSizeTypeBadgeVariant(String(row.size_type || ''))}>{String(row.size_type || '-')}</ModernBadge></div> },
                                            { key: 'status', label: 'Status', render: (row: Record<string, unknown>) => <div className="min-w-[80px]"><ModernBadge variant={getStatusBadgeVariant(String(row.status || ''))}>{String(row.status || '-')}</ModernBadge></div> },
                                            { key: 'vessel', label: 'Vessel', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.vessel || '-')}</div> },
                                            { key: 'voyage', label: 'Voyage', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.voyage || '-')}</div> },
                                            { key: 'shipper', label: 'Shipper', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.shipper || '-')}</div> },
                                            { key: 'hauler', label: 'Hauler', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.hauler || '-')}</div> },
                                            { key: 'booking', label: 'Booking', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.booking || '-')}</div> },
                                            { key: 'destination', label: 'Destination', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.destination || '-')}</div> },
                                            { key: 'plate_no', label: 'Plate No.', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.plate_no || '-')}</div> },
                                            { key: 'load', label: 'Load', render: (row: Record<string, unknown>) => <div className="min-w-[70px]"><ModernBadge variant={getLoadBadgeVariant(String(row.load || ''))}>{String(row.load || '-')}</ModernBadge></div> },
                                            { key: 'chasis', label: 'Chasis', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.chasis || '-')}</div> },
                                            { key: 'seal_no', label: 'Seal No.', render: (row: Record<string, unknown>) => <div className="text-sm text-gray-600">{String(row.seal_no || '-')}</div> },
                                        ].filter(col => outgoingFields[col.key as keyof typeof outgoingFields])}
                                        data={group.records}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}

                {/* Pagination by client groups */}
                {allClientGroups.length > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: colors.table.border }}>
                        <div className="text-sm" style={{ color: colors.text.secondary }}>
                            Showing client group <span className="font-bold" style={{ color: colors.text.primary }}>{currentPage}</span> of <span className="font-bold" style={{ color: colors.text.primary }}>{allClientGroups.length}</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: colors.brand.primary, color: 'white' }}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(Math.min(allClientGroups.length, currentPage + 1))}
                                disabled={currentPage === allClientGroups.length}
                                className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: colors.brand.primary, color: 'white' }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderDMRTab = () => {
        return (
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
                                <h2 className="text-xl font-bold text-white">Daily Aging Report (DMR)</h2>
                                <p className="text-sm text-white/90 mt-0.5">Generate and export container aging reports</p>
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
                                            <SelectValue placeholder="Select a client" />
                                        </SelectTrigger>
                                        <SelectContent>
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
                            <span className="font-bold" style={{ color: colors.text.primary }}>{filteredReportData.length}</span> units found
                        </p>
                    </div>
                </div>

                {filteredReportData.length > 0 && (
                    <div className="w-full max-w-full overflow-x-auto">
                        <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                            {/* Title */}
                            <div className="px-6 py-4 border-b" style={{ borderColor: colors.table.border }}>
                                <p className="text-sm font-bold text-gray-900">TBS CONTAINER YARD OPC, INC</p>
                                <p className="text-sm font-bold text-gray-900 mt-1">INVENTORY REPORT AS OF {singleDate}</p>
                            </div>
                            
                            <table className="w-full">
                                <thead>
                                    <tr style={{ backgroundColor: colors.brand.primary }}>
                                        <th className="px-4 py-3 text-left text-white font-semibold text-sm">NO.</th>
                                        <th className="px-4 py-3 text-left text-white font-semibold text-sm">CONTAINER NO.</th>
                                        <th className="px-4 py-3 text-left text-white font-semibold text-sm">SIZE/TYPE</th>
                                        <th className="px-4 py-3 text-left text-white font-semibold text-sm">DATE IN</th>
                                        <th className="px-4 py-3 text-left text-white font-semibold text-sm">AGE</th>
                                        <th className="px-4 py-3 text-left text-white font-semibold text-sm">STATUS</th>
                                        <th className="px-4 py-3 text-left text-white font-semibold text-sm">CLASS</th>
                                        <th className="px-4 py-3 text-left text-white font-semibold text-sm">DMF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        // Group data by size_type
                                        const groupedBySizeType = new Map<string, Record<string, unknown>[]>();
                                        filteredReportData.forEach((row) => {
                                            const sizeType = String(row.size_type || 'Unknown');
                                            if (!groupedBySizeType.has(sizeType)) {
                                                groupedBySizeType.set(sizeType, []);
                                            }
                                            groupedBySizeType.get(sizeType)!.push(row);
                                        });

                                        let rowNumber = 1;
                                        const rows: React.ReactNode[] = [];

                                        // Iterate through each size type group
                                        groupedBySizeType.forEach((items, sizeType) => {
                                            // Add rows for this size type
                                            items.forEach((row) => {
                                                rows.push(
                                                    <tr key={`${sizeType}-${rowNumber}`} style={{ borderBottom: `1px solid ${colors.table.border}` }}>
                                                        <td className="px-4 py-3 text-sm text-gray-900">{rowNumber}</td>
                                                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{String(row.container_no || '-')}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600"><ModernBadge variant={getSizeTypeBadgeVariant(String(row.size_type || ''))}>{String(row.size_type || '-')}</ModernBadge></td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(String(row.date_in || ''))}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{String(row.age || '-')}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600"><ModernBadge variant={getStatusBadgeVariant(String(row.status || ''))}>{String(row.status || '-')}</ModernBadge></td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{String(row.class || '-')}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(String(row.dmf || ''))}</td>
                                                    </tr>
                                                );
                                                rowNumber++;
                                            });

                                            // Add subtotal row for this size type
                                            rows.push(
                                                <tr key={`${sizeType}-subtotal`} style={{ backgroundColor: colors.brand.primary, borderBottom: `1px solid ${colors.table.border}` }}>
                                                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-white"></td>
                                                    <td className="px-4 py-3 text-sm font-bold text-white">{items.length}</td>
                                                    <td className="px-4 py-3 text-sm font-bold text-white">UNITS</td>
                                                    <td colSpan={4} className="px-4 py-3 text-sm font-bold text-white"></td>
                                                </tr>
                                            );
                                        });

                                        return rows;
                                    })()}
                                </tbody>
                            </table>

                            {/* Footer with total */}
                            <div className="px-6 py-4 border-t" style={{ borderColor: colors.table.border, backgroundColor: colors.brand.primary }}>
                                <p className="text-sm font-bold text-white">TOTAL NO. OF UNITS: <span>{filteredReportData.length}</span></p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderDCRTab = () => {
        const inOutData = dcrData?.in_out || [];
        const teusData = dcrData?.teus || [];
        const billingData = dcrData?.billing || {};
        const totals = dcrData?.totals || {};

        return (
        <div className="space-y-6">
            {/* Filter Section */}
            <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                <div 
                    className="px-6 py-5"
                    style={{ backgroundColor: colors.brand.primary }}
                >
                    <div className="flex items-center gap-3">
                        <Search className="w-5 h-5 text-white" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Daily Container Report (DCR)</h2>
                            <p className="text-sm text-white/90 mt-0.5">Generate and export daily container reports - showing IN/OUT by size and client</p>
                        </div>
                    </div>
                </div>
                
                <div className="p-6">
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
                </div>

                <div className="w-full h-px" style={{ backgroundColor: colors.table.border }}></div>
                <div className="px-6 py-4 bg-gray-50">
                    <p className="text-sm font-medium" style={{ color: colors.text.secondary }}>
                        DCR data will be generated and shown below when you click "Generate"
                    </p>
                </div>
            </div>

            {inOutData && inOutData.length > 0 && (
                <div className="space-y-6">
                    {/* TABLE 1: IN/OUT BY CLIENT */}
                    <div className="w-full max-w-full overflow-x-auto">
                        <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                            <div className="px-6 py-4 border-b" style={{ borderColor: colors.table.border }}>
                                <p className="text-sm font-bold text-gray-900">IN/OUT BY CLIENT</p>
                                <p className="text-sm text-gray-600 mt-1">Date: {singleDate}</p>
                            </div>
                            
                            <table className="w-full">
                                <thead>
                                    <tr style={{ backgroundColor: colors.brand.primary }}>
                                        <th className="px-4 py-3 text-left text-white font-semibold text-sm">Client</th>
                                        <th colSpan={2} className="px-4 py-3 text-center text-white font-semibold text-sm">IN</th>
                                        <th colSpan={2} className="px-4 py-3 text-center text-white font-semibold text-sm">OUT</th>
                                    </tr>
                                    <tr style={{ backgroundColor: '#5A5A5A' }}>
                                        <th className="px-4 py-2 text-left text-white font-semibold text-xs"></th>
                                        <th className="px-4 py-2 text-center text-white font-semibold text-xs">20'</th>
                                        <th className="px-4 py-2 text-center text-white font-semibold text-xs">40'</th>
                                        <th className="px-4 py-2 text-center text-white font-semibold text-xs">20'</th>
                                        <th className="px-4 py-2 text-center text-white font-semibold text-xs">40'</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {inOutData.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: `1px solid ${colors.table.border}` }}>
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.client || '-'}</td>
                                            <td className="px-4 py-3 text-sm text-center text-gray-600">{row.in_20}</td>
                                            <td className="px-4 py-3 text-sm text-center text-gray-600">{row.in_40}</td>
                                            <td className="px-4 py-3 text-sm text-center text-gray-600">{row.out_20}</td>
                                            <td className="px-4 py-3 text-sm text-center text-gray-600">{row.out_40}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: colors.brand.primary }}>
                                        <td className="px-4 py-3 text-sm font-bold text-white">TOTAL</td>
                                        <td className="px-4 py-3 text-sm text-center font-bold text-white">{totals.ti || 0}</td>
                                        <td className="px-4 py-3 text-sm text-center font-bold text-white">{totals.fi || 0}</td>
                                        <td className="px-4 py-3 text-sm text-center font-bold text-white">{totals.to || 0}</td>
                                        <td className="px-4 py-3 text-sm text-center font-bold text-white">{totals.fo || 0}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* TABLE 2: TEUS */}
                    {teusData && teusData.length > 0 && (
                        <div className="w-full max-w-full overflow-x-auto">
                            <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                                <div className="px-6 py-4 border-b" style={{ borderColor: colors.table.border }}>
                                    <p className="text-sm font-bold text-gray-900">TEUS (TWENTY EQUIVALENT UNITS)</p>
                                </div>
                                
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ backgroundColor: colors.brand.primary }}>
                                            <th className="px-4 py-3 text-left text-white font-semibold text-sm">Client</th>
                                            <th className="px-4 py-3 text-center text-white font-semibold text-sm">IN</th>
                                            <th className="px-4 py-3 text-center text-white font-semibold text-sm">OUT</th>
                                            <th className="px-4 py-3 text-center text-white font-semibold text-sm">Total TEUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teusData.map((row, idx) => (
                                            <tr key={idx} style={{ borderBottom: `1px solid ${colors.table.border}` }}>
                                                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.client || '-'}</td>
                                                <td className="px-4 py-3 text-sm text-center text-gray-600">{row.iin}</td>
                                                <td className="px-4 py-3 text-sm text-center text-gray-600">{row.iout}</td>
                                                <td className="px-4 py-3 text-sm text-center text-gray-600">{row.ts}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: colors.brand.primary }}>
                                            <td className="px-4 py-3 text-sm font-bold text-white">TOTAL</td>
                                            <td className="px-4 py-3 text-sm text-center font-bold text-white">{totals.iin || 0}</td>
                                            <td className="px-4 py-3 text-sm text-center font-bold text-white">{totals.iout || 0}</td>
                                            <td className="px-4 py-3 text-sm text-center font-bold text-white">{totals.ts || 0}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TABLE 3: BILLING/TOTAL AMOUNT */}
                    {billingData && Object.keys(billingData).length > 0 && (
                        <div className="w-full max-w-full overflow-x-auto">
                            <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                                <div className="px-6 py-4 border-b" style={{ borderColor: colors.table.border }}>
                                    <p className="text-sm font-bold text-gray-900">TOTAL AMOUNT / BILLING</p>
                                </div>
                                
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ backgroundColor: colors.brand.primary }}>
                                            <th className="px-4 py-3 text-left text-white font-semibold text-sm">Type</th>
                                            <th className="px-4 py-3 text-center text-white font-semibold text-sm">Count</th>
                                            <th className="px-4 py-3 text-center text-white font-semibold text-sm">Rate</th>
                                            <th className="px-4 py-3 text-center text-white font-semibold text-sm">Total Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ borderBottom: `1px solid ${colors.table.border}` }}>
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">IN</td>
                                            <td className="px-4 py-3 text-sm text-center text-gray-600">{billingData.incoming_count || 0}</td>
                                            <td className="px-4 py-3 text-sm text-center text-gray-600">{(billingData.incoming_rate || 1200).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-center font-bold text-gray-900">{(billingData.incoming_total || 0).toLocaleString()}</td>
                                        </tr>
                                        <tr style={{ borderBottom: `1px solid ${colors.table.border}` }}>
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">OUT</td>
                                            <td className="px-4 py-3 text-sm text-center text-gray-600">{billingData.outgoing_count || 0}</td>
                                            <td className="px-4 py-3 text-sm text-center text-gray-600">{(billingData.outgoing_rate || 1000).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-sm text-center font-bold text-gray-900">{(billingData.outgoing_total || 0).toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ backgroundColor: colors.brand.primary }}>
                                            <td className="px-4 py-3 text-sm font-bold text-white">GRAND TOTAL</td>
                                            <td className="px-4 py-3 text-sm text-center font-bold text-white">{(billingData.incoming_count || 0) + (billingData.outgoing_count || 0)}</td>
                                            <td className="px-4 py-3 text-sm text-center font-bold text-white"></td>
                                            <td className="px-4 py-3 text-sm text-center font-bold text-white">{(billingData.grand_total || 0).toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
    };

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
                            disabled={loading || (activeTab === 'incoming' || activeTab === 'outgoing' ? (!startDate || !endDate) : activeTab === 'dmr' ? (!singleDate || !clientId || clientId === '' || clientId === 'all') : !singleDate)}
                            className="px-6 py-3"
                        >
                            <FileText className="w-5 h-5" />
                            {loading ? 'Generating...' : 'Generate'}
                        </ModernButton>
                        {activeTab === 'dcr' && (
                            <ModernButton
                                variant="primary"
                                onClick={handleDocsFeeExportClick}
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

                <ModernConfirmDialog
                    open={showDocsFeeConfirm}
                    onOpenChange={setShowDocsFeeConfirm}
                    onConfirm={handleDocsFeeExport}
                    title="Export Docs Fee Report"
                    description="Are you sure you want to export the Docs Fee report?"
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

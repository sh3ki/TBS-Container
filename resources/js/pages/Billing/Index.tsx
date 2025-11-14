import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { ModernButton, ModernCard, ModernTable, ModernBadge, ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Clock, Users, Search } from 'lucide-react';
import { colors } from '@/lib/colors';

interface BillingData extends Record<string, unknown> {
    inv_id: number;
    hashed_id: string;
    container_no: string;
    client_code: string;
    client_name: string;
    container_size: string;
    date_in: string;
    date_out: string | null;
    storage_days: number;
    storage_rate: number;
    storage_charges: number;
    handling_rate: number;
    handling_off: number;
    handling_on: number;
    handling_charges: number;
    total: number;
}

interface Client {
    id: string;
    c_id: number;
    code: string;
    name: string;
    text: string;
}

interface BillingIndexProps {
    clients?: Client[];
}

const Index: React.FC<BillingIndexProps> = ({ clients: initialClients = [] }) => {
    const { toasts, removeToast, success, error } = useModernToast();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [clientId, setClientId] = useState('all');
    const [sizeType, setSizeType] = useState('all');
    const [clients, setClients] = useState<Client[]>(initialClients);
    const [billingData, setBillingData] = useState<BillingData[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;
    const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
    const [showExportConfirm, setShowExportConfirm] = useState(false);

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        try {
            const response = await axios.get('/api/billing/clients');
            if (response.data.success) {
                setClients(response.data.data);
            }
        } catch (err) {
            console.error('Failed to load clients:', err);
            error('Failed to load clients');
        }
    };

    const handleGenerateClick = () => {
        if (!startDate || !endDate) {
            error('Please select both start and end dates');
            return;
        }
        setShowGenerateConfirm(true);
    };

    const handleGenerateConfirm = async () => {
        setShowGenerateConfirm(false);
        setLoading(true);

        try {
            const response = await axios.post('/api/billing/generate', {
                start: startDate,
                end: endDate,
                client_id: clientId !== 'all' ? clientId : null,
            });

            if (response.data.success) {
                setBillingData(response.data.data);
                setCurrentPage(1); // Reset to first page
                
                success(`Generated ${response.data.data.length} billing records`);
            } else {
                error(response.data.message || 'Failed to generate billing');
            }
        } catch (err: unknown) {
            const err_response = err as { response?: { data?: { message?: string } } };
            error(err_response.response?.data?.message || 'Failed to generate billing');
        } finally {
            setLoading(false);
        }
    };

    const handleExportClick = () => {
        if (billingData.length === 0) {
            error('Please generate billing first');
            return;
        }
        setShowExportConfirm(true);
    };

    const handleExportConfirm = async () => {
        setShowExportConfirm(false);
        setLoading(true);

        try {
            const response = await axios.post('/api/billing/export', {
                start: startDate,
                end: endDate,
                client_id: clientId !== 'all' ? clientId : null,
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Billing_Report_${startDate}_to_${endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            success('Billing data exported successfully');
        } catch (error_caught: unknown) {
            const err = error_caught as { response?: { data?: { message?: string } } };
            error(err.response?.data?.message || 'Failed to export');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
        }).format(amount);
    };

    // Format date to "Jan 01, 2025"
    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
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

    return (
        <AuthenticatedLayout>
            <Head title="Billing Management" />
            
            <div className="space-y-6">
                {/* Page Header with Export Button */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                Billing Management
                            </h1>
                            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                Generate invoices and manage billing records
                            </p>
                        </div>
                    </div>
                    
                    {/* Generate and Export Buttons at Top */}
                    <div className="flex items-center gap-3">
                        <ModernButton 
                            variant="primary" 
                            onClick={handleGenerateClick} 
                            disabled={loading || !startDate || !endDate}
                            className="px-6 py-3"
                        >
                            <FileText className="w-5 h-5" />
                            {loading ? 'Generating...' : 'Generate'}
                        </ModernButton>
                        <ModernButton 
                            variant="add" 
                            onClick={handleExportClick} 
                            disabled={loading || billingData.length === 0}
                            className="px-6 py-3"
                        >
                            <Download className="w-5 h-5" />
                            Export
                        </ModernButton>
                    </div>
                </div>

                {/* Generate Confirmation Dialog */}
                <ModernConfirmDialog
                    open={showGenerateConfirm}
                    onOpenChange={setShowGenerateConfirm}
                    onConfirm={handleGenerateConfirm}
                    title="Generate Billing Records"
                    description={`Are you sure you want to generate billing records from ${startDate} to ${endDate}${clientId !== 'all' ? ' for the selected client' : ' for all clients'}?`}
                    confirmText="Generate"
                    cancelText="Cancel"
                />

                {/* Export Confirmation Dialog */}
                <ModernConfirmDialog
                    open={showExportConfirm}
                    onOpenChange={setShowExportConfirm}
                    onConfirm={handleExportConfirm}
                    title="Export Billing Data"
                    description={`Are you sure you want to export ${billingData.filter(item => sizeType === 'all' || item.container_size === sizeType).length} billing records to CSV?`}
                    confirmText="Export"
                    cancelText="Cancel"
                />

                {/* Filter Section */}
                <div className="relative" style={{ zIndex: 0 }}>
                    <ModernCard title="Search & Filter Billing" subtitle="Generate billing records" icon={<Search className="w-5 h-5" />}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <Label className="text-sm font-semibold mb-2 text-gray-900">Client Filter</Label>
                                <Select value={clientId} onValueChange={setClientId}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="All Clients" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Clients</SelectItem>
                                        {clients.map((client) => (
                                            <SelectItem key={client.id} value={client.id}>
                                                {client.text}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2 text-gray-900">Start Date</Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-11"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2 text-gray-900">End Date</Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="h-11"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2 text-gray-900">Size/Type Filter</Label>
                                <Select value={sizeType} onValueChange={setSizeType}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="All Sizes" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Sizes</SelectItem>
                                        <SelectItem value="10DJH">10DJH</SelectItem>
                                        <SelectItem value="20DJH">20DJH</SelectItem>
                                        <SelectItem value="20GP">20GP</SelectItem>
                                        <SelectItem value="40GP">40GP</SelectItem>
                                        <SelectItem value="40HC">40HC</SelectItem>
                                        <SelectItem value="45HC">45HC</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-sm text-gray-600">
                                <span className="font-semibold text-gray-900">{billingData.filter(item => sizeType === 'all' || item.container_size === sizeType).length}</span> billing record{billingData.filter(item => sizeType === 'all' || item.container_size === sizeType).length !== 1 ? 's' : ''} found
                            </p>
                        </div>
                    </ModernCard>
                </div>

                {/* Totals Row - Above Table */}
                {billingData.length > 0 && (
                    <>
                        <div className="p-6 rounded-xl shadow-sm" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                                <div>
                                    <div className="text-xs uppercase font-semibold mb-1" style={{ color: colors.text.secondary }}>
                                        Total Units
                                    </div>
                                    <div className="text-2xl font-bold flex items-center gap-2" style={{ color: colors.text.primary }}>
                                        <Users className="w-5 h-5" />
                                        {billingData.filter(item => sizeType === 'all' || item.container_size === sizeType).length}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase font-semibold mb-1" style={{ color: colors.text.secondary }}>
                                        Total Days
                                    </div>
                                    <div className="text-2xl font-bold flex items-center gap-2" style={{ color: colors.text.primary }}>
                                        <Clock className="w-5 h-5" />
                                        {billingData.filter(item => sizeType === 'all' || item.container_size === sizeType).reduce((sum, item) => sum + item.storage_days, 0)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase font-semibold mb-1" style={{ color: colors.text.secondary }}>
                                        Storage Cost
                                    </div>
                                    <div className="text-2xl font-bold" style={{ color: '#10B981' }}>
                                        {formatCurrency(billingData.filter(item => sizeType === 'all' || item.container_size === sizeType).reduce((sum, item) => sum + item.storage_charges, 0))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase font-semibold mb-1" style={{ color: colors.text.secondary }}>
                                        Handling (OFF)
                                    </div>
                                    <div className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                                        {formatCurrency(billingData.filter(item => sizeType === 'all' || item.container_size === sizeType).reduce((sum, item) => sum + item.handling_off, 0))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase font-semibold mb-1" style={{ color: colors.text.secondary }}>
                                        Handling (ON)
                                    </div>
                                    <div className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                                        {formatCurrency(billingData.filter(item => sizeType === 'all' || item.container_size === sizeType).reduce((sum, item) => sum + item.handling_on, 0))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs uppercase font-semibold mb-1" style={{ color: colors.text.secondary }}>
                                        Overall Total
                                    </div>
                                    <div className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
                                        {formatCurrency(billingData.filter(item => sizeType === 'all' || item.container_size === sizeType).reduce((sum, item) => sum + item.total, 0))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Billing Data Table with Pagination */}
                        <ModernTable
                            columns={[
                                {
                                    key: 'container_no',
                                    label: 'Container No.',
                                    width: '12%',
                                    render: (item: BillingData) => (
                                        <div className="font-medium text-gray-900 min-w-[110px]">
                                            {item.container_no}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'container_size',
                                    label: 'Size/Type',
                                    width: '8%',
                                    render: (item: BillingData) => {
                                        let variant: 'success' | 'error' | 'warning' | 'info' | 'default' = 'default';
                                        const size = item.container_size;
                                        
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
                                                <ModernBadge variant={variant}>{item.container_size || '-'}</ModernBadge>
                                            </div>
                                        );
                                    },
                                },
                                {
                                    key: 'date_in',
                                    label: 'Date In',
                                    width: '10%',
                                    render: (item: BillingData) => (
                                        <div className="text-sm text-gray-600 min-w-[100px]">
                                            {formatDate(item.date_in)}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'date_out',
                                    label: 'Date Out',
                                    width: '10%',
                                    render: (item: BillingData) => (
                                        <div className="text-sm text-gray-600 min-w-[100px]">
                                            {formatDate(item.date_out)}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'storage_days',
                                    label: 'Days',
                                    width: '7%',
                                    render: (item: BillingData) => (
                                        <div className="text-sm font-medium text-gray-900 min-w-[50px] text-center">
                                            {item.storage_days}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'storage_rate',
                                    label: 'S. Rate',
                                    width: '9%',
                                    render: (item: BillingData) => (
                                        <div className="text-sm text-right" style={{ color: colors.text.secondary }}>
                                            {item.storage_rate.toFixed(2)}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'storage_charges',
                                    label: 'S. Cost',
                                    width: '11%',
                                    render: (item: BillingData) => (
                                        <div className="text-sm font-semibold text-right" style={{ color: '#10B981' }}>
                                            {item.storage_charges.toFixed(2)}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'handling_off',
                                    label: 'H-OFF',
                                    width: '11%',
                                    render: (item: BillingData) => (
                                        <div className="text-sm font-semibold text-right" style={{ color: '#F59E0B' }}>
                                            {item.handling_off.toFixed(2)}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'handling_on',
                                    label: 'H-ON',
                                    width: '11%',
                                    render: (item: BillingData) => (
                                        <div className="text-sm font-semibold text-right" style={{ color: '#F59E0B' }}>
                                            {item.handling_on.toFixed(2)}
                                        </div>
                                    ),
                                },
                                {
                                    key: 'total',
                                    label: 'Total',
                                    width: '11%',
                                    render: (item: BillingData) => (
                                        <div className="text-sm font-bold text-right" style={{ color: colors.brand.primary }}>
                                            {item.total.toFixed(2)}
                                        </div>
                                    ),
                                },
                            ]}
                            data={billingData
                                .filter(item => sizeType === 'all' || item.container_size === sizeType)
                                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                            loading={loading}
                            emptyMessage="No billing records found. Generate a report to view data."
                            pagination={{
                                currentPage,
                                totalPages: Math.ceil(billingData.filter(item => sizeType === 'all' || item.container_size === sizeType).length / itemsPerPage),
                                perPage: itemsPerPage,
                                total: billingData.filter(item => sizeType === 'all' || item.container_size === sizeType).length,
                                onPageChange: setCurrentPage,
                            }}
                        />
                    </>
                )}

                {/* Empty State */}
                {billingData.length === 0 && !loading && (
                    <ModernCard title="No Data" subtitle="Generate a billing report to get started">
                        <div className="py-12 text-center" style={{ color: colors.text.secondary }}>
                            <FileText className="w-16 h-16 mx-auto mb-4 opacity-40" />
                            <p className="text-lg font-medium">No billing data generated yet</p>
                            <p className="text-sm mt-2">Select a date range and click "Generate" to create billing records</p>
                        </div>
                    </ModernCard>
                )}
            </div>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
};

export default Index;

import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ModernButton, ModernCard } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    FileText,
    Download,
    Calendar,
    TrendingUp,
    Package,
    Users,
    DollarSign,
    Activity,
    AlertCircle,
    BarChart,
    Printer
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';
import axios from 'axios';

interface Client {
    c_id: number;
    client_name: string;
    client_code: string;
}

export default function Index() {
    const { toast } = useToast();
    const [activeReport, setActiveReport] = useState('daily-gate');
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
    
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClient, setSelectedClient] = useState('');
    const [gateStatus, setGateStatus] = useState('both');
    const [size, setSize] = useState('');
    const [condition, setCondition] = useState('');
    const [bookingStatus, setBookingStatus] = useState('');
    
    const reports = [
        {
            id: 'daily-gate',
            name: 'Daily Gate In/Out',
            icon: Activity,
            description: 'Daily gate movements and container tracking',
            color: colors.brand.primary,
        },
        {
            id: 'inventory-status',
            name: 'Inventory Status',
            icon: Package,
            description: 'Current containers in yard',
            color: '#10B981',
        },
        {
            id: 'client-activity',
            name: 'Client Activity',
            icon: Users,
            description: 'Client-specific activity report',
            color: '#8B5CF6',
        },
        {
            id: 'billing-summary',
            name: 'Billing Summary',
            icon: DollarSign,
            description: 'Billing and charges overview',
            color: '#F59E0B',
        },
        {
            id: 'container-movement',
            name: 'Container Movement',
            icon: TrendingUp,
            description: 'Container movement history',
            color: '#6366F1',
        },
        {
            id: 'booking-status',
            name: 'Booking Status',
            icon: Calendar,
            description: 'Booking allocations and usage',
            color: '#EC4899',
        },
        {
            id: 'hold-containers',
            name: 'Hold Containers',
            icon: AlertCircle,
            description: 'Containers currently on hold',
            color: '#EF4444',
        },
        {
            id: 'damaged-containers',
            name: 'Damaged Containers',
            icon: AlertCircle,
            description: 'Containers with damage records',
            color: '#F97316',
        },
        {
            id: 'storage-utilization',
            name: 'Storage Utilization',
            icon: BarChart,
            description: 'Yard capacity and utilization',
            color: '#06B6D4',
        },
    ];

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const response = await axios.get('/api/clients');
            setClients(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch clients:', error);
        }
    };

    const generateReport = async () => {
        setLoading(true);
        setReportData(null);

        try {
            let endpoint = '';
            const params: Record<string, string | undefined> = {
                date_from: dateFrom,
                date_to: dateTo,
            };

            if (selectedClient) params.client_id = selectedClient;

            switch (activeReport) {
                case 'daily-gate':
                    endpoint = '/api/reports/daily-gate';
                    params.gate_status = gateStatus;
                    break;
                case 'inventory-status':
                    endpoint = '/api/reports/inventory-status';
                    if (size) params.size = size;
                    if (condition) params.condition = condition;
                    break;
                case 'client-activity':
                    endpoint = '/api/reports/client-activity';
                    if (!selectedClient) {
                        toast({ title: "Error", description: "Please select a client for this report", variant: "destructive" });
                        setLoading(false);
                        return;
                    }
                    break;
                case 'billing-summary':
                    endpoint = '/api/reports/billing-summary';
                    break;
                case 'container-movement':
                    endpoint = '/api/reports/container-movement';
                    break;
                case 'booking-status':
                    endpoint = '/api/reports/booking-status';
                    if (bookingStatus) params.status = bookingStatus;
                    break;
                case 'hold-containers':
                    endpoint = '/api/reports/hold-containers';
                    break;
                case 'damaged-containers':
                    endpoint = '/api/reports/damaged-containers';
                    break;
                case 'storage-utilization':
                    endpoint = '/api/reports/storage-utilization';
                    params.date = dateFrom;
                    break;
                default:
                    toast({ title: "Error", description: "Invalid report type", variant: "destructive" });
                    setLoading(false);
                    return;
            }

            const response = await axios.get(endpoint, { params });
            setReportData(response.data.data);

            toast({ title: "Success", description: "Report generated successfully" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to generate report", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = async () => {
        if (!reportData) {
            toast({ title: "Error", description: "No data to export", variant: "destructive" });
            return;
        }

        try {
            const csvData = convertToCSV(reportData);
            const blob = new Blob([csvData], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${activeReport}_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            window.URL.revokeObjectURL(url);

            toast({ title: "Success", description: "Report exported successfully" });
        } catch (error) {
            toast({ title: "Error", description: "Failed to export report", variant: "destructive" });
        }
    };

    const printReport = () => {
        window.print();
    };

    const convertToCSV = (data: Record<string, unknown>) => {
        const rows: string[][] = [];
        
        const dataArray = Object.values(data).find(Array.isArray);
        if (!dataArray || dataArray.length === 0) return '';

        const headers = Object.keys(dataArray[0]);
        rows.push(headers);

        dataArray.forEach((item: Record<string, unknown>) => {
            const row = headers.map(header => {
                const value = item[header];
                return typeof value === 'string' && value.includes(',') 
                    ? `"${value}"` 
                    : String(value ?? '');
            });
            rows.push(row);
        });

        return rows.map(row => row.join(',')).join('\n');
    };

    const activeReportConfig = reports.find(r => r.id === activeReport);

    return (
        <AuthenticatedLayout>
            <Head title="Reports & Analytics" />

            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                Reports & Analytics
                            </h1>
                            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                Generate and export business reports
                            </p>
                        </div>
                    </div>
                    {reportData && (
                        <div className="flex gap-3">
                            <ModernButton variant="secondary" onClick={printReport}>
                                <Printer className="w-4 h-4" />
                                Print
                            </ModernButton>
                            <ModernButton variant="primary" onClick={exportToExcel} disabled={loading}>
                                <Download className="w-4 h-4" />
                                Export CSV
                            </ModernButton>
                        </div>
                    )}
                </div>

                {/* Report Selection Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {reports.map((report) => (
                        <button
                            key={report.id}
                            onClick={() => setActiveReport(report.id)}
                            className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                                activeReport === report.id
                                    ? 'shadow-lg'
                                    : 'shadow hover:shadow-md'
                            }`}
                            style={{
                                borderColor: activeReport === report.id ? report.color : colors.table.border,
                                backgroundColor: activeReport === report.id ? report.color + '10' : colors.main,
                            }}
                        >
                            <report.icon 
                                className="w-8 h-8 mx-auto mb-2" 
                                style={{ color: report.color }}
                            />
                            <div className="text-sm font-semibold text-center" style={{ color: colors.text.primary }}>
                                {report.name}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Active Report Card */}
                {activeReportConfig && (
                    <ModernCard 
                        title={activeReportConfig.name}
                        subtitle={activeReportConfig.description}
                        icon={<activeReportConfig.icon className="w-5 h-5" />}
                    >
                        {/* Filter Panel */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 rounded-lg mb-6" style={{ backgroundColor: colors.table.header + '10', border: `1px solid ${colors.table.border}` }}>
                            {/* Date Range */}
                            {!['storage-utilization'].includes(activeReport) && (
                                <>
                                    <div>
                                        <Label className="text-sm font-semibold mb-2">Date From</Label>
                                        <Input
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) => setDateFrom(e.target.value)}
                                            className="h-11"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-sm font-semibold mb-2">Date To</Label>
                                        <Input
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) => setDateTo(e.target.value)}
                                            className="h-11"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Single Date for Storage Utilization */}
                            {activeReport === 'storage-utilization' && (
                                <div>
                                    <Label className="text-sm font-semibold mb-2">Date</Label>
                                    <Input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="h-11"
                                    />
                                </div>
                            )}

                            {/* Client Filter */}
                            {!['storage-utilization'].includes(activeReport) && (
                                <div>
                                    <Label className="text-sm font-semibold mb-2">
                                        Client {activeReport === 'client-activity' && <span className="text-red-500">*</span>}
                                    </Label>
                                    <Select 
                                        value={selectedClient || 'all'} 
                                        onValueChange={(val) => setSelectedClient(val === 'all' ? '' : val)}
                                    >
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="All Clients" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Clients</SelectItem>
                                            {clients.map((client) => (
                                                <SelectItem key={client.c_id} value={client.c_id.toString()}>
                                                    {client.client_code} - {client.client_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Gate Status for Daily Gate Report */}
                            {activeReport === 'daily-gate' && (
                                <div>
                                    <Label className="text-sm font-semibold mb-2">Gate Status</Label>
                                    <Select value={gateStatus} onValueChange={setGateStatus}>
                                        <SelectTrigger className="h-11">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="both">Both (In & Out)</SelectItem>
                                            <SelectItem value="in">Gate In Only</SelectItem>
                                            <SelectItem value="out">Gate Out Only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Container Size for Inventory Status */}
                            {activeReport === 'inventory-status' && (
                                <>
                                    <div>
                                        <Label className="text-sm font-semibold mb-2">Size</Label>
                                        <Select value={size || 'all'} onValueChange={(val) => setSize(val === 'all' ? '' : val)}>
                                            <SelectTrigger className="h-11">
                                                <SelectValue placeholder="All Sizes" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Sizes</SelectItem>
                                                <SelectItem value="20">20"</SelectItem>
                                                <SelectItem value="40">40"</SelectItem>
                                                <SelectItem value="45">45"</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-semibold mb-2">Condition</Label>
                                        <Select value={condition || 'all'} onValueChange={(val) => setCondition(val === 'all' ? '' : val)}>
                                            <SelectTrigger className="h-11">
                                                <SelectValue placeholder="All Conditions" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All</SelectItem>
                                                <SelectItem value="E">Empty</SelectItem>
                                                <SelectItem value="F">Full</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </>
                            )}

                            {/* Booking Status Filter */}
                            {activeReport === 'booking-status' && (
                                <div>
                                    <Label className="text-sm font-semibold mb-2">Status</Label>
                                    <Select value={bookingStatus || 'all'} onValueChange={(val) => setBookingStatus(val === 'all' ? '' : val)}>
                                        <SelectTrigger className="h-11">
                                            <SelectValue placeholder="All Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="upcoming">Upcoming</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Generate Button */}
                        <div className="flex justify-center mb-6">
                            <ModernButton 
                                variant="add" 
                                size="lg"
                                onClick={generateReport} 
                                disabled={loading}
                            >
                                <FileText className="w-4 h-4" />
                                Generate Report
                            </ModernButton>
                        </div>

                        {/* Report Preview/Results */}
                        {reportData && (
                            <div className="p-6 rounded-lg" style={{ backgroundColor: colors.table.header + '10', border: `1px solid ${colors.table.border}` }}>
                                <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text.primary }}>
                                    Report Preview
                                </h3>
                                <div className="prose max-w-none">
                                    <pre className="text-sm" style={{ color: colors.text.secondary }}>
                                        {JSON.stringify(reportData, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        )}
                    </ModernCard>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

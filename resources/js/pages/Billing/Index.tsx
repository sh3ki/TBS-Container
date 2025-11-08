import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { ModernButton, ModernCard, ModernTable, ModernBadge } from '@/components/modern';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, Calendar, DollarSign, Download, TrendingUp, Package, Clock, Users } from 'lucide-react';
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
    handling_count: number;
    handling_rate: number;
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

interface Summary {
    total_storage_charges: number;
    total_handling_charges: number;
    total_charges: number;
    record_count: number;
}

export default function Index() {
    const { toast } = useToast();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [clientId, setClientId] = useState('all');
    const [clients, setClients] = useState<Client[]>([]);
    const [billingData, setBillingData] = useState<BillingData[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(lastDay.toISOString().split('T')[0]);
        
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
            toast({ title: "Error", description: "Failed to load clients", variant: "destructive" });
        }
    };

    const handleGenerate = async () => {
        if (!startDate || !endDate) {
            toast({ title: "Error", description: "Please select both start and end dates", variant: "destructive" });
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('/api/billing/generate', {
                start: startDate,
                end: endDate,
            });

            if (response.data.success) {
                setBillingData(response.data.data);
                setSummary(response.data.summary);
                
                toast({
                    title: "Success",
                    description: `Generated ${response.data.summary.record_count} billing records`
                });
            } else {
                toast({
                    title: "Error",
                    description: response.data.message || 'Failed to generate billing',
                    variant: "destructive"
                });
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            toast({
                title: "Error",
                description: error.response?.data?.message || 'Failed to generate billing',
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        if (billingData.length === 0) {
            toast({ title: "Error", description: "Please generate billing first", variant: "destructive" });
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post('/api/billing/export', {
                start: startDate,
                end: endDate,
                client_id: clientId !== 'all' ? clientId : null,
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `billing_${startDate}_to_${endDate}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            toast({ title: "Success", description: "Billing data exported successfully" });
        } catch (err) {
            toast({ title: "Error", description: 'Failed to export', variant: "destructive" });
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

    return (
        <AuthenticatedLayout>
            <Head title="Billing Management" />
            
            <div className="space-y-6">
                {/* Page Header */}
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
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="p-6 rounded-xl shadow-lg" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: colors.brand.primary + '20' }}>
                                    <FileText className="w-5 h-5" style={{ color: colors.brand.primary }} />
                                </div>
                                <div className="text-xs uppercase font-semibold" style={{ color: colors.text.secondary }}>
                                    Total Records
                                </div>
                            </div>
                            <div className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                {summary.record_count}
                            </div>
                        </div>

                        <div className="p-6 rounded-xl shadow-lg" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: '#10B981' + '20' }}>
                                    <Package className="w-5 h-5" style={{ color: '#10B981' }} />
                                </div>
                                <div className="text-xs uppercase font-semibold" style={{ color: colors.text.secondary }}>
                                    Storage Charges
                                </div>
                            </div>
                            <div className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                {formatCurrency(summary.total_storage_charges)}
                            </div>
                        </div>

                        <div className="p-6 rounded-xl shadow-lg" style={{ backgroundColor: colors.main, border: `1px solid ${colors.table.border}` }}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg" style={{ backgroundColor: '#F59E0B' + '20' }}>
                                    <TrendingUp className="w-5 h-5" style={{ color: '#F59E0B' }} />
                                </div>
                                <div className="text-xs uppercase font-semibold" style={{ color: colors.text.secondary }}>
                                    Handling Charges
                                </div>
                            </div>
                            <div className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                {formatCurrency(summary.total_handling_charges)}
                            </div>
                        </div>

                        <div className="p-6 rounded-xl shadow-lg" style={{ backgroundColor: colors.brand.primary, border: `1px solid ${colors.brand.primary}` }}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-white bg-opacity-20">
                                    <DollarSign className="w-5 h-5 text-white" />
                                </div>
                                <div className="text-xs uppercase font-semibold text-white opacity-90">
                                    Total Charges
                                </div>
                            </div>
                            <div className="text-3xl font-bold text-white">
                                {formatCurrency(summary.total_charges)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <ModernCard title="Generate Billing Report" subtitle="Select date range and client" icon={<Calendar className="w-5 h-5" />}>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <Label className="text-sm font-semibold mb-2">Start Date</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="mt-1.5"
                            />
                        </div>
                        <div>
                            <Label className="text-sm font-semibold mb-2">End Date</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="mt-1.5"
                            />
                        </div>
                        <div>
                            <Label className="text-sm font-semibold mb-2">Client Filter</Label>
                            <Select value={clientId} onValueChange={setClientId}>
                                <SelectTrigger className="mt-1.5">
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
                        <div className="flex items-end gap-2">
                            <ModernButton variant="primary" onClick={handleGenerate} disabled={loading} className="flex-1">
                                <FileText className="w-4 h-4" />
                                {loading ? 'Generating...' : 'Generate'}
                            </ModernButton>
                            <ModernButton 
                                variant="add" 
                                onClick={handleExport} 
                                disabled={loading || billingData.length === 0}
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </ModernButton>
                        </div>
                    </div>
                </ModernCard>

                {/* Billing Data Table */}
                {billingData.length > 0 && (
                    <ModernCard title="Billing Records" subtitle={`${billingData.length} records generated`}>
                        <ModernTable
                            columns={[
                                {
                                    key: 'container_no',
                                    label: 'Container',
                                    render: (item: BillingData) => (
                                        <div>
                                            <div className="font-semibold" style={{ color: colors.text.primary }}>
                                                {item.container_no}
                                            </div>
                                            <div className="text-xs" style={{ color: colors.text.secondary }}>
                                                Size: {item.container_size}
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'client_name',
                                    label: 'Client',
                                    render: (item: BillingData) => (
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: colors.brand.primary }}>
                                                {item.client_code.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium" style={{ color: colors.text.primary }}>
                                                    {item.client_name}
                                                </div>
                                                <div className="text-xs" style={{ color: colors.text.secondary }}>
                                                    {item.client_code}
                                                </div>
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'storage',
                                    label: 'Storage',
                                    render: (item: BillingData) => (
                                        <div>
                                            <div className="flex items-center gap-1 text-sm" style={{ color: colors.text.primary }}>
                                                <Clock className="w-3.5 h-3.5" />
                                                {item.storage_days} days
                                            </div>
                                            <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                                Rate: {formatCurrency(item.storage_rate)}/day
                                            </div>
                                            <div className="text-xs font-semibold mt-1" style={{ color: '#10B981' }}>
                                                {formatCurrency(item.storage_charges)}
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'handling',
                                    label: 'Handling',
                                    render: (item: BillingData) => (
                                        <div>
                                            <div className="text-sm" style={{ color: colors.text.primary }}>
                                                {item.handling_count} operations
                                            </div>
                                            <div className="text-xs mt-1" style={{ color: colors.text.secondary }}>
                                                Rate: {formatCurrency(item.handling_rate)}/op
                                            </div>
                                            <div className="text-xs font-semibold mt-1" style={{ color: '#F59E0B' }}>
                                                {formatCurrency(item.handling_charges)}
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'dates',
                                    label: 'Period',
                                    render: (item: BillingData) => (
                                        <div className="text-xs" style={{ color: colors.text.secondary }}>
                                            <div>In: {new Date(item.date_in).toLocaleDateString()}</div>
                                            <div className="mt-1">
                                                Out: {item.date_out ? new Date(item.date_out).toLocaleDateString() : 'Still in yard'}
                                            </div>
                                        </div>
                                    ),
                                },
                                {
                                    key: 'total',
                                    label: 'Total',
                                    render: (item: BillingData) => (
                                        <div className="text-right">
                                            <div className="text-xl font-bold" style={{ color: colors.brand.primary }}>
                                                {formatCurrency(item.total)}
                                            </div>
                                            <ModernBadge variant="success" className="mt-1">
                                                <DollarSign className="w-3 h-3" />
                                                Billable
                                            </ModernBadge>
                                        </div>
                                    ),
                                },
                            ]}
                            data={billingData}
                            loading={loading}
                            emptyMessage="No billing records found. Generate a report to view data."
                        />
                    </ModernCard>
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
        </AuthenticatedLayout>
    );
}

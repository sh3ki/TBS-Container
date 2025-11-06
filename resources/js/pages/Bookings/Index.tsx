import React, { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { ModernButton, ModernCard, ModernTable, ModernBadge } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Plus, Edit, Eye, Search, Ship, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';
import axios from 'axios';

interface Client {
    id: string;
    text: string;
    code: string;
    name: string;
}

interface Booking extends Record<string, unknown> {
    b_id: number;
    hashed_id: string;
    book_no: string;
    client: {
        c_id: number;
        client_name: string;
        client_code: string;
    };
    shipper: string;
    twenty: number;
    fourty: number;
    fourty_five: number;
    twenty_rem: number;
    fourty_rem: number;
    fourty_five_rem: number;
    cont_list: string;
    cont_list_rem: string;
    expiration_date: string;
    status_text: string;
    date_added: string;
}

export default function Index() {
    const { toast } = useToast();
    
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchKey, setSearchKey] = useState('');
    const [totalCount, setTotalCount] = useState(0);
    
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showViewDialog, setShowViewDialog] = useState(false);
    const [bookingType, setBookingType] = useState<'with' | 'without'>('without');
    
    const [formData, setFormData] = useState({
        id: '',
        bnum: '',
        cid: '',
        shipper: '',
        two: 0,
        four: 0,
        fourf: 0,
        cnums: '',
        exp: '',
        isc: '0',
        clientid: '',
        ship: '',
    });
    
    const [clients, setClients] = useState<Client[]>([]);
    const [shipperSuggestions, setShipperSuggestions] = useState<string[]>([]);
    const [showShipperSuggestions, setShowShipperSuggestions] = useState(false);
    const [viewContainers, setViewContainers] = useState<string[]>([]);

    useEffect(() => {
        fetchBookings();
        fetchClients();
    }, []);

    useEffect(() => {
        if (searchKey) {
            setFilteredBookings(bookings.filter(b => 
                b.book_no.toLowerCase().includes(searchKey.toLowerCase()) ||
                b.shipper.toLowerCase().includes(searchKey.toLowerCase()) ||
                b.client.client_name.toLowerCase().includes(searchKey.toLowerCase())
            ));
        } else {
            setFilteredBookings(bookings);
        }
    }, [searchKey, bookings]);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/bookings');
            if (response.data.success) {
                setBookings(response.data.data);
                setFilteredBookings(response.data.data);
                setTotalCount(response.data.total);
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to fetch bookings',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchClients = async () => {
        try {
            const response = await axios.get('/api/bookings/helpers/clients');
            if (response.data.success) {
                setClients(response.data.data);
            }
        } catch (error: unknown) {
            console.error('Failed to fetch clients:', error);
        }
    };

    const handleShipperInput = async (value: string) => {
        setFormData({ ...formData, shipper: value, ship: value });
        
        if (value.length > 1) {
            try {
                const response = await axios.get('/api/bookings/helpers/shipper-autocomplete', {
                    params: { key: value }
                });
                if (response.data.success) {
                    setShipperSuggestions(response.data.data);
                    setShowShipperSuggestions(true);
                }
            } catch (error: unknown) {
                console.error('Failed to fetch shipper suggestions:', error);
            }
        } else {
            setShowShipperSuggestions(false);
        }
    };

    const handleAddBooking = () => {
        setShowAddDialog(true);
        setShowEditDialog(false);
        setBookingType('without');
        setFormData({
            id: '',
            bnum: '',
            cid: '',
            shipper: '',
            two: 0,
            four: 0,
            fourf: 0,
            cnums: '',
            exp: '',
            isc: '0',
            clientid: '',
            ship: '',
        });
    };

    const handleSubmitAdd = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.bnum || !formData.cid || !formData.shipper || !formData.exp) {
            toast({
                title: 'Validation Error',
                description: 'Please fill out all required fields',
                variant: 'destructive',
            });
            return;
        }

        if (bookingType === 'with' && !formData.cnums) {
            toast({
                title: 'Validation Error',
                description: 'Please enter container numbers',
                variant: 'destructive',
            });
            return;
        }

        if (bookingType === 'without' && formData.two === 0 && formData.four === 0 && formData.fourf === 0) {
            toast({
                title: 'Validation Error',
                description: 'Please enter at least one container quantity',
                variant: 'destructive',
            });
            return;
        }

        try {
            const response = await axios.post('/api/bookings', formData);
            if (response.data.success) {
                toast({
                    title: 'Success',
                    description: 'Booking has been saved successfully',
                });
                setShowAddDialog(false);
                fetchBookings();
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to save booking',
                variant: 'destructive',
            });
        }
    };

    const handleEdit = async (hashedId: string) => {
        try {
            const response = await axios.get(`/api/bookings/${hashedId}/edit`);
            if (response.data.success) {
                const data = response.data.data;
                setFormData({
                    id: hashedId,
                    bnum: data.book_no,
                    cid: '',
                    shipper: data.shipper,
                    two: data.twenty,
                    four: data.fourty,
                    fourf: data.fourty_five,
                    cnums: '',
                    exp: data.expiration_date,
                    isc: data.has_container_list ? '1' : '0',
                    clientid: '',
                    ship: data.shipper,
                });
                
                const client = clients.find(c => c.code === data.client_code);
                if (client) {
                    setFormData(prev => ({ ...prev, clientid: client.id, cid: client.id }));
                }
                
                setBookingType(data.has_container_list ? 'with' : 'without');
                setShowEditDialog(true);
                setShowAddDialog(false);
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to load booking data',
                variant: 'destructive',
            });
        }
    };

    const handleSubmitEdit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.bnum || !formData.clientid || !formData.ship || !formData.exp) {
            toast({
                title: 'Validation Error',
                description: 'Please fill out all required fields',
                variant: 'destructive',
            });
            return;
        }

        try {
            const response = await axios.put(`/api/bookings/${formData.id}`, {
                bnum: formData.bnum,
                ship: formData.ship,
                exp: formData.exp,
                two: formData.two,
                four: formData.four,
                fourf: formData.fourf,
                clientid: formData.clientid,
                isc: formData.isc,
            });
            
            if (response.data.success) {
                toast({
                    title: 'Success',
                    description: 'Booking updated successfully',
                });
                setShowEditDialog(false);
                fetchBookings();
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to update booking',
                variant: 'destructive',
            });
        }
    };

    const handleViewContainers = async (hashedId: string) => {
        try {
            const response = await axios.get(`/api/bookings/${hashedId}/containers`);
            if (response.data.success) {
                setViewContainers(response.data.data);
                setShowViewDialog(true);
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast({
                title: 'Error',
                description: err.response?.data?.message || 'Failed to fetch containers',
                variant: 'destructive',
            });
        }
    };

    const getContainerListArray = (contList: string) => {
        if (!contList) return [];
        return contList.split(',').filter(c => c.trim());
    };

    return (
        <AuthenticatedLayout>
            <Head title="Bookings" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                            <Calendar className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                Booking Management
                            </h1>
                            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                Manage container booking and reservations
                            </p>
                        </div>
                    </div>
                    <ModernButton variant="add" onClick={handleAddBooking}>
                        <Plus className="w-4 h-4" />
                        Book Containers
                    </ModernButton>
                </div>

                <ModernCard 
                    title="Booking List" 
                    subtitle={`${totalCount} booking(s) found`}
                >
                    <div className="mb-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by booking number, shipper, or client..."
                                value={searchKey}
                                onChange={(e) => setSearchKey(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <ModernTable
                        columns={[
                            {
                                key: 'book_no',
                                label: 'BookNo',
                                render: (item: Booking) => (
                                    <div className="font-bold" style={{ color: colors.brand.primary }}>
                                        {item.book_no}
                                    </div>
                                ),
                            },
                            {
                                key: 'client',
                                label: 'Client',
                                render: (item: Booking) => (
                                    <div className="text-sm" style={{ color: colors.text.primary }}>
                                        {item.client.client_code}
                                    </div>
                                ),
                            },
                            {
                                key: 'shipper',
                                label: 'Shipper',
                                render: (item: Booking) => (
                                    <div className="flex items-center gap-2">
                                        <Ship className="w-4 h-4" style={{ color: colors.text.secondary }} />
                                        <span className="text-sm" style={{ color: colors.text.primary }}>
                                            {item.shipper}
                                        </span>
                                    </div>
                                ),
                            },
                            {
                                key: 'x20',
                                label: 'X20',
                                render: (item: Booking) => (
                                    <div className="text-sm font-medium" style={{ color: colors.text.primary }}>
                                        {item.twenty}
                                    </div>
                                ),
                            },
                            {
                                key: 'x40',
                                label: 'X40',
                                render: (item: Booking) => (
                                    <div className="text-sm font-medium" style={{ color: colors.text.primary }}>
                                        {item.fourty}
                                    </div>
                                ),
                            },
                            {
                                key: 'x45',
                                label: 'X45',
                                render: (item: Booking) => (
                                    <div className="text-sm font-medium" style={{ color: colors.text.primary }}>
                                        {item.fourty_five}
                                    </div>
                                ),
                            },
                            {
                                key: 'x20_rem',
                                label: 'X20 REM',
                                render: (item: Booking) => (
                                    <ModernBadge variant="info">
                                        {item.twenty_rem}
                                    </ModernBadge>
                                ),
                            },
                            {
                                key: 'x40_rem',
                                label: 'X40 REM',
                                render: (item: Booking) => (
                                    <ModernBadge variant="info">
                                        {item.fourty_rem}
                                    </ModernBadge>
                                ),
                            },
                            {
                                key: 'x45_rem',
                                label: 'X45 REM',
                                render: (item: Booking) => (
                                    <ModernBadge variant="info">
                                        {item.fourty_five_rem}
                                    </ModernBadge>
                                ),
                            },
                            {
                                key: 'clist',
                                label: 'CLIST',
                                render: (item: Booking) => {
                                    const containers = getContainerListArray(item.cont_list);
                                    return (
                                        <div className="text-xs font-mono" style={{ color: colors.text.secondary }}>
                                            {containers.length > 0 ? (
                                                <div>
                                                    {containers.slice(0, 2).map((c, i) => (
                                                        <div key={i}>{c}</div>
                                                    ))}
                                                    {containers.length > 2 && <div>+{containers.length - 2} more</div>}
                                                </div>
                                            ) : '-'}
                                        </div>
                                    );
                                },
                            },
                            {
                                key: 'clistrem',
                                label: 'CLISTREM',
                                render: (item: Booking) => {
                                    const containers = getContainerListArray(item.cont_list_rem);
                                    return (
                                        <div className="text-xs font-mono" style={{ color: colors.text.secondary }}>
                                            {containers.length > 0 ? `${containers.length} left` : '-'}
                                        </div>
                                    );
                                },
                            },
                            {
                                key: 'exp',
                                label: 'EXP',
                                render: (item: Booking) => (
                                    <div className="text-sm" style={{ color: colors.text.secondary }}>
                                        {new Date(item.expiration_date).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </div>
                                ),
                            },
                            {
                                key: 'status',
                                label: 'STATUS',
                                render: (item: Booking) => (
                                    <ModernBadge 
                                        variant={item.status_text === 'Active' ? 'success' : 'error'}
                                    >
                                        {item.status_text}
                                    </ModernBadge>
                                ),
                            },
                            {
                                key: 'date',
                                label: 'DATE',
                                render: (item: Booking) => (
                                    <div className="text-sm" style={{ color: colors.text.secondary }}>
                                        {new Date(item.date_added).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </div>
                                ),
                            },
                            {
                                key: 'actions',
                                label: 'ACTIONS',
                                render: (item: Booking) => (
                                    <div className="flex items-center gap-2">
                                        <ModernButton 
                                            variant="secondary" 
                                            size="sm"
                                            onClick={() => handleViewContainers(item.hashed_id)}
                                        >
                                            <Eye className="w-3 h-3" />
                                        </ModernButton>
                                        <ModernButton 
                                            variant="edit" 
                                            size="sm"
                                            onClick={() => handleEdit(item.hashed_id)}
                                        >
                                            <Edit className="w-3 h-3" />
                                        </ModernButton>
                                    </div>
                                ),
                            },
                        ]}
                        data={filteredBookings}
                        loading={loading}
                        emptyMessage="No bookings found"
                    />
                </ModernCard>
            </div>

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded" style={{ backgroundColor: colors.actions.add + '20' }}>
                                <Plus className="w-5 h-5" style={{ color: colors.actions.add }} />
                            </div>
                            Book Containers
                        </DialogTitle>
                        <DialogDescription>
                            Create a new booking for container reservations
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitAdd}>
                        <div className="space-y-4">
                            <div>
                                <Label className="text-base font-medium mb-2 block">Booking Type</Label>
                                <div className="flex gap-4">
                                    <label className="inline-flex items-center">
                                        <input 
                                            type="radio" 
                                            checked={bookingType === 'with'} 
                                            onChange={() => setBookingType('with')} 
                                            className="form-radio h-4 w-4"
                                            style={{ color: colors.brand.primary }}
                                        />
                                        <span className="ml-2">With Container List</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                        <input 
                                            type="radio" 
                                            checked={bookingType === 'without'} 
                                            onChange={() => setBookingType('without')} 
                                            className="form-radio h-4 w-4"
                                            style={{ color: colors.brand.primary }}
                                        />
                                        <span className="ml-2">Without Container List</span>
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Booking Number <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.bnum}
                                        onChange={(e) => setFormData({ ...formData, bnum: e.target.value })}
                                        placeholder="Enter booking number"
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Client <span className="text-red-500">*</span></Label>
                                    <select 
                                        value={formData.cid}
                                        onChange={(e) => setFormData({ ...formData, cid: e.target.value, clientid: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2"
                                        style={{ '--tw-ring-color': colors.brand.primary } as React.CSSProperties}
                                        required
                                    >
                                        <option value="">Select Client</option>
                                        {clients.map((client) => (
                                            <option key={client.id} value={client.id}>{client.text}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="relative">
                                    <Label>Shipper <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.shipper}
                                        onChange={(e) => handleShipperInput(e.target.value)}
                                        placeholder="Enter shipper name"
                                        required
                                    />
                                    {showShipperSuggestions && shipperSuggestions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                                            {shipperSuggestions.map((shipper, idx) => (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => { 
                                                        setFormData({ ...formData, shipper, ship: shipper }); 
                                                        setShowShipperSuggestions(false); 
                                                    }} 
                                                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                                >
                                                    {shipper}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <Label>Expiration Date <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={formData.exp}
                                        onChange={(e) => setFormData({ ...formData, exp: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            {bookingType === 'with' ? (
                                <div>
                                    <Label>Container Numbers (comma-separated, 11 chars each) <span className="text-red-500">*</span></Label>
                                    <Textarea
                                        value={formData.cnums}
                                        onChange={(e) => setFormData({ ...formData, cnums: e.target.value })}
                                        rows={4}
                                        placeholder="ABCD1234567,EFGH8901234,..."
                                        required
                                        className="font-mono"
                                    />
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label>20' Containers</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={formData.two}
                                            onChange={(e) => setFormData({ ...formData, two: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div>
                                        <Label>40' Containers</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={formData.four}
                                            onChange={(e) => setFormData({ ...formData, four: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div>
                                        <Label>45' Containers</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={formData.fourf}
                                            onChange={(e) => setFormData({ ...formData, fourf: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <DialogFooter className="mt-6">
                            <ModernButton 
                                variant="secondary" 
                                type="button"
                                onClick={() => setShowAddDialog(false)}
                            >
                                Cancel
                            </ModernButton>
                            <ModernButton variant="add" type="submit">
                                <Plus className="w-4 h-4" />
                                Save Booking
                            </ModernButton>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded" style={{ backgroundColor: colors.actions.edit + '20' }}>
                                <Edit className="w-5 h-5" style={{ color: colors.actions.edit }} />
                            </div>
                            Edit Booking
                        </DialogTitle>
                        <DialogDescription>
                            Update booking information
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitEdit}>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Booking Number <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.bnum}
                                        onChange={(e) => setFormData({ ...formData, bnum: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Client <span className="text-red-500">*</span></Label>
                                    <select 
                                        value={formData.clientid}
                                        onChange={(e) => setFormData({ ...formData, clientid: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2"
                                        style={{ '--tw-ring-color': colors.brand.primary } as React.CSSProperties}
                                        required
                                    >
                                        <option value="">Select Client</option>
                                        {clients.map((client) => (
                                            <option key={client.id} value={client.id}>{client.text}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label>Shipper <span className="text-red-500">*</span></Label>
                                    <Input
                                        value={formData.ship}
                                        onChange={(e) => setFormData({ ...formData, ship: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Expiration Date <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={formData.exp}
                                        onChange={(e) => setFormData({ ...formData, exp: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>20' Containers</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={formData.two}
                                        onChange={(e) => setFormData({ ...formData, two: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div>
                                    <Label>40' Containers</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={formData.four}
                                        onChange={(e) => setFormData({ ...formData, four: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div>
                                    <Label>45' Containers</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={formData.fourf}
                                        onChange={(e) => setFormData({ ...formData, fourf: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="mt-6">
                            <ModernButton 
                                variant="secondary" 
                                type="button"
                                onClick={() => setShowEditDialog(false)}
                            >
                                Cancel
                            </ModernButton>
                            <ModernButton variant="edit" type="submit">
                                <Edit className="w-4 h-4" />
                                Update Booking
                            </ModernButton>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="p-2 rounded" style={{ backgroundColor: colors.brand.primary + '20' }}>
                                <Package className="w-5 h-5" style={{ color: colors.brand.primary }} />
                            </div>
                            Booked Containers
                        </DialogTitle>
                        <DialogDescription>
                            List of containers in this booking
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-96 overflow-auto">
                        {viewContainers.length > 0 ? (
                            <div className="space-y-2">
                                {viewContainers.map((container, idx) => (
                                    <div 
                                        key={idx} 
                                        className="p-3 rounded-lg border font-mono text-sm"
                                        style={{ backgroundColor: '#F9FAFB' }}
                                    >
                                        {container}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center py-8 text-gray-500">No containers found</p>
                        )}
                    </div>
                    <DialogFooter>
                        <ModernButton 
                            variant="secondary" 
                            onClick={() => setShowViewDialog(false)}
                        >
                            Close
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AuthenticatedLayout>
    );
}

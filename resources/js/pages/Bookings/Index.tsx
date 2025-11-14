import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ModernButton, ModernCard, ModernTable, ModernBadge, ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package, Pencil, Trash2, Eye, Calendar } from 'lucide-react';
import { colors } from '@/lib/colors';

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

interface FormData {
  bnum: string;
  cid: string;
  shipper: string;
  two: number;
  four: number;
  fourf: number;
  cnums: string;
  exp: string;
}

export default function Index() {
  const { toasts, removeToast, success, error } = useModernToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [expirationFilter, setExpirationFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [bookingType, setBookingType] = useState<'with' | 'without'>('without');
  
  const [confirmAddBooking, setConfirmAddBooking] = useState(false);
  const [confirmUpdateBooking, setConfirmUpdateBooking] = useState(false);
  const [confirmDeleteBooking, setConfirmDeleteBooking] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    bnum: '',
    cid: '',
    shipper: '',
    two: 0,
    four: 0,
    fourf: 0,
    cnums: '',
    exp: '',
  });
  
  const [editFormData, setEditFormData] = useState<FormData & { id: string; clientid: string; ship: string }>({
    id: '',
    bnum: '',
    cid: '',
    shipper: '',
    two: 0,
    four: 0,
    fourf: 0,
    cnums: '',
    exp: '',
    clientid: '',
    ship: '',
  });
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [shipperSuggestions, setShipperSuggestions] = useState<string[]>([]);
  const [showShipperSuggestions, setShowShipperSuggestions] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchBookings();
    fetchClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, searchTerm, clientFilter, expirationFilter]);

  // Check for pending booking from Gate OUT "Save and Book = YES"
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'create' && clients.length > 0) {
      const pendingData = sessionStorage.getItem('pendingBooking');
      
      if (pendingData) {
        try {
          const data = JSON.parse(pendingData);
          const client = clients.find(c => c.id === data.client_id.toString());
          
          setFormData({
            bnum: '',
            cid: client?.id || '',
            shipper: '',
            two: 0,
            four: 0,
            fourf: 0,
            cnums: data.container_no,
            exp: '',
          });
          
          setBookingType('with');
          setShowAddModal(true);
          sessionStorage.removeItem('pendingBooking');
          window.history.replaceState({}, '', '/bookings');
          
          success(`Container ${data.container_no} from Gate OUT ready for booking`);
        } catch (err) {
          console.error('Failed to parse pending booking:', err);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  const applyFilters = () => {
    let filtered = [...bookings];
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(booking => 
        booking.book_no.toLowerCase().includes(search) ||
        booking.shipper.toLowerCase().includes(search) ||
        booking.client.client_name.toLowerCase().includes(search) ||
        booking.client.client_code.toLowerCase().includes(search)
      );
    }
    
    // Client filter
    if (clientFilter !== 'all') {
      filtered = filtered.filter(booking => booking.client.c_id.toString() === clientFilter);
    }
    
    // Expiration date filter
    if (expirationFilter) {
      filtered = filtered.filter(booking => {
        // Normalize the expiration date from the booking to YYYY-MM-DD format
        const expirationDate = new Date(booking.expiration_date);
        const year = expirationDate.getFullYear();
        const month = String(expirationDate.getMonth() + 1).padStart(2, '0');
        const day = String(expirationDate.getDate()).padStart(2, '0');
        const bookingDateFormatted = `${year}-${month}-${day}`;
        
        return bookingDateFormatted === expirationFilter;
      });
    }
    
    setFilteredBookings(filtered);
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/bookings', {
        params: { 
          per_page: 1000
        }
      });
      if (response.data.success) {
        setBookings(response.data.data);
      }
    } catch {
      error('Failed to load bookings');
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
    } catch {
      console.error('Failed to fetch clients');
    }
  };

  const handleShipperInput = async (value: string) => {
    setFormData({ ...formData, shipper: value });
    
    if (value.length > 1) {
      try {
        const response = await axios.get('/api/bookings/helpers/shipper-autocomplete', {
          params: { key: value }
        });
        if (response.data.success) {
          setShipperSuggestions(response.data.data);
          setShowShipperSuggestions(true);
        }
      } catch {
        console.error('Failed to fetch shipper suggestions');
      }
    } else {
      setShowShipperSuggestions(false);
    }
  };

  const submitAddBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setConfirmAddBooking(true);
  };

  const handleAddBooking = async () => {
    try {
      const payload = {
        ...formData,
        isc: bookingType === 'with' ? '1' : '0'
      };
      
      console.log('Sending booking data:', payload);
      console.log('Client selected:', clients.find(c => c.id === formData.cid));
      
      const response = await axios.post('/api/bookings', payload);
      if (response.data.success) {
        success('Booking created successfully');
        setShowAddModal(false);
        setConfirmAddBooking(false);
        setFormData({
          bnum: '',
          cid: '',
          shipper: '',
          two: 0,
          four: 0,
          fourf: 0,
          cnums: '',
          exp: '',
        });
        setErrors({});
        fetchBookings();
      }
    } catch (err: unknown) {
      setConfirmAddBooking(false);
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (e.response?.data?.errors) {
        setErrors(e.response.data.errors);
        error('Please check the form for errors');
      } else {
        error(e.response?.data?.message || 'Failed to create booking');
      }
    }
  };

  const handleEditBooking = useCallback((booking: Booking) => {
    // Use already-loaded booking data - no API call needed!
    const client = clients.find(c => c.code === booking.client.client_code);
    
    // Format expiration date properly for date input (YYYY-MM-DD)
    let formattedExp = '';
    if (booking.expiration_date) {
      const expDate = new Date(booking.expiration_date);
      if (!isNaN(expDate.getTime())) {
        formattedExp = expDate.toISOString().split('T')[0];
      }
    }
    
    setEditFormData({
      id: booking.hashed_id,
      bnum: booking.book_no,
      cid: client?.id || '',
      shipper: booking.shipper,
      two: booking.twenty,
      four: booking.fourty,
      fourf: booking.fourty_five,
      cnums: '',
      exp: formattedExp,
      clientid: client?.id || '',
      ship: booking.shipper,
    });
    
    setBookingType(booking.cont_list && booking.cont_list.trim() !== '' ? 'with' : 'without');
    setShowEditModal(true);
  }, [clients]);

  const submitUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setConfirmUpdateBooking(true);
  };

  const handleUpdateBooking = async () => {
    // Close confirmation modal immediately
    setConfirmUpdateBooking(false);
    
    try {
      const response = await axios.put(`/api/bookings/${editFormData.id}`, {
        bnum: editFormData.bnum,
        ship: editFormData.ship,
        exp: editFormData.exp,
        two: editFormData.two,
        four: editFormData.four,
        fourf: editFormData.fourf,
        clientid: editFormData.clientid,
        isc: bookingType === 'with' ? '1' : '0',
      });
      if (response.data.success) {
        success('Booking updated successfully');
        setShowEditModal(false);
        fetchBookings();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (e.response?.data?.errors) {
        setErrors(e.response.data.errors);
        error('Please check the form for errors');
      } else {
        error(e.response?.data?.message || 'Failed to update booking');
      }
    }
  };

  const handleDeleteBooking = async () => {
    if (!bookingToDelete) return;
    
    try {
      const response = await axios.delete(`/api/bookings/${bookingToDelete.hashed_id}`);
      if (response.data.success) {
        success('Booking deleted successfully');
        setBookingToDelete(null);
        setConfirmDeleteBooking(false);
        fetchBookings();
      }
    } catch {
      setConfirmDeleteBooking(false);
      error('Failed to delete booking');
    }
  };

  const handleViewContainers = useCallback((booking: Booking) => {
    // Set booking data immediately from local state - all data is already in booking object
    setSelectedBooking(booking);
    setShowViewModal(true);
  }, []);

  const getContainerListArray = (contList: string) => {
    if (!contList) return [];
    return contList.split(',').filter(c => c.trim());
  };

  // Pagination
  const paginatedBookings = filteredBookings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredBookings.length / pageSize);

  return (
    <AuthenticatedLayout>
      <Head title="Booking Management" />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Booking Management</h1>
              <p className="text-sm mt-1 text-gray-600">Manage container booking and reservations</p>
            </div>
          </div>
          <ModernButton variant="add" size="lg" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Book Containers
          </ModernButton>
        </div>

        <div className="relative" style={{ zIndex: 0 }}>
          <ModernCard title="Search & Filter Bookings" subtitle="Find bookings quickly" icon={<Search className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label className="text-sm font-semibold mb-2 text-gray-900">Search Bookings</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    type="text"
                    placeholder="Search by booking number, shipper, or client..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 text-gray-900">Client Filter</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.filter(client => client.name && client.name.trim() !== '').map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 text-gray-900">Expiration Filter</Label>
                <Input
                  type="date"
                  value={expirationFilter}
                  onChange={(e) => setExpirationFilter(e.target.value)}
                  className="h-11"
                  placeholder="Filter by expiration date"
                />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{filteredBookings.length}</span> bookings found
                {searchTerm || clientFilter !== 'all' || expirationFilter ? (
                  <span> (filtered from {bookings.length} total)</span>
                ) : null}
              </p>
            </div>
          </ModernCard>
        </div>

        <div className="w-full">
          <ModernTable
            columns={[
              {
                key: 'book_no',
                label: 'Book No.',
                render: (booking: Booking) => (
                  <div className="font-semibold text-gray-900 max-w-[70px]">{booking.book_no}</div>
                ),
              },
              {
                key: 'client',
                label: 'Client Name',
                render: (booking: Booking) => (
                  <div className="text-sm text-gray-900 min-w-[70px] max-w-[75px]">
                    <div className="font-medium">{booking.client.client_name}</div>
                    <div className="text-xs text-gray-500">{booking.client.client_code}</div>
                  </div>
                ),
              },
              {
                key: 'shipper',
                label: 'Shipper',
                render: (booking: Booking) => (
                  <div className="min-w-[70px] max-w-[90px]">
                    <span className="text-sm text-gray-900">{booking.shipper}</span>
                  </div>
                ),
              },
              {
                key: 'containers_info',
                label: 'Containers',
                render: (booking: Booking) => (
                  <div className="space-y-2 min-w-[65px]">
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-0.5">Allocated:</div>
                      <div className="space-y-0.5">
                        <div className="text-sm text-gray-900">x20: {booking.twenty}</div>
                        <div className="text-sm text-gray-900">x40: {booking.fourty}</div>
                        <div className="text-sm text-gray-900">x45: {booking.fourty_five}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-700 mb-0.5">Remaining:</div>
                      <div className="space-y-0.5">
                        <div className="text-sm text-gray-900">x20 rem: {booking.twenty_rem}</div>
                        <div className="text-sm text-gray-900">x40 rem: {booking.fourty_rem}</div>
                        <div className="text-sm text-gray-900">x45 rem: {booking.fourty_five_rem}</div>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'container_lists',
                label: 'Container Lists',
                render: (booking: Booking) => {
                  const containers = getContainerListArray(booking.cont_list);
                  const containersRem = getContainerListArray(booking.cont_list_rem);
                  return (
                    <div className="space-y-1.5 min-w-[65px]">
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-0.5">List:</div>
                        <div className="text-xs font-mono text-gray-600">
                          {containers.length > 0 ? (
                            <div className="space-y-0.5">
                              {containers.map((c, i) => (
                                <div key={i} className="truncate">{c}</div>
                              ))}
                            </div>
                          ) : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-700 mb-0.5">Rem:</div>
                        <div className="text-xs font-mono text-gray-600">
                          {containersRem.length > 0 ? (
                            <div className="space-y-0.5">
                              {containersRem.map((c, i) => (
                                <div key={i} className="truncate">{c}</div>
                              ))}
                            </div>
                          ) : '-'}
                        </div>
                      </div>
                    </div>
                  );
                },
              },
              {
                key: 'expiration',
                label: 'Expiration',
                render: (booking: Booking) => (
                  <div className="min-w-[95px]">
                    <span className="text-sm text-gray-600">
                      {new Date(booking.expiration_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (booking: Booking) => (
                  <div className="min-w-[55px]">
                    <ModernBadge variant={booking.status_text === 'Active' ? 'success' : 'error'}>
                      {booking.status_text}
                    </ModernBadge>
                  </div>
                ),
              },
              {
                key: 'date_added',
                label: 'Date',
                render: (booking: Booking) => (
                  <div className="text-sm text-gray-600 min-w-[65px]">
                    {new Date(booking.date_added).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                ),
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (booking: Booking) => (
                    <div className="flex items-center justify-end gap-1.5 min-w-[100px]">
                      <ModernButton 
                        variant="primary" 
                        size="sm" 
                        onClick={() => handleViewContainers(booking)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </ModernButton>
                      <ModernButton 
                        variant="edit" 
                        size="sm" 
                        onClick={() => handleEditBooking(booking)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </ModernButton>
                      <ModernButton 
                        variant="delete" 
                        size="sm" 
                        onClick={() => {
                          setBookingToDelete(booking);
                          setConfirmDeleteBooking(true);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </ModernButton>
                    </div>
                ),
              },
            ]}
            data={paginatedBookings}
            loading={loading}
            emptyMessage="No bookings found. Click 'Book Containers' to get started."
            pagination={{
              currentPage,
              totalPages,
              perPage: pageSize,
              total: filteredBookings.length,
              onPageChange: setCurrentPage,
            }}
          />
        </div>
      </div>

      {/* Add Booking Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Book Containers</DialogTitle>
            <DialogDescription>Create a new booking for container reservations</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAddBooking}>
            <div className="grid gap-4 py-4">
              <div>
                <Label className="text-gray-900 text-base font-medium mb-2 block">Booking Type</Label>
                <div className="grid grid-cols-2 gap-0 w-full rounded-lg shadow-sm overflow-hidden" role="group">
                  <button
                    type="button"
                    onClick={() => {
                      setBookingType('without');
                      setFormData({ ...formData, cnums: '', two: 0, four: 0, fourf: 0 });
                    }}
                    className={`px-6 py-3 text-sm font-medium border transition-all ${
                      bookingType === 'without'
                        ? 'text-white border-transparent shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    style={bookingType === 'without' ? { backgroundColor: colors.brand.primary } : {}}
                  >
                    Without Container List
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingType('with');
                      setFormData({ ...formData, cnums: '', two: 0, four: 0, fourf: 0 });
                    }}
                    className={`px-6 py-3 text-sm font-medium border border-l-0 transition-all ${
                      bookingType === 'with'
                        ? 'text-white border-transparent shadow-sm'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    style={bookingType === 'with' ? { backgroundColor: colors.brand.primary } : {}}
                  >
                    With Container List
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Booking Number <span className="text-red-500">*</span></Label>
                  <Input value={formData.bnum} placeholder="Enter booking number" onChange={(e) => setFormData({ ...formData, bnum: e.target.value })} className={errors.bnum ? 'border-red-500' : ''} />
                  {errors.bnum && <p className="text-red-500 text-xs mt-1">{errors.bnum[0]}</p>}
                </div>
                <div>
                  <Label className="text-gray-900">Client <span className="text-red-500">*</span></Label>
                  <Select value={formData.cid} onValueChange={(value) => setFormData({ ...formData, cid: value })}>
                    <SelectTrigger className={`truncate ${errors.cid ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder="Select Client" className="truncate" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id} className="truncate">
                          <span className="truncate block" title={client.text}>{client.text}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.cid && <p className="text-red-500 text-xs mt-1">{errors.cid[0]}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Label className="text-gray-900">Shipper <span className="text-red-500">*</span></Label>
                  <Input
                    value={formData.shipper}
                    onChange={(e) => handleShipperInput(e.target.value)}
                    placeholder="Enter shipper name"
                    className={errors.shipper ? 'border-red-500' : ''}
                    autoComplete="off"
                  />
                  {showShipperSuggestions && shipperSuggestions.length > 0 && (
                    <div 
                      className="absolute w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                      style={{ zIndex: 9999 }}
                    >
                      {shipperSuggestions.map((shipper, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => { 
                            setFormData({ ...formData, shipper }); 
                            setShowShipperSuggestions(false); 
                          }} 
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-gray-900 text-sm"
                          style={{ cursor: 'pointer' }}
                        >
                          {shipper}
                        </div>
                      ))}
                    </div>
                  )}
                  {errors.shipper && <p className="text-red-500 text-xs mt-1">{errors.shipper[0]}</p>}
                </div>
                <div>
                  <Label className="text-gray-900">Expiration Date <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={formData.exp}
                      onChange={(e) => setFormData({ ...formData, exp: e.target.value })}
                      className={`pr-10 ${errors.exp ? 'border-red-500' : ''}`}
                      placeholder="mm/dd/yyyy"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  {errors.exp && <p className="text-red-500 text-xs mt-1">{errors.exp[0]}</p>}
                </div>
              </div>
              {bookingType === 'with' ? (
                <div>
                  <Label className="text-gray-900">Container Numbers <span className="text-red-500">*</span></Label>
                  <Textarea
                    value={formData.cnums}
                    onChange={(e) => setFormData({ ...formData, cnums: e.target.value })}
                    rows={4}
                    placeholder="Enter container numbers (comma-separated, 11 chars each)"
                    className={`font-mono ${errors.cnums ? 'border-red-500' : ''}`}
                  />
                  {errors.cnums && <p className="text-red-500 text-xs mt-1">{errors.cnums[0]}</p>}
                  <p className="text-xs text-gray-500 mt-1">Format: ABCD1234567, EFGH8901234</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-900">20' Containers</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.two}
                      onChange={(e) => setFormData({ ...formData, two: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-gray-900">40' Containers</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.four}
                      onChange={(e) => setFormData({ ...formData, four: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-gray-900">45' Containers</Label>
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
            <DialogFooter className="gap-2">
              <ModernButton type="button" variant="toggle" onClick={() => setShowAddModal(false)}>Cancel</ModernButton>
              <ModernButton type="submit" variant="add"><Plus className="w-4 h-4" />Add Booking</ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Booking Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Edit Booking</DialogTitle>
            <DialogDescription>Update booking information</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitUpdateBooking}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Booking Number <span className="text-red-500">*</span></Label>
                  <Input value={editFormData.bnum} onChange={(e) => setEditFormData({ ...editFormData, bnum: e.target.value })} />
                </div>
                <div>
                  <Label className="text-gray-900">Client <span className="text-red-500">*</span></Label>
                  <Select 
                    value={editFormData.clientid}
                    onValueChange={(value) => setEditFormData({ ...editFormData, clientid: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Client" />
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Shipper <span className="text-red-500">*</span></Label>
                  <Input value={editFormData.ship} onChange={(e) => setEditFormData({ ...editFormData, ship: e.target.value })} />
                </div>
                <div>
                  <Label className="text-gray-900">Expiration Date <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input 
                      type="date" 
                      value={editFormData.exp} 
                      onChange={(e) => setEditFormData({ ...editFormData, exp: e.target.value })}
                      className="pr-10"
                      placeholder="mm/dd/yyyy"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-900">20' Containers</Label>
                  <Input type="number" min="0" value={editFormData.two} onChange={(e) => setEditFormData({ ...editFormData, two: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-gray-900">40' Containers</Label>
                  <Input type="number" min="0" value={editFormData.four} onChange={(e) => setEditFormData({ ...editFormData, four: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-gray-900">45' Containers</Label>
                  <Input type="number" min="0" value={editFormData.fourf} onChange={(e) => setEditFormData({ ...editFormData, fourf: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton type="button" variant="toggle" onClick={() => setShowEditModal(false)}>Cancel</ModernButton>
              <ModernButton type="submit" variant="edit"><Pencil className="w-4 h-4" />Update Booking</ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Containers Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Booked Containers</DialogTitle>
            <DialogDescription>List of containers in this booking</DialogDescription>
          </DialogHeader>
          {selectedBooking && (
            <div className="py-4">
              <div className="mb-6 pb-4 border-b">
                <p className="text-sm text-gray-600">Booking Number: <span className="font-semibold text-gray-900">{selectedBooking.book_no}</span></p>
                <p className="text-sm text-gray-600">Shipper: <span className="font-semibold text-gray-900">{selectedBooking.shipper}</span></p>
              </div>
              
              {/* Two Column Layout - Same as table */}
              <div className="grid grid-cols-2 gap-8">
                {/* Left Column - CONTAINERS */}
                <div>
                  <div className="bg-blue-500 text-white text-center py-2 px-4 rounded-t-lg font-semibold">
                    CONTAINERS
                  </div>
                  <div className="border border-t-0 rounded-b-lg p-4 bg-gray-50">
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Allocated:</h3>
                      <div className="text-gray-700 space-y-1">
                        <p>x20: {selectedBooking.twenty}</p>
                        <p>x40: {selectedBooking.fourty}</p>
                        <p>x45: {selectedBooking.fourty_five}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Remaining:</h3>
                      <div className="text-gray-700 space-y-1">
                        <p>x20 rem: <span className={selectedBooking.twenty_rem > 0 ? 'text-blue-600 font-semibold' : ''}>{selectedBooking.twenty_rem}</span></p>
                        <p>x40 rem: <span className={selectedBooking.fourty_rem > 0 ? 'text-blue-600 font-semibold' : ''}>{selectedBooking.fourty_rem}</span></p>
                        <p>x45 rem: <span className={selectedBooking.fourty_five_rem > 0 ? 'text-blue-600 font-semibold' : ''}>{selectedBooking.fourty_five_rem}</span></p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right Column - CONTAINER LISTS */}
                <div>
                  <div className="bg-blue-500 text-white text-center py-2 px-4 rounded-t-lg font-semibold">
                    CONTAINER LISTS
                  </div>
                  <div className="border border-t-0 rounded-b-lg p-4 bg-gray-50">
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 mb-2">List:</h3>
                      <div className="space-y-1">
                        {selectedBooking.cont_list && selectedBooking.cont_list.trim() ? (
                          getContainerListArray(selectedBooking.cont_list).map((container, idx) => (
                            <p key={`list-${idx}`} className="text-gray-700 font-mono text-sm">{container}</p>
                          ))
                        ) : (
                          <p className="text-gray-500">-</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Rem:</h3>
                      <div className="space-y-1">
                        {selectedBooking.cont_list_rem && selectedBooking.cont_list_rem.trim() ? (
                          getContainerListArray(selectedBooking.cont_list_rem).map((container, idx) => (
                            <p key={`rem-${idx}`} className="text-gray-700 font-mono text-sm">{container}</p>
                          ))
                        ) : (
                          <p className="text-gray-500">-</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <ModernButton variant="toggle" onClick={() => setShowViewModal(false)}>Close</ModernButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modals */}
      <ModernConfirmDialog
        open={confirmAddBooking}
        onOpenChange={setConfirmAddBooking}
        onConfirm={handleAddBooking}
        title="Add New Booking"
        description="Are you sure you want to add this booking?"
        confirmText="Add Booking"
        type="success"
      />
      
      <ModernConfirmDialog
        open={confirmUpdateBooking}
        onOpenChange={setConfirmUpdateBooking}
        onConfirm={handleUpdateBooking}
        title="Update Booking"
        description="Are you sure you want to update this booking information?"
        confirmText="Update Booking"
        type="warning"
      />
      
      <ModernConfirmDialog
        open={confirmDeleteBooking}
        onOpenChange={setConfirmDeleteBooking}
        onConfirm={handleDeleteBooking}
        title="Delete Booking"
        description={`Are you sure you want to delete booking ${bookingToDelete?.book_no}? This action cannot be undone.`}
        confirmText="Delete Booking"
        type="danger"
      />
      
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </AuthenticatedLayout>
  );
}

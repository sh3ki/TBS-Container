import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { ModernButton, ModernCard, ModernTable, ModernBadge, ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package, Pencil, Trash2, Eye, Calendar, RotateCcw, Filter, ArrowUpDown } from 'lucide-react';
import { colors } from '@/lib/colors';
import CachedFieldHistory from '@/components/CachedFieldHistory';
import { removeFieldHistory, saveFieldHistory } from '@/components/CachedFieldHistory';

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
  } | null;
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

interface GateOutContainer {
  container_no: string;
  date_added: string;
  size?: string | number;
  type?: string;
}

interface FormData {
  bnum: string;
  cid: string;
  shipper: string;
  two: number | string;
  four: number | string;
  fourf: number | string;
  cnums: string;
  exp: string;
}

interface EditFormData extends Omit<FormData, 'two' | 'four' | 'fourf'> {
  id: string;
  clientid: string;
  ship: string;
  two: string;
  four: string;
  fourf: string;
}

const formatContainerListInput = (value: string) => {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const containers = normalized.match(/.{1,11}/g) || [];
  return containers.join(', ');
};

export default function Index() {
  const { toasts, removeToast, success, error } = useModernToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [expirationFilter, setExpirationFilter] = useState<string>('');
  const [draftClientFilter, setDraftClientFilter] = useState<string>('all');
  const [draftExpirationFilter, setDraftExpirationFilter] = useState<string>('');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const filterModalApplyRef = useRef(false);
  const [expiredResults, setExpiredResults] = useState<Booking[]>([]);
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(999999);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [bookingType, setBookingType] = useState<'with' | 'without'>('without');
  const [editBookingType, setEditBookingType] = useState<'with' | 'without'>('without');
  
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
  
  const [editFormData, setEditFormData] = useState<EditFormData>({
    id: '',
    bnum: '',
    cid: '',
    shipper: '',
    two: '',
    four: '',
    fourf: '',
    cnums: '',
    exp: '',
    clientid: '',
    ship: '',
  });
  const [editMinimums, setEditMinimums] = useState({ two: 0, four: 0, fourf: 0 });
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedContainerList, setSelectedContainerList] = useState<string[]>([]);
  const [selectedRemainingContainerList, setSelectedRemainingContainerList] = useState<string[]>([]);
  const [selectedGateOutContainers, setSelectedGateOutContainers] = useState<GateOutContainer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    removeFieldHistory('booking.container_numbers');
    fetchBookings();
    fetchClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, appliedSearchTerm, clientFilter, expirationFilter]);

  // Back to Top button visibility based on scroll position
  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      try {
        setShowBackToTop(window.scrollY > 200);
      } catch {
        // ignore
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', onScroll);
      }
    };
  }, []);

  // Check for pending booking from Gate OUT "Deduct in Booking = YES"
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
    // Helper: determine expired (expiration date strictly before today)
    const isExpired = (b: Booking) => {
      if (!b.expiration_date) return false;
      const exp = new Date(b.expiration_date);
      const today = new Date();
      today.setHours(0,0,0,0);
      return exp.getTime() < today.getTime();
    };

    // Start with current bookings array
    let working = [...bookings];

    const search = appliedSearchTerm.toLowerCase();

    // Apply client filter if set
    if (clientFilter !== 'all') {
      working = working.filter(booking => booking.client?.c_id?.toString() === clientFilter);
    }

    // Apply expiration date filter (exact date)
    if (expirationFilter) {
      working = working.filter(booking => {
        const expirationDate = new Date(booking.expiration_date);
        const year = expirationDate.getFullYear();
        const month = String(expirationDate.getMonth() + 1).padStart(2, '0');
        const day = String(expirationDate.getDate()).padStart(2, '0');
        const bookingDateFormatted = `${year}-${month}-${day}`;
        return bookingDateFormatted === expirationFilter;
      });
    }

    // For main table: only include non-expired bookings
    let currentFiltered = working.filter(b => !isExpired(b));

    // Apply search to current bookings
    if (search) {
      currentFiltered = currentFiltered.filter(booking => 
        (booking.book_no || '').toLowerCase().includes(search) ||
        (booking.shipper || '').toLowerCase().includes(search)
      );
    }

    setFilteredBookings(currentFiltered);

    // For expired results (only used when searching): apply same filters but for expired bookings
    let expired = [...bookings];
    if (clientFilter !== 'all') {
      expired = expired.filter(booking => booking.client?.c_id?.toString() === clientFilter);
    }
    if (expirationFilter) {
      expired = expired.filter(booking => {
        const expirationDate = new Date(booking.expiration_date);
        const year = expirationDate.getFullYear();
        const month = String(expirationDate.getMonth() + 1).padStart(2, '0');
        const day = String(expirationDate.getDate()).padStart(2, '0');
        const bookingDateFormatted = `${year}-${month}-${day}`;
        return bookingDateFormatted === expirationFilter;
      });
    }
    expired = expired.filter(b => isExpired(b));
    if (search) {
      expired = expired.filter(booking => 
        (booking.book_no || '').toLowerCase().includes(search) ||
        (booking.shipper || '').toLowerCase().includes(search)
      );
    }
    setExpiredResults(expired);
  };

  const fetchBookings = async (search = '') => {
    setLoading(true);
    try {
      const response = await axios.get('/api/bookings', {
        params: { 
          per_page: 1000,
          ...(search ? { search, show_all: 1 } : {}),
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

  const handleSearch = async (allowEmpty = false) => {
    const trimmedSearch = searchTerm.trim();
    if (!allowEmpty && !trimmedSearch && !appliedSearchTerm) return;

    setAppliedSearchTerm(trimmedSearch);
    await fetchBookings(trimmedSearch);
  };

  const handleResetSearch = async () => {
    setSearchTerm('');
    setAppliedSearchTerm('');
    setSortColumn('');
    setSortDirection('asc');
    await fetchBookings();
  };

  const canResetSearch = Boolean(searchTerm.trim() || appliedSearchTerm || sortColumn);

  const canResetFilters = clientFilter !== 'all' || Boolean(expirationFilter);

  const handleFilterModalOpenChange = (open: boolean) => {
    if (!open && !filterModalApplyRef.current) {
      setDraftClientFilter(clientFilter);
      setDraftExpirationFilter(expirationFilter);
    }
    filterModalApplyRef.current = false;
    setShowFiltersModal(open);
  };

  const handleApplyFilters = () => {
    setClientFilter(draftClientFilter);
    setExpirationFilter(draftExpirationFilter);
    filterModalApplyRef.current = true;
    setShowFiltersModal(false);
  };

  const handleResetFilters = () => {
    setClientFilter('all');
    setExpirationFilter('');
    setDraftClientFilter('all');
    setDraftExpirationFilter('');
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

  const submitAddBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setConfirmAddBooking(true);
  };

  const handleAddBooking = async () => {
    try {
      const payload = {
        ...formData,
        two: Number(formData.two || 0),
        four: Number(formData.four || 0),
        fourf: Number(formData.fourf || 0),
        // The tabs are navigation only; save both the quantities and list.
        cnums: formData.cnums,
        isc: bookingType === 'with' ? '1' : '0'
      };
      
      console.log('Sending booking data:', payload);
      console.log('Client selected:', clients.find(c => c.id === formData.cid));
      
      const response = await axios.post('/api/bookings', payload);
      if (response.data.success) {
        saveFieldHistory({
          'booking.shipper': formData.shipper,
        });
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
    const client = clients.find(c => c.code === booking.client?.client_code);
    
    // Match the expiration date rendered in the table.
    const expDate = new Date(booking.expiration_date);
    const formattedExp = isNaN(expDate.getTime())
      ? ''
      : `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}-${String(expDate.getDate()).padStart(2, '0')}`;
    
    setEditFormData({
      id: booking.hashed_id,
      bnum: booking.book_no,
      cid: client?.id || '',
      shipper: booking.shipper,
      two: String(booking.twenty),
      four: String(booking.fourty),
      fourf: String(booking.fourty_five),
      cnums: formatContainerListInput(booking.cont_list || ''),
      exp: formattedExp,
      clientid: client?.id || '',
      ship: booking.shipper,
    });
    setEditMinimums({
      two: Math.max(0, booking.twenty - booking.twenty_rem),
      four: Math.max(0, booking.fourty - booking.fourty_rem),
      fourf: Math.max(0, booking.fourty_five - booking.fourty_five_rem),
    });
    
    setEditBookingType(booking.cont_list && booking.cont_list.trim() !== '' ? 'with' : 'without');
    setShowEditModal(true);
  }, [clients]);

  const submitUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const quantityChecks = [
      { value: editFormData.two, minimum: editMinimums.two, label: "20'" },
      { value: editFormData.four, minimum: editMinimums.four, label: "40'" },
      { value: editFormData.fourf, minimum: editMinimums.fourf, label: "45'" },
    ];

    for (const quantity of quantityChecks) {
      if (!/^\d+$/.test(quantity.value)) {
        error(`Enter a whole number for ${quantity.label} containers`);
        return;
      }

      if (Number(quantity.value) < quantity.minimum) {
        error(`Can't enter below ${quantity.minimum} for ${quantity.label} containers`);
        return;
      }
    }

    setConfirmUpdateBooking(true);
  };

  const handleUpdateBooking = async () => {
    // Close confirmation modal immediately
    setConfirmUpdateBooking(false);
    
    try {
      const response = await axios.put(`/api/bookings/${editFormData.id}`, {
        bnum: editFormData.bnum.toUpperCase(),
        ship: editFormData.ship.toUpperCase(),
        exp: editFormData.exp,
        two: Number(editFormData.two),
        four: Number(editFormData.four),
        fourf: Number(editFormData.fourf),
        // The tabs are navigation only; save both the quantities and list.
        cnums: editFormData.cnums,
        clientid: editFormData.clientid,
        isc: editBookingType === 'with' ? '1' : '0',
      });
      if (response.data.success) {
        saveFieldHistory({
          'booking.shipper': editFormData.ship,
        });
        success('Booking updated successfully');
        setShowEditModal(false);

        // Update only the edited row so the table does not reload or reset
        // the user's current scroll position.
        const updatedFromServer = response.data.data as Partial<Booking> | undefined;
        setBookings((currentBookings) => currentBookings.map((booking) => {
          if (booking.hashed_id !== editFormData.id) return booking;

          const selectedClient = clients.find((client) => client.id === editFormData.clientid);
          return {
            ...booking,
            ...updatedFromServer,
            hashed_id: booking.hashed_id,
            book_no: editFormData.bnum.toUpperCase().replace(/\s/g, ''),
            shipper: editFormData.ship.toUpperCase(),
            expiration_date: editFormData.exp,
            client: updatedFromServer?.client || booking.client || (selectedClient ? {
              c_id: Number(selectedClient.id),
              client_name: selectedClient.name || selectedClient.text,
              client_code: selectedClient.code,
            } : booking.client),
          };
        }));
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
        // Remove only the deleted row to preserve table position and scroll.
        setBookings((currentBookings) => currentBookings.filter(
          (booking) => booking.hashed_id !== bookingToDelete.hashed_id
        ));
      }
    } catch {
      setConfirmDeleteBooking(false);
      error('Failed to delete booking');
    }
  };

  const handleViewContainers = useCallback(async (booking: Booking) => {
    const fallbackList = getContainerListArray(booking.cont_list).map((container) => container.trim());
    const fallbackRemainingList = getContainerListArray(booking.cont_list_rem).map((container) => container.trim());
    setSelectedContainerList(fallbackList);
    setSelectedRemainingContainerList(fallbackRemainingList);
    setSelectedGateOutContainers([]);
    setSelectedBooking(booking);
    setShowViewModal(true);

    try {
      const response = await axios.get(`/api/bookings/${booking.hashed_id}/containers`);
      if (response.data.success) {
        setSelectedContainerList(response.data.data || []);
        setSelectedRemainingContainerList(response.data.remaining || []);
        setSelectedGateOutContainers(response.data.gate_out_containers || []);
      }
    } catch {
      // Keep the booking's stored lists if the filtered lookup is unavailable.
    }
  }, []);

  const getContainerListArray = (contList: string) => {
    if (!contList) return [];
    return contList.split(',').filter(c => c.trim());
  };

  const handleSort = (column: string) => {
    if (sortColumn === column && sortDirection === 'desc') {
      setSortColumn('');
      setSortDirection('asc');
      return;
    }

    const nextDirection: 'asc' | 'desc' = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(nextDirection);
  };

  const sortIconFor = (column: string) => sortColumn === column
    ? <span className="text-white">{sortDirection === 'asc' ? '↑' : '↓'}</span>
    : <ArrowUpDown className="h-4 w-4 opacity-90" />;

  const sortBookings = (rows: Booking[]) => {
    const effectiveColumn = sortColumn || 'date_added';
    const getSortValue = (booking: Booking): string | number => {
      switch (effectiveColumn) {
        case 'book_no': return (booking.book_no || '').toLowerCase();
        case 'client': return (booking.client?.client_name || '').toLowerCase();
        case 'shipper': return (booking.shipper || '').toLowerCase();
        case 'twenty_rem': return booking.twenty_rem ?? 0;
        case 'fourty_rem': return booking.fourty_rem ?? 0;
        case 'fourty_five_rem': return booking.fourty_five_rem ?? 0;
        case 'expiration': return booking.expiration_date ? new Date(booking.expiration_date).getTime() : 0;
        case 'container_list': return getContainerListArray(booking.cont_list).length;
        case 'container_list_rem': return getContainerListArray(booking.cont_list_rem).length;
        case 'date_added': return booking.date_added ? new Date(booking.date_added).getTime() : 0;
        default: return '';
      }
    };

    return [...rows].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      const result = typeof aValue === 'number' && typeof bValue === 'number'
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' });
      return sortColumn && sortDirection === 'desc' ? -result : result;
    });
  };

    // Define table columns once so we can reuse for expired results
    const tableColumns = [
      {
        key: 'book_no',
        label: 'Book No.',
        sortable: true,
        render: (booking: Booking) => (
          <div className="font-semibold text-gray-900 max-w-[70px]">{booking.book_no}</div>
        ),
      },
      {
        key: 'client',
        label: 'Client Name',
        sortable: true,
        render: (booking: Booking) => (
          <div className="text-sm text-gray-900 min-w-[70px] max-w-[75px]">
            <div className="font-medium">{booking.client?.client_name || 'Unknown client'}</div>
            <div className="text-xs text-gray-500">{booking.client?.client_code || '-'}</div>
          </div>
        ),
      },
      {
        key: 'shipper',
        label: 'Shipper',
        sortable: true,
        render: (booking: Booking) => (
          <div className="min-w-[70px] max-w-[90px]">
            <span className="text-sm text-gray-900">{booking.shipper}</span>
          </div>
        ),
      },
      {
        key: 'containers_info',
        label: (
          <div className="w-full min-w-[190px]">
            <div>Containers</div>
            <div className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-2 mt-2 text-center text-xs normal-case">
              <div>x20</div>
              <div>x40</div>
              <div>x45</div>
            </div>
          </div>
        ),
        headerRender: () => (
          <div className="flex w-full min-w-[190px] flex-col items-start gap-1 text-xs uppercase leading-tight">
            <span>Containers</span>
            <div className="grid w-full min-w-0 grid-cols-3 gap-2 text-center">
              {([
                ['x20', 'twenty_rem'],
                ['x40', 'fourty_rem'],
                ['x45', 'fourty_five_rem'],
              ] as const).map(([label, column]) => (
                <button
                  key={column}
                  type="button"
                  className="inline-flex w-full min-w-0 items-center justify-center gap-1 font-semibold hover:text-white/80"
                  onClick={(event) => { event.stopPropagation(); handleSort(column); }}
                  title={`Sort by remaining ${label}`}
                >
                  {label} {sortIconFor(column)}
                </button>
              ))}
            </div>
          </div>
        ),
        render: (booking: Booking) => (
          <div className="w-full min-w-[190px] space-y-2">
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-0.5">Allocated:</div>
              <div className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-center text-sm text-gray-900">
                <div>{booking.twenty}</div>
                <div>{booking.fourty}</div>
                <div>{booking.fourty_five}</div>
              </div>

            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 mb-0.5">Remaining:</div>
              <div className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-2 text-center text-sm font-semibold text-blue-600">
                <div>{booking.twenty_rem}</div>
                <div>{booking.fourty_rem}</div>
                <div>{booking.fourty_five_rem}</div>
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'container_lists',
        label: 'Container Lists',
        headerRender: () => (
          <div className="flex w-full min-w-[180px] flex-col items-start gap-1 whitespace-nowrap text-xs uppercase leading-tight">
            <span>Container Lists</span>
            <div className="grid w-full grid-cols-2 gap-3 text-center">
              {([
                ['List', 'container_list'],
                ['Remaining', 'container_list_rem'],
              ] as const).map(([label, column]) => (
                <button
                  key={column}
                  type="button"
                  className="inline-flex w-full items-center justify-start gap-1 font-semibold hover:text-white/80"
                  onClick={(event) => { event.stopPropagation(); handleSort(column); }}
                  title={`Sort by ${label.toLowerCase()} container count`}
                >
                  {label} {sortIconFor(column)}
                </button>
              ))}
            </div>
          </div>
        ),
        render: (booking: Booking) => {
          const containers = getContainerListArray(booking.cont_list);
          const containersRem = getContainerListArray(booking.cont_list_rem);
          return (
            <div className="grid w-full min-w-[180px] grid-cols-2 gap-3">
              <div className="min-w-0">
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
              <div className="min-w-0">
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
        sortable: true,
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
        sortable: true,
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
                    title="View Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </ModernButton>
                  <ModernButton 
                    variant="edit" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); handleEditBooking(booking); }}
                    title="Edit Booking"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </ModernButton>
                  <ModernButton 
                    variant="delete" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); setBookingToDelete(booking); setConfirmDeleteBooking(true); }}
                    title="Delete Booking"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </ModernButton>
            </div>
        ),
      },
    ];

    const hasRemaining = (booking: Booking) => (
      (booking.twenty_rem ?? 0) > 0 ||
      (booking.fourty_rem ?? 0) > 0 ||
      (booking.fourty_five_rem ?? 0) > 0 ||
      getContainerListArray(booking.cont_list_rem).some((container) => container.trim() !== '')
    );

    // Keep separate tables while using the same active sort and default date order.
    const bookingsWithRemaining = sortBookings(filteredBookings.filter(hasRemaining));
    const bookingsWithoutRemaining = sortBookings(filteredBookings.filter((booking) => !hasRemaining(booking)));
    const totalPages = 1;

  return (
    <AuthenticatedLayout>
      <Head title="Booking Management" />
      <CachedFieldHistory />
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
              <div className="md:col-span-3">
                <Label className="text-sm font-semibold mb-2 text-gray-900">Search Bookings</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Search by booking number or shipper..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleSearch();
                        }
                      }}
                      className="pl-10 h-11"
                    />
                    <ModernButton
                      type="button"
                      variant="primary"
                      onClick={() => void handleSearch()}
                      disabled={loading || (!searchTerm.trim() && !appliedSearchTerm)}
                      className="h-11 px-5"
                    >
                      Search
                    </ModernButton>
                    <button
                      type="button"
                      onClick={() => void handleResetSearch()}
                      disabled={loading || !canResetSearch}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white p-0 text-gray-600 shadow-xs transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Reset search"
                      aria-label="Reset search"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="md:col-span-1">
                <Label className="text-sm font-semibold mb-2 text-gray-900">Filter Options</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftClientFilter(clientFilter);
                      setDraftExpirationFilter(expirationFilter);
                      setShowFiltersModal(true);
                    }}
                    className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs"
                    disabled={loading}
                  >
                    <Filter className="w-4 h-4 text-gray-600" />
                    <span>Filters</span>
                    {canResetFilters && (
                      <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        Active
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    disabled={loading || !canResetFilters}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white p-0 text-gray-600 shadow-xs transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Reset filters"
                    aria-label="Reset filters"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{filteredBookings.length}</span> bookings found
                {appliedSearchTerm || canResetFilters ? (
                  <span> (filtered from {bookings.length} total)</span>
                ) : null}
              </p>
            </div>
          </ModernCard>
        </div>

        <div className="w-full">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-gray-900">Bookings with Remaining</h2>
            <p className="text-sm text-gray-600">{bookingsWithRemaining.length} booking{bookingsWithRemaining.length === 1 ? '' : 's'}</p>
          </div>
          <ModernTable
            columns={tableColumns}
            data={bookingsWithRemaining}
            loading={loading}
            emptyMessage="No bookings with remaining containers found."
            pagination={false}
            onSort={handleSort}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onRowClick={handleViewContainers}
          />
          {bookingsWithoutRemaining.length > 0 && (
            <div className="mt-6">
              <div className="mb-3">
                <h2 className="text-base font-semibold text-gray-900">Bookings with No Remaining</h2>
                <p className="text-sm text-gray-600">{bookingsWithoutRemaining.length} booking{bookingsWithoutRemaining.length === 1 ? '' : 's'}</p>
              </div>
              <ModernTable
                columns={tableColumns}
                data={bookingsWithoutRemaining}
                loading={false}
                emptyMessage="No bookings without remaining containers found."
                pagination={false}
                onSort={handleSort}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onRowClick={handleViewContainers}
              />
            </div>
          )}
          {expiredResults && expiredResults.length > 0 && (
            <div className="mt-6">
              <div className="flex items-start gap-3">
                <span className="w-3 h-3 rounded-full bg-blue-500 mt-1" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Expired Matches</h3>
                  <p className="text-sm text-gray-600">{expiredResults.length} expired bookings matched</p>
                </div>
              </div>
              <div className="mt-3">
                <ModernTable
                  columns={tableColumns}
                  data={sortBookings(expiredResults)}
                  loading={false}
                  emptyMessage="No expired bookings match your search."
                  pagination={false}
                  onSort={handleSort}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onRowClick={handleViewContainers}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters Modal */}
      <Dialog open={showFiltersModal} onOpenChange={handleFilterModalOpenChange}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
              Filter Options
            </DialogTitle>
            <DialogDescription>
              Apply filters to refine booking results
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-semibold text-gray-900">Client</Label>
              <Select value={draftClientFilter} onValueChange={setDraftClientFilter}>
                <SelectTrigger className="mt-1.5 h-11">
                  <SelectValue placeholder="All Clients" />
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
              <Label className="text-sm font-semibold text-gray-900">Expiration Date</Label>
              <Input
                type="date"
                value={draftExpirationFilter}
                onChange={(e) => setDraftExpirationFilter(e.target.value)}
                className="mt-1.5 h-11"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <ModernButton
              variant="secondary"
              onClick={handleResetFilters}
              disabled={loading || !canResetFilters}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </ModernButton>
            <ModernButton
              variant="primary"
              onClick={handleApplyFilters}
              disabled={loading}
            >
              Apply
            </ModernButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <Input value={formData.bnum} placeholder="Enter booking number" onChange={(e) => setFormData({ ...formData, bnum: e.target.value.toUpperCase() })} className={errors.bnum ? 'border-red-500' : ''} />
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
                <div>
                  <Label className="text-gray-900">Shipper <span className="text-red-500">*</span></Label>
                  <Input
                    data-history-key="booking.shipper"
                    value={formData.shipper}
                    onChange={(e) => setFormData({ ...formData, shipper: e.target.value.toUpperCase() })}
                    placeholder="Enter shipper name"
                    className={errors.shipper ? 'border-red-500' : ''}
                  />
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
                  <Label className="text-gray-900">Container Numbers</Label>
                  <Textarea
                    value={formData.cnums}
                      onChange={(e) => setFormData({ ...formData, cnums: formatContainerListInput(e.target.value) })}
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
                  <Input type="number" min="0" value={formData.two} onChange={(e) => setFormData({ ...formData, two: e.target.value })} />
                </div>
                <div>
                  <Label className="text-gray-900">40' Containers</Label>
                  <Input type="number" min="0" value={formData.four} onChange={(e) => setFormData({ ...formData, four: e.target.value })} />
                </div>
                <div>
                  <Label className="text-gray-900">45' Containers</Label>
                  <Input type="number" min="0" value={formData.fourf} onChange={(e) => setFormData({ ...formData, fourf: e.target.value })} />
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
              <div>
                <Label className="text-gray-900 text-base font-medium mb-2 block">Booking Type</Label>
                <div className="grid grid-cols-2 gap-0 w-full rounded-lg shadow-sm overflow-hidden" role="group">
                  <button type="button" onClick={() => {
                    setEditBookingType('without');
                  }} className={`px-6 py-3 text-sm font-medium border transition-all ${editBookingType === 'without' ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`} style={editBookingType === 'without' ? { backgroundColor: colors.brand.primary } : {}}>
                    Without Container List
                  </button>
                  <button type="button" onClick={() => {
                    setEditBookingType('with');
                  }} className={`px-6 py-3 text-sm font-medium border border-l-0 transition-all ${editBookingType === 'with' ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`} style={editBookingType === 'with' ? { backgroundColor: colors.brand.primary } : {}}>
                    With Container List
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Booking Number <span className="text-red-500">*</span></Label>
                  <Input value={editFormData.bnum} onChange={(e) => setEditFormData({ ...editFormData, bnum: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <Label className="text-gray-900">Client <span className="text-red-500">*</span></Label>
                  <Select 
                    value={editFormData.clientid}
                    onValueChange={(value) => setEditFormData({ ...editFormData, clientid: value })}
                  >
                  <SelectTrigger className="w-full truncate">
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
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Shipper <span className="text-red-500">*</span></Label>
                  <Input data-history-key="booking.shipper" value={editFormData.ship} onChange={(e) => setEditFormData({ ...editFormData, ship: e.target.value.toUpperCase() })} />
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
              {editBookingType === 'with' ? (
                <div>
                  <Label className="text-gray-900">Container Numbers</Label>
                  <Textarea value={editFormData.cnums} onChange={(e) => setEditFormData({ ...editFormData, cnums: formatContainerListInput(e.target.value) })} rows={4} placeholder="Enter container numbers (comma-separated, 11 chars each)" className={`font-mono ${errors.cnums ? 'border-red-500' : ''}`} />
                  {errors.cnums && <p className="text-red-500 text-xs mt-1">{errors.cnums[0]}</p>}
                  <p className="text-xs text-gray-500 mt-1">Format: ABCD1234567, EFGH8901234</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-900">20' Containers</Label>
                  <Input type="number" value={editFormData.two} onChange={(e) => setEditFormData({ ...editFormData, two: e.target.value })} />
                </div>
                <div>
                  <Label className="text-gray-900">40' Containers</Label>
                  <Input type="number" value={editFormData.four} onChange={(e) => setEditFormData({ ...editFormData, four: e.target.value })} />
                </div>
                <div>
                  <Label className="text-gray-900">45' Containers</Label>
                  <Input type="number" value={editFormData.fourf} onChange={(e) => setEditFormData({ ...editFormData, fourf: e.target.value })} />
                </div>
                </div>
              )}
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
            <div className="space-y-6">
              
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Booking Information</div>
                <div className="space-y-1">
                  <div className="text-sm text-gray-900">Booking Number: <span className="font-semibold">{selectedBooking.book_no}</span></div>
                  <div className="text-sm text-gray-900">Shipper: <span className="font-semibold">{selectedBooking.shipper}</span></div>
                </div>
              <div className="border-t pt-4">
                
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - CONTAINERS */}
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    <div>Containers</div>
                    <div className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-3 mt-2 text-center text-xs normal-case">
                      <div>x20</div>
                      <div>x40</div>
                      <div>x45</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Allocated</div>
                    <div className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-3 text-center text-gray-900">
                      <div>{selectedBooking.twenty}</div>
                      <div>{selectedBooking.fourty}</div>
                      <div>{selectedBooking.fourty_five}</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Remaining</div>
                    <div className="grid w-full grid-cols-[repeat(3,minmax(0,1fr))] gap-3 text-center text-gray-900">
                      <div><span className={selectedBooking.twenty_rem > 0 ? 'text-blue-600 font-semibold' : ''}>{selectedBooking.twenty_rem}</span></div>
                      <div><span className={selectedBooking.fourty_rem > 0 ? 'text-blue-600 font-semibold' : ''}>{selectedBooking.fourty_rem}</span></div>
                      <div><span className={selectedBooking.fourty_five_rem > 0 ? 'text-blue-600 font-semibold' : ''}>{selectedBooking.fourty_five_rem}</span></div>
                    </div>
                  </div>
                </div>
                
                {/* Right Column - CONTAINER LISTS */}
                <div className="space-y-4">
                  <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Container Lists</div>
                  
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">List</div>
                    <div className="space-y-1">
                      {selectedContainerList.length > 0 ? (
                        selectedContainerList.map((container, idx) => (
                          <div key={`list-${idx}`} className="text-gray-900 font-mono text-sm">{container}</div>
                        ))
                      ) : (
                        <div className="text-gray-500">-</div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Rem</div>
                    <div className="space-y-1">
                      {selectedRemainingContainerList.length > 0 ? (
                        selectedRemainingContainerList.map((container, idx) => (
                          <div key={`rem-${idx}`} className="text-gray-900 font-mono text-sm">{container}</div>
                        ))
                      ) : (
                        <div className="text-gray-500">-</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Gate Out Containers</div>
                {selectedGateOutContainers.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto rounded-md border border-gray-200">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 text-[11px] uppercase tracking-wide text-white" style={{ backgroundColor: colors.table.header }}>
                        <tr>
                          <th className="px-3 py-2 font-semibold">Container</th>
                          <th className="px-3 py-2 font-semibold">Size/Type</th>
                          <th className="px-3 py-2 font-semibold">Date</th>
                          <th className="px-3 py-2 font-semibold">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedGateOutContainers.map((container, idx) => {
                          const dateAdded = new Date(container.date_added);
                          const validDate = !Number.isNaN(dateAdded.getTime());
                          const sizeType = `${container.size ?? ''}${container.type ?? ''}` || '-';
                          let sizeVariant: 'success' | 'error' | 'warning' | 'info' | 'default' = 'default';
                          if (sizeType === '10DJH' || sizeType === '20RF' || sizeType === '40HC') sizeVariant = 'success';
                          else if (sizeType === '20FR' || sizeType === '20RH' || sizeType === '40OT') sizeVariant = 'error';
                          else if (sizeType === '20HR' || sizeType === '40DC' || sizeType === '40RH') sizeVariant = 'warning';
                          else if (sizeType === '20OT' || sizeType === '40FR') sizeVariant = 'info';

                          return (
                            <tr key={`gate-out-${idx}`} className="bg-white hover:bg-gray-50">
                              <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-900">{container.container_no}</td>
                              <td className="px-3 py-2"><ModernBadge variant={sizeVariant}>{sizeType}</ModernBadge></td>
                              <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                                {validDate ? dateAdded.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-gray-700">
                                {validDate ? dateAdded.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">-</div>
                )}
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
      
      <button
        aria-label="Back to top"
        title="Back to top"
        onClick={() => {
          try {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch {
            // ignore
          }
        }}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 24,
          zIndex: 9999,
          width: 44,
          height: 44,
          borderRadius: 8,
          background: '#111827',
          color: '#ffffff',
          display: showBackToTop ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
          cursor: 'pointer',
          border: 'none',
          outline: 'none',
          transition: 'opacity 200ms ease',
        }}
      >
        ↑
      </button>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </AuthenticatedLayout>
  );
}

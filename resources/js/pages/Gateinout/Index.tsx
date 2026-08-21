import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { ModernButton, ModernCard, ModernTable, ModernBadge, ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, CheckCircle, TruckIcon as GateIcon, Filter, RefreshCw } from 'lucide-react';
import { colors } from '@/lib/colors';
import ProcessGateInModal from '@/components/Gateinout/ProcessGateInModal';
import ProcessGateOutModal from '@/components/Gateinout/ProcessGateOutModal';

interface PreInventoryRecord extends Record<string, unknown> {
  hashed_id: string;
  p_id: number;
  client_id: number;
  container_no: string;
  client_name: string;
  client_code: string;
  plate_no: string;
  hauler: string;
  gate_status: 'IN' | 'OUT';
  status: 'pending' | 'processed';
  runtime: number;
  runtime_color: 'green' | 'orange' | 'red';
  date_added: string;
}

interface Client {
  c_id: number;
  hashed_c_id: string;
  client_name: string;
  client_code: string;
}

interface PreInFormData {
  container_no: string;
  client_id: string;
}

interface PreOutFormData {
  plate_no: string;
  hauler: string;
}

interface EditPreInFormData {
  id: string;
  container_no: string;
  client_id: string;
  plate_no: string;
  hauler: string;
}

interface EditPreOutFormData {
  id: string;
  container_no: string;
  plate_no: string;
  hauler: string;
}

export default function Index() {
  const { toasts, removeToast, success, error } = useModernToast();
  const [preInventoryList, setPreInventoryList] = useState<PreInventoryRecord[]>([]);
  const [filteredInRecords, setFilteredInRecords] = useState<PreInventoryRecord[]>([]);
  const [filteredOutRecords, setFilteredOutRecords] = useState<PreInventoryRecord[]>([]);
  // Table-only data used to refresh rows without touching header titles/counts
  const [inTableData, setInTableData] = useState<PreInventoryRecord[]>([]);
  const [outTableData, setOutTableData] = useState<PreInventoryRecord[]>([]);
  const [inLoading, setInLoading] = useState(false);
  const [outLoading, setOutLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [tempSelectedClient, setTempSelectedClient] = useState<string>('all');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [currentPageIn, setCurrentPageIn] = useState(1);
  const [currentPageOut, setCurrentPageOut] = useState(1);
  const [itemsPerPageIn, setItemsPerPageIn] = useState<number>(15);
  const [itemsPerPageOut, setItemsPerPageOut] = useState<number>(15);

  const [showAddPreInModal, setShowAddPreInModal] = useState(false);
  const [showAddPreOutModal, setShowAddPreOutModal] = useState(false);
  const [showEditPreInModal, setShowEditPreInModal] = useState(false);
  const [showEditPreOutModal, setShowEditPreOutModal] = useState(false);
  const [showProcessGateInModal, setShowProcessGateInModal] = useState(false);
  const [showProcessGateOutModal, setShowProcessGateOutModal] = useState(false);

  const [confirmUpdatePreIn, setConfirmUpdatePreIn] = useState(false);
  const [confirmUpdatePreOut, setConfirmUpdatePreOut] = useState(false);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<PreInventoryRecord | null>(null);

  const [preInForm, setPreInForm] = useState<PreInFormData>({
    container_no: '',
    client_id: '',
  });
  const [preOutForm, setPreOutForm] = useState<PreOutFormData>({
    plate_no: '',
    hauler: '',
  });

  const [editPreInForm, setEditPreInForm] = useState<EditPreInFormData>({
    id: '',
    container_no: '',
    client_id: '',
    plate_no: '',
    hauler: '',
  });

  const [editPreOutForm, setEditPreOutForm] = useState<EditPreOutFormData>({
    id: '',
    container_no: '',
    plate_no: '',
    hauler: '',
  });

  const [selectedProcessRecord, setSelectedProcessRecord] = useState<PreInventoryRecord | null>(null);

  const [statusOptions, setStatusOptions] = useState<Array<{ s_id: number; status: string }>>([]);
  const [sizeTypeOptions, setSizeTypeOptions] = useState<Array<{ s_id: number; size: string; type: string }>>([]);
  const [loadOptions, setLoadOptions] = useState<Array<{ l_id: number; type: string }>>([]);

  const [pageAccess, setPageAccess] = useState<{ can_view: boolean; module_edit: boolean; module_delete: boolean }>({
    can_view: false,
    module_edit: false,
    module_delete: false,
  });

  const fetchPageAccess = async () => {
    try {
      const resp = await axios.get('/api/gateinout/page-record-access');
      if (resp.data.success) {
        setPageAccess({
          can_view: Boolean(resp.data.can_view),
          module_edit: Boolean(resp.data.module_edit),
          module_delete: Boolean(resp.data.module_delete),
        });
      }
    } catch {
      console.warn('Failed to load page access for gateinout');
    }
  };

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preInventoryList, searchTerm, selectedClient]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listRes, clientsRes] = await Promise.all([
        axios.post('/api/gateinout/list', {}),
        axios.get('/api/gateinout/clients'),
      ]);

      if (listRes.data.success) {
        const records = listRes.data.data || listRes.data.prelist || [];
        setPreInventoryList(records || []);
      }
      if (clientsRes.data.success) {
        setClients(clientsRes.data.data || clientsRes.data.clients || []);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e?.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageAccess();
    fetchData();
    fetchDropdownOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDropdownOptions = async () => {
    try {
      const [statusRes, sizeTypeRes, loadRes] = await Promise.all([
        axios.get('/api/gateinout/status-options'),
        axios.get('/api/gateinout/sizetype-options'),
        axios.get('/api/gateinout/load-options'),
      ]);

      if (statusRes.data.success) {
        setStatusOptions(statusRes.data.data || []);
      }
      if (sizeTypeRes.data.success) {
        setSizeTypeOptions(sizeTypeRes.data.data || []);
      }
      if (loadRes.data.success) {
        setLoadOptions(loadRes.data.data || []);
      }
    } catch {
      // Silently fail - non-critical
      console.warn('Failed to load dropdown options');
    }
  };

  const applyFilters = () => {
    let filtered = [...preInventoryList];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (record) =>
          record.container_no.toLowerCase().includes(search) ||
          record.client_name.toLowerCase().includes(search) ||
          record.client_code.toLowerCase().includes(search) ||
          record.plate_no.toLowerCase().includes(search) ||
          record.hauler.toLowerCase().includes(search)
      );
    }

    // status filter removed — only filtering by search term and client

    if (selectedClient && selectedClient !== 'all') {
      filtered = filtered.filter((record) => String(record.client_id ?? '') === selectedClient);
    }

    // Separate into IN and OUT records
    const inRecords = filtered.filter((record) => record.gate_status === 'IN');
    const outRecords = filtered.filter((record) => record.gate_status === 'OUT');

    // Update the filtered sets (used for counts and global state)
    setFilteredInRecords(inRecords);
    setFilteredOutRecords(outRecords);
    // Also populate the table rows (these are what the tables render). Keeping them
    // separate lets us refresh only rows without updating header counts/titles.
    setInTableData(inRecords);
    setOutTableData(outRecords);
    setCurrentPageIn(1); // Reset to first page when filters change
    setCurrentPageOut(1);
  };

  // Refresh only IN rows (does not touch header counts/titles)
  const fetchInRows = async () => {
    try {
      setInLoading(true);
      const listRes = await axios.post('/api/gateinout/list', {});
      if (listRes.data.success) {
        const records = listRes.data.data || listRes.data.prelist || [];
        let filtered = Array.isArray(records) ? records : [];
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          filtered = filtered.filter(
            (record: PreInventoryRecord) =>
              record.container_no.toLowerCase().includes(search) ||
              record.client_name.toLowerCase().includes(search) ||
              record.client_code.toLowerCase().includes(search) ||
              record.plate_no.toLowerCase().includes(search) ||
              record.hauler.toLowerCase().includes(search)
          );
        }
        if (selectedClient && selectedClient !== 'all') {
          filtered = filtered.filter((record: PreInventoryRecord) => String(record.client_id ?? '') === selectedClient);
        }
        const inRecords = filtered.filter((record: PreInventoryRecord) => record.gate_status === 'IN');
        setInTableData(inRecords);
        setCurrentPageIn(1);
      }
    } catch (err) {
      console.error('Failed to refresh IN rows:', err);
    } finally {
      setInLoading(false);
    }
  };

  // Refresh only OUT rows (does not touch header counts/titles)
  const fetchOutRows = async () => {
    try {
      setOutLoading(true);
      const listRes = await axios.post('/api/gateinout/list', {});
      if (listRes.data.success) {
        const records = listRes.data.data || listRes.data.prelist || [];
        let filtered = Array.isArray(records) ? records : [];
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          filtered = filtered.filter(
            (record: PreInventoryRecord) =>
              record.container_no.toLowerCase().includes(search) ||
              record.client_name.toLowerCase().includes(search) ||
              record.client_code.toLowerCase().includes(search) ||
              record.plate_no.toLowerCase().includes(search) ||
              record.hauler.toLowerCase().includes(search)
          );
        }
        if (selectedClient && selectedClient !== 'all') {
          filtered = filtered.filter((record: PreInventoryRecord) => String(record.client_id ?? '') === selectedClient);
        }
        const outRecords = filtered.filter((record: PreInventoryRecord) => record.gate_status === 'OUT');
        setOutTableData(outRecords);
        setCurrentPageOut(1);
      }
    } catch (err) {
      console.error('Failed to refresh OUT rows:', err);
    } finally {
      setOutLoading(false);
    }
  };

  const submitAddPreIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preInForm.container_no.length !== 11) {
      error('Container number must be exactly 11 characters');
      return;
    }
    if (!preInForm.client_id) {
      error('Please select a client');
      return;
    }
    handleAddPreIn();
  };

  const handleAddPreIn = async () => {
    try {
      const response = await axios.post('/api/gateinout/check-container-in', {
        cno: preInForm.container_no.toUpperCase(),
        client: preInForm.client_id,
      });

      if (response.data.message) {
        const [type, msg] = response.data.message;
        if (type === 'success') {
          success('Pre-In added successfully');
          setShowAddPreInModal(false);
          setPreInForm({ container_no: '', client_id: '' });
          await fetchData();
        } else {
          error(msg.replace(/<[^>]*>/g, ''));
        }
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to add Pre-In');
    }
  };

  const submitAddPreOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preOutForm.plate_no.trim()) {
      error('Plate number is required');
      return;
    }
    if (!preOutForm.hauler.trim()) {
      error('Hauler is required');
      return;
    }
    handleAddPreOut();
  };

  const handleAddPreOut = async () => {
    try {
      const response = await axios.post('/api/gateinout/check-container-out', {
        pno: preOutForm.plate_no,
        hauler: preOutForm.hauler,
      });

      if (response.data.message) {
        const [type, msg] = response.data.message;
        if (type === 'success') {
          success('Pre-Out added successfully');
          setShowAddPreOutModal(false);
          setPreOutForm({ plate_no: '', hauler: '' });
          await fetchData();
        } else {
          error(msg.replace(/<[^>]*>/g, ''));
        }
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to add Pre-Out');
    }
  };

  const handleEditPreIn = async (record: PreInventoryRecord) => {
    // Use the client_id from the record directly
    setEditPreInForm({
      id: record.hashed_id,
      container_no: record.container_no,
      client_id: record.client_id.toString(),
      plate_no: record.plate_no || '',
      hauler: record.hauler || '',
    });
    setShowEditPreInModal(true);
  };

  const handleEditPreOut = async (record: PreInventoryRecord) => {
    try {
      const response = await axios.post('/api/gateinout/get-preout-details', {
        id: record.hashed_id,
      });

      if (response.data.success) {
        const data = response.data.data;
        setEditPreOutForm({
          id: record.hashed_id,
          container_no: data.container_no,
          plate_no: data.plate_no || '',
          hauler: data.hauler || '',
        });
        setShowEditPreOutModal(true);
      }
    } catch {
      error('Failed to load Pre-Out details');
    }
  };

  const submitUpdatePreIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmUpdatePreIn(true);
  };

  const handleUpdatePreIn = async () => {
    try {
      // Find the hashed client ID
      const selectedClient = clients.find(c => c.c_id.toString() === editPreInForm.client_id);
      const hashedClientId = selectedClient?.hashed_c_id || editPreInForm.client_id;
      
      const requestData = {
        id: editPreInForm.id,
        cno: editPreInForm.container_no,
        cid: hashedClientId
      };
      console.log('Sending Update Pre-In Data:', requestData);
      const response = await axios.post('/api/gateinout/update-prein', requestData);
      console.log('Update Pre-In Response:', response.data);
      
      if (response.data.message) {
        const [type, msg] = response.data.message;
        if (type === 'success') {
          setShowEditPreInModal(false);
          setConfirmUpdatePreIn(false);
          await fetchData();
          success('Pre-In updated successfully');
        } else {
          setConfirmUpdatePreIn(false);
          error(msg.replace(/<[^>]*>/g, ''));
        }
      }
    } catch (err: unknown) {
      setConfirmUpdatePreIn(false);
      const e = err as { response?: { data?: { message?: string } } };
      console.error('Update Pre-In Error:', err);
      error(e.response?.data?.message || 'Failed to update Pre-In');
    }
  };

  const submitUpdatePreOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmUpdatePreOut(true);
  };

  const handleUpdatePreOut = async () => {
    try {
      const requestData = {
        id: editPreOutForm.id,
        pno: editPreOutForm.plate_no,
        hauler: editPreOutForm.hauler
      };
      console.log('Sending Update Pre-Out Data:', requestData);
      const response = await axios.post('/api/gateinout/update-preout', requestData);
      console.log('Update Pre-Out Response:', response.data);
      
      if (response.data.message) {
        const [type, msg] = response.data.message;
        if (type === 'success') {
          setShowEditPreOutModal(false);
          setConfirmUpdatePreOut(false);
          await fetchData();
          success('Pre-Out updated successfully');
        } else {
          setConfirmUpdatePreOut(false);
          error(msg.replace(/<[^>]*>/g, ''));
        }
      }
    } catch (err: unknown) {
      setConfirmUpdatePreOut(false);
      const e = err as { response?: { data?: { message?: string } } };
      console.error('Update Pre-Out Error:', err);
      error(e.response?.data?.message || 'Failed to update Pre-Out');
    }
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;

    try {
      const response = await axios.post('/api/gateinout/delete-pre', {
        id: recordToDelete.hashed_id,
      });
      console.log('Delete Response:', response.data);
      
      setRecordToDelete(null);
      setConfirmDeleteRecord(false);
      await fetchData();
      success('Record deleted successfully');
    } catch (err: unknown) {
      setConfirmDeleteRecord(false);
      const e = err as { response?: { data?: { message?: string } } };
      console.error('Delete Error:', err);
      error(e.response?.data?.message || 'Failed to delete record');
    }
  };

  const handleProcessClick = (record: PreInventoryRecord) => {
    setSelectedProcessRecord(record);
    if (record.gate_status === 'IN') {
      setShowProcessGateInModal(true);
    } else {
      setShowProcessGateOutModal(true);
    }
  };

  const canEdit = (record: PreInventoryRecord): boolean => {
    return record.status.toLowerCase() === 'pending' && pageAccess.module_edit;
  };

  const canDelete = (record: PreInventoryRecord): boolean => {
    return record.status.toLowerCase() === 'pending' && pageAccess.module_delete;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatRuntime = (minutes: number) => {
    const days = Math.floor(minutes / (24 * 60));
    const remainingMinutes = minutes % (24 * 60);
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    
    return `${days}d ${hours}h ${mins}m`;
  };

  const getRuntimeColor = (color: string) => {
    switch (color) {
      case 'green':
        return '#10b981';
      case 'orange':
        return '#f59e0b';
      case 'red':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  // Pagination for both tables (use table-specific data so headers/counts remain unchanged)
  const paginatedInRecords = inTableData.slice(
    (currentPageIn - 1) * itemsPerPageIn,
    currentPageIn * itemsPerPageIn
  );
  const totalPagesIn = Math.ceil(filteredInRecords.length / (itemsPerPageIn || 1));

  const paginatedOutRecords = outTableData.slice(
    (currentPageOut - 1) * itemsPerPageOut,
    currentPageOut * itemsPerPageOut
  );
  const totalPagesOut = Math.ceil(filteredOutRecords.length / (itemsPerPageOut || 1));

  return (
    <AuthenticatedLayout>
      <Head title="Gate In & Out" />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="space-y-6">
        {/* HEADER - EXACTLY LIKE CLIENTS PAGE */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl"
              style={{ backgroundColor: colors.brand.primary }}
            >
              <GateIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gate In & Out</h1>
              <p className="text-sm mt-1 text-gray-600">
                Manage pre-gate records and process approvals
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <ModernButton
              variant="add"
              size="lg"
              onClick={() => setShowAddPreInModal(true)}
            >
              <Plus className="w-4 h-4" />
              Add Pre In
            </ModernButton>
            <ModernButton
              variant="delete"
              size="lg"
              onClick={() => setShowAddPreOutModal(true)}
            >
              <Plus className="w-4 h-4" />
              Add Pre Out
            </ModernButton>
          </div>
        </div>

        {/* SEARCH & FILTER CARD - EXACTLY LIKE CLIENTS PAGE */}
        <div className="relative" style={{ zIndex: 0 }}>
          <ModernCard
            title="Search & Filter Pre-Gate Records"
            subtitle="Find records quickly"
            icon={<Search className="w-5 h-5" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3">
                <Label className="text-sm font-semibold mb-2 text-gray-900">
                  Search Records
                </Label>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <Input
                    type="text"
                    placeholder="Search by container, client, plate no., or hauler..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
              <div className="md:col-span-1">
                <Label className="text-sm font-semibold mb-2 text-gray-900">
                  Filter Options
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setTempSelectedClient(selectedClient);
                    setShowFiltersModal(true);
                  }}
                  className="flex items-center gap-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs"
                >
                  <Filter className="w-4 h-4 text-gray-600" />
                  <span>Filters</span>
                  {selectedClient !== 'all' && (
                    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs px-2 py-0.5">
                      1
                    </span>
                  )}
                </button>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{filteredInRecords.length + filteredOutRecords.length}</span>{' '}
                records found
                {searchTerm || selectedClient !== 'all' ? (
                  <span> (filtered from {preInventoryList.length} total)</span>
                ) : null}
              </p>
            </div>
          </ModernCard>
        </div>

        {/* IN RECORDS TABLE */}
        <div className="w-full">
          <div className="mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10b981' }}></div>
                  Gate IN Records
                </h2>
                <p className="text-sm text-gray-600 mt-1">{filteredInRecords.length} IN record(s)</p>
              </div>
              <div className="ml-4">
                <ModernButton
                  type="button"
                  variant="toggle"
                  size="sm"
                  onClick={() => fetchInRows()}
                  disabled={inLoading}
                  title="Refresh IN records"
                >
                  <RefreshCw className="w-4 h-4" />
                </ModernButton>
              </div>
            </div>
          </div>
          <ModernTable
            columns={[
              {
                key: 'container_no',
                label: 'Container No',
                render: (record: PreInventoryRecord) => (
                  <div className="font-mono font-semibold text-gray-900 min-w-[70px]" title={record.container_no}>
                    {record.container_no}
                  </div>
                ),
              },
              {
                key: 'client',
                label: 'Client Name',
                render: (record: PreInventoryRecord) => (
                  <div className="min-w-[120px] max-w-[120px]">
                    <div className="font-medium text-gray-900 " title={record.client_name}>{record.client_name}</div>
                    <div className="text-xs text-gray-500 ">{record.client_code}</div>
                  </div>
                ),
              },
              {
                key: 'plate_no',
                label: 'Plate No',
                render: (record: PreInventoryRecord) => (
                  <div className="text-sm text-gray-600 min-w-[70px] " title={record.plate_no || '-'}>
                    {record.plate_no || '-'}
                  </div>
                ),
              },
              {
                key: 'hauler',
                label: 'Hauler',
                render: (record: PreInventoryRecord) => (
                  <div className="text-sm text-gray-600 min-w-[70px]" title={record.hauler || '-'}>
                    {record.hauler || '-'}
                  </div>
                ),
              },
              {
                key: 'gate_status',
                label: 'Gate Status',
                render: (record: PreInventoryRecord) => (
                  <div className="min-w-[60px]">
                    <ModernBadge variant={record.gate_status === 'IN' ? 'success' : 'error'}>
                      {record.gate_status}
                    </ModernBadge>
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (record: PreInventoryRecord) => (
                  <div className="min-w-[70px] ">
                    <ModernBadge
                      variant={
                        record.status.toLowerCase() === 'pending' ? 'warning' : 'default'
                      }
                    >
                      {record.status.toUpperCase()}
                    </ModernBadge>
                  </div>
                ),
              },
              {
                key: 'runtime',
                label: 'Run Time',
                render: (record: PreInventoryRecord) => (
                  <div
                    className="font-semibold min-w-[70px]"
                    style={{ color: getRuntimeColor(record.runtime_color) }}
                  >
                    {formatRuntime(record.runtime)}
                  </div>
                ),
              },
              {
                key: 'date_added',
                label: 'Date Created',
                render: (record: PreInventoryRecord) => (
                  <div className="text-sm text-gray-600 min-w-[80px] max-w-[110px]">
                    {formatDateTime(record.date_added)}
                  </div>
                ),
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (record: PreInventoryRecord) => (
                  <div className="flex items-center justify-end gap-2 min-w-[120px]">
                    {/* PROCESS BUTTON - AS REQUESTED IN IMAGE */}
                    {record.status.toLowerCase() === 'pending' && (
                      <ModernButton
                        variant="add"
                        size="sm"
                        onClick={() => handleProcessClick(record)}
                        title="Process"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </ModernButton>
                    )}
                    {canEdit(record) && (
                      <ModernButton
                        variant="edit"
                        size="sm"
                        onClick={() => {
                          if (record.gate_status === 'IN') {
                            handleEditPreIn(record);
                          } else {
                            handleEditPreOut(record);
                          }
                        }}
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </ModernButton>
                    )}
                    {canDelete(record) && (
                      <ModernButton
                        variant="delete"
                        size="sm"
                        onClick={() => {
                          setRecordToDelete(record);
                          setConfirmDeleteRecord(true);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </ModernButton>
                    )}
                  </div>
                ),
              },
            ]}
            data={paginatedInRecords}
            loading={loading}
            emptyMessage="No IN records found."
            pagination={{
              currentPage: currentPageIn,
              totalPages: totalPagesIn,
              perPage: itemsPerPageIn,
              total: filteredInRecords.length,
              onPageChange: setCurrentPageIn,
              onPerPageChange: (per: number) => { setItemsPerPageIn(per); setCurrentPageIn(1); },
              rowsOptions: [15, 20, 50, 100],
            }}
          />
        </div>

        {/* OUT RECORDS TABLE */}
        <div className="w-full mt-8">
          <div className="mb-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
                  Gate OUT Records
                </h2>
                <p className="text-sm text-gray-600 mt-1">{filteredOutRecords.length} OUT record(s)</p>
              </div>
              <div className="ml-4">
                <ModernButton
                  type="button"
                  variant="toggle"
                  size="sm"
                  onClick={() => fetchOutRows()}
                  disabled={outLoading}
                  title="Refresh OUT records"
                >
                  <RefreshCw className="w-4 h-4" />
                </ModernButton>
              </div>
            </div>
          </div>
          <ModernTable
            columns={[
              {
                key: 'container_no',
                label: 'Container No',
                render: (record: PreInventoryRecord) => (
                  <div className="font-mono font-semibold text-gray-900 min-w-[70px]" title={record.container_no}>
                    {record.container_no}
                  </div>
                ),
              },
              {
                key: 'client',
                label: 'Client Name',
                render: (record: PreInventoryRecord) => (
                  <div className="min-w-[120px] max-w-[120px]">
                    <div className="font-medium text-gray-900 " title={record.client_name}>{record.client_name}</div>
                    <div className="text-xs text-gray-500 ">{record.client_code}</div>
                  </div>
                ),
              },
              {
                key: 'plate_no',
                label: 'Plate No',
                render: (record: PreInventoryRecord) => (
                  <div className="text-sm text-gray-600 min-w-[70px] " title={record.plate_no || '-'}>
                    {record.plate_no || '-'}
                  </div>
                ),
              },
              {
                key: 'hauler',
                label: 'Hauler',
                render: (record: PreInventoryRecord) => (
                  <div className="text-sm text-gray-600 min-w-[70px]" title={record.hauler || '-'}>
                    {record.hauler || '-'}
                  </div>
                ),
              },
              {
                key: 'gate_status',
                label: 'Gate Status',
                render: (record: PreInventoryRecord) => (
                  <div className="min-w-[60px]">
                    <ModernBadge variant={record.gate_status === 'IN' ? 'success' : 'error'}>
                      {record.gate_status}
                    </ModernBadge>
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (record: PreInventoryRecord) => (
                  <div className="min-w-[70px] ">
                    <ModernBadge
                      variant={
                        record.status.toLowerCase() === 'pending' ? 'warning' : 'default'
                      }
                    >
                      {record.status.toUpperCase()}
                    </ModernBadge>
                  </div>
                ),
              },
              {
                key: 'runtime',
                label: 'Run Time',
                render: (record: PreInventoryRecord) => (
                  <div
                    className="font-semibold min-w-[70px]"
                    style={{ color: getRuntimeColor(record.runtime_color) }}
                  >
                    {formatRuntime(record.runtime)}
                  </div>
                ),
              },
              {
                key: 'date_added',
                label: 'Date Created',
                render: (record: PreInventoryRecord) => (
                  <div className="text-sm text-gray-600 min-w-[80px] max-w-[110px]">
                    {formatDateTime(record.date_added)}
                  </div>
                ),
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (record: PreInventoryRecord) => (
                  <div className="flex items-center justify-end gap-2 min-w-[120px]">
                    {/* PROCESS BUTTON - AS REQUESTED IN IMAGE */}
                    {record.status.toLowerCase() === 'pending' && (
                      <ModernButton
                        variant="add"
                        size="sm"
                        onClick={() => handleProcessClick(record)}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </ModernButton>
                    )}
                    {canEdit(record) && (
                      <ModernButton
                        variant="edit"
                        size="sm"
                        onClick={() => {
                          if (record.gate_status === 'IN') {
                            handleEditPreIn(record);
                          } else {
                            handleEditPreOut(record);
                          }
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </ModernButton>
                    )}
                    {canDelete(record) && (
                      <ModernButton
                        variant="delete"
                        size="sm"
                        onClick={() => {
                          setRecordToDelete(record);
                          setConfirmDeleteRecord(true);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </ModernButton>
                    )}
                  </div>
                ),
              },
            ]}
            data={paginatedOutRecords}
            loading={loading}
            emptyMessage="No OUT records found."
            pagination={{
              currentPage: currentPageOut,
              totalPages: totalPagesOut,
              perPage: itemsPerPageOut,
              total: filteredOutRecords.length,
              onPageChange: setCurrentPageOut,
              onPerPageChange: (per: number) => { setItemsPerPageOut(per); setCurrentPageOut(1); },
              rowsOptions: [15, 20, 50, 100],
            }}
          />
        </div>
      </div>

      {/* Add Pre In Modal */}
      {/* Filters Modal */}
      <Dialog open={showFiltersModal} onOpenChange={setShowFiltersModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
              Filters
            </DialogTitle>
            <DialogDescription>Filter records by client and status</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4">
            <div>
              <Label className="text-gray-900">Client</Label>
              <div className="mt-2">
                <Select value={tempSelectedClient} onValueChange={(val) => setTempSelectedClient(val)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.c_id} value={client.c_id.toString()}>
                        {client.client_code} - {client.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status filter removed */}
          </div>
          <DialogFooter className="gap-2">
            <ModernButton
              type="button"
              variant="toggle"
              onClick={() => {
                setTempSelectedClient('all');
              }}
            >
              Reset
            </ModernButton>
            <ModernButton
              type="button"
              variant="add"
              onClick={() => {
                setSelectedClient(tempSelectedClient);
                setShowFiltersModal(false);
              }}
            >
              Apply Filters
            </ModernButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showAddPreInModal} onOpenChange={setShowAddPreInModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
              Add Pre In
            </DialogTitle>
            <DialogDescription>Register a new container for gate-in approval</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAddPreIn}>
            <div className="grid gap-4 py-4">
              <div>
                <Label className="text-gray-900">
                  Client <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={preInForm.client_id}
                  onValueChange={(value) =>
                    setPreInForm({ ...preInForm, client_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.c_id} value={client.hashed_c_id}>
                        {client.client_code} - {client.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-900">
                  Container No. <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={preInForm.container_no}
                  onChange={(e) =>
                    setPreInForm({ ...preInForm, container_no: e.target.value.toUpperCase() })
                  }
                  placeholder="ABCD1234567"
                  maxLength={11}
                />
                <p className="text-xs text-gray-500 mt-1">Must be exactly 11 characters</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton
                type="button"
                variant="toggle"
                onClick={() => setShowAddPreInModal(false)}
              >
                Cancel
              </ModernButton>
              <ModernButton type="submit" variant="add">
                <Plus className="w-4 h-4" />
                Add Pre In
              </ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Pre Out Modal */}
      <Dialog open={showAddPreOutModal} onOpenChange={setShowAddPreOutModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
              Add Pre Out
            </DialogTitle>
            <DialogDescription>
              Register a new truck for gate-out approval
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAddPreOut}>
            <div className="grid gap-4 py-4">
              <div>
                <Label className="text-gray-900">
                  Plate No. <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={preOutForm.plate_no}
                  onChange={(e) =>
                    setPreOutForm({ ...preOutForm, plate_no: e.target.value })
                  }
                  placeholder="ABC-1234"
                />
                <p className="text-xs text-gray-500 mt-1">Truck plate number</p>
              </div>
              <div>
                <Label className="text-gray-900">
                  Hauler <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={preOutForm.hauler}
                  onChange={(e) =>
                    setPreOutForm({ ...preOutForm, hauler: e.target.value })
                  }
                  placeholder="Hauler/Trucking company name"
                />
                <p className="text-xs text-gray-500 mt-1">Trucking company or hauler name</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton
                type="button"
                variant="toggle"
                onClick={() => setShowAddPreOutModal(false)}
              >
                Cancel
              </ModernButton>
              <ModernButton type="submit" variant="delete">
                <Plus className="w-4 h-4" />
                Add Pre Out
              </ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Pre In Modal */}
      <Dialog open={showEditPreInModal} onOpenChange={setShowEditPreInModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
              Edit Pre In
            </DialogTitle>
            <DialogDescription>Update Pre-IN record details</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitUpdatePreIn}>
            <div className="grid gap-4 py-4">
              <div>
                <Label className="text-gray-900">
                  Client <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={editPreInForm.client_id}
                  onValueChange={(value) =>
                    setEditPreInForm({ ...editPreInForm, client_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.c_id} value={client.c_id.toString()}>
                        {client.client_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-900">
                  Container No. <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={editPreInForm.container_no}
                  onChange={(e) =>
                    setEditPreInForm({
                      ...editPreInForm,
                      container_no: e.target.value.toUpperCase(),
                    })
                  }
                  maxLength={11}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton
                type="button"
                variant="toggle"
                onClick={() => setShowEditPreInModal(false)}
              >
                Cancel
              </ModernButton>
              <ModernButton type="submit" variant="edit">
                <Pencil className="w-4 h-4" />
                Update Pre In
              </ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Pre Out Modal */}
      <Dialog open={showEditPreOutModal} onOpenChange={setShowEditPreOutModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
              Edit Pre Out
            </DialogTitle>
            <DialogDescription>Update Pre-OUT record details</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitUpdatePreOut}>
            <div className="grid gap-4 py-4">
              <div>
                <Label className="text-gray-900">Plate No.</Label>
                <Input
                  value={editPreOutForm.plate_no}
                  onChange={(e) =>
                    setEditPreOutForm({ ...editPreOutForm, plate_no: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-gray-900">Hauler</Label>
                <Input
                  value={editPreOutForm.hauler}
                  onChange={(e) =>
                    setEditPreOutForm({ ...editPreOutForm, hauler: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton
                type="button"
                variant="toggle"
                onClick={() => setShowEditPreOutModal(false)}
              >
                Cancel
              </ModernButton>
              <ModernButton type="submit" variant="edit">
                <Pencil className="w-4 h-4" />
                Update Pre Out
              </ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Process Gate IN Modal */}
      <ProcessGateInModal
        open={showProcessGateInModal}
        onClose={() => setShowProcessGateInModal(false)}
        record={selectedProcessRecord}
        statusOptions={statusOptions}
        sizeTypeOptions={sizeTypeOptions}
        loadOptions={loadOptions}
        onSuccess={() => {
          success('Gate IN processed successfully');
          fetchData();
        }}
        showError={error}
      />

      {/* Process Gate OUT Modal */}
      <ProcessGateOutModal
        open={showProcessGateOutModal}
        onClose={() => setShowProcessGateOutModal(false)}
        record={selectedProcessRecord}
        statusOptions={statusOptions}
        sizeTypeOptions={sizeTypeOptions}
        loadOptions={loadOptions}
        onSuccess={() => {
          success('Gate OUT processed successfully');
          fetchData();
        }}
        showError={error}
      />

      {/* Confirmation Modals */}
      <ModernConfirmDialog
        open={confirmUpdatePreIn}
        onOpenChange={setConfirmUpdatePreIn}
        onConfirm={handleUpdatePreIn}
        title="Update Pre In"
        description="Are you sure you want to update this Pre-In record?"
        confirmText="Update Pre In"
        type="warning"
      />

      <ModernConfirmDialog
        open={confirmUpdatePreOut}
        onOpenChange={setConfirmUpdatePreOut}
        onConfirm={handleUpdatePreOut}
        title="Update Pre Out"
        description="Are you sure you want to update this Pre-Out record?"
        confirmText="Update Pre Out"
        type="warning"
      />

      <ModernConfirmDialog
        open={confirmDeleteRecord}
        onOpenChange={setConfirmDeleteRecord}
        onConfirm={handleDeleteRecord}
        title="Delete Record"
        description={`Are you sure you want to delete record for container ${recordToDelete?.container_no}? This action cannot be undone.`}
        confirmText="Delete Record"
        type="danger"
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </AuthenticatedLayout>
  );
}

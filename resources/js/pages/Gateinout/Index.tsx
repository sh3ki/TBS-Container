import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { ModernButton, ModernCard, ModernTable, ModernBadge, ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, CheckCircle, TruckIcon as GateIcon } from 'lucide-react';
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
  const [filteredRecords, setFilteredRecords] = useState<PreInventoryRecord[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gateStatusFilter, setGateStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [showAddPreInModal, setShowAddPreInModal] = useState(false);
  const [showAddPreOutModal, setShowAddPreOutModal] = useState(false);
  const [showEditPreInModal, setShowEditPreInModal] = useState(false);
  const [showEditPreOutModal, setShowEditPreOutModal] = useState(false);
  const [showProcessGateInModal, setShowProcessGateInModal] = useState(false);
  const [showProcessGateOutModal, setShowProcessGateOutModal] = useState(false);

  const [confirmAddPreIn, setConfirmAddPreIn] = useState(false);
  const [confirmAddPreOut, setConfirmAddPreOut] = useState(false);
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

  const [pageAccess, setPageAccess] = useState({
    module_edit: false,
    module_delete: false,
  });

  // Dropdown options for Process modals
  const [statusOptions, setStatusOptions] = useState<Array<{ s_id: number; status: string }>>([]);
  const [sizeTypeOptions, setSizeTypeOptions] = useState<Array<{ s_id: number; size: string; type: string }>>([]);
  const [loadOptions, setLoadOptions] = useState<Array<{ l_id: number; type: string }>>([]);
  const [selectedProcessRecord, setSelectedProcessRecord] = useState<PreInventoryRecord | null>(null);

  useEffect(() => {
    fetchData();
    fetchDropdownOptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preInventoryList, searchTerm, statusFilter, gateStatusFilter]);

  useEffect(() => {
    fetchDropdownOptions();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const startTime = performance.now();
    try {
      // Fetch all data in parallel for better performance - OPTIMIZED LIKE CLIENTS PAGE
      const [recordsRes, clientsRes, accessRes] = await Promise.all([
        axios.post('/api/gateinout/list', { search: '' }),
        axios.get('/api/gateinout/clients'),
        axios.get('/api/gateinout/page-record-access'),
      ]);

      if (recordsRes.data.success) {
        setPreInventoryList(recordsRes.data.prelist || []);
        
        // Log performance metrics
        if (recordsRes.data.performance) {
          console.log('🚀 Gate In/Out Performance:', {
            'API Query Time': `${recordsRes.data.performance.query_time_ms}ms`,
            'API Total Time': `${recordsRes.data.performance.total_time_ms}ms`,
            'Records Fetched': recordsRes.data.performance.records_count,
            'Total Frontend Time': `${Math.round(performance.now() - startTime)}ms`
          });
        }
      }

      if (clientsRes.data.success) {
        setClients(clientsRes.data.data || []);
      }

      if (accessRes.data.success) {
        setPageAccess({
          module_edit: accessRes.data.module_edit || false,
          module_delete: accessRes.data.module_delete || false,
        });
      }
    } catch {
      error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

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

    if (statusFilter !== 'all') {
      filtered = filtered.filter((record) => record.status.toLowerCase() === statusFilter);
    }

    if (gateStatusFilter !== 'all') {
      filtered = filtered.filter((record) => record.gate_status === gateStatusFilter);
    }

    setFilteredRecords(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const refreshData = async () => {
    try {
      const response = await axios.post('/api/gateinout/list', { search: '' });
      if (response.data.success) {
        setPreInventoryList(response.data.prelist || []);
      }
    } catch {
      error('Failed to refresh list');
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
    setConfirmAddPreIn(true);
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
          setConfirmAddPreIn(false);
          setPreInForm({ container_no: '', client_id: '' });
          refreshData();
        } else {
          setConfirmAddPreIn(false);
          error(msg.replace(/<[^>]*>/g, ''));
        }
      }
    } catch (err: unknown) {
      setConfirmAddPreIn(false);
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
    setConfirmAddPreOut(true);
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
          setConfirmAddPreOut(false);
          setPreOutForm({ plate_no: '', hauler: '' });
          refreshData();
        } else {
          setConfirmAddPreOut(false);
          error(msg.replace(/<[^>]*>/g, ''));
        }
      }
    } catch (err: unknown) {
      setConfirmAddPreOut(false);
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to add Pre-Out');
    }
  };

  const handleEditPreIn = async (record: PreInventoryRecord) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/gateinout/get-prein-details', {
        id: record.hashed_id,
      });

      if (response.data.success) {
        const data = response.data.data;
        setEditPreInForm({
          id: record.hashed_id,
          container_no: data.container_no,
          client_id: data.client_id.toString(),
          plate_no: data.plate_no || '',
          hauler: data.hauler || '',
        });
        setShowEditPreInModal(true);
      }
    } catch {
      error('Failed to load Pre-In details');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPreOut = async (record: PreInventoryRecord) => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const submitUpdatePreIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmUpdatePreIn(true);
  };

  const handleUpdatePreIn = async () => {
    try {
      const response = await axios.post('/api/gateinout/update-prein', editPreInForm);
      if (response.data.success) {
        success('Pre-In updated successfully');
        setShowEditPreInModal(false);
        setConfirmUpdatePreIn(false);
        refreshData();
      }
    } catch (err: unknown) {
      setConfirmUpdatePreIn(false);
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to update Pre-In');
    }
  };

  const submitUpdatePreOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmUpdatePreOut(true);
  };

  const handleUpdatePreOut = async () => {
    try {
      const response = await axios.post('/api/gateinout/update-preout', editPreOutForm);
      if (response.data.success) {
        success('Pre-Out updated successfully');
        setShowEditPreOutModal(false);
        setConfirmUpdatePreOut(false);
        refreshData();
      }
    } catch (err: unknown) {
      setConfirmUpdatePreOut(false);
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to update Pre-Out');
    }
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;

    try {
      const response = await axios.post('/api/gateinout/delete-pre', {
        id: recordToDelete.hashed_id,
      });
      if (response.data.success) {
        success('Record deleted successfully');
        setRecordToDelete(null);
        setConfirmDeleteRecord(false);
        refreshData();
      }
    } catch (err: unknown) {
      setConfirmDeleteRecord(false);
      const e = err as { response?: { data?: { message?: string } } };
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

  // Pagination
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredRecords.length / pageSize);

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
              <div className="md:col-span-2">
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
              <div>
                <Label className="text-sm font-semibold mb-2 text-gray-900">
                  Status Filter
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 text-gray-900">
                  Gate Status Filter
                </Label>
                <Select value={gateStatusFilter} onValueChange={setGateStatusFilter}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="IN">IN</SelectItem>
                    <SelectItem value="OUT">OUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{filteredRecords.length}</span>{' '}
                records found
                {searchTerm || statusFilter !== 'all' || gateStatusFilter !== 'all' ? (
                  <span> (filtered from {preInventoryList.length} total)</span>
                ) : null}
              </p>
            </div>
          </ModernCard>
        </div>

        {/* MODERN TABLE - EXACTLY LIKE CLIENTS PAGE */}
        <div className="w-full">
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
                    {record.runtime} min
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
            data={paginatedRecords}
            loading={loading}
            emptyMessage="No records found. Click 'Add Pre In' or 'Add Pre Out' to get started."
            pagination={{
              currentPage,
              totalPages,
              perPage: pageSize,
              total: filteredRecords.length,
              onPageChange: setCurrentPage,
            }}
          />
        </div>
      </div>

      {/* Add Pre In Modal */}
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
              <div>
                <Label className="text-gray-900">Plate No.</Label>
                <Input
                  value={editPreInForm.plate_no}
                  onChange={(e) =>
                    setEditPreInForm({ ...editPreInForm, plate_no: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-gray-900">Hauler</Label>
                <Input
                  value={editPreInForm.hauler}
                  onChange={(e) =>
                    setEditPreInForm({ ...editPreInForm, hauler: e.target.value })
                  }
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
                <Label className="text-gray-900">Container No.</Label>
                <Input
                  value={editPreOutForm.container_no}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Container No. cannot be changed for Pre-OUT
                </p>
              </div>
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
          refreshData();
        }}
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
          refreshData();
        }}
      />

      {/* Confirmation Modals */}
      <ModernConfirmDialog
        open={confirmAddPreIn}
        onOpenChange={setConfirmAddPreIn}
        onConfirm={handleAddPreIn}
        title="Add Pre In"
        description="Are you sure you want to add this Pre-In record?"
        confirmText="Add Pre In"
        type="success"
      />

      <ModernConfirmDialog
        open={confirmAddPreOut}
        onOpenChange={setConfirmAddPreOut}
        onConfirm={handleAddPreOut}
        title="Add Pre Out"
        description="Are you sure you want to add this Pre-Out record?"
        confirmText="Add Pre Out"
        type="danger"
      />

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

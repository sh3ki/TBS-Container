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

interface PreInventoryRecord extends Record<string, unknown> {
  hashed_id: string;
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

interface ProcessGateInFormData {
  procid: string;
  cno: string;
  cid: string;
  dmanu: string;
  client: string;
  status: string;
  sizetype: string;
  iso: string;
  class: string;
  vessel: string;
  voyage: string;
  checker: string;
  excon: string;
  load: string;
  plateno: string;
  hauler: string;
  haulerd: string;
  license: string;
  location: string;
  chasis: string;
  contact: string;
  bol: string;
  remarks: string;
}

interface ProcessGateOutFormData {
  procid: string;
  cno: string;
  checker: string;
  contact: string;
  client: string;
  hauler: string;
  plateno: string;
  gatein_remarks: string;
  approval_notes: string;
  remarks: string;
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
  const [confirmProcessGateIn, setConfirmProcessGateIn] = useState(false);
  const [confirmProcessGateOut, setConfirmProcessGateOut] = useState(false);
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

  const [processGateInForm, setProcessGateInForm] = useState<ProcessGateInFormData>({
    procid: '',
    cno: '',
    cid: '',
    dmanu: '',
    client: '',
    status: '',
    sizetype: '',
    iso: '',
    class: 'A',
    vessel: '',
    voyage: '',
    checker: '',
    excon: '',
    load: '',
    plateno: '',
    hauler: '',
    haulerd: '',
    license: '',
    location: '',
    chasis: '',
    contact: '',
    bol: '',
    remarks: '',
  });

  const [processGateOutForm, setProcessGateOutForm] = useState<ProcessGateOutFormData>({
    procid: '',
    cno: '',
    checker: '',
    contact: '',
    client: '',
    hauler: '',
    plateno: '',
    gatein_remarks: '',
    approval_notes: '',
    remarks: '',
  });

  const [pageAccess, setPageAccess] = useState({
    module_edit: false,
    module_delete: false,
  });

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preInventoryList, searchTerm, statusFilter, gateStatusFilter]);

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
    if (record.gate_status === 'IN') {
      setProcessGateInForm({
        procid: record.hashed_id,
        cno: record.container_no,
        cid: record.client_code,
        dmanu: '',
        client: record.client_name,
        status: '',
        sizetype: '',
        iso: '',
        class: 'A',
        vessel: '',
        voyage: '',
        checker: '',
        excon: '',
        load: '',
        plateno: record.plate_no,
        hauler: record.hauler,
        haulerd: '',
        license: '',
        location: '',
        chasis: '',
        contact: '',
        bol: '',
        remarks: '',
      });
      setShowProcessGateInModal(true);
    } else {
      setProcessGateOutForm({
        procid: record.hashed_id,
        cno: record.container_no,
        checker: '',
        contact: '',
        client: record.client_name,
        hauler: record.hauler,
        plateno: record.plate_no,
        gatein_remarks: '',
        approval_notes: '',
        remarks: '',
      });
      setShowProcessGateOutModal(true);
    }
  };

  const submitProcessGateIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmProcessGateIn(true);
  };

  const handleProcessGateIn = async () => {
    try {
      const response = await axios.post('/api/gateinout/gate-in', processGateInForm);
      if (response.data.success) {
        success('Container successfully gated IN');
        setShowProcessGateInModal(false);
        setConfirmProcessGateIn(false);
        refreshData();
      }
    } catch (err: unknown) {
      setConfirmProcessGateIn(false);
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to process Gate IN');
    }
  };

  const submitProcessGateOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmProcessGateOut(true);
  };

  const handleProcessGateOut = async () => {
    try {
      const response = await axios.post('/api/gateinout/gate-out', processGateOutForm);
      if (response.data.success) {
        success('Container successfully gated OUT');
        setShowProcessGateOutModal(false);
        setConfirmProcessGateOut(false);
        refreshData();
      }
    } catch (err: unknown) {
      setConfirmProcessGateOut(false);
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to process Gate OUT');
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
                  <div className="font-mono font-semibold text-gray-900 min-w-[100px]">
                    {record.container_no}
                  </div>
                ),
              },
              {
                key: 'client',
                label: 'Client Name',
                render: (record: PreInventoryRecord) => (
                  <div className="min-w-[120px]">
                    <div className="font-medium text-gray-900">{record.client_name}</div>
                    <div className="text-xs text-gray-500">{record.client_code}</div>
                  </div>
                ),
              },
              {
                key: 'plate_no',
                label: 'Plate No',
                render: (record: PreInventoryRecord) => (
                  <div className="text-sm text-gray-600 min-w-[80px]">
                    {record.plate_no || '-'}
                  </div>
                ),
              },
              {
                key: 'hauler',
                label: 'Hauler',
                render: (record: PreInventoryRecord) => (
                  <div className="text-sm text-gray-600 min-w-[100px]">
                    {record.hauler || '-'}
                  </div>
                ),
              },
              {
                key: 'gate_status',
                label: 'Gate Status',
                render: (record: PreInventoryRecord) => (
                  <div className="min-w-[70px]">
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
                  <div className="min-w-[80px]">
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
                  <div className="text-sm text-gray-600 min-w-[100px]">
                    {formatDateTime(record.date_added)}
                  </div>
                ),
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (record: PreInventoryRecord) => (
                  <div className="flex items-center justify-end gap-2">
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
      <Dialog open={showProcessGateInModal} onOpenChange={setShowProcessGateInModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
              Process Gate IN
            </DialogTitle>
            <DialogDescription>
              Complete all required fields to process gate-in for {processGateInForm.cno}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitProcessGateIn}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-gray-900">Container No.</Label>
                  <Input value={processGateInForm.cno} disabled className="bg-gray-100" />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Date Manufactured <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="month"
                    value={processGateInForm.dmanu}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, dmanu: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">Client</Label>
                  <Input
                    value={processGateInForm.client}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label className="text-gray-900">Status</Label>
                  <Select
                    value={processGateInForm.status}
                    onValueChange={(value) =>
                      setProcessGateInForm({ ...processGateInForm, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPTY">EMPTY</SelectItem>
                      <SelectItem value="FULL">FULL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-900">Size/Type</Label>
                  <Select
                    value={processGateInForm.sizetype}
                    onValueChange={(value) =>
                      setProcessGateInForm({ ...processGateInForm, sizetype: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size/type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20GP">20 GP</SelectItem>
                      <SelectItem value="20HC">20 HC</SelectItem>
                      <SelectItem value="40GP">40 GP</SelectItem>
                      <SelectItem value="40HC">40 HC</SelectItem>
                      <SelectItem value="40RF">40 RF</SelectItem>
                      <SelectItem value="45HC">45 HC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-900">
                    ISO Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.iso}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, iso: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Class <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={processGateInForm.class}
                    onValueChange={(value) =>
                      setProcessGateInForm({ ...processGateInForm, class: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="C">C</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-900">
                    Vessel <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.vessel}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, vessel: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Voyage <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.voyage}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, voyage: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Checker <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.checker}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, checker: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-gray-900">
                    Ex-Consignee <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.excon}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, excon: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">Load</Label>
                  <Select
                    value={processGateInForm.load}
                    onValueChange={(value) =>
                      setProcessGateInForm({ ...processGateInForm, load: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select load" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LADEN">LADEN</SelectItem>
                      <SelectItem value="EMPTY">EMPTY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-900">
                    Plate No. <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.plateno}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, plateno: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Hauler <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.hauler}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, hauler: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Hauler Driver <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.haulerd}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, haulerd: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    License No. <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.license}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, license: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Location <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.location}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, location: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Chasis <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.chasis}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, chasis: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Contact No. <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.contact}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, contact: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Bill of Lading <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateInForm.bol}
                    onChange={(e) =>
                      setProcessGateInForm({ ...processGateInForm, bol: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Label className="text-gray-900">
                Remarks <span className="text-red-500">*</span>
              </Label>
              <textarea
                className="w-full border rounded-md p-2 min-h-[80px]"
                value={processGateInForm.remarks}
                onChange={(e) =>
                  setProcessGateInForm({ ...processGateInForm, remarks: e.target.value })
                }
                required
              />
            </div>

            <DialogFooter className="mt-6 gap-2">
              <ModernButton
                type="button"
                variant="toggle"
                onClick={() => setShowProcessGateInModal(false)}
              >
                Cancel
              </ModernButton>
              <ModernButton type="submit" variant="add">
                <CheckCircle className="w-4 h-4" />
                Process & Save
              </ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Process Gate OUT Modal */}
      <Dialog open={showProcessGateOutModal} onOpenChange={setShowProcessGateOutModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
              Process Gate OUT
            </DialogTitle>
            <DialogDescription>
              Complete all required fields to process gate-out for {processGateOutForm.cno}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitProcessGateOut}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-gray-900">Container No.</Label>
                  <Input
                    value={processGateOutForm.cno}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label className="text-gray-900">Client</Label>
                  <Input
                    value={processGateOutForm.client}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label className="text-gray-900">Hauler</Label>
                  <Input
                    value={processGateOutForm.hauler}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div>
                  <Label className="text-gray-900">Plate No.</Label>
                  <Input
                    value={processGateOutForm.plateno}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Checker <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateOutForm.checker}
                    onChange={(e) =>
                      setProcessGateOutForm({ ...processGateOutForm, checker: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-gray-900">
                    Contact No. <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={processGateOutForm.contact}
                    onChange={(e) =>
                      setProcessGateOutForm({ ...processGateOutForm, contact: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-gray-900">Gate In Remarks</Label>
                  <div className="border rounded-md p-2 bg-gray-50 min-h-[60px]">
                    {processGateOutForm.gatein_remarks || 'No remarks'}
                  </div>
                </div>
                <div>
                  <Label className="text-gray-900">Approval Notes</Label>
                  <div className="border rounded-md p-2 bg-gray-50 min-h-[60px]">
                    {processGateOutForm.approval_notes || 'No notes'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Label className="text-gray-900">Remarks</Label>
              <textarea
                className="w-full border rounded-md p-2 min-h-[80px] bg-gray-100"
                value={processGateOutForm.remarks}
                disabled
              />
            </div>

            <DialogFooter className="mt-6 gap-2">
              <ModernButton
                type="button"
                variant="toggle"
                onClick={() => setShowProcessGateOutModal(false)}
              >
                Cancel
              </ModernButton>
              <ModernButton type="submit" variant="add">
                <CheckCircle className="w-4 h-4" />
                Process & Save
              </ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

      <ModernConfirmDialog
        open={confirmProcessGateIn}
        onOpenChange={setConfirmProcessGateIn}
        onConfirm={handleProcessGateIn}
        title="Process Gate IN"
        description="Are you sure you want to process this Gate IN? This will create a permanent record."
        confirmText="Process Gate IN"
        type="success"
      />

      <ModernConfirmDialog
        open={confirmProcessGateOut}
        onOpenChange={setConfirmProcessGateOut}
        onConfirm={handleProcessGateOut}
        title="Process Gate OUT"
        description="Are you sure you want to process this Gate OUT? This will create a permanent record."
        confirmText="Process Gate OUT"
        type="success"
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </AuthenticatedLayout>
  );
}

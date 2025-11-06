import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { ModernButton, ModernCard, ModernTable, ModernBadge, ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Users as ClientsIcon, Pencil, Trash2, Eye, Power, User, Phone, Printer, Mail } from 'lucide-react';
import { colors } from '@/lib/colors';

interface Client extends Record<string, unknown> {
  c_id: number;
  client_name: string;
  client_code: string;
  client_address: string;
  client_email: string;
  contact_person: string;
  phone_number: string;
  fax_number: string;
  date_added: string;
  archived: number;
  status: string;
}

interface FormData {
  client_name: string;
  client_code: string;
  client_address: string;
  client_email: string;
  contact_person: string;
  phone_number: string;
  fax_number: string;
}

export default function Index() {
  const { toasts, removeToast, success, error } = useModernToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  
  const [confirmAddClient, setConfirmAddClient] = useState(false);
  const [confirmUpdateClient, setConfirmUpdateClient] = useState(false);
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false);
  const [confirmToggleStatus, setConfirmToggleStatus] = useState(false);
  const [clientToToggle, setClientToToggle] = useState<Client | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    client_name: '',
    client_code: '',
    client_address: '',
    client_email: '',
    contact_person: '',
    phone_number: '',
    fax_number: '',
  });
  
  const [editFormData, setEditFormData] = useState<FormData & { c_id: number }>({
    c_id: 0,
    client_name: '',
    client_code: '',
    client_address: '',
    client_email: '',
    contact_person: '',
    phone_number: '',
    fax_number: '',
  });
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, searchTerm, statusFilter]);

  const applyFilters = () => {
    let filtered = [...clients];
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(client => 
        client.client_name.toLowerCase().includes(search) ||
        client.client_code.toLowerCase().includes(search) ||
        client.contact_person.toLowerCase().includes(search) ||
        (client.client_email && client.client_email.toLowerCase().includes(search))
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(client => {
        if (statusFilter === 'active') return client.archived === 0;
        if (statusFilter === 'inactive') return client.archived === 1;
        return true;
      });
    }
    
    setFilteredClients(filtered);
    setTotal(filtered.length);
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/clients', {
        params: { 
          search: '',
          per_page: 1000
        }
      });
      if (response.data.success) {
        setClients(response.data.clients);
        setTotal(response.data.clients.length);
      }
    } catch {
      error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const submitAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setConfirmAddClient(true);
  };

  const handleAddClient = async () => {
    try {
      const response = await axios.post('/api/clients', formData);
      if (response.data.success) {
        success('Client created successfully');
        setShowAddModal(false);
        setConfirmAddClient(false);
        setFormData({
          client_name: '',
          client_code: '',
          client_address: '',
          client_email: '',
          contact_person: '',
          phone_number: '',
          fax_number: '',
        });
        setErrors({});
        fetchClients();
      }
    } catch (err: unknown) {
      setConfirmAddClient(false);
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (e.response?.data?.errors) {
        setErrors(e.response.data.errors);
        error('Please check the form for errors');
      } else {
        error(e.response?.data?.message || 'Failed to create client');
      }
    }
  };

  const handleEditClient = async (client: Client) => {
    setEditFormData({
      c_id: client.c_id,
      client_name: client.client_name,
      client_code: client.client_code,
      client_address: client.client_address || '',
      client_email: client.client_email || '',
      contact_person: client.contact_person,
      phone_number: client.phone_number || '',
      fax_number: client.fax_number || '',
    });
    setShowEditModal(true);
  };

  const submitUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setConfirmUpdateClient(true);
  };

  const handleUpdateClient = async () => {
    try {
      const response = await axios.put(`/api/clients/${editFormData.c_id}`, editFormData);
      if (response.data.success) {
        success('Client updated successfully');
        setShowEditModal(false);
        setConfirmUpdateClient(false);
        setErrors({});
        fetchClients();
      }
    } catch (err: unknown) {
      setConfirmUpdateClient(false);
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (e.response?.data?.errors) {
        setErrors(e.response.data.errors);
        error('Please check the form for errors');
      } else {
        error(e.response?.data?.message || 'Failed to update client');
      }
    }
  };

  const handleViewClient = (client: Client) => {
    setSelectedClient(client);
    setShowViewModal(true);
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    
    try {
      const response = await axios.delete(`/api/clients/${clientToDelete.c_id}`);
      if (response.data.success) {
        success('Client deleted successfully');
        setClientToDelete(null);
        setConfirmDeleteClient(false);
        fetchClients();
      }
    } catch (err: unknown) {
      setConfirmDeleteClient(false);
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to delete client');
    }
  };

  const handleToggleStatus = async () => {
    if (!clientToToggle) return;
    
    try {
      const response = await axios.post(`/api/clients/${clientToToggle.c_id}/toggle-status`);
      if (response.data.success) {
        const newStatus = response.data.new_status;
        success(`Client ${newStatus.toLowerCase()}`);
        setClientToToggle(null);
        setConfirmToggleStatus(false);
        fetchClients();
      }
    } catch {
      setConfirmToggleStatus(false);
      error('Failed to toggle client status');
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Pagination
  const paginatedClients = filteredClients.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredClients.length / pageSize);

  return (
    <AuthenticatedLayout>
      <Head title="Clients Management" />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
              <ClientsIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Clients Management</h1>
              <p className="text-sm mt-1 text-gray-600">Manage your client database and contacts</p>
            </div>
          </div>
          <ModernButton variant="add" size="lg" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Add New Client
          </ModernButton>
        </div>

        <div className="relative" style={{ zIndex: 0 }}>
          <ModernCard title="Search & Filter Clients" subtitle="Find clients quickly" icon={<Search className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label className="text-sm font-semibold mb-2 text-gray-900">Search Clients</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    type="text"
                    placeholder="Search by client name, code, contact person, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-2 text-gray-900">Status Filter</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{filteredClients.length}</span> clients found
                {searchTerm || statusFilter !== 'all' ? (
                  <span> (filtered from {clients.length} total)</span>
                ) : null}
              </p>
            </div>
          </ModernCard>
        </div>

        <div className="w-full">
          <ModernTable
            columns={[
              {
                key: 'client_name',
                label: 'Client Name',
                render: (client: Client) => (
                  <div className="font-semibold text-gray-900 min-w-[100px] max-w-[120px] " title={client.client_name}>{client.client_name}</div>
                ),
              },
              {
                key: 'client_code',
                label: 'Code',
                render: (client: Client) => (
                  <div className="text-sm text-gray-600 min-w-[60px] max-w-[60px] ">{client.client_code}</div>
                ),
              },
              {
                key: 'client_address',
                label: 'Address',
                render: (client: Client) => (
                  <div className="text-sm text-gray-600 min-w-[120px] max-w-[160px] " title={client.client_address || '-'}>{client.client_address || '-'}</div>
                ),
              },
              {
                key: 'contact_details',
                label: 'Contact Details',
                render: (client: Client) => (
                  <div className="space-y-1 min-w-[120px] max-w-[180px]">
                    <div className="flex items-center gap-2 text-sm text-gray-900">
                      <User className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      <span className="truncate" title={client.contact_person}>{client.contact_person}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate" title={client.client_email || '-'}>{client.client_email || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate" title={client.phone_number || '-'}>{client.phone_number || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Printer className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate" title={client.fax_number || '-'}>{client.fax_number || '-'}</span>
                    </div>
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (client: Client) => (
                  <div className="min-w-[70px]">
                    <ModernBadge variant={client.archived === 0 ? 'success' : 'error'}>
                      {client.archived === 0 ? 'Active' : 'Inactive'}
                    </ModernBadge>
                  </div>
                ),
              },
              {
                key: 'date_added',
                label: 'Date Created',
                render: (client: Client) => (
                  <div className="text-sm text-gray-600 min-w-[90px]">{formatDateTime(client.date_added)}</div>
                ),
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (client: Client) => (
                  <div className="flex items-center justify-end gap-2">
                    <ModernButton variant="primary" size="sm" onClick={() => handleViewClient(client)}>
                      <Eye className="w-3.5 h-3.5" />
                    </ModernButton>
                    <ModernButton variant="edit" size="sm" onClick={() => handleEditClient(client)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </ModernButton>
                    <ModernButton variant="toggle" size="sm" onClick={() => {
                      setClientToToggle(client);
                      setConfirmToggleStatus(true);
                    }}>
                      <Power className="w-3.5 h-3.5" />
                    </ModernButton>
                    <ModernButton variant="delete" size="sm" onClick={() => {
                      setClientToDelete(client);
                      setConfirmDeleteClient(true);
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </ModernButton>
                  </div>
                ),
              },
            ]}
            data={paginatedClients}
            loading={loading}
            emptyMessage="No clients found. Click 'Add New Client' to get started."
            pagination={{
              currentPage,
              totalPages,
              perPage: pageSize,
              total: filteredClients.length,
              onPageChange: setCurrentPage,
            }}
          />
        </div>
      </div>

      {/* Add Client Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Add New Client</DialogTitle>
            <DialogDescription>Create a new client account</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAddClient}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Client Name <span className="text-red-500">*</span></Label>
                  <Input value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} className={errors.client_name ? 'border-red-500' : ''} />
                  {errors.client_name && <p className="text-red-500 text-xs mt-1">{errors.client_name[0]}</p>}
                </div>
                <div>
                  <Label className="text-gray-900">Code <span className="text-red-500">*</span></Label>
                  <Input value={formData.client_code} onChange={(e) => setFormData({ ...formData, client_code: e.target.value })} className={errors.client_code ? 'border-red-500' : ''} />
                  {errors.client_code && <p className="text-red-500 text-xs mt-1">{errors.client_code[0]}</p>}
                </div>
              </div>
              <div>
                <Label className="text-gray-900">Contact Person <span className="text-red-500">*</span></Label>
                <Input value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} className={errors.contact_person ? 'border-red-500' : ''} />
                {errors.contact_person && <p className="text-red-500 text-xs mt-1">{errors.contact_person[0]}</p>}
              </div>
              <div>
                <Label className="text-gray-900">Email</Label>
                <Input value={formData.client_email} onChange={(e) => setFormData({ ...formData, client_email: e.target.value })} className={errors.client_email ? 'border-red-500' : ''} />
                {errors.client_email && <p className="text-red-500 text-xs mt-1">{errors.client_email[0]}</p>}
              </div>
              <div>
                <Label className="text-gray-900">Address</Label>
                <Input value={formData.client_address} onChange={(e) => setFormData({ ...formData, client_address: e.target.value })} className={errors.client_address ? 'border-red-500' : ''} />
                {errors.client_address && <p className="text-red-500 text-xs mt-1">{errors.client_address[0]}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Phone Number</Label>
                  <Input value={formData.phone_number} onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} className={errors.phone_number ? 'border-red-500' : ''} />
                  {errors.phone_number && <p className="text-red-500 text-xs mt-1">{errors.phone_number[0]}</p>}
                </div>
                <div>
                  <Label className="text-gray-900">Fax Number</Label>
                  <Input value={formData.fax_number} onChange={(e) => setFormData({ ...formData, fax_number: e.target.value })} className={errors.fax_number ? 'border-red-500' : ''} />
                  {errors.fax_number && <p className="text-red-500 text-xs mt-1">{errors.fax_number[0]}</p>}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton type="button" variant="toggle" onClick={() => setShowAddModal(false)}>Cancel</ModernButton>
              <ModernButton type="submit" variant="add"><Plus className="w-4 h-4" />Add Client</ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Client Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Edit Client</DialogTitle>
            <DialogDescription>Update client information</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitUpdateClient}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Client Name <span className="text-red-500">*</span></Label>
                  <Input value={editFormData.client_name} onChange={(e) => setEditFormData({ ...editFormData, client_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-gray-900">Code <span className="text-red-500">*</span></Label>
                  <Input value={editFormData.client_code} onChange={(e) => setEditFormData({ ...editFormData, client_code: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-gray-900">Contact Person <span className="text-red-500">*</span></Label>
                <Input value={editFormData.contact_person} onChange={(e) => setEditFormData({ ...editFormData, contact_person: e.target.value })} />
              </div>
              <div>
                <Label className="text-gray-900">Email</Label>
                <Input value={editFormData.client_email} onChange={(e) => setEditFormData({ ...editFormData, client_email: e.target.value })} />
              </div>
              <div>
                <Label className="text-gray-900">Address</Label>
                <Input value={editFormData.client_address} onChange={(e) => setEditFormData({ ...editFormData, client_address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Phone Number</Label>
                  <Input value={editFormData.phone_number} onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })} />
                </div>
                <div>
                  <Label className="text-gray-900">Fax Number</Label>
                  <Input value={editFormData.fax_number} onChange={(e) => setEditFormData({ ...editFormData, fax_number: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton type="button" variant="toggle" onClick={() => setShowEditModal(false)}>Cancel</ModernButton>
              <ModernButton type="submit" variant="edit"><Pencil className="w-4 h-4" />Update Client</ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Client Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Client Details</DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: colors.brand.primary }}>
                  {selectedClient.client_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedClient.client_name}</h3>
                  <p className="text-sm text-gray-600">@{selectedClient.client_code}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    Contact Person
                  </Label>
                  <p className="mt-1 text-gray-900">{selectedClient.contact_person}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </Label>
                  <p className="mt-1 text-gray-900">{selectedClient.client_email || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    Phone Number
                  </Label>
                  <p className="mt-1 text-gray-900">{selectedClient.phone_number || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <Printer className="w-3.5 h-3.5" />
                    Fax Number
                  </Label>
                  <p className="mt-1 text-gray-900">{selectedClient.fax_number || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Address
                  </Label>
                  <p className="mt-1 text-gray-900">{selectedClient.client_address || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <Power className="w-3.5 h-3.5" />
                    Status
                  </Label>
                  <div className="mt-1">
                    <ModernBadge variant={selectedClient.archived === 0 ? 'success' : 'error'}>
                      {selectedClient.archived === 0 ? 'Active' : 'Inactive'}
                    </ModernBadge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Date Created
                  </Label>
                  <p className="mt-1 text-gray-900">{formatDateTime(selectedClient.date_added)}</p>
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
        open={confirmAddClient}
        onOpenChange={setConfirmAddClient}
        onConfirm={handleAddClient}
        title="Add New Client"
        description="Are you sure you want to add this client?"
        confirmText="Add Client"
        type="success"
      />
      
      <ModernConfirmDialog
        open={confirmUpdateClient}
        onOpenChange={setConfirmUpdateClient}
        onConfirm={handleUpdateClient}
        title="Update Client"
        description="Are you sure you want to update this client's information?"
        confirmText="Update Client"
        type="warning"
      />
      
      <ModernConfirmDialog
        open={confirmDeleteClient}
        onOpenChange={setConfirmDeleteClient}
        onConfirm={handleDeleteClient}
        title="Delete Client"
        description={`Are you sure you want to delete ${clientToDelete?.client_name}? This action cannot be undone.`}
        confirmText="Delete Client"
        type="danger"
      />
      
      <ModernConfirmDialog
        open={confirmToggleStatus}
        onOpenChange={setConfirmToggleStatus}
        type="warning"
        title={`${clientToToggle?.status === 'Active' ? 'Deactivate' : 'Activate'} Client?`}
        description={`Are you sure you want to ${clientToToggle?.status === 'Active' ? 'deactivate' : 'activate'} "${clientToToggle?.client_name}"?`}
        confirmText={`Yes, ${clientToToggle?.status === 'Active' ? 'Deactivate' : 'Activate'}`}
        onConfirm={handleToggleStatus}
      />
      
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </AuthenticatedLayout>
  );
}

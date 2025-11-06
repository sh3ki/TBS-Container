import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { ModernButton, ModernCard, ModernTable, ModernBadge } from '@/components/modern';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Users as UsersIcon, Pencil, Trash2, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
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

export default function Index({ auth }: Record<string, unknown>) {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('date_added');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<FormData>({
    client_name: '',
    client_code: '',
    client_address: '',
    client_email: '',
    contact_person: '',
    phone_number: '',
    fax_number: '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Check if user has delete permission
  const canDelete = auth.permissions?.find((p: any) => p.page === 'clients')?.acs_delete === 1;

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when search changes
    loadClients(1);
  }, [searchTerm]);

  useEffect(() => {
    loadClients(currentPage);
  }, [currentPage, sortBy, sortOrder]);

  const loadClients = async (page = currentPage) => {
    try {
      setLoading(true);
      const response = await axios.get('/api/clients', {
        params: { 
          search: searchTerm,
          page: page,
          sort_by: sortBy,
          sort_order: sortOrder,
          per_page: 15
        }
      });
      if (response.data.success) {
        setClients(response.data.clients);
        if (response.data.pagination) {
          setCurrentPage(response.data.pagination.current_page);
          setTotalPages(response.data.pagination.last_page);
          setTotal(response.data.pagination.total);
        }
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({
        title: "Error",
        description: "Failed to load clients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const openAddModal = () => {
    setEditingClient(null);
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
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      client_name: client.client_name,
      client_code: client.client_code,
      client_address: client.client_address || '',
      client_email: client.client_email || '',
      contact_person: client.contact_person,
      phone_number: client.phone_number || '',
      fax_number: client.fax_number || '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openDeleteModal = (client: Client) => {
    setDeletingClient(client);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      if (editingClient) {
        // Update existing client
        const response = await axios.put(`/api/clients/${editingClient.c_id}`, formData);
        if (response.data.success) {
          toast({
            title: "Success",
            description: "Client updated successfully",
          });
          setIsModalOpen(false);
          loadClients();
        }
      } else {
        // Create new client
        const response = await axios.post('/api/clients', formData);
        if (response.data.success) {
          toast({
            title: "Success",
            description: "Client created successfully",
          });
          setIsModalOpen(false);
          loadClients();
        }
      }
    } catch (error: any) {
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        toast({
          title: "Error",
          description: error.response?.data?.message || "Failed to save client",
          variant: "destructive",
        });
      }
    }
  };

  const handleDelete = async () => {
    if (!deletingClient) return;

    try {
      const response = await axios.delete(`/api/clients/${deletingClient.c_id}`);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Client deleted successfully",
        });
        setIsDeleteModalOpen(false);
        setDeletingClient(null);
        loadClients();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        title: "Error",
        description: err.response?.data?.message || "Failed to delete client",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <AuthenticatedLayout>
      <Head title="Clients" />

      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
              <UsersIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                Clients
              </h1>
              <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                Manage your client database and contacts
              </p>
            </div>
          </div>
          <ModernButton variant="add" size="lg" onClick={openAddModal}>
            <Plus className="w-4 h-4" />
            Add New Client
          </ModernButton>
        </div>

        {/* Search and Filters */}
        <ModernCard title="Search Clients" subtitle="Find clients quickly" icon={<Search className="w-5 h-5" />}>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                type="text"
                placeholder="Search by name, code, or contact person..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              {total} client{total !== 1 ? 's' : ''} total
            </div>
          </div>
        </ModernCard>

        {/* Clients Table */}
        <ModernCard title="All Clients" subtitle={`Showing ${clients.length} clients`}>
          <ModernTable
            columns={[
              {
                key: 'client_name',
                label: 'Client Name',
                sortable: true,
                render: (client: Client) => (
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: colors.brand.primary }}>
                      {client.client_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold" style={{ color: colors.text.primary }}>
                        {client.client_name}
                      </div>
                      <div className="text-xs" style={{ color: colors.text.secondary }}>
                        Code: {client.client_code}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'contact_person',
                label: 'Contact Person',
                sortable: true,
                render: (client: Client) => (
                  <div>
                    <div className="font-medium" style={{ color: colors.text.primary }}>
                      {client.contact_person}
                    </div>
                    {client.phone_number && (
                      <div className="flex items-center gap-1 text-xs mt-1" style={{ color: colors.text.secondary }}>
                        <Phone className="w-3 h-3" />
                        {client.phone_number}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'client_email',
                label: 'Email',
                render: (client: Client) => client.client_email ? (
                  <div className="flex items-center gap-1 text-sm" style={{ color: colors.text.secondary }}>
                    <Mail className="w-3.5 h-3.5" />
                    {client.client_email}
                  </div>
                ) : <span style={{ color: colors.text.secondary }}>-</span>,
              },
              {
                key: 'client_address',
                label: 'Address',
                render: (client: Client) => client.client_address ? (
                  <div className="flex items-start gap-1 text-sm max-w-xs" style={{ color: colors.text.secondary }}>
                    <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{client.client_address}</span>
                  </div>
                ) : <span style={{ color: colors.text.secondary }}>-</span>,
              },
              {
                key: 'date_added',
                label: 'Date Added',
                sortable: true,
                render: (client: Client) => (
                  <div className="flex items-center gap-1 text-sm" style={{ color: colors.text.secondary }}>
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(client.date_added)}
                  </div>
                ),
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (client: Client) => (
                  <div className="flex items-center justify-end gap-2">
                    <ModernButton
                      variant="edit"
                      size="sm"
                      onClick={() => router.visit(`/clients/${client.c_id}/edit`)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </ModernButton>
                    {canDelete && (
                      <ModernButton
                        variant="delete"
                        size="sm"
                        onClick={() => openDeleteModal(client)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </ModernButton>
                    )}
                  </div>
                ),
              },
            ]}
            data={clients}
            loading={loading}
            emptyMessage="No clients found. Click 'Add New Client' to get started."
            onSort={(column: string) => {
              if (sortBy === column) {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy(column);
                setSortOrder('asc');
              }
            }}
            sortColumn={sortBy}
            sortDirection={sortOrder}
            pagination={{
              currentPage,
              totalPages,
              total,
              perPage,
              onPageChange: setCurrentPage,
            }}
          />
        </ModernCard>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </DialogTitle>
            <DialogDescription>
              {editingClient ? 'Update client information below' : 'Fill in the client details to add them to your system'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6 py-4">
              {/* Client Name and Code */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="client_name" className="text-sm font-semibold">
                    Client Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className={`mt-1.5 ${errors.client_name ? 'border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="Enter client name"
                  />
                  {errors.client_name && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <span>⚠</span> {errors.client_name[0]}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="client_code" className="text-sm font-semibold">
                    Client Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="client_code"
                    value={formData.client_code}
                    onChange={(e) => setFormData({ ...formData, client_code: e.target.value })}
                    className={`mt-1.5 ${errors.client_code ? 'border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="e.g., CLI-001"
                  />
                  {errors.client_code && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <span>⚠</span> {errors.client_code[0]}
                    </p>
                  )}
                </div>
              </div>

              {/* Contact Person */}
              <div>
                <Label htmlFor="contact_person" className="text-sm font-semibold">
                  Contact Person <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  className={`mt-1.5 ${errors.contact_person ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="Primary contact name"
                />
                {errors.contact_person && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <span>⚠</span> {errors.contact_person[0]}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="client_email" className="text-sm font-semibold">
                  Email
                </Label>
                <Input
                  id="client_email"
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  className={`mt-1.5 ${errors.client_email ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="email@example.com"
                />
                {errors.client_email && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <span>⚠</span> {errors.client_email[0]}
                  </p>
                )}
              </div>

              {/* Address */}
              <div>
                <Label htmlFor="client_address" className="text-sm font-semibold">
                  Address
                </Label>
                <Input
                  id="client_address"
                  value={formData.client_address}
                  onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                  className="mt-1.5"
                  placeholder="Full address"
                />
              </div>

              {/* Phone and Fax */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone_number" className="text-sm font-semibold">
                    Phone Number
                  </Label>
                  <Input
                    id="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="mt-1.5"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="fax_number" className="text-sm font-semibold">
                    Fax Number
                  </Label>
                  <Input
                    id="fax_number"
                    value={formData.fax_number}
                    onChange={(e) => setFormData({ ...formData, fax_number: e.target.value })}
                    className="mt-1.5"
                    placeholder="+1 (555) 000-0001"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton type="button" variant="toggle" onClick={() => setIsModalOpen(false)}>
                Cancel
              </ModernButton>
              <ModernButton type="submit" variant={editingClient ? 'edit' : 'add'}>
                {editingClient ? 'Update Client' : 'Add Client'}
              </ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete Client
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Are you sure you want to delete <strong className="text-gray-900">{deletingClient?.client_name}</strong>?
              <br />
              <span className="text-red-600 font-semibold">This action cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <ModernButton variant="toggle" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </ModernButton>
            <ModernButton variant="delete" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
              Delete Client
            </ModernButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthenticatedLayout>
  );
}

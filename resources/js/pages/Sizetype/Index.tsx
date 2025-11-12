import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { ModernButton, ModernCard, ModernTable, ModernBadge, ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package, Edit, Trash2, Eye, Power } from 'lucide-react';
import { colors } from '@/lib/colors';

interface SizeType extends Record<string, unknown> {
  s_id: number;
  size: string;
  type: string;
  description: string;
  date_added: string;
  archived: number;
  status: string;
}

interface FormData {
  size: string;
  type: string;
  description: string;
}

export default function Index() {
  const { toasts, removeToast, success, error } = useModernToast();
  const [sizeTypes, setSizeTypes] = useState<SizeType[]>([]);
  const [filteredSizeTypes, setFilteredSizeTypes] = useState<SizeType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  
  const [confirmAddSizeType, setConfirmAddSizeType] = useState(false);
  const [confirmUpdateSizeType, setConfirmUpdateSizeType] = useState(false);
  const [confirmDeleteSizeType, setConfirmDeleteSizeType] = useState(false);
  const [confirmToggleStatus, setConfirmToggleStatus] = useState(false);
  const [sizeTypeToToggle, setsizeTypeToToggle] = useState<SizeType | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    size: '',
    type: '',
    description: '',
  });
  
  const [editFormData, setEditFormData] = useState<FormData & { s_id: number }>({
    s_id: 0,
    size: '',
    type: '',
    description: '',
  });
  
  const [selectedSizeType, setSelectedSizeType] = useState<SizeType | null>(null);
  const [SizeTypeToDelete, setSizeTypeToDelete] = useState<SizeType | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Handle modal closing with cleanup
  const handleCloseAddModal = (open: boolean) => {
    setShowAddModal(open);
    if (!open) {
      setErrors({});
      setFormData({
        size: '',
        type: '',
        description: '',
      });
    }
  };

  const handleCloseEditModal = (open: boolean) => {
    setShowEditModal(open);
    if (!open) {
      setErrors({});
    }
  };

  useEffect(() => {
    fetchSizeTypes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeTypes, searchTerm, statusFilter]);

  const applyFilters = () => {
    let filtered = [...sizeTypes];
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(sizeType => 
        sizeType.size.toLowerCase().includes(search) ||
        sizeType.type.toLowerCase().includes(search) ||
        (sizeType.description && sizeType.description.toLowerCase().includes(search))
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(SizeType => {
        if (statusFilter === 'active') return SizeType.archived === 0;
        if (statusFilter === 'inactive') return SizeType.archived === 1;
        return true;
      });
    }
    
    setFilteredSizeTypes(filtered);
    setTotal(filtered.length);
  };

  const fetchSizeTypes = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/sizetype', {
        params: { 
          search: '',
          per_page: 1000
        }
      });
      if (response.data.success) {
        setSizeTypes(response.data.data || response.data.sizeTypes);
        setTotal((response.data.data || response.data.sizeTypes).length);
      }
    } catch {
      error('Failed to load size types');
    } finally {
      setLoading(false);
    }
  };

  const submitAddSizeType = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setConfirmAddSizeType(true);
  };

  const handleAddSizeType = async () => {
    try {
      // Clean up the data - send null for empty description
      const dataToSend = {
        ...formData,
        description: formData.description.trim() || null
      };
      
      const response = await axios.post('/api/sizetype', dataToSend);
      if (response.data.success) {
        success('Size & Type created successfully');
        handleCloseAddModal(false);
        setConfirmAddSizeType(false);
        fetchSizeTypes();
      }
    } catch (err: unknown) {
      setConfirmAddSizeType(false);
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (e.response?.data?.errors) {
        setErrors(e.response.data.errors);
        error('Please check the form for errors');
      } else {
        error(e.response?.data?.message || 'Failed to create size & type');
      }
    }
  };

  const handleEditSizeType = async (sizeType: SizeType) => {
    setEditFormData({
      s_id: sizeType.s_id,
      size: sizeType.size,
      type: sizeType.type,
      description: sizeType.description || '',
    });
    setShowEditModal(true);
  };

  const submitUpdateSizeType = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setConfirmUpdateSizeType(true);
  };

  const handleUpdateSizeType = async () => {
    try {
      // Clean up the data - send null for empty description
      const dataToSend = {
        ...editFormData,
        description: editFormData.description.trim() || null
      };
      
      const response = await axios.put(`/api/sizetype/${editFormData.s_id}`, dataToSend);
      if (response.data.success) {
        success('SizeType updated successfully');
        handleCloseEditModal(false);
        setConfirmUpdateSizeType(false);
        fetchSizeTypes();
      }
    } catch (err: unknown) {
      setConfirmUpdateSizeType(false);
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (e.response?.data?.errors) {
        setErrors(e.response.data.errors);
        error('Please check the form for errors');
      } else {
        error(e.response?.data?.message || 'Failed to update SizeType');
      }
    }
  };

  const handleViewSizeType = (SizeType: SizeType) => {
    setSelectedSizeType(SizeType);
    setShowViewModal(true);
  };

  const handleDeleteSizeType = async () => {
    if (!SizeTypeToDelete) return;
    
    try {
      const response = await axios.delete(`/api/sizetype/${SizeTypeToDelete.s_id}`);
      if (response.data.success) {
        success('SizeType deleted successfully');
        setSizeTypeToDelete(null);
        setConfirmDeleteSizeType(false);
        fetchSizeTypes();
      }
    } catch (err: unknown) {
      setConfirmDeleteSizeType(false);
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to delete SizeType');
    }
  };

  const handleToggleStatus = async () => {
    if (!sizeTypeToToggle) return;
    
    try {
      const response = await axios.post(`/api/sizetype/${sizeTypeToToggle.s_id}/toggle-status`);
      if (response.data.success) {
        const newStatus = response.data.new_status;
        success(`SizeType ${newStatus.toLowerCase()}`);
        setsizeTypeToToggle(null);
        setConfirmToggleStatus(false);
        fetchSizeTypes();
      }
    } catch {
      setConfirmToggleStatus(false);
      error('Failed to toggle SizeType status');
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
  const paginatedSizeTypes = filteredSizeTypes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredSizeTypes.length / pageSize);

  return (
    <AuthenticatedLayout>
      <Head title="Size & Type Management" />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Size & Type Management</h1>
              <p className="text-sm mt-1 text-gray-600">Manage container sizes and types</p>
            </div>
          </div>
          <ModernButton variant="add" size="lg" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Add New Size & Type
          </ModernButton>
        </div>

        <div className="relative" style={{ zIndex: 0 }}>
          <ModernCard title="Search & Filter Size & Type" subtitle="Find size & type combinations quickly" icon={<Search className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label className="text-sm font-semibold mb-2 text-gray-900">Search Size & Type</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    type="text"
                    placeholder="Search by container size, type or description..."
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
                <span className="font-semibold text-gray-900">{filteredSizeTypes.length}</span> container size & type{filteredSizeTypes.length !== 1 ? 's' : ''} found
                {searchTerm || statusFilter !== 'all' ? (
                  <span> (filtered from {sizeTypes.length} total)</span>
                ) : null}
              </p>
            </div>
          </ModernCard>
        </div>

        <div className="w-full">
          <ModernTable
            columns={[
              {
                key: 'size',
                label: 'Size',
                render: (sizeType: SizeType) => (
                  <div className="font-semibold text-gray-900 text-lg">{sizeType.size}</div>
                ),
              },
              {
                key: 'type',
                label: 'Type',
                render: (sizeType: SizeType) => (
                  <div className="font-medium text-gray-700">{sizeType.type}</div>
                ),
              },
              {
                key: 'description',
                label: 'Description',
                render: (sizeType: SizeType) => (
                  <div className="text-sm text-gray-600">{sizeType.description || '-'}</div>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (sizeType: SizeType) => (
                  <ModernBadge variant={sizeType.archived === 0 ? 'success' : 'error'}>
                    {sizeType.archived === 0 ? 'Active' : 'Inactive'}
                  </ModernBadge>
                ),
              },
              {
                key: 'date_added',
                label: 'Date Created',
                render: (sizeType: SizeType) => (
                  <div className="text-sm text-gray-600">{formatDateTime(sizeType.date_added)}</div>
                ),
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (sizeType: SizeType) => (
                  <div className="flex items-center justify-end gap-2">
                    <ModernButton variant="primary" size="sm" onClick={() => handleViewSizeType(sizeType)}>
                      <Eye className="w-3.5 h-3.5" />
                    </ModernButton>
                    <ModernButton variant="edit" size="sm" onClick={() => handleEditSizeType(sizeType)}>
                      <Edit className="w-3.5 h-3.5" />
                    </ModernButton>
                    <ModernButton variant="toggle" size="sm" onClick={() => {
                      setsizeTypeToToggle(sizeType);
                      setConfirmToggleStatus(true);
                    }}>
                      <Power className="w-3.5 h-3.5" />
                    </ModernButton>
                    <ModernButton variant="delete" size="sm" onClick={() => {
                      setSizeTypeToDelete(sizeType);
                      setConfirmDeleteSizeType(true);
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </ModernButton>
                  </div>
                ),
              },
            ]}
            data={paginatedSizeTypes}
            loading={loading}
            emptyMessage="No size & type combinations found. Click 'Add New Size & Type' to get started."
            pagination={{
              currentPage,
              totalPages,
              perPage: pageSize,
              total: filteredSizeTypes.length,
              onPageChange: setCurrentPage,
            }}
          />
        </div>
      </div>

      {/* Add SizeType Modal */}
      <Dialog open={showAddModal} onOpenChange={handleCloseAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Add New Size & Type</DialogTitle>
            <DialogDescription>Create a new container size and type combination</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAddSizeType}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Size <span className="text-red-500">*</span></Label>
                  <Input 
                    value={formData.size} 
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })} 
                    className={errors.size ? 'border-red-500' : ''}
                    maxLength={2}
                    placeholder="20, 40, 45"
                  />
                  {errors.size && <p className="text-red-500 text-xs mt-1">{errors.size[0]}</p>}
                </div>
                <div>
                  <Label className="text-gray-900">Type <span className="text-red-500">*</span></Label>
                  <Input 
                    value={formData.type} 
                    onChange={(e) => setFormData({ ...formData, type: e.target.value.toUpperCase() })} 
                    className={errors.type ? 'border-red-500' : ''}
                    maxLength={3}
                    placeholder="GP, HC, OT"
                  />
                  {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type[0]}</p>}
                </div>
              </div>
              <div>
                <Label className="text-gray-900">Description (Optional)</Label>
                <Textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                  className={errors.description ? 'border-red-500' : ''}
                  maxLength={45}
                  placeholder="Enter description..."
                />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description[0]}</p>}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton type="button" variant="toggle" onClick={() => handleCloseAddModal(false)}>Cancel</ModernButton>
              <ModernButton type="submit" variant="add"><Plus className="w-4 h-4" />Add Size & Type</ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit SizeType Modal */}
      <Dialog open={showEditModal} onOpenChange={handleCloseEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Edit Size & Type</DialogTitle>
            <DialogDescription>Update container size and type information</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitUpdateSizeType}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Size <span className="text-red-500">*</span></Label>
                  <Input 
                    value={editFormData.size} 
                    onChange={(e) => setEditFormData({ ...editFormData, size: e.target.value })}
                    className={errors.size ? 'border-red-500' : ''}
                    maxLength={2}
                    placeholder="20, 40, 45"
                  />
                  {errors.size && <p className="text-red-500 text-xs mt-1">{errors.size[0]}</p>}
                </div>
                <div>
                  <Label className="text-gray-900">Type <span className="text-red-500">*</span></Label>
                  <Input 
                    value={editFormData.type} 
                    onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value.toUpperCase() })}
                    className={errors.type ? 'border-red-500' : ''}
                    maxLength={3}
                    placeholder="GP, HC, OT"
                  />
                  {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type[0]}</p>}
                </div>
              </div>
              <div>
                <Label className="text-gray-900">Description (Optional)</Label>
                <Textarea 
                  value={editFormData.description} 
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className={errors.description ? 'border-red-500' : ''}
                  maxLength={45}
                  placeholder="Enter description..."
                />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description[0]}</p>}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton type="button" variant="toggle" onClick={() => handleCloseEditModal(false)}>Cancel</ModernButton>
              <ModernButton type="submit" variant="edit"><Edit className="w-4 h-4" />Update Size & Type</ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View SizeType Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Size & Type Details</DialogTitle>
          </DialogHeader>
          {selectedSizeType && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: colors.brand.primary }}>
                  {String(selectedSizeType.size).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedSizeType.size}{selectedSizeType.type}</h3>
                  <p className="text-sm text-gray-600">Container Size & Type</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-xs uppercase text-gray-600">Size</Label>
                  <p className="mt-1 text-gray-900 font-semibold text-lg">{selectedSizeType.size}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-gray-600">Type</Label>
                  <p className="mt-1 text-gray-900 font-medium">{selectedSizeType.type}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs uppercase text-gray-600">Description</Label>
                  <p className="mt-1 text-gray-900">{selectedSizeType.description || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <Power className="w-3.5 h-3.5" />
                    Status
                  </Label>
                  <div className="mt-1">
                    <ModernBadge variant={selectedSizeType.archived === 0 ? 'success' : 'error'}>
                      {selectedSizeType.archived === 0 ? 'Active' : 'Inactive'}
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
                  <p className="mt-1 text-gray-900">{formatDateTime(selectedSizeType.date_added)}</p>
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
        open={confirmAddSizeType}
        onOpenChange={setConfirmAddSizeType}
        onConfirm={handleAddSizeType}
        title="Add New SizeType"
        description="Are you sure you want to add this SizeType?"
        confirmText="Add SizeType"
        type="success"
      />
      
      <ModernConfirmDialog
        open={confirmUpdateSizeType}
        onOpenChange={setConfirmUpdateSizeType}
        onConfirm={handleUpdateSizeType}
        title="Update SizeType"
        description="Are you sure you want to update this SizeType's information?"
        confirmText="Update SizeType"
        type="warning"
      />
      
      <ModernConfirmDialog
        open={confirmDeleteSizeType}
        onOpenChange={setConfirmDeleteSizeType}
        onConfirm={handleDeleteSizeType}
        title="Delete SizeType"
        description={`Are you sure you want to delete ${SizeTypeToDelete?.size}? This action cannot be undone.`}
        confirmText="Delete SizeType"
        type="danger"
      />
      
      <ModernConfirmDialog
        open={confirmToggleStatus}
        onOpenChange={setConfirmToggleStatus}
        type="warning"
        title={`${sizeTypeToToggle?.status === 'Active' ? 'Deactivate' : 'Activate'} SizeType?`}
        description={`Are you sure you want to ${sizeTypeToToggle?.status === 'Active' ? 'deactivate' : 'activate'} "${sizeTypeToToggle?.size}"?`}
        confirmText={`Yes, ${sizeTypeToToggle?.status === 'Active' ? 'Deactivate' : 'Activate'}`}
        onConfirm={handleToggleStatus}
      />
      
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </AuthenticatedLayout>
  );
}

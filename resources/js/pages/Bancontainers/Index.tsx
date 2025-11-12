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
import { Plus, Search, Ban, Pencil, Trash2, Eye, FileText } from 'lucide-react';
import { colors } from '@/lib/colors';

interface BanContainer extends Record<string, unknown> {
  b_id: number;
  container_no: string;
  notes: string;
  date_added: string;
  status: string;
  is_active: boolean;
  banned_by: string | null;
}

interface Stats {
  total_banned: number;
  active_bans: number;
  blocked_in_inventory: number;
}

interface FormData {
  container_no: string;
  notes: string;
}

export default function Index() {
  const { toasts, removeToast, success, error } = useModernToast();
  const [banContainers, setBanContainers] = useState<BanContainer[]>([]);
  const [filteredBans, setFilteredBans] = useState<BanContainer[]>([]);
  const [stats, setStats] = useState<Stats>({ total_banned: 0, active_bans: 0, blocked_in_inventory: 0 });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  
  const [confirmAddBan, setConfirmAddBan] = useState(false);
  const [confirmUpdateBan, setConfirmUpdateBan] = useState(false);
  const [confirmDeleteBan, setConfirmDeleteBan] = useState(false);
  const [banToDelete, setBanToDelete] = useState<BanContainer | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    container_no: '',
    notes: '',
  });
  
  const [bulkFormData, setBulkFormData] = useState({
    container_numbers: '',
    notes: '',
  });
  
  const [editFormData, setEditFormData] = useState<FormData & { b_id: number }>({
    b_id: 0,
    container_no: '',
    notes: '',
  });
  
  const [selectedBan, setSelectedBan] = useState<BanContainer | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchBanContainers();
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banContainers, searchTerm, statusFilter]);

  const applyFilters = () => {
    let filtered = [...banContainers];
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(ban => 
        ban.container_no.toLowerCase().includes(search) ||
        ban.notes.toLowerCase().includes(search)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(ban => ban.status === 'active');
      } else if (statusFilter === 'in_inventory') {
        filtered = filtered.filter(ban => ban.status === 'blocked');
      }
    }
    
    setFilteredBans(filtered);
    setTotal(filtered.length);
  };

  const fetchBanContainers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/bancontainers');
      if (response.data.success) {
        setBanContainers(response.data.data || []);
        setTotal(response.data.data?.length || 0);
      }
    } catch {
      error('Failed to load banned containers');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/bancontainers/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch {
      console.error('Failed to load stats');
    }
  };

  const submitAddBan = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setConfirmAddBan(true);
  };

  const handleAddBan = async () => {
    try {
      const response = await axios.post('/api/bancontainers', formData);
      if (response.data.success) {
        success('Container banned successfully');
        setShowAddModal(false);
        setConfirmAddBan(false);
        setFormData({
          container_no: '',
          notes: '',
        });
        setErrors({});
        fetchBanContainers();
        fetchStats();
      }
    } catch (err: unknown) {
      setConfirmAddBan(false);
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (e.response?.data?.errors) {
        setErrors(e.response.data.errors);
        error('Please check the form for errors');
      } else {
        error(e.response?.data?.message || 'Failed to ban container');
      }
    }
  };

  const handleEditBan = async (ban: BanContainer) => {
    setEditFormData({
      b_id: ban.b_id,
      container_no: ban.container_no,
      notes: ban.notes || '',
    });
    setShowEditModal(true);
  };

  const submitUpdateBan = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setConfirmUpdateBan(true);
  };

  const handleUpdateBan = async () => {
    try {
      const response = await axios.put(`/api/bancontainers/${editFormData.b_id}`, editFormData);
      if (response.data.success) {
        success('Ban container updated successfully');
        setShowEditModal(false);
        setConfirmUpdateBan(false);
        setErrors({});
        fetchBanContainers();
        fetchStats();
      }
    } catch (err: unknown) {
      setConfirmUpdateBan(false);
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (e.response?.data?.errors) {
        setErrors(e.response.data.errors);
        error('Please check the form for errors');
      } else {
        error(e.response?.data?.message || 'Failed to update ban container');
      }
    }
  };

  const handleViewBan = (ban: BanContainer) => {
    setSelectedBan(ban);
    setShowViewModal(true);
  };

  const handleDeleteBan = async () => {
    if (!banToDelete) return;
    
    try {
      const response = await axios.delete(`/api/bancontainers/${banToDelete.b_id}`);
      if (response.data.success) {
        success('Ban container removed successfully');
        setBanToDelete(null);
        setConfirmDeleteBan(false);
        fetchBanContainers();
        fetchStats();
      }
    } catch (err: unknown) {
      setConfirmDeleteBan(false);
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to remove ban container');
    }
  };

  const handleBulkAdd = async () => {
    try {
      // Split by comma and clean up whitespace
      const containerNumbers = bulkFormData.container_numbers
        .split(',')
        .map(num => num.trim().toUpperCase())
        .filter(num => num.length > 0);

      if (containerNumbers.length === 0) {
        error('Please enter at least one container number');
        return;
      }

      const response = await axios.post('/api/bancontainers/bulk-add', {
        container_numbers: containerNumbers,
        notes: bulkFormData.notes
      });

      if (response.data.success) {
        success(`Successfully banned ${response.data.added} container(s)`);
        if (response.data.skipped > 0) {
          warning(`${response.data.skipped} container(s) were already banned`);
        }
        setShowBulkAddModal(false);
        setBulkFormData({ container_numbers: '', notes: '' });
        fetchBanContainers();
        fetchStats();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to bulk ban containers');
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
  const paginatedBans = filteredBans.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredBans.length / pageSize);

  return (
    <AuthenticatedLayout>
      <Head title="Banned Containers" />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
              <Ban className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Banned Containers</h1>
              <p className="text-sm mt-1 text-gray-600">Manage containers that are banned from operations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ModernButton variant="edit" size="lg" onClick={() => setShowBulkAddModal(true)}>
              <FileText className="w-4 h-4" />
              Bulk Ban
            </ModernButton>
            <ModernButton variant="add" size="lg" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              Ban Container
            </ModernButton>
          </div>
        </div>

        <div className="relative" style={{ zIndex: 0 }}>
          <ModernCard title="Search & Filter Banned Containers" subtitle="Find banned containers quickly" icon={<Search className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label className="text-sm font-semibold mb-2 text-gray-900">Search Banned Containers</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    type="text"
                    placeholder="Search by container number or reason..."
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
                <span className="font-semibold text-gray-900">{filteredBans.length}</span> banned containers found
                {searchTerm || statusFilter !== 'all' ? (
                  <span> (filtered from {banContainers.length} total)</span>
                ) : null}
              </p>
            </div>
          </ModernCard>
        </div>

        <div className="w-full">
          <ModernTable
            columns={[
              {
                key: 'container_no',
                label: 'Container Number',
                render: (ban: BanContainer) => (
                  <div className="font-mono font-bold text-red-600 min-w-[140px]" title={ban.container_no}>{ban.container_no}</div>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (ban: BanContainer) => (
                  <div className="min-w-[100px]">
                    <ModernBadge variant={ban.status === 'active' ? 'error' : 'warning'}>
                      {ban.status === 'active' ? 'BANNED' : 'BLOCKED IN INVENTORY'}
                    </ModernBadge>
                  </div>
                ),
              },
              {
                key: 'notes',
                label: 'Reason',
                render: (ban: BanContainer) => (
                  <div className="text-sm text-gray-700 min-w-[180px] max-w-[280px]" title={ban.notes || 'No reason provided'}>
                    {ban.notes || <span className="text-gray-400 italic">No reason provided</span>}
                  </div>
                ),
              },
              {
                key: 'date_added',
                label: 'Date Banned',
                render: (ban: BanContainer) => (
                  <div className="text-sm text-gray-600 min-w-[90px]">{formatDateTime(ban.date_added)}</div>
                ),
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (ban: BanContainer) => (
                  <div className="flex items-center justify-end gap-2">
                    <ModernButton variant="primary" size="sm" onClick={() => handleViewBan(ban)}>
                      <Eye className="w-3.5 h-3.5" />
                    </ModernButton>
                    <ModernButton variant="edit" size="sm" onClick={() => handleEditBan(ban)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </ModernButton>
                    <ModernButton variant="delete" size="sm" onClick={() => {
                      setBanToDelete(ban);
                      setConfirmDeleteBan(true);
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </ModernButton>
                  </div>
                ),
              },
            ]}
            data={paginatedBans}
            loading={loading}
            emptyMessage="No banned containers found. Click 'Ban Container' to get started."
            pagination={{
              currentPage,
              totalPages,
              perPage: pageSize,
              total: filteredBans.length,
              onPageChange: setCurrentPage,
            }}
          />
        </div>
      </div>

      {/* Add Ban Container Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Ban Container</DialogTitle>
            <DialogDescription>Add a container to the ban list</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAddBan}>
            <div className="grid gap-4 py-4">
              <div>
                <Label className="text-gray-900">Container Number <span className="text-red-500">*</span></Label>
                <Input 
                  value={formData.container_no} 
                  onChange={(e) => setFormData({ ...formData, container_no: e.target.value.toUpperCase() })} 
                  className={errors.container_no ? 'border-red-500 font-mono' : 'font-mono'} 
                  placeholder="ABCD1234567"
                />
                {errors.container_no && <p className="text-red-500 text-xs mt-1">{errors.container_no[0]}</p>}
              </div>
              <div>
                <Label className="text-gray-900">Reason / Notes</Label>
                <Textarea 
                  value={formData.notes} 
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                  className={errors.notes ? 'border-red-500' : ''} 
                  placeholder="Enter the reason for banning this container..."
                  rows={4}
                />
                {errors.notes && <p className="text-red-500 text-xs mt-1">{errors.notes[0]}</p>}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton type="button" variant="toggle" onClick={() => setShowAddModal(false)}>Cancel</ModernButton>
              <ModernButton type="submit" variant="add"><Plus className="w-4 h-4" />Ban Container</ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Ban Container Modal */}
      <Dialog open={showBulkAddModal} onOpenChange={setShowBulkAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Bulk Ban Containers</DialogTitle>
            <DialogDescription>Ban multiple containers at once</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label className="text-gray-900">Container Numbers <span className="text-red-500">*</span></Label>
              <Textarea 
                value={bulkFormData.container_numbers} 
                onChange={(e) => setBulkFormData({ ...bulkFormData, container_numbers: e.target.value })} 
                className="font-mono" 
                placeholder="Enter container numbers separated by comma&#10;e.g., ASKF34JF854, NFKSJ8493HJ, ABCD1234567"
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-1">Separate container numbers with commas (,)</p>
            </div>
            <div>
              <Label className="text-gray-900">Reason / Notes</Label>
              <Textarea 
                value={bulkFormData.notes} 
                onChange={(e) => setBulkFormData({ ...bulkFormData, notes: e.target.value })} 
                placeholder="Enter the reason for banning these containers..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <ModernButton type="button" variant="toggle" onClick={() => setShowBulkAddModal(false)}>Cancel</ModernButton>
            <ModernButton type="button" variant="add" onClick={handleBulkAdd}>
              <FileText className="w-4 h-4" />
              Bulk Ban
            </ModernButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Ban Container Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Edit Ban Container</DialogTitle>
            <DialogDescription>Update ban container information</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitUpdateBan}>
            <div className="grid gap-4 py-4">
              <div>
                <Label className="text-gray-900">Container Number <span className="text-red-500">*</span></Label>
                <Input 
                  value={editFormData.container_no} 
                  onChange={(e) => setEditFormData({ ...editFormData, container_no: e.target.value.toUpperCase() })} 
                  className="font-mono"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Container number cannot be changed</p>
              </div>
              <div>
                <Label className="text-gray-900">Reason / Notes</Label>
                <Textarea 
                  value={editFormData.notes} 
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} 
                  placeholder="Enter the reason for banning this container..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton type="button" variant="toggle" onClick={() => setShowEditModal(false)}>Cancel</ModernButton>
              <ModernButton type="submit" variant="edit"><Pencil className="w-4 h-4" />Update</ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Banned Container Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Banned Container Details</DialogTitle>
          </DialogHeader>
          {selectedBan && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: colors.brand.primary }}>
                  <Ban className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 font-mono">{selectedBan.container_no}</h3>
                  <p className="text-sm text-gray-600">Banned Container</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="col-span-2">
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5" />
                    Reason / Notes
                  </Label>
                  <p className="mt-1 text-gray-900">{selectedBan.notes || 'No reason provided'}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Date Banned
                  </Label>
                  <p className="mt-1 text-gray-900">{formatDateTime(selectedBan.date_added)}</p>
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
        open={confirmAddBan}
        onOpenChange={setConfirmAddBan}
        onConfirm={handleAddBan}
        title="Ban Container"
        description="Are you sure you want to ban this container?"
        confirmText="Ban Container"
        type="danger"
      />
      
      <ModernConfirmDialog
        open={confirmUpdateBan}
        onOpenChange={setConfirmUpdateBan}
        onConfirm={handleUpdateBan}
        title="Update Ban Container"
        description="Are you sure you want to update this ban container's information?"
        confirmText="Update"
        type="warning"
      />
      
      <ModernConfirmDialog
        open={confirmDeleteBan}
        onOpenChange={setConfirmDeleteBan}
        onConfirm={handleDeleteBan}
        title="Remove Ban"
        description={`Are you sure you want to remove the ban on ${banToDelete?.container_no}? This container will be allowed to operate again.`}
        confirmText="Remove Ban"
        type="success"
      />
      
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </AuthenticatedLayout>
  );
}

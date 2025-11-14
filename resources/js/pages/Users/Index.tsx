import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { ModernButton, ModernCard, ModernTable, ModernBadge, ModernConfirmDialog, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Users as UsersIcon, Pencil, Trash2, Eye, Shield, Power, Mail, User } from 'lucide-react';
import { colors } from '@/lib/colors';

interface UserData extends Record<string, unknown> {
  user_id: number;
  hashed_id: string;
  username: string;
  full_name: string;
  email: string;
  contact: string;
  privilege_name: string;
  privilege_id: number;
  status: string;
  date_added: string;
}

interface Privilege {
  priv_id: number;
  priv_name: string;
}

interface PageAccess {
  page_id: number;
  page_name: string;
  acs_edit: number;
  acs_delete: number;
}

export default function Index({ auth }: Record<string, unknown>) {
  const { toasts, showToast, removeToast, success, error, warning } = useModernToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [privileges, setPrivileges] = useState<Privilege[]>([]);
  const [pages, setPages] = useState<PageAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPrivilegesModal, setShowPrivilegesModal] = useState(false);
  
  const [confirmAddUser, setConfirmAddUser] = useState(false);
  const [confirmUpdateUser, setConfirmUpdateUser] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(false);
  const [confirmToggleStatus, setConfirmToggleStatus] = useState(false);
  const [userToToggle, setUserToToggle] = useState<UserData | null>(null);
  
  const [formData, setFormData] = useState({
    username: '', password: '', confirm_password: '', full_name: '',
    email: '', priv_id: 0, archived: 0
  });
  
  const [editFormData, setEditFormData] = useState({
    hashed_id: '', full_name: '', email: '', priv_id: 0,
    archived: 0, change_password: false, new_password: '', confirm_new_password: ''
  });
  
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [selectedPageAccess, setSelectedPageAccess] = useState<PageAccess[]>([]);
  const [addModalPageAccess, setAddModalPageAccess] = useState<PageAccess[]>([]);
  const [editModalPageAccess, setEditModalPageAccess] = useState<PageAccess[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  
  useEffect(() => {
    fetchUsers();
    fetchPrivileges();
    fetchPages();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, statusFilter, roleFilter]);
  
  // Fetch page access when privilege changes in Add modal
  useEffect(() => {
    if (formData.priv_id > 0) {
      fetchPageAccessForPrivilege(formData.priv_id, setAddModalPageAccess);
    } else {
      setAddModalPageAccess([]);
    }
  }, [formData.priv_id]);
  
  // Fetch page access when privilege changes in Edit modal
  useEffect(() => {
    if (editFormData.priv_id > 0) {
      fetchPageAccessForPrivilege(editFormData.priv_id, setEditModalPageAccess);
    } else {
      setEditModalPageAccess([]);
    }
  }, [editFormData.priv_id]);
  
  const fetchPageAccessForPrivilege = async (privId: number, setState: React.Dispatch<React.SetStateAction<PageAccess[]>>) => {
    try {
      const response = await axios.get(`/api/users/privileges/${privId}/pages`);
      if (response.data.success) {
        setState(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch page access for privilege');
    }
  };
  
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/users/list', {
        start: 0,
        length: 1000
      });
      
      if (response.data.success) {
        setUsers(response.data.data);
        setTotal(response.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };
  
  const applyFilters = () => {
    let filtered = [...users];
    
    // Search filter (phrase matching)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.full_name.toLowerCase().includes(search) ||
        user.username.toLowerCase().includes(search) ||
        (user.email && user.email.toLowerCase().includes(search))
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }
    
    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.privilege_id.toString() === roleFilter);
    }
    
    setFilteredUsers(filtered);
    setTotal(filtered.length);
  };
  
  const fetchPrivileges = async () => {
    try {
      const response = await axios.get('/api/users/privileges');
      if (response.data.success) setPrivileges(response.data.data);
    } catch (err) {
      console.error('Failed to fetch privileges:', err);
    }
  };
  
  const fetchPages = async () => {
    try {
      const response = await axios.get('/api/users/pages');
      if (response.data.success) setPages(response.data.data);
    } catch (err) {
      console.error('Failed to fetch pages:', err);
    }
  };

  const submitAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    if (formData.password !== formData.confirm_password) {
      setErrors({ confirm_password: ['Passwords do not match'] });
      return;
    }
    
    setConfirmAddUser(true);
  };
  
  const handleAddUser = async () => {
    try {
      const response = await axios.post('/api/users', formData);
      if (response.data.success) {
        success('User created successfully');
        setShowAddModal(false);
        setFormData({ username: '', password: '', confirm_password: '', full_name: '', email: '', priv_id: 0, archived: 0 });
        fetchUsers();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (e.response?.data?.errors) {
        setErrors(e.response.data.errors);
      } else {
        error(e.response?.data?.message || 'Failed to create user');
      }
    }
  };
  
  const handleEditUser = async (user: UserData) => {
    try {
      const response = await axios.get(`/api/users/${user.hashed_id}`);
      if (response.data.success) {
        const userData = response.data.data;
        setEditFormData({
          hashed_id: userData.hashed_id,
          full_name: userData.full_name,
          email: userData.email,
          priv_id: userData.privilege_id,
          archived: userData.status === 'Inactive' ? 1 : 0,
          change_password: false,
          new_password: '',
          confirm_new_password: ''
        });
        setShowEditModal(true);
      }
    } catch (err) {
      error('Failed to load user data');
    }
  };

  const submitUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    if (editFormData.change_password && editFormData.new_password !== editFormData.confirm_new_password) {
      setErrors({ confirm_new_password: ['Passwords do not match'] });
      return;
    }
    
    setConfirmUpdateUser(true);
  };
  
  const handleUpdateUser = async () => {
    try {
      const response = await axios.put(`/api/users/${editFormData.hashed_id}`, editFormData);
      if (response.data.success) {
        success('User updated successfully');
        setShowEditModal(false);
        fetchUsers();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      if (e.response?.data?.errors) {
        setErrors(e.response.data.errors);
      } else {
        error(e.response?.data?.message || 'Failed to update user');
      }
    }
  };
  
  const handleViewUser = async (user: UserData) => {
    try {
      const response = await axios.get(`/api/users/${user.hashed_id}`);
      if (response.data.success) {
        setSelectedUser(response.data.data);
        // Fetch privilege access for this user
        if (response.data.data.privilege_id) {
          const accessResponse = await axios.get(`/api/users/privileges/${response.data.data.privilege_id}/pages`);
          if (accessResponse.data.success) {
            setSelectedPageAccess(accessResponse.data.data);
          }
        }
        setShowViewModal(true);
      }
    } catch (err) {
      error('Failed to load user details');
    }
  };
  
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      const response = await axios.delete(`/api/users/${userToDelete.hashed_id}`);
      if (response.data.success) {
        success('User deleted successfully');
        setConfirmDeleteUser(false);
        setUserToDelete(null);
        fetchUsers();
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to delete user');
    }
  };
  
  const handleToggleStatus = async () => {
    if (!userToToggle) return;
    
    try {
      const response = await axios.post(`/api/users/${userToToggle.hashed_id}/toggle-status`, {});
      if (response.data.success) {
        const newStatus = response.data.new_status;
        success(`User ${newStatus.toLowerCase()}`);
        setUserToToggle(null);
        fetchUsers();
      }
    } catch (err) {
      error('Failed to toggle user status');
    }
  };
  
  const handleManagePrivileges = async (user: UserData) => {
    try {
      const response = await axios.get(`/api/users/${user.hashed_id}/page-access`);
      if (response.data.success) {
        setSelectedUser(user);
        setSelectedPageAccess(response.data.data);
        setShowPrivilegesModal(true);
      }
    } catch (err) {
      error('Failed to load page access');
    }
  };
  
  const handleUpdatePageAccess = async () => {
    if (!selectedUser) return;
    
    try {
      const response = await axios.post(`/api/users/${selectedUser.hashed_id}/page-access`, {
        page_access: selectedPageAccess
      });
      if (response.data.success) {
        success('Page access updated successfully');
        setShowPrivilegesModal(false);
      }
    } catch (err) {
      error('Failed to update page access');
    }
  };
  
  const togglePageAccess = (pageId: number, field: 'acs_edit' | 'acs_delete') => {
    const existingIndex = selectedPageAccess.findIndex(pa => pa.page_id === pageId);
    
    if (existingIndex >= 0) {
      const updated = [...selectedPageAccess];
      updated[existingIndex][field] = updated[existingIndex][field] === 1 ? 0 : 1;
      setSelectedPageAccess(updated);
    } else {
      setSelectedPageAccess([
        ...selectedPageAccess,
        {
          page_id: pageId,
          page_name: pages.find(p => p.page_id === pageId)?.page_name || '',
          acs_edit: field === 'acs_edit' ? 1 : 0,
          acs_delete: field === 'acs_delete' ? 1 : 0
        }
      ]);
    }
  };
  
  const getPageAccessValue = (pageId: number, field: 'acs_edit' | 'acs_delete') => {
    const access = selectedPageAccess.find(pa => pa.page_id === pageId);
    return access ? access[field] === 1 : false;
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

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <AuthenticatedLayout>
      <Head title="Users Management" />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="space-y-6 max-w-full overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
              <UsersIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
              <p className="text-sm mt-1 text-gray-600">Manage system users, roles, and permissions</p>
            </div>
          </div>
          <ModernButton variant="add" size="lg" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Add New User
          </ModernButton>
        </div>

        <div className="relative" style={{ zIndex: 0 }}>
          <ModernCard title="Search & Filter Users" subtitle="Find users quickly" icon={<Search className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label className="text-sm font-semibold mb-2 text-gray-900">Search Users</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                  type="text"
                  placeholder="Search by username, name, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 text-gray-900">Role Filter</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {privileges.map(priv => (
                    <SelectItem key={priv.priv_id} value={priv.priv_id.toString()}>
                      {priv.priv_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-semibold mb-2 text-gray-900">Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            {total} user{total !== 1 ? 's' : ''} found
          </div>
        </ModernCard>
        </div>

        <div className="bg-transparent">
          <ModernTable
            columns={[
              {
                key: 'username',
                label: 'User',
                render: (user: UserData) => (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: colors.brand.primary }}>
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{user.full_name}</div>
                      <div className="text-xs flex items-center gap-1 text-gray-600">
                        <User className="w-3 h-3" />
                        {user.username}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: 'email',
                label: 'Email',
                render: (user: UserData) => (
                  <div className="text-sm text-gray-600">
                    {user.email || '-'}
                  </div>
                ),
              },
              {
                key: 'privilege_name',
                label: 'Role',
                render: (user: UserData) => (
                  <ModernBadge variant="info">
                    <Shield className="w-3 h-3" />
                    {user.privilege_name}
                  </ModernBadge>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (user: UserData) => (
                  <ModernBadge variant={user.status === 'Active' ? 'success' : 'error'}>
                    {user.status}
                  </ModernBadge>
                ),
              },
              {
                key: 'date_added',
                label: 'Date Created',
                render: (user: UserData) => (
                  <div className="text-sm text-gray-600">
                    {formatDateTime(user.date_added)}
                  </div>
                ),
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (user: UserData) => (
                  <div className="flex items-center justify-end gap-2">
                    <ModernButton variant="primary" size="sm" onClick={() => handleViewUser(user)}>
                      <Eye className="w-3.5 h-3.5" />
                    </ModernButton>
                    <ModernButton variant="edit" size="sm" onClick={() => handleEditUser(user)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </ModernButton>
                    <ModernButton variant="toggle" size="sm" onClick={() => {
                      setUserToToggle(user);
                      setConfirmToggleStatus(true);
                    }}>
                      <Power className="w-3.5 h-3.5" />
                    </ModernButton>
                    <ModernButton variant="delete" size="sm" onClick={() => {
                      setUserToDelete(user);
                      setConfirmDeleteUser(true);
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </ModernButton>
                  </div>
                ),
              },
            ]}
            data={paginatedUsers}
            loading={loading}
            emptyMessage="No users found. Click 'Add New User' to get started."
            pagination={{
              currentPage,
              totalPages: Math.ceil(total / pageSize),
              total,
              perPage: pageSize,
              onPageChange: setCurrentPage,
            }}
          />
        </div>
      </div>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Add New User</DialogTitle>
            <DialogDescription>Create a new user account with appropriate privileges</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAddUser}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Username <span className="text-red-500">*</span></Label>
                  <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className={errors.username ? 'border-red-500' : ''} />
                  {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username[0]}</p>}
                </div>
                <div>
                  <Label className="text-gray-900">Full Name <span className="text-red-500">*</span></Label>
                  <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className={errors.full_name ? 'border-red-500' : ''} />
                  {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name[0]}</p>}
                </div>
              </div>
              <div>
                <Label className="text-gray-900">Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-gray-900">Privilege Level <span className="text-red-500">*</span></Label>
                <Select value={formData.priv_id.toString()} onValueChange={(value) => setFormData({ ...formData, priv_id: parseInt(value) })}>
                  <SelectTrigger><SelectValue placeholder="Select privilege level" /></SelectTrigger>
                  <SelectContent>
                    {privileges.map((priv) => (
                      <SelectItem key={priv.priv_id} value={priv.priv_id.toString()}>{priv.priv_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Show privilege access when a privilege is selected */}
              {formData.priv_id > 0 && addModalPageAccess.length > 0 && (
                <div className="border rounded-lg p-4" style={{ borderColor: colors.card.border, backgroundColor: colors.main }}>
                  <h4 className="text-sm font-semibold mb-3 text-gray-900">Privilege Access</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {addModalPageAccess.map(page => (
                      <div key={page.page_id} className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>{page.page_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Password <span className="text-red-500">*</span></Label>
                  <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={errors.password ? 'border-red-500' : ''} />
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password[0]}</p>}
                </div>
                <div>
                  <Label className="text-gray-900">Confirm Password <span className="text-red-500">*</span></Label>
                  <Input type="password" value={formData.confirm_password} onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })} className={errors.confirm_password ? 'border-red-500' : ''} />
                  {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password[0]}</p>}
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ModernButton type="button" variant="toggle" onClick={() => setShowAddModal(false)}>Cancel</ModernButton>
              <ModernButton type="submit" variant="add"><Plus className="w-4 h-4" />Add User</ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Edit User</DialogTitle>
            <DialogDescription>Update user information and settings</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitUpdateUser}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900">Full Name <span className="text-red-500">*</span></Label>
                  <Input value={editFormData.full_name} onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-gray-900">Email</Label>
                  <Input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-gray-900">Privilege Level <span className="text-red-500">*</span></Label>
                <Select value={editFormData.priv_id.toString()} onValueChange={(value) => setEditFormData({ ...editFormData, priv_id: parseInt(value) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {privileges.map((priv) => (
                      <SelectItem key={priv.priv_id} value={priv.priv_id.toString()}>{priv.priv_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Show privilege access when a privilege is selected */}
              {editFormData.priv_id > 0 && editModalPageAccess.length > 0 && (
                <div className="border rounded-lg p-4" style={{ borderColor: colors.card.border, backgroundColor: colors.main }}>
                  <h4 className="text-sm font-semibold mb-3 text-gray-900">Privilege Access</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {editModalPageAccess.map(page => (
                      <div key={page.page_id} className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>{page.page_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Checkbox checked={editFormData.change_password} onCheckedChange={(checked) => setEditFormData({ ...editFormData, change_password: checked as boolean })} />
                <Label className="text-gray-900">Change Password</Label>
              </div>
              {editFormData.change_password && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-900">New Password</Label>
                    <Input type="password" value={editFormData.new_password} onChange={(e) => setEditFormData({ ...editFormData, new_password: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-gray-900">Confirm New Password</Label>
                    <Input type="password" value={editFormData.confirm_new_password} onChange={(e) => setEditFormData({ ...editFormData, confirm_new_password: e.target.value })} className={errors.confirm_new_password ? 'border-red-500' : ''} />
                    {errors.confirm_new_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_new_password[0]}</p>}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <ModernButton type="button" variant="toggle" onClick={() => setShowEditModal(false)}>Cancel</ModernButton>
              <ModernButton type="submit" variant="edit"><Pencil className="w-4 h-4" />Update User</ModernButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: colors.brand.primary }}>
                  {selectedUser.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedUser.full_name}</h3>
                  <p className="text-sm text-gray-600">@{selectedUser.username}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </Label>
                  <p className="mt-1 text-gray-900">{selectedUser.email || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    Privilege Level
                  </Label>
                  <p className="mt-1 text-gray-900">{selectedUser.privilege_name}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <Power className="w-3.5 h-3.5" />
                    Status
                  </Label>
                  <div className="mt-1">
                    <ModernBadge variant={selectedUser.status === 'Active' ? 'success' : 'error'}>{selectedUser.status}</ModernBadge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Date Created
                  </Label>
                  <p className="mt-1 text-gray-900">{formatDateTime(selectedUser.date_added)}</p>
                </div>
              </div>
              
              {/* Show privilege access */}
              {selectedPageAccess.length > 0 && (
                <div className="pt-4 border-t">
                  <Label className="text-xs uppercase text-gray-600 mb-3 block">Privilege Access</Label>
                  <div className="border rounded-lg p-4" style={{ borderColor: colors.card.border, backgroundColor: colors.main }}>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {selectedPageAccess.map(page => (
                        <div key={page.page_id} className="flex items-center gap-2 text-sm text-gray-700">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span>{page.page_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <ModernButton variant="toggle" onClick={() => setShowViewModal(false)}>Close</ModernButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPrivilegesModal} onOpenChange={setShowPrivilegesModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>Manage Page Access - {selectedUser?.full_name}</DialogTitle>
            <DialogDescription>Configure which pages the user can edit and delete in</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ModernTable
              columns={[
                { key: 'page_name', label: 'Page', render: (page: PageAccess) => <span className="text-gray-900">{page.page_name}</span> },
                {
                  key: 'acs_edit',
                  label: 'Can Edit',
                  render: (page: PageAccess) => (
                    <Checkbox checked={getPageAccessValue(page.page_id, 'acs_edit')} onCheckedChange={() => togglePageAccess(page.page_id, 'acs_edit')} />
                  ),
                },
                {
                  key: 'acs_delete',
                  label: 'Can Delete',
                  render: (page: PageAccess) => (
                    <Checkbox checked={getPageAccessValue(page.page_id, 'acs_delete')} onCheckedChange={() => togglePageAccess(page.page_id, 'acs_delete')} />
                  ),
                },
              ]}
              data={pages}
              emptyMessage="No pages available"
            />
          </div>
          <DialogFooter className="gap-2">
            <ModernButton variant="toggle" onClick={() => setShowPrivilegesModal(false)}>Cancel</ModernButton>
            <ModernButton variant="primary" onClick={handleUpdatePageAccess}><Shield className="w-4 h-4" />Save Permissions</ModernButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModernConfirmDialog
        open={confirmAddUser}
        onOpenChange={setConfirmAddUser}
        type="success"
        title="Add New User?"
        description={`Are you sure you want to create user "${formData.full_name}"?`}
        confirmText="Yes, Add User"
        onConfirm={handleAddUser}
      />

      <ModernConfirmDialog
        open={confirmUpdateUser}
        onOpenChange={setConfirmUpdateUser}
        type="warning"
        title="Update User?"
        description={`Are you sure you want to update "${editFormData.full_name}"?`}
        confirmText="Yes, Update"
        onConfirm={handleUpdateUser}
      />

      <ModernConfirmDialog
        open={confirmDeleteUser}
        onOpenChange={setConfirmDeleteUser}
        type="danger"
        title="Delete User?"
        description={`Are you sure you want to delete "${userToDelete?.full_name}"? This action cannot be undone.`}
        confirmText="Yes, Delete"
        onConfirm={handleDeleteUser}
      />

      <ModernConfirmDialog
        open={confirmToggleStatus}
        onOpenChange={setConfirmToggleStatus}
        type="warning"
        title={`${userToToggle?.status === 'Active' ? 'Deactivate' : 'Activate'} User?`}
        description={`Are you sure you want to ${userToToggle?.status === 'Active' ? 'deactivate' : 'activate'} "${userToToggle?.full_name}"?`}
        confirmText={`Yes, ${userToToggle?.status === 'Active' ? 'Deactivate' : 'Activate'}`}
        onConfirm={handleToggleStatus}
      />
    </AuthenticatedLayout>
  );
}

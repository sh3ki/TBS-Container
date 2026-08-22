import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ModernBadge, ModernButton, ModernCard, ModernConfirmDialog, ModernTable, ToastContainer, useModernToast } from '@/components/modern';
import { colors } from '@/lib/colors';
import { FolderPlus, FolderOpen, Image as ImageIcon, RefreshCw, Trash2, Upload, ArrowLeft, Search, Shield, Eye, Images } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ExplorerItem extends Record<string, unknown> {
  name: string;
  relative_path: string;
  type: 'file' | 'directory';
  size: number | null;
  modified_at: string;
  is_image: boolean;
}

interface PageAccessResponse {
  can_view: boolean;
  module_edit: boolean;
  module_delete: boolean;
}

export default function Index() {
  const { toasts, removeToast, success, error } = useModernToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<ExplorerItem[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pageAccess, setPageAccess] = useState<PageAccessResponse>({
    can_view: false,
    module_edit: false,
    module_delete: false,
  });
  const [folderName, setFolderName] = useState('');
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ExplorerItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetchPageAccess();
  }, []);

  useEffect(() => {
    if (pageAccess.can_view) {
      fetchItems(currentPath);
    }
  }, [pageAccess.can_view]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) {
      return items;
    }

    const keyword = searchTerm.toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(keyword));
  }, [items, searchTerm]);

  const breadcrumbParts = useMemo(() => {
    if (!currentPath) {
      return [] as string[];
    }

    return currentPath.split('/').filter(Boolean);
  }, [currentPath]);

  

  const fetchPageAccess = async () => {
    try {
      const response = await axios.get('/api/containerimages/page-record-access');
      if (response.data.success) {
        setPageAccess({
          can_view: Boolean(response.data.can_view),
          module_edit: Boolean(response.data.module_edit),
          module_delete: Boolean(response.data.module_delete),
        });
      }
    } catch {
      error('Unable to load your access permissions');
    }
  };

  const fetchItems = async (path: string) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/containerimages/list', {
        params: { path },
      });

      if (response.data.success) {
        setItems(response.data.data.items || []);
        setCurrentPath(response.data.data.current_path || '');
        setPageAccess((prev) => ({
          ...prev,
          module_edit: Boolean(response.data.data.module_edit),
          module_delete: Boolean(response.data.data.module_delete),
          can_view: Boolean(response.data.data.can_view),
        }));
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to load explorer items');
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (path: string) => {
    fetchItems(path);
  };

  const openItem = (item: ExplorerItem) => {
    if (item.type === 'directory') {
      navigateTo(item.relative_path);
      return;
    }

    const fileUrl = `/api/containerimages/file?path=${encodeURIComponent(item.relative_path)}`;
    window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  const handleUploadClick = () => {
    if (!pageAccess.module_edit) {
      error('You do not have upload permission');
      return;
    }

    fileInputRef.current?.click();
  };

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('path', currentPath);

      Array.from(files).forEach((file) => {
        formData.append('files[]', file);
      });

      const response = await axios.post('/api/containerimages/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        success(`Uploaded ${response.data.uploaded?.length || files.length} file(s) successfully`);
        fetchItems(currentPath);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Upload failed');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      error('Please enter a folder name');
      return;
    }

    setCreatingFolder(true);
    try {
      const response = await axios.post('/api/containerimages/folders', {
        path: currentPath,
        folder_name: folderName,
      });

      if (response.data.success) {
        success('Folder created successfully');
        setFolderName('');
        setShowCreateFolderModal(false);
        fetchItems(currentPath);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const askDeleteItem = (item: ExplorerItem) => {
    setItemToDelete(item);
    setConfirmDelete(true);
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) {
      return;
    }

    try {
      const response = await axios.post('/api/containerimages/delete-item', {
        path: itemToDelete.relative_path,
        type: itemToDelete.type,
      });

      if (response.data.success) {
        success(`${itemToDelete.type === 'directory' ? 'Folder' : 'File'} deleted successfully`);
        setConfirmDelete(false);
        setItemToDelete(null);
        fetchItems(currentPath);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Delete failed');
    }
  };

  const formatFileSize = (size: number | null) => {
    if (!size || size <= 0) {
      return '-';
    }

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const columns = [
    {
      key: 'name',
      label: 'Item Name',
      render: (item: ExplorerItem) => (
        <div className="flex items-center gap-3">
          {item.type === 'directory' ? (
            <FolderOpen className="h-4 w-4" style={{ color: colors.status.warning }} />
          ) : (
            <ImageIcon className="h-4 w-4" style={{ color: colors.brand.primary }} />
          )}
          <button
            type="button"
            className="text-left underline-offset-2 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              openItem(item);
            }}
            style={{ color: colors.text.primary }}
          >
            {item.name}
          </button>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: '150px',
      render: (item: ExplorerItem) => (
        <ModernBadge variant={item.type === 'directory' ? 'warning' : item.is_image ? 'info' : 'default'}>
          {item.type === 'directory' ? 'Folder' : item.is_image ? 'Image' : 'File'}
        </ModernBadge>
      ),
    },
    {
      key: 'size',
      label: 'Size',
      width: '120px',
      render: (item: ExplorerItem) => formatFileSize(item.size),
    },
    {
      key: 'modified_at',
      label: 'Modified',
      width: '200px',
      render: (item: ExplorerItem) => item.modified_at || '-',
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '180px',
      render: (item: ExplorerItem) => (
        <div className="flex items-center gap-2">
          <ModernButton
            variant="secondary"
            size="sm"
            icon={<Eye className="h-4 w-4" />}
            onClick={(e) => {
              e.stopPropagation();
              openItem(item);
            }}
          >
            Open
          </ModernButton>

          {pageAccess.module_delete && (
            <ModernButton
              variant="delete"
              size="sm"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={(e) => {
                e.stopPropagation();
                askDeleteItem(item);
              }}
            >
              Delete
            </ModernButton>
          )}
        </div>
      ),
    },
  ];

  const canGoBack = breadcrumbParts.length > 0;

  return (
    <AuthenticatedLayout>
      <Head title="Container Images" />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
              <Images className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Container Images</h1>
              <p className="text-sm mt-1 text-gray-600">Explore and manage container images in the server</p>
            </div>
          </div>

          <div />
        </div>

        {!pageAccess.can_view ? (
          <ModernCard
            title="Access Restricted"
            subtitle="Your role does not have access to this page"
            icon={<Shield className="h-5 w-5" />}
          >
            <p style={{ color: colors.text.secondary }}>
              Ask an administrator to grant this page in pages_access.
            </p>
          </ModernCard>
        ) : (
          <>
              <ModernCard
              title="Explorer"
              subtitle="Folder navigation and file management"
              icon={<FolderOpen className="h-5 w-5" />}
              headerAction={
                <div className="flex items-center gap-2">
                  <ModernButton
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCw className="h-4 w-4" />}
                    onClick={() => fetchItems(currentPath)}
                  >
                    Refresh
                  </ModernButton>

                  {pageAccess.module_edit && (
                    <>
                      <ModernButton
                        variant="add"
                        size="sm"
                        icon={<Upload className="h-4 w-4" />}
                        onClick={handleUploadClick}
                        loading={uploading}
                      >
                        Upload
                      </ModernButton>

                      <ModernButton
                        variant="primary"
                        size="sm"
                        icon={<FolderPlus className="h-4 w-4" />}
                        onClick={() => setShowCreateFolderModal(true)}
                      >
                        Create Folder
                      </ModernButton>
                    </>
                  )}
                </div>
              }
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*"
                onChange={handleUploadChange}
              />

              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ModernButton
                      variant="secondary"
                      size="sm"
                      icon={<ArrowLeft className="h-4 w-4" />}
                      disabled={!canGoBack}
                      onClick={() => {
                        if (!canGoBack) {
                          return;
                        }
                        const nextPath = breadcrumbParts.slice(0, -1).join('/');
                        navigateTo(nextPath);
                      }}
                    >
                      Back
                    </ModernButton>

                    <button
                      type="button"
                      className="text-sm font-medium hover:underline"
                      style={{ color: colors.brand.primary }}
                      onClick={() => navigateTo('')}
                    >
                      Root
                    </button>

                    {breadcrumbParts.map((part, index) => {
                      const breadcrumbPath = breadcrumbParts.slice(0, index + 1).join('/');
                      return (
                        <div key={breadcrumbPath} className="flex items-center gap-2">
                          <span style={{ color: colors.text.secondary }}>/</span>
                          <button
                            type="button"
                            className="text-sm hover:underline"
                            style={{ color: colors.brand.primary }}
                            onClick={() => navigateTo(breadcrumbPath)}
                          >
                            {part}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Folder name input moved into modal */}

                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.text.secondary }} />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search files/folders"
                        className="pl-9 w-64"
                      />
                    </div>
                  </div>
                </div>

                <ModernTable
                  columns={columns}
                  data={filteredItems}
                  loading={loading}
                  emptyMessage="No files or folders found"
                  onRowClick={openItem}
                />
              </div>
            </ModernCard>
          </>
        )}
      </div>

      <Dialog open={showCreateFolderModal} onOpenChange={setShowCreateFolderModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>Enter a name for the new folder.</DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <Input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Folder name"
            />
          </div>

          <DialogFooter>
            <div className="flex items-center gap-2">
              <ModernButton variant="secondary" onClick={() => setShowCreateFolderModal(false)}>
                Cancel
              </ModernButton>

              <ModernButton variant="primary" onClick={handleCreateFolder} loading={creatingFolder}>
                Create
              </ModernButton>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModernConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={handleDeleteItem}
        title="Delete Item"
        description={`Delete ${itemToDelete?.type === 'directory' ? 'folder' : 'file'} "${itemToDelete?.name || ''}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </AuthenticatedLayout>
  );
}

import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ModernBadge, ModernButton, ModernCard, ModernConfirmDialog, ModernTable, ToastContainer, useModernToast } from '@/components/modern';
import { colors } from '@/lib/colors';
import { FolderPlus, FolderOpen, Image as ImageIcon, RefreshCw, Trash2, Upload, ArrowLeft, Search, Shield, Download, Edit, Images, List, Grid, MoreHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ImageViewerModal from '@/components/ImageViewerModal';

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
  const [downloadingPaths, setDownloadingPaths] = useState<string[]>([]);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ExplorerItem | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'large'>('list');
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);


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

  const displayItems = useMemo(() => {
    const foldersWithIndex: Array<{ item: ExplorerItem; index: number }> = [];
    const othersWithIndex: Array<{ item: ExplorerItem; index: number }> = [];

    filteredItems.forEach((item, index) => {
      if (item.type === 'directory') {
        foldersWithIndex.push({ item, index });
      } else {
        othersWithIndex.push({ item, index });
      }
    });

    const getModifiedTime = (value: string) => {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const sortedFolders = foldersWithIndex.sort((a, b) => {
      const timeDiff = getModifiedTime(b.item.modified_at) - getModifiedTime(a.item.modified_at);
      if (timeDiff !== 0) {
        return timeDiff;
      }

      return a.index - b.index;
    });

    return [...sortedFolders.map(({ item }) => item), ...othersWithIndex.map(({ item }) => item)];
  }, [filteredItems]);

  const breadcrumbParts = useMemo(() => {
    if (!currentPath) {
      return [] as string[];
    }

    return currentPath.split('/').filter(Boolean);
  }, [currentPath]);

  // Use all items in the current folder (not search-filtered) for the image carousel
  const imageItems = useMemo(() => items.filter((i) => i.is_image), [items]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedPaths.includes(item.relative_path)),
    [items, selectedPaths],
  );

  const displayedSelectedCount = displayItems.filter((item) => selectedPaths.includes(item.relative_path)).length;
  const allDisplayedSelected = displayItems.length > 0 && displayedSelectedCount === displayItems.length;
  const someDisplayedSelected = displayedSelectedCount > 0 && !allDisplayedSelected;
  const selectionCheckmark = (color: string) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='${color.replace('#', '%23')}' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m3 8 3 3 7-7'/%3E%3C/svg%3E")`;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someDisplayedSelected;
    }
  }, [someDisplayedSelected]);

  

  const fetchPageAccess = async () => {
    try {
      const response = await axios.get('/api/containerimages/page-record-access');
      if (response.data.success) {
        setPageAccess({
          can_view: Boolean(response.data.can_view),
          module_edit: Boolean(response.data.module_edit),
          module_delete: Number(response.data.module_delete) > 0,
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
        setSelectedPaths([]);
        setCurrentPath(response.data.data.current_path || '');
        setPageAccess((prev) => ({
          ...prev,
          module_edit: Boolean(response.data.data.module_edit),
          module_delete: Number(response.data.data.module_delete) > 0,
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

    if (item.is_image) {
      const images = items.filter((i) => i.is_image);
      const idx = images.findIndex((i) => i.relative_path === item.relative_path);
      setViewerIndex(idx >= 0 ? idx : 0);
      setImageViewerOpen(true);
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

  const handleDownload = async (item: ExplorerItem) => {
    // For directories, let the browser handle the download (avoids saving JSON errors as text)
    if (item.type === 'directory') {
      const href = `/api/containerimages/download?path=${encodeURIComponent(item.relative_path)}`;
      const a = document.createElement('a');
      a.href = href;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    setDownloadingPaths((prev) => [...prev, item.relative_path]);
    try {
      const response = await axios.get('/api/containerimages/download', {
        params: { path: item.relative_path },
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      success('Download started');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Download failed');
    } finally {
      setDownloadingPaths((prev) => prev.filter((p) => p !== item.relative_path));
    }
  };

  const toggleSelected = (path: string) => {
    setSelectedPaths((current) => current.includes(path)
      ? current.filter((selectedPath) => selectedPath !== path)
      : [...current, path]);
  };

  const toggleAllDisplayed = () => {
    const displayedPaths = displayItems.map((item) => item.relative_path);
    setSelectedPaths((current) => {
      if (allDisplayedSelected) {
        return current.filter((path) => !displayedPaths.includes(path));
      }

      return Array.from(new Set([...current, ...displayedPaths]));
    });
  };

  const handleBulkDownload = async () => {
    if (selectedItems.length === 0) return;

    setBulkDownloading(true);
    try {
      const response = await axios.post('/api/containerimages/download-bulk', {
        paths: selectedItems.map((item) => item.relative_path),
      }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'container-images.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      success(`Download started for ${selectedItems.length} selected item(s)`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Bulk download failed');
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;

    try {
      const response = await axios.post('/api/containerimages/delete-bulk', {
        paths: selectedItems.map((item) => item.relative_path),
      });
      if (response.data.success) {
        success(response.data.message || 'Selected items deleted successfully');
        setBulkDeleteConfirm(false);
        setSelectedPaths([]);
        fetchItems(currentPath);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Bulk delete failed');
    }
  };

  const openRenameModal = (item: ExplorerItem) => {
    setRenameTarget(item);
    setRenameName(item.name);
    setShowRenameModal(true);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    if (!renameName.trim()) {
      error('Please enter a name');
      return;
    }

    setRenaming(true);
    try {
      const response = await axios.post('/api/containerimages/rename', {
        path: renameTarget.relative_path,
        new_name: renameName,
      });

      if (response.data.success) {
        success('Renamed successfully');
        setShowRenameModal(false);
        setRenameTarget(null);
        setRenameName('');
        fetchItems(currentPath);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      error(e.response?.data?.message || 'Rename failed');
    } finally {
      setRenaming(false);
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
      key: 'selection',
      label: '',
      width: '110px',
      headerRender: () => (
        <div className="flex items-center gap-2 normal-case tracking-normal">
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            checked={allDisplayedSelected}
            onChange={toggleAllDisplayed}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select all displayed items"
            className="h-4 w-4 appearance-none rounded border border-gray-600 bg-gray-100 bg-center bg-no-repeat checked:bg-white"
            style={{
              backgroundColor: allDisplayedSelected || someDisplayedSelected ? '#ffffff' : '#f3f4f6',
              backgroundImage: allDisplayedSelected || someDisplayedSelected ? selectionCheckmark('#2563eb') : 'none',
            }}
          />
          <span className="text-xs font-semibold whitespace-nowrap">{displayedSelectedCount}/{displayItems.length}</span>
        </div>
      ),
      render: (item: ExplorerItem) => (
        <input
          type="checkbox"
          checked={selectedPaths.includes(item.relative_path)}
          onChange={() => toggleSelected(item.relative_path)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${item.name}`}
          className="h-4 w-4 appearance-none rounded border border-gray-600 bg-gray-100 bg-center bg-no-repeat checked:bg-blue-600"
          style={{
            backgroundImage: selectedPaths.includes(item.relative_path) ? selectionCheckmark('#ffffff') : 'none',
          }}
        />
      ),
    },
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
            icon={<Download className="h-4 w-4" />}
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(item);
            }}
            loading={downloadingPaths.includes(item.relative_path)}
          >
            Download
          </ModernButton>

          {pageAccess.module_edit && (
            <ModernButton
              variant="secondary"
              size="sm"
              icon={<Edit className="h-4 w-4" />}
              onClick={(e) => {
                e.stopPropagation();
                openRenameModal(item);
              }}
            >
              Rename
            </ModernButton>
          )}

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

                    <span className="text-sm whitespace-nowrap" style={{ color: colors.text.secondary }}>
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>

                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: colors.text.secondary }} />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search files/folders"
                        className="pl-9 w-64"
                      />
                    </div>
                    <div className="ml-3 flex items-center space-x-2">
                      <ModernButton
                        variant={viewMode === 'list' ? 'primary' : 'secondary'}
                        size="sm"
                        icon={<List className="h-4 w-4" />}
                        onClick={() => setViewMode('list')}
                        title="List"
                      />

                      <ModernButton
                        variant={viewMode === 'large' ? 'primary' : 'secondary'}
                        size="sm"
                        icon={<Grid className="h-4 w-4" />}
                        onClick={() => setViewMode('large')}
                        title="View Extra Large Icons"
                      />
                    </div>
                  </div>
                </div>

                {selectedItems.length > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border bg-blue-50 px-3 py-2" style={{ borderColor: colors.brand.primary }}>
                    <span className="mr-2 text-sm font-medium" style={{ color: colors.text.primary }}>
                      {selectedItems.length} selected
                    </span>
                    <ModernButton
                      variant="secondary"
                      size="sm"
                      icon={<Download className="h-4 w-4" />}
                      onClick={handleBulkDownload}
                      loading={bulkDownloading}
                    >
                      Download
                    </ModernButton>
                    {pageAccess.module_delete && (
                      <ModernButton
                        variant="delete"
                        size="sm"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => setBulkDeleteConfirm(true)}
                      >
                        Delete
                      </ModernButton>
                    )}
                  </div>
                )}

                {viewMode === 'list' ? (
                  <ModernTable
                    columns={columns}
                    data={displayItems}
                    loading={loading}
                    emptyMessage="No files or folders found"
                    onRowClick={openItem}
                    contentKey={`${displayedSelectedCount}-${displayItems.length}-${selectedItems.length}`}
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {displayItems.length === 0 ? (
                      <div className="col-span-full py-12 text-center" style={{ color: colors.text.secondary }}>
                        No files or folders found
                      </div>
                    ) : (
                      displayItems.map((item) => (
                      <div
                        key={item.relative_path}
                        className="relative flex flex-col items-center cursor-pointer p-2 hover:bg-gray-50 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          openItem(item);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPaths.includes(item.relative_path)}
                          onChange={() => toggleSelected(item.relative_path)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${item.name}`}
                          className="absolute left-3 top-3 z-10 h-4 w-4 appearance-none rounded border border-gray-600 bg-gray-100 bg-center bg-no-repeat checked:bg-blue-600"
                          style={{
                            backgroundImage: selectedPaths.includes(item.relative_path) ? selectionCheckmark('#ffffff') : 'none',
                          }}
                        />
                        <div className="w-36 h-36 flex items-center justify-center bg-gray-100 rounded overflow-hidden">
                          {item.is_image ? (
                            <img
                              src={`/api/containerimages/file?path=${encodeURIComponent(item.relative_path)}`}
                              alt={item.name}
                              className="object-cover w-full h-full"
                            />
                          ) : item.type === 'directory' ? (
                            <FolderOpen className="w-12 h-12" style={{ color: colors.status.warning }} />
                          ) : (
                            <ImageIcon className="w-12 h-12 text-gray-500" />
                          )}
                        </div>

                        <div className="mt-2 text-sm text-center truncate w-36" style={{ color: colors.text.primary }}>{item.name}</div>

                        <button
                          type="button"
                          className="absolute right-2 bottom-2 p-1 rounded bg-white shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenFor(menuOpenFor === item.relative_path ? null : item.relative_path);
                          }}
                        >
                          <MoreHorizontal className="w-4 h-4 text-gray-600" />
                        </button>

                        {menuOpenFor === item.relative_path && (
                          <div className="absolute right-2 bottom-10 bg-white border rounded shadow-md z-50">
                            <button
                              className="block px-3 py-2 text-left w-40 hover:bg-gray-100 text-black"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenFor(null);
                                handleDownload(item);
                              }}
                            >
                              Download
                            </button>

                            {pageAccess.module_edit && (
                              <button
                                className="block px-3 py-2 text-left w-40 hover:bg-gray-100 text-black"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenFor(null);
                                  openRenameModal(item);
                                }}
                              >
                                Rename
                              </button>
                            )}

                            {pageAccess.module_delete && (
                              <button
                                className="block px-3 py-2 text-left w-40 hover:bg-gray-100 text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenFor(null);
                                  askDeleteItem(item);
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      ))
                    )}
                  </div>
                )}
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

      <Dialog open={showRenameModal} onOpenChange={setShowRenameModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Item</DialogTitle>
            <DialogDescription>Enter a new name for the item.</DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="New name"
            />
          </div>

          <DialogFooter>
            <div className="flex items-center gap-2">
              <ModernButton variant="secondary" onClick={() => setShowRenameModal(false)}>
                Cancel
              </ModernButton>

              <ModernButton variant="primary" onClick={handleRename} loading={renaming}>
                Rename
              </ModernButton>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageViewerModal
        open={imageViewerOpen}
        onOpenChange={setImageViewerOpen}
        images={imageItems.map((image) => ({
          src: `/api/containerimages/file?path=${encodeURIComponent(image.relative_path)}`,
          name: image.name,
          key: image.relative_path,
        }))}
        currentIndex={viewerIndex}
        onIndexChange={setViewerIndex}
      />

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

      <ModernConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={setBulkDeleteConfirm}
        onConfirm={handleBulkDelete}
        title="Delete Selected Items"
        description={`Delete ${selectedItems.length} selected item(s)? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </AuthenticatedLayout>
  );
}

import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ModernBadge, ModernButton, ModernCard, ModernConfirmDialog, ModernTable, ToastContainer, useModernToast } from '@/components/modern';
import { colors } from '@/lib/colors';
import { FolderPlus, FolderOpen, Image as ImageIcon, RefreshCw, Trash2, Upload, ArrowLeft, Search, Shield, Download, Edit, Images, List, Grid, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [downloadingPaths, setDownloadingPaths] = useState<string[]>([]);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ExplorerItem | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'large'>('list');
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);


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

  const thumbContainerRef = useRef<HTMLDivElement | null>(null);

  // Use all items in the current folder (not search-filtered) for the image carousel
  const imageItems = useMemo(() => items.filter((i) => i.is_image), [items]);
  const currentImage = imageItems[viewerIndex] ?? null;

  // Keep viewerIndex in range when images change
  useEffect(() => {
    if (viewerIndex >= imageItems.length) {
      setViewerIndex(imageItems.length > 0 ? 0 : 0);
    }
  }, [imageItems, viewerIndex]);

  // Center the selected thumbnail in the carousel
  useEffect(() => {
    if (!thumbContainerRef.current) return;
    if (!imageItems || imageItems.length === 0) return;
    const container = thumbContainerRef.current;
    const el = container.querySelector(`[data-index="${viewerIndex}"]`) as HTMLElement | null;
    if (!el) return;
    // Delay centering slightly to ensure layout has settled, then center the thumbnail
    setTimeout(() => {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } catch (e) {
        const elLeft = el.offsetLeft;
        const elWidth = el.offsetWidth;
        const scrollTo = elLeft + elWidth / 2 - container.clientWidth / 2;
        container.scrollTo({ left: Math.max(0, scrollTo), behavior: 'smooth' });
      }
    }, 50);
  }, [viewerIndex, imageItems, imageViewerOpen]);

  // Support keyboard navigation in image viewer (same behavior as chevrons)
  useEffect(() => {
    if (!imageViewerOpen || imageItems.length === 0) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setViewerIndex((prev) => (prev - 1 + imageItems.length) % imageItems.length);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setViewerIndex((prev) => (prev + 1) % imageItems.length);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [imageViewerOpen, imageItems.length]);

  

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

                {viewMode === 'list' ? (
                  <ModernTable
                    columns={columns}
                    data={displayItems}
                    loading={loading}
                    emptyMessage="No files or folders found"
                    onRowClick={openItem}
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

      <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
        <DialogContent className="max-w-6xl w-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-4 w-full max-h-[85vh] overflow-hidden">
            <div
              className="w-full max-w-[1100px] aspect-[4/3] flex items-center justify-center relative overflow-hidden rounded-md bg-black/5"
              onClick={(e) => {
                // Click left/right 30%/70% to go prev/next
                const images = imageItems;
                if (images.length === 0) return;
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const x = (e as React.MouseEvent).clientX - rect.left;
                const w = rect.width;
                if (x < w * 0.3) {
                  setViewerIndex((prev) => (prev - 1 + images.length) % images.length);
                } else if (x > w * 0.7) {
                  setViewerIndex((prev) => (prev + 1) % images.length);
                }
              }}
            >
              {currentImage && (
                <div className="flex flex-col items-center w-full h-full">
                  <div className="mb-2 text-center font-medium" style={{ color: colors.text.primary }}>
                    {currentImage.name}
                  </div>
                  <img
                    src={`/api/containerimages/file?path=${encodeURIComponent(currentImage.relative_path)}`}
                    alt={currentImage.name}
                    className="w-full h-full object-contain mx-auto"
                    style={{ display: 'block' }}
                  />
                </div>
              )}

              {/* Left/Right overlay icons centered vertically */}
              {imageItems.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setViewerIndex((prev) => (prev - 1 + imageItems.length) % imageItems.length);
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="w-5 h-5 text-black" />
                  </button>

                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setViewerIndex((prev) => (prev + 1) % imageItems.length);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow"
                    aria-label="Next"
                  >
                    <ChevronRight className="w-5 h-5 text-black" />
                  </button>
                </>
              )}
            </div>

            <div className="w-full">
              <div ref={thumbContainerRef} className="flex items-center justify-start gap-2 overflow-x-auto py-2 px-4">
                {imageItems.map((imgItem, idx) => (
                  <button
                    key={imgItem.relative_path}
                    data-index={idx}
                    onClick={() => setViewerIndex(idx)}
                    className={`flex-none p-1 rounded ${idx === viewerIndex ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                  >
                    <img
                      src={`/api/containerimages/file?path=${encodeURIComponent(imgItem.relative_path)}`}
                      alt={imgItem.name}
                      className="w-24 h-24 object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
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

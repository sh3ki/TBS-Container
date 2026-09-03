import React, { useState, useEffect, useRef } from 'react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { ModernButton, ModernTable, ModernBadge, ModernCard, ToastContainer, useModernToast } from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ModernConfirmDialog } from '@/components/modern';
import { Textarea } from '@/components/ui/textarea';
import { Package, FileText, Download, CheckCircle, Lock, Unlock, Truck, Eye, Pencil, Trash2, ChevronLeft, ChevronRight, Search, Printer, Filter } from 'lucide-react';
import { colors } from '@/lib/colors';

interface Client {
    id: string;
    c_id: number;
    code: string;
    name: string;
    text: string;
}

interface InventoryRecord {
    i_id: number;
    hashed_id?: string;
    eir_no: string;
    container_no: string;
    client: string;
    client_code: string;
    client_id?: string;
    size: string;
    size_type_id?: number;
    iso_code?: string;
    gate: string;
    date: string;
    time: string;
    days: number;
    status: string;
    status_id?: string;
    class: string;
    dmf: string;
    location: string;
    eir_notes: string;
    app_notes: string;
    approval_date?: string;
    is_hold?: boolean;
    container_status_id?: number;
    vessel?: string;
    voyage?: string;
    checker?: string;
    ex_consignee?: string;
    load?: string;
    load_id?: string;
    plate_no?: string;
    hauler?: string;
    hauler_driver?: string;
    license_no?: string;
    chasis?: string;
    contact_no?: string;
    bill_of_lading?: string;
    hold_notes?: string;
    hold_date?: string;
    [key: string]: unknown;
}

interface ViewerImage {
    src: string;
    name: string;
    relativePath?: string;
}

const Index: React.FC = () => {
    const { toasts, removeToast, success, error } = useModernToast();
    
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [sizeTypes, setSizeTypes] = useState<{ value: string; label: string }[]>([]);
    const [statusesIn, setStatusesIn] = useState<string[]>([]);
    const [statusesOut, setStatusesOut] = useState<string[]>([]);
    const [reportData, setReportData] = useState<InventoryRecord[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState(1);
    // Request a very large page size so the table shows all rows by default
    const [itemsPerPage, setItemsPerPage] = useState<number>(999999);

    // Summary report data
    const [summaryData, setSummaryData] = useState<{
        by_client: Record<string, Record<string, number>>;
        size_types: string[];
    } | null>(null);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    // Approval modal states
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<InventoryRecord | null>(null);
    const [approvalNotes, setApprovalNotes] = useState('');

    // Hold modal states
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [holdNotes, setHoldNotes] = useState('');
    const [holdingRecord, setHoldingRecord] = useState(false);

    // Repo/Available action state
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // View modal state
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewRecord, setViewRecord] = useState<InventoryRecord | null>(null);
    // Images for view modal
    const [containerImages, setContainerImages] = useState<ViewerImage[]>([]);
    const [showImageViewer, setShowImageViewer] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    // Show/hide Back to Top button
    const [showBackToTop, setShowBackToTop] = useState(false);
    const thumbContainerRef = useRef<HTMLDivElement | null>(null);

    // Confirmation dialog states
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    const [showHoldConfirm, setShowHoldConfirm] = useState(false);
    const [showUnholdConfirm, setShowUnholdConfirm] = useState(false);
    const [showRepoToggleConfirm, setShowRepoToggleConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showEditConfirm, setShowEditConfirm] = useState(false);
    const [showExportConfirm, setShowExportConfirm] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<InventoryRecord | null>(null);
    const [recordForAction, setRecordForAction] = useState<InventoryRecord | null>(null);

    // Edit modal states
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState<InventoryRecord | null>(null);

    // Dropdown options for edit modal
    const [statusOptions, setStatusOptions] = useState<Array<{ s_id: number; status: string }>>([]);
    const [sizeTypeOptions, setSizeTypeOptions] = useState<Array<{ s_id: number; size: string; type: string }>>([]);
    const [loadOptions, setLoadOptions] = useState<Array<{ l_id: number; type: string }>>([]);

    // Filter modal state
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    
    // Search state
    const [searchTerm, setSearchTerm] = useState('');
    const isFirstSearchEffect = useRef(true);

    const defaultFilters = {
        client: 'all',
        iso_code: '',
        container_no: '',
        date_out_from: '',
        date_in_from: '',
        date_out_to: '',
        date_in_to: '',
        hauler_out: '',
        checker: '',
        vessel_out: '',
        consignee: '',
        shipper: '',
        hauler_in: '',
        destination: '',
        vessel_in: '',
        booking_number: '',
        plate_no_in: '',
        seal_no: '',
        status_in: 'all',
        contact_no: '',
        size_type: 'all',
        bill_of_lading: '',
        status_out: 'all',
        gate_status: 'CURRENTLY',
    };

    // Filter states
    const [filters, setFilters] = useState(defaultFilters);

    useEffect(() => {
        loadDropdownData();
        loadAllInventory();
        fetchDropdownOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (isFirstSearchEffect.current) {
            isFirstSearchEffect.current = false;
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setCurrentPage(1);
            void fetchInventory({ page: 1, perPage: itemsPerPage, search: searchTerm, showToast: false });
        }, 450);

        return () => window.clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    const currentImage = containerImages[currentImageIndex] ?? null;
    const viewerFrameWidth = 'min(92vw, calc((94vh - 220px) * 4 / 3))';

    useEffect(() => {
        if (currentImageIndex >= containerImages.length) {
            setCurrentImageIndex(containerImages.length > 0 ? 0 : 0);
        }
    }, [containerImages, currentImageIndex]);

    useEffect(() => {
        if (!thumbContainerRef.current) return;
        if (!containerImages || containerImages.length === 0) return;
        const container = thumbContainerRef.current;
        const el = container.querySelector(`[data-index="${currentImageIndex}"]`) as HTMLElement | null;
        if (!el) return;

        setTimeout(() => {
            try {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } catch {
                const elLeft = el.offsetLeft;
                const elWidth = el.offsetWidth;
                const scrollTo = elLeft + elWidth / 2 - container.clientWidth / 2;
                container.scrollTo({ left: Math.max(0, scrollTo), behavior: 'smooth' });
            }
        }, 50);
    }, [currentImageIndex, containerImages, showImageViewer]);

    useEffect(() => {
        if (!showImageViewer || containerImages.length === 0) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                setCurrentImageIndex((prev) => (prev - 1 + containerImages.length) % containerImages.length);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                setCurrentImageIndex((prev) => (prev + 1) % containerImages.length);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showImageViewer, containerImages.length]);

    // Back to Top button visibility based on scroll position
    useEffect(() => {
        const onScroll = () => {
            try {
                setShowBackToTop(window.scrollY > 200);
            } catch {
                // ignore (server-side or other envs)
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('scroll', onScroll);
            }
        };
    }, []);

    const fetchDropdownOptions = async () => {
        try {
            const [statusRes, sizeTypeRes, loadRes] = await Promise.all([
                axios.get('/api/gateinout/status-options'),
                axios.get('/api/gateinout/sizetype-options'),
                axios.get('/api/gateinout/load-options'),
            ]);

            if (statusRes.data.success) {
                setStatusOptions(statusRes.data.data);
            }
            if (sizeTypeRes.data.success) {
                setSizeTypeOptions(sizeTypeRes.data.data);
            }
            if (loadRes.data.success) {
                setLoadOptions(loadRes.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch dropdown options:', err);
        }
    };

    const loadDropdownData = async () => {
        try {
            // Load clients
            const clientsResponse = await axios.get('/api/reports/clients');
            if (clientsResponse.data.success) {
                setClients(clientsResponse.data.data);
            }

            // Load size types (combined)
            const sizeTypesResponse = await axios.get('/api/inventory/size-types');
            if (sizeTypesResponse.data.success) {
                const combined = sizeTypesResponse.data.data.map((st: { size: string; type: string }) => ({
                    value: `${st.size}${st.type}`,
                    label: `${st.size}${st.type}`
                }));
                setSizeTypes(combined);
            }

            // Load statuses
            const statusesResponse = await axios.get('/api/inventory/statuses');
            if (statusesResponse.data.success) {
                setStatusesIn(statusesResponse.data.statuses || []);
                setStatusesOut(statusesResponse.data.statuses || []);
            }
        } catch (err) {
            console.error('Failed to load dropdown data:', err);
        }
    };

    const fetchInventory = async ({
        page = 1,
        perPage = itemsPerPage,
        search = searchTerm,
        showToast = false,
        includeSummary = false,
    }: {
        page?: number;
        perPage?: number;
        search?: string;
        showToast?: boolean;
        includeSummary?: boolean;
    } = {}) => {
        setLoading(true);
        try {
            const payload = {
                ...buildFilterPayload(),
                gate_status: (filters.gate_status || 'CURRENTLY') as string,
                page,
                per_page: perPage,
                search: search?.trim() || '',
                include_summary: includeSummary,
            };

            const response = await axios.post('/api/inventory/search', payload);
            
            if (response.data.success) {
                setReportData(response.data.data || []);
                setTotalCount(Number(response.data.total || 0));
                if (includeSummary) {
                    setSummaryData(response.data.summary || null);
                } else {
                    setSummaryData(null);
                }
                if (showToast) {
                    success(`Found ${(response.data.total ?? response.data.data?.length ?? 0).toLocaleString()} records`);
                }
            } else {
                error(response.data.message || 'Failed to load inventory data');
                setReportData([]);
                setSummaryData(null);
                setTotalCount(0);
            }
        } catch (err: unknown) {
            const errorCaught = err as { response?: { data?: { message?: string } } };
            error(errorCaught.response?.data?.message || 'Failed to load inventory data');
            setReportData([]);
            setSummaryData(null);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    const fetchSummaryData = async () => {
        await fetchInventory({
            page: 1,
            perPage: 1,
            search: searchTerm,
            includeSummary: true,
            showToast: false,
        });
    };

    const loadAllInventory = async () => {
        await fetchInventory({ page: 1, perPage: itemsPerPage, search: '', showToast: false });
    };

    const handleFilterChange = (field: string, value: string | boolean) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const buildFilterPayload = () => {
        const payload: Record<string, unknown> = {};

        Object.entries(filters).forEach(([key, value]) => {
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed && trimmed.toLowerCase() !== 'all') {
                    payload[key] = trimmed;
                }
            }
        });

        return payload;
    };

    const filteredReportData = reportData;

    // Format date to "Jan 01, 2025"
    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    // Format date to "Jan 2002" (month and year only)
    const formatMonthYear = (dateString?: string) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString || '-';
            return date.toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateString || '-';
        }
    };

    // Format time to "11:00:01 AM"
    const formatTime = (timeString: string) => {
        if (!timeString) return '-';
        try {
            // If timeString is already in HH:MM:SS format, convert to 12-hour format
            const timeParts = timeString.split(':');
            if (timeParts.length >= 2) {
                const hours = parseInt(timeParts[0]);
                const minutes = timeParts[1];
                const seconds = timeParts[2] || '00';
                const ampm = hours >= 12 ? 'PM' : 'AM';
                const hour12 = hours % 12 || 12;
                return `${hour12}:${minutes}:${seconds} ${ampm}`;
            }
            return timeString;
        } catch {
            return timeString;
        }
    };

    // Format duration between gate-in datetime and now as "Xd Yh Zm"
    const formatDurationFrom = (dateString?: string, timeString?: string, fallback?: number) => {
        try {
            if (!dateString) return fallback !== undefined ? `${fallback} days` : '-';

            let inDate: Date | null = null;

            // Try ISO-style combine if time available
            if (timeString && timeString.includes(':')) {
                // Prefer ISO combined
                const iso = `${dateString}T${timeString}`;
                inDate = new Date(iso);
                if (isNaN(inDate.getTime())) {
                    // fallback to parsing separate
                    inDate = new Date(`${dateString} ${timeString}`);
                }
            } else {
                inDate = new Date(dateString);
            }

            if (!inDate || isNaN(inDate.getTime())) return fallback !== undefined ? `${fallback} days` : '-';

            const now = new Date();
            let diffMs = now.getTime() - inDate.getTime();
            if (diffMs < 0) diffMs = 0;

            const minutesTotal = Math.floor(diffMs / 60000);
            const days = Math.floor(minutesTotal / (60 * 24));
            const hours = Math.floor((minutesTotal - days * 24 * 60) / 60);
            const minutes = minutesTotal - days * 24 * 60 - hours * 60;

            return `${days}d ${hours}h ${minutes}m`;
        } catch {
            return fallback !== undefined ? `${fallback} days` : '-';
        }
    };

    // Compact duration for table display: "12d 10h 24m", "14h 23m", "12m"
    const formatDurationCompactFrom = (dateString?: string, timeString?: string, fallback?: number) => {
        try {
            if (!dateString) return fallback !== undefined ? `${fallback}d` : '-';

            let inDate: Date | null = null;

            if (timeString && timeString.includes(':')) {
                const iso = `${dateString}T${timeString}`;
                inDate = new Date(iso);
                if (isNaN(inDate.getTime())) {
                    inDate = new Date(`${dateString} ${timeString}`);
                }
            } else {
                inDate = new Date(dateString);
            }

            if (!inDate || isNaN(inDate.getTime())) return fallback !== undefined ? `${fallback}d` : '-';

            const now = new Date();
            let diffMs = now.getTime() - inDate.getTime();
            if (diffMs < 0) diffMs = 0;

            const minutesTotal = Math.floor(diffMs / 60000);
            const days = Math.floor(minutesTotal / (60 * 24));
            const hours = Math.floor((minutesTotal - days * 24 * 60) / 60);
            const minutes = minutesTotal - days * 24 * 60 - hours * 60;

            if (days > 0) return `${days}d ${hours}h ${minutes}m`;
            if (hours > 0) return `${hours}h ${minutes}m`;
            return `${minutes}m`;
        } catch {
            return fallback !== undefined ? `${fallback}d` : '-';
        }
    };

    const getImageNameFromUrl = (imageUrl: string) => {
        try {
            const url = new URL(imageUrl, window.location.origin);
            const rawPath = url.searchParams.get('path') || imageUrl;
            const decodedPath = decodeURIComponent(rawPath);
            const segments = decodedPath.split('/').filter(Boolean);
            return segments[segments.length - 1] || `Image ${containerImages.length + 1}`;
        } catch {
            const decoded = decodeURIComponent(imageUrl);
            const segments = decoded.split('/').filter(Boolean);
            return segments[segments.length - 1] || `Image ${containerImages.length + 1}`;
        }
    };

    const normalizeViewerImages = (images: unknown[]): ViewerImage[] => {
        return images
            .map((image) => {
                if (typeof image === 'string') {
                    return {
                        src: image,
                        name: getImageNameFromUrl(image),
                    };
                }

                if (image && typeof image === 'object') {
                    const record = image as Record<string, unknown>;
                    const srcValue =
                        (typeof record.url === 'string' && record.url) ||
                        (typeof record.src === 'string' && record.src) ||
                        (typeof record.image_url === 'string' && record.image_url) ||
                        (typeof record.path === 'string' && record.path) ||
                        (typeof record.relative_path === 'string' && `/api/inventory/images/file?path=${encodeURIComponent(record.relative_path)}`) ||
                        '';

                    if (!srcValue) {
                        return null;
                    }

                    const nameValue =
                        (typeof record.name === 'string' && record.name) ||
                        (typeof record.filename === 'string' && record.filename) ||
                        (typeof record.original_name === 'string' && record.original_name) ||
                        getImageNameFromUrl(srcValue);

                    return {
                        src: srcValue,
                        name: nameValue,
                        relativePath: typeof record.relative_path === 'string' ? record.relative_path : undefined,
                    };
                }

                return null;
            })
            .filter((item): item is ViewerImage => item !== null)
            .map((item, index) => ({
                ...item,
                name: item.name || `Image ${index + 1}`,
            }));
    };

    // Fetch container images using the containerimages API used by the explorer
    const fetchContainerImages = async (dateString?: string, gateStatus?: string, containerNo?: string) => {
        setContainerImages([]);
        if (!dateString || !containerNo) return;

        try {
            const res = await axios.get('/api/inventory/images', {
                params: {
                    date: dateString,
                    gate_status: gateStatus || 'IN',
                    container_no: containerNo,
                },
            });

            if (res.data && res.data.success && Array.isArray(res.data.data)) {
                const normalized = normalizeViewerImages(res.data.data);
                if (normalized.length > 0) {
                    setContainerImages(normalized);
                }
            }
        } catch (err) {
            // ignore and leave images empty
            console.debug('fetchContainerImages error', err);
            setContainerImages([]);
        }
    };

    const handleOpenApprovalModal = (record: InventoryRecord) => {
        setSelectedRecord(record);
        setApprovalNotes('');
        setShowApprovalModal(true);
    };

    const handleSubmitApprovalNotes = () => {
        if (!approvalNotes.trim()) {
            error('Please enter approval notes');
            return;
        }
        if (approvalNotes.length > 300) {
            error('Approval notes cannot exceed 300 characters');
            return;
        }
        setShowApprovalModal(false);
        setShowApproveConfirm(true);
    };

    const handleApproveContainer = async () => {
        if (!selectedRecord || !approvalNotes.trim()) {
            error('Please enter approval notes');
            return;
        }

        try {
            const response = await axios.post(`/api/inventory/${selectedRecord.i_id}/approve`, {
                approval_notes: approvalNotes.trim()
            });

            if (response.data.success) {
                success('Container approved successfully!');
                setShowApproveConfirm(false);
                setSelectedRecord(null);
                setApprovalNotes('');
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to approve container');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to approve container');
        }
    };

    const handleOpenHoldModal = (record: InventoryRecord) => {
        setSelectedRecord(record);
        setHoldNotes('');
        setShowHoldConfirm(true);
    };

    const handleConfirmHold = () => {
        setShowHoldConfirm(false);
        setShowHoldModal(true);
    };

    const handleHoldContainer = async () => {
        if (!selectedRecord || !holdNotes.trim()) {
            error('Please enter hold notes');
            return;
        }

        setHoldingRecord(true);
        try {
            const response = await axios.post(`/api/inventory/${selectedRecord.i_id}/hold`, {
                notes: holdNotes.trim()
            });

            if (response.data.success) {
                success('Container placed on hold successfully!');
                setShowHoldModal(false);
                setSelectedRecord(null);
                setHoldNotes('');
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to hold container');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to hold container');
        } finally {
            setHoldingRecord(false);
        }
    };

    const handleOpenUnholdConfirm = (record: InventoryRecord) => {
        setRecordForAction(record);
        setShowUnholdConfirm(true);
    };

    const handleUnholdContainer = async () => {
        if (!recordForAction) return;

        setUpdatingStatus(true);
        try {
            const response = await axios.post(`/api/inventory/${recordForAction.i_id}/unhold`);

            if (response.data.success) {
                success('Container removed from hold successfully!');
                setShowUnholdConfirm(false);
                setRecordForAction(null);
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to unhold container');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to unhold container');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleOpenRepoToggleConfirm = (record: InventoryRecord) => {
        setRecordForAction(record);
        setShowRepoToggleConfirm(true);
    };

    const handleToggleRepoStatus = async () => {
        if (!recordForAction) return;

        const isRepo = recordForAction.container_status_id === 8;
        const action = isRepo ? 'Available' : 'Repo';

        setUpdatingStatus(true);
        try {
            const response = await axios.post(`/api/inventory/${recordForAction.i_id}/toggle-repo`);

            if (response.data.success) {
                success(`Container updated to ${action} successfully!`);
                setShowRepoToggleConfirm(false);
                setRecordForAction(null);
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to update container status');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to update container status');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleViewRecord = async (record: InventoryRecord) => {
        if (!record.i_id) {
            error('Invalid record identifier');
            return;
        }

        try {
            // Use hashed_id if available, otherwise use i_id directly
            const identifier = record.hashed_id || record.i_id;
            const response = await axios.get(`/api/inventory/${identifier}`);
            
            if (response.data.success) {
                const data = response.data.data;
                // Map API response to InventoryRecord format
                const mappedRecord: InventoryRecord = {
                    i_id: data.i_id,
                    hashed_id: data.hashed_id,
                    eir_no: data.i_id?.toString() || '',
                    container_no: data.container_no,
                    client: data.client_name || '',
                    client_code: data.client_code || '',
                    client_id: data.client_id?.toString(),
                    size: data.container_size || '',
                    size_type_id: data.size_type_id,
                    iso_code: data.iso_code,
                    gate: data.gate_status,
                    date: data.date_in,
                    time: data.time_in,
                    days: data.days_in_yard,
                    status: data.container_status || '',
                    status_id: data.container_status_id,
                    class: data.condition || '',
                    dmf: data.date_manufactured || '',
                    location: data.location || '',
                    eir_notes: data.remarks || '',
                    app_notes: data.approval_notes || '',
                    approval_date: data.approval_date,
                    is_hold: data.is_hold,
                    container_status_id: data.container_status_id,
                    vessel: data.vessel,
                    voyage: data.voyage,
                    checker: data.origin,
                    ex_consignee: data.ex_consignee,
                    load: data.load_type,
                    load_id: data.load_type_id,
                    plate_no: data.plate_no,
                    hauler: data.hauler,
                    hauler_driver: data.hauler_driver,
                    license_no: data.license_no,
                    chasis: data.chasis,
                    contact_no: data.contact_no,
                    bill_of_lading: data.bill_of_lading,
                    hold_notes: data.hold_details && data.hold_details.notes ? data.hold_details.notes : undefined,
                    hold_date: data.hold_details && data.hold_details.date_added ? data.hold_details.date_added : undefined,
                };
                setViewRecord(mappedRecord);
                // If API already provided images, use them. Otherwise fall back to containerimages list API.
                if (response.data.data.images && Array.isArray(response.data.data.images) && response.data.data.images.length > 0) {
                    setContainerImages(normalizeViewerImages(response.data.data.images));
                } else {
                    await fetchContainerImages(mappedRecord.date as string, mappedRecord.gate as string, mappedRecord.container_no);
                }
                setCurrentImageIndex(0);
                setShowViewModal(true);
            } else {
                error(response.data.message || 'Failed to load container details');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to load container details');
        }
    };

    const handleOpenEditModal = async (record: InventoryRecord) => {
        if (!record.i_id) {
            error('Invalid record identifier');
            return;
        }

        try {
            // Use hashed_id if available, otherwise use i_id directly
            const identifier = record.hashed_id || record.i_id;
            const response = await axios.get(`/api/inventory/${identifier}`);
            
            if (response.data.success) {
                const data = response.data.data;
                // Map API response to InventoryRecord format
                const mappedRecord: InventoryRecord = {
                    i_id: data.i_id,
                    hashed_id: data.hashed_id,
                    eir_no: data.i_id?.toString() || '',
                    container_no: data.container_no,
                    client: data.client_name || '',
                    client_code: data.client_code || '',
                    client_id: data.client_id?.toString(),
                    size: data.container_size || '',
                    size_type_id: data.size_type_id,
                    iso_code: data.iso_code,
                    gate: data.gate_status,
                    date: data.date_in,
                    time: data.time_in,
                    days: data.days_in_yard,
                    status: data.container_status || '',
                    status_id: data.container_status_id,
                    class: data.condition || '',
                    dmf: data.date_manufactured || '',
                    location: data.location || '',
                    eir_notes: data.remarks || '',
                    app_notes: data.approval_notes || '',
                    approval_date: data.approval_date,
                    is_hold: data.is_hold,
                    container_status_id: data.container_status_id,
                    vessel: data.vessel,
                    voyage: data.voyage,
                    checker: data.origin,
                    ex_consignee: data.ex_consignee,
                    load: data.load_type,
                    load_id: data.load_type_id,
                    plate_no: data.plate_no,
                    hauler: data.hauler,
                    hauler_driver: data.hauler_driver,
                    license_no: data.license_no,
                    chasis: data.chasis,
                    contact_no: data.contact_no,
                    bill_of_lading: data.bill_of_lading,
                };
                setEditFormData(mappedRecord);
                setShowEditModal(true);
            } else {
                error(response.data.message || 'Failed to load container details');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to load container details');
        }
    };

    const handleSubmitEdit = () => {
        setShowEditModal(false);
        setShowEditConfirm(true);
    };

    const handleConfirmEdit = async () => {
        if (!editFormData) return;
        
        setLoading(true);
        try {
            const identifier = editFormData.hashed_id || editFormData.i_id;
            
            // Prepare update payload
            const payload: Record<string, unknown> = {
                container_no: editFormData.container_no,
                client_id: editFormData.client_id,
                size_type: editFormData.size_type_id,
                container_status: editFormData.status_id,
                class: editFormData.class,
                vessel: editFormData.vessel,
                voyage: editFormData.voyage,
                location: editFormData.location,
                remarks: editFormData.eir_notes,
                plate_no: editFormData.plate_no,
                hauler: editFormData.hauler,
                iso_code: editFormData.iso_code,
                origin: editFormData.checker,
                ex_consignee: editFormData.ex_consignee,
                hauler_driver: editFormData.hauler_driver,
                license_no: editFormData.license_no,
                chasis: editFormData.chasis,
                seal_no: editFormData.seal_no,
                date_manufactured: editFormData.dmf,
                contact_no: editFormData.contact_no,
                bill_of_lading: editFormData.bill_of_lading,
            };

            const response = await axios.put(`/api/inventory/${identifier}`, payload);

            if (response.data.success) {
                success('Container updated successfully!');
                setShowEditConfirm(false);
                setEditFormData(null);
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to update container');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to update container');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRecord = async () => {
        if (!recordToDelete) return;

        try {
            const identifier = recordToDelete.hashed_id || recordToDelete.i_id;
            const response = await axios.delete(`/api/inventory/${identifier}`);

            if (response.data.success) {
                success('Container deleted successfully!');
                setShowDeleteConfirm(false);
                setRecordToDelete(null);
                await loadAllInventory();
            } else {
                error(response.data.message || 'Failed to delete container');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to delete container');
        }
    };

    

    const openLegacyPrintSingle = (row: InventoryRecord) => {
        const idForPrint = row.hashed_id || row.i_id;
        const status = row.gate_status || row.gate || 'IN';
        window.open(`/api/inventory/print/${idForPrint}?status=${status}`, '_blank', 'width=1280,height=800');
    };

    const openLegacyPrintInOut = (row: InventoryRecord) => {
        const idForPrint = row.hashed_id || row.i_id;
        const status = row.gate_status || row.gate || 'IN';
        window.open(`/api/inventory/print-inout?id=${idForPrint}&s=${status}`, '_blank', 'width=1280,height=900');
    };

    const handleSearch = async () => {
        setCurrentPage(1);
        await fetchInventory({ page: 1, perPage: itemsPerPage, search: searchTerm, showToast: true });
    };

    const handleApplyFilters = async () => {
        await handleSearch();
        setShowFiltersModal(false);
    };

    const handleResetFilters = () => {
        setFilters(defaultFilters);
        setCurrentPage(1);
        void fetchInventory({ page: 1, perPage: itemsPerPage, search: searchTerm, showToast: false });
    };

    const handleOpenExportConfirm = () => {
        setShowExportConfirm(true);
    };

    const handleExport = async () => {
        setShowExportConfirm(false);
        setLoading(true);

        try {
            const payload = {
                ...buildFilterPayload(),
                search: searchTerm.trim(),
            };
            const response = await axios.post('/api/inventory/export', payload, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
            const link = document.createElement('a');
            link.href = url;
            const filename = `Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            success('Inventory exported successfully');
            // Note: Not refreshing table data after export
        } catch (error_caught: unknown) {
            const err = error_caught as { response?: { data?: { message?: string } } };
            error(err.response?.data?.message || 'Failed to export inventory');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Inventory" />
            <div className="space-y-6 overflow-hidden">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                            <Package className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold" style={{ color: colors.text.primary }}>
                                Inventory
                            </h1>
                            <p className="text-sm mt-1" style={{ color: colors.text.secondary }}>
                                Search and manage container inventory
                            </p>
                        </div>
                    </div>
                    
                    {/* Summary and Export Buttons */}
                    <div className="flex items-center gap-3">
                        <ModernButton 
                            variant="edit" 
                            onClick={async () => {
                                if (reportData.length === 0) {
                                    error('Please generate a report first to view the summary');
                                    return;
                                }
                                if (!summaryData) {
                                    await fetchSummaryData();
                                }
                                setShowSummaryModal(true);
                            }} 
                            disabled={loading}
                            className="px-6 py-3"
                        >
                            <Eye className="w-5 h-5" />
                            View Summary Report
                        </ModernButton>
                        <ModernButton 
                            variant="add" 
                            onClick={handleOpenExportConfirm} 
                            disabled={loading || reportData.length === 0}
                            className="px-6 py-3"
                        >
                            <Download className="w-5 h-5" />
                            Export
                        </ModernButton>
                    </div>
                </div>

                {/* SEARCH & FILTER CARD */}
                <div className="relative" style={{ zIndex: 0 }}>
                    <ModernCard
                        title="Search & Filter Inventory"
                        subtitle="Find containers quickly"
                        icon={<Search className="w-5 h-5" />}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-3">
                                <Label className="text-sm font-semibold mb-2 text-gray-900">Search Containers</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                    <Input
                                        type="text"
                                        placeholder="Search by container number, EIR, or client..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="pl-10 h-11"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-1">
                                <Label className="text-sm font-semibold mb-2 text-gray-900">Filter Options</Label>
                                <button
                                    type="button"
                                    onClick={() => setShowFiltersModal(true)}
                                    className="flex items-center gap-2 h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs"
                                    disabled={loading}
                                >
                                    <Filter className="w-4 h-4 text-gray-600" />
                                    <span>Filters</span>
                                    {Object.entries(filters).some(([key, value]) => {
                                        if (typeof value !== 'string') return false;
                                        return value.trim() !== '' && value.trim().toLowerCase() !== 'all' && !(key === 'gate_status' && value === 'CURRENTLY');
                                    }) && (
                                        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs px-2 py-0.5">
                                            Active
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <p className="text-sm text-gray-600">
                                <span className="font-semibold text-gray-900">{totalCount.toLocaleString()}</span> container{totalCount !== 1 ? 's' : ''} found
                            </p>
                        </div>
                    </ModernCard>
                </div>

                {/* Results Table */}
                <div className="w-full max-w-full overflow-x-auto">
                    {loading ? (
                        <div className="text-center py-12">
                            <p style={{ color: colors.text.secondary }}>Loading inventory...</p>
                        </div>
                    ) : filteredReportData.length > 0 ? (
                        <ModernTable
                            columns={[
                                { 
                                    key: 'eir_no', 
                                    label: 'EIR No.',
                                    render: (row: InventoryRecord) => (
                                        <div 
                                            className="font-semibold text-gray-900 min-w-[40px] pointer-events-none"
                                        >
                                            {row.eir_no}
                                        </div>
                                    )
                                },
                                { 
                                    key: 'container_no', 
                                    label: 'Cont. No.',
                                    render: (row: InventoryRecord) => (
                                        <div 
                                            className="font-medium text-gray-900 min-w-[110px] pointer-events-none"
                                        >
                                            {row.container_no}
                                        </div>
                                    )
                                },
                                { 
                                    key: 'client', 
                                    label: 'Client',
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-900 min-w-[120px] max-w-[150px]">
                                            <div className="font-medium">{row.client}</div>
                                            <div className="text-xs text-gray-500">{row.client_code}</div>
                                        </div>
                                    )
                                },
                                {
                                    key: 'info',
                                    label: 'Size / Status / Class',
                                    render: (row: InventoryRecord) => {
                                        // size variant
                                        let sizeVariant: 'success' | 'error' | 'warning' | 'info' | 'default' = 'default';
                                        const size = row.size;
                                        if (size === '10DJH') sizeVariant = 'success';
                                        else if (size === '20FR') sizeVariant = 'error';
                                        else if (size === '20HR') sizeVariant = 'warning';
                                        else if (size === '20OT') sizeVariant = 'info';
                                        else if (size === '20RF') sizeVariant = 'success';
                                        else if (size === '20RH') sizeVariant = 'error';
                                        else if (size === '40DC') sizeVariant = 'warning';
                                        else if (size === '40FR') sizeVariant = 'info';
                                        else if (size === '40HC') sizeVariant = 'success';
                                        else if (size === '40OT') sizeVariant = 'error';
                                        else if (size === '40RH') sizeVariant = 'warning';

                                        // status variant
                                        let statusVariant: 'success' | 'error' | 'warning' | 'info' | 'default' = 'default';
                                        const status = row.status;
                                        if (status === 'ASIS') statusVariant = 'warning';
                                        else if (status === 'AVL') statusVariant = 'success';
                                        else if (status === 'DMG') statusVariant = 'error';
                                        else if (status === 'FSV') statusVariant = 'info';
                                        else if (status === 'HLD') statusVariant = 'error';
                                        else if (status === 'REPO') statusVariant = 'warning';
                                        else if (status === 'RPR') statusVariant = 'success';
                                        else if (status === 'WSH') statusVariant = 'info';

                                        // class variant
                                        let classVariant: 'success' | 'error' | 'warning' | 'info' | 'default' = 'default';
                                        const containerClass = row.class;
                                        if (containerClass === 'A') classVariant = 'success';
                                        else if (containerClass === 'B') classVariant = 'warning';
                                        else if (containerClass === 'C') classVariant = 'error';

                                        return (
                                            <div className="flex flex-col gap-1 min-w-[110px]">
                                                <div>
                                                    <ModernBadge variant={statusVariant}>{row.status || '-'}</ModernBadge>
                                                </div>
                                                <div>
                                                    <ModernBadge variant={sizeVariant}>{row.size || '-'}</ModernBadge>
                                                </div>
                                                <div>
                                                    <ModernBadge variant={classVariant}>{row.class || '-'}</ModernBadge>
                                                </div>
                                            </div>
                                        );
                                    }
                                },
                                {
                                    key: 'date_days',
                                    label: 'DATE/TIME / Days',
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-600 min-w-[130px]">
                                            <div className="font-medium">{formatDate(row.date)}</div>
                                            <div className="text-xs text-gray-500 mt-1">{formatTime(row.time)}</div>
                                            <div className="mt-1">
                                                <span className="font-bold text-gray-900 text-sm">DAYS: {formatDurationCompactFrom(row.date, row.time, row.days)}</span>
                                            </div>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'dmf', 
                                    label: 'Date mfd',
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-600 min-w-[80px]">{formatMonthYear(row.dmf as string)}</div>
                                    )
                                },
                                { 
                                    key: 'location', 
                                    label: 'Loc',
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-600 min-w-[40px]">{row.location}</div>
                                    )
                                },
                                { 
                                    key: 'eir_notes', 
                                    label: 'EIR Notes',
                                    render: (row: InventoryRecord) => (
                                        <div className="min-w-[200px] max-w-[250px]">
                                            <span className="text-sm text-gray-600 break-words" title={row.eir_notes}>{row.eir_notes || '-'}</span>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'app_notes', 
                                    label: 'App Notes',
                                    render: (row: InventoryRecord) => (
                                        <div className="flex items-center gap-2 min-w-[150px]">
                                            {row.app_notes && row.app_notes.trim() ? (
                                                <span className="text-sm text-gray-600">{row.app_notes}</span>
                                            ) : (
                                                <ModernButton
                                                    variant="add"
                                                    size="sm"
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleOpenApprovalModal(row); }}
                                                    title="Approve Container"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                </ModernButton>
                                            )}
                                        </div>
                                    )
                                },
                                { 
                                    key: 'actions', 
                                    label: 'Actions',
                                    render: (row: InventoryRecord) => (
                                        <div className="min-w-[120px]">
                                            <div className="grid grid-cols-3 gap-2 justify-items-end">
                                                <ModernButton 
                                                    variant="primary" 
                                                    size="sm" 
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleViewRecord(row); }}
                                                    title="View Details"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </ModernButton>

                                                <ModernButton 
                                                    variant="edit" 
                                                    size="sm" 
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleOpenEditModal(row); }}
                                                    title="Edit Container"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </ModernButton>

                                                <ModernButton
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); openLegacyPrintSingle(row); }}
                                                    title="Print"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                </ModernButton>

                                                {row.is_hold ? (
                                                    <ModernButton
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleOpenUnholdConfirm(row); }}
                                                        title="Remove from Hold"
                                                        disabled={updatingStatus}
                                                    >
                                                        <Unlock className="w-3.5 h-3.5" />
                                                    </ModernButton>
                                                ) : (
                                                    <ModernButton
                                                        variant="toggle"
                                                        size="sm"
                                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleOpenHoldModal(row); }}
                                                        title="Place on Hold"
                                                        disabled={updatingStatus}
                                                    >
                                                        <Lock className="w-3.5 h-3.5" />
                                                    </ModernButton>
                                                )}

                                                <ModernButton
                                                    variant={row.container_status_id === 8 ? "add" : "edit"}
                                                    size="sm"
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleOpenRepoToggleConfirm(row); }}
                                                    title={row.container_status_id === 8 ? "Update to Available" : "Update to Repo"}
                                                    disabled={updatingStatus}
                                                >
                                                    <Truck className="w-3.5 h-3.5" />
                                                </ModernButton>

                                                <ModernButton 
                                                    variant="delete" 
                                                    size="sm" 
                                                    onClick={(e: React.MouseEvent) => {
                                                        e.stopPropagation();
                                                        setRecordToDelete(row);
                                                        setShowDeleteConfirm(true);
                                                    }}
                                                    title="Delete Container"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </ModernButton>
                                            </div>
                                        </div>
                                    )
                                },
                            ]}
                            onRowClick={handleViewRecord}
                            data={filteredReportData}
                        />
                    ) : (
                        <div className="text-center py-12">
                            <p style={{ color: colors.text.secondary }}>No inventory records found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Filters Modal */}
            <Dialog open={showFiltersModal} onOpenChange={setShowFiltersModal}>
                <DialogContent className="!max-w-[90vw] !w-[90vw] !max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
                            Filter Options
                        </DialogTitle>
                        <DialogDescription>
                            Apply filters to refine inventory results
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
                        {/* Column 1 */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm font-semibold mb-2">In/Out</Label>
                                <Select value={filters.gate_status || 'CURRENTLY'} onValueChange={(value) => handleFilterChange('gate_status', value)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="Real Time Inventory" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CURRENTLY">Real Time Inventory</SelectItem>
                                        <SelectItem value="IN">In</SelectItem>
                                        <SelectItem value="OUT">Out</SelectItem>
                                        <SelectItem value="BOTH">Both</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Status In</Label>
                                <Select value={filters.status_in} onValueChange={(value) => handleFilterChange('status_in', value)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {statusesIn.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Status Out</Label>
                                <Select value={filters.status_out} onValueChange={(value) => handleFilterChange('status_out', value)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {statusesOut.map((status) => (
                                            <SelectItem key={status} value={status}>
                                                {status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Size/Type</Label>
                                <Select value={filters.size_type} onValueChange={(value) => handleFilterChange('size_type', value)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {sizeTypes.map((st) => (
                                            <SelectItem key={st.value} value={st.value}>
                                                {st.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">ISO Code</Label>
                                <Input
                                    type="text"
                                    value={filters.iso_code}
                                    onChange={(e) => handleFilterChange('iso_code', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>
                            
                            <div>
                                <Label className="text-sm font-semibold mb-2">Checker</Label>
                                <Input
                                    type="text"
                                    value={filters.checker}
                                    onChange={(e) => handleFilterChange('checker', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Seal No.</Label>
                                <Input
                                    type="text"
                                    value={filters.seal_no}
                                    onChange={(e) => handleFilterChange('seal_no', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold mb-2">Bill of Lading</Label>
                                <Input
                                    type="text"
                                    value={filters.bill_of_lading}
                                    onChange={(e) => handleFilterChange('bill_of_lading', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm font-semibold mb-2">Container No.</Label>
                                <Input
                                    type="text"
                                    value={filters.container_no}
                                    onChange={(e) => handleFilterChange('container_no', e.target.value)}
                                    className="mt-1.5"
                                    placeholder="Search container..."
                                />
                            </div>
                            
                            <div>
                                <Label className="text-sm font-semibold mb-2">Date In (From)</Label>
                                <Input
                                    type="date"
                                    value={filters.date_in_from}
                                    onChange={(e) => handleFilterChange('date_in_from', e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Date In (To)</Label>
                                <Input
                                    type="date"
                                    value={filters.date_in_to}
                                    onChange={(e) => handleFilterChange('date_in_to', e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Hauler In</Label>
                                <Input
                                    type="text"
                                    value={filters.hauler_in}
                                    onChange={(e) => handleFilterChange('hauler_in', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Vessel In</Label>
                                <Input
                                    type="text"
                                    value={filters.vessel_in}
                                    onChange={(e) => handleFilterChange('vessel_in', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Booking Number</Label>
                                <Input
                                    type="text"
                                    value={filters.booking_number}
                                    onChange={(e) => handleFilterChange('booking_number', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Destination</Label>
                                <Input
                                    type="text"
                                    value={filters.destination}
                                    onChange={(e) => handleFilterChange('destination', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Shipper</Label>
                                <Input
                                    type="text"
                                    value={filters.shipper}
                                    onChange={(e) => handleFilterChange('shipper', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>
                        </div>

                        {/* Column 3 */}
                        <div className="space-y-3">
                            <div>
                                <Label className="text-sm font-semibold mb-2">Client</Label>
                                <Select value={filters.client} onValueChange={(value) => handleFilterChange('client', value)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {clients.map((client) => (
                                            <SelectItem key={client.id} value={client.id}>
                                                {client.text}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Date Out (From)</Label>
                                <Input
                                    type="date"
                                    value={filters.date_out_from}
                                    onChange={(e) => handleFilterChange('date_out_from', e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Date Out (To)</Label>
                                <Input
                                    type="date"
                                    value={filters.date_out_to}
                                    onChange={(e) => handleFilterChange('date_out_to', e.target.value)}
                                    className="mt-1.5"
                                    placeholder="yyyy-mm-dd"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Hauler Out</Label>
                                <Input
                                    type="text"
                                    value={filters.hauler_out}
                                    onChange={(e) => handleFilterChange('hauler_out', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Vessel Out</Label>
                                <Input
                                    type="text"
                                    value={filters.vessel_out}
                                    onChange={(e) => handleFilterChange('vessel_out', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Consignee</Label>
                                <Input
                                    type="text"
                                    value={filters.consignee}
                                    onChange={(e) => handleFilterChange('consignee', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Plate No. In</Label>
                                <Input
                                    type="text"
                                    value={filters.plate_no_in}
                                    onChange={(e) => handleFilterChange('plate_no_in', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Contact No.</Label>
                                <Input
                                    type="text"
                                    value={filters.contact_no}
                                    onChange={(e) => handleFilterChange('contact_no', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <ModernButton
                            variant="secondary"
                            onClick={handleResetFilters}
                            disabled={loading}
                        >
                            Reset
                        </ModernButton>
                        <ModernButton
                            variant="primary"
                            onClick={handleApplyFilters}
                            disabled={loading}
                        >
                            <FileText className="w-4 h-4" />
                            {loading ? 'Applying...' : 'Apply'}
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hold Modal */}
            <Dialog open={showHoldModal} onOpenChange={setShowHoldModal}>
                <DialogContent className="max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900">Place Container on Hold</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {selectedRecord && (
                            <div className="space-y-2">
                                <div className="text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">Container No:</span> {selectedRecord.container_no}
                                </div>
                                <div className="text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">Client:</span> {selectedRecord.client}
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="hold-notes" className="text-gray-900">Hold Notes *</Label>
                            <Textarea
                                id="hold-notes"
                                value={holdNotes}
                                onChange={(e) => setHoldNotes(e.target.value)}
                                placeholder="Enter reason for hold..."
                                rows={4}
                                className="resize-none text-gray-900 bg-white border-gray-300"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton
                            variant="secondary"
                            onClick={() => setShowHoldModal(false)}
                            disabled={holdingRecord}
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton
                            variant="delete"
                            onClick={handleHoldContainer}
                            disabled={holdingRecord || !holdNotes.trim()}
                        >
                            {holdingRecord ? 'Processing...' : 'Place on Hold'}
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Image Viewer Modal */}
            <Dialog open={showImageViewer} onOpenChange={setShowImageViewer}>
                <DialogContent className="!w-fit !max-w-[96vw] max-h-[94vh] p-4 sm:p-5 flex items-center justify-center overflow-hidden">
                    <div className="flex flex-col items-center gap-3 w-fit max-h-[90vh] overflow-hidden">
                        {currentImage && (
                            <div className="text-center font-medium pt-2" style={{ color: colors.text.primary }}>
                                {currentImage.name}
                            </div>
                        )}

                        <div className="flex items-center justify-center">
                            <div
                                className="relative aspect-[4/3] overflow-hidden rounded-md bg-black/5"
                                style={{ width: viewerFrameWidth }}
                                onClick={(e) => {
                                    const images = containerImages;
                                    if (images.length === 0) return;
                                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                                    const x = (e as React.MouseEvent).clientX - rect.left;
                                    const w = rect.width;
                                    if (x < w * 0.3) {
                                        setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
                                    } else if (x > w * 0.7) {
                                        setCurrentImageIndex((prev) => (prev + 1) % images.length);
                                    }
                                }}
                            >
                                {currentImage && (
                                    <div className="flex items-center justify-center w-full h-full">
                                        <img
                                            src={currentImage.src}
                                            alt={currentImage.name}
                                            className="w-full h-full object-contain mx-auto"
                                            style={{ display: 'block' }}
                                        />
                                    </div>
                                )}

                                {containerImages.length > 0 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={(ev) => {
                                                ev.stopPropagation();
                                                setCurrentImageIndex((prev) => (prev - 1 + containerImages.length) % containerImages.length);
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
                                                setCurrentImageIndex((prev) => (prev + 1) % containerImages.length);
                                            }}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white p-2 rounded-full shadow"
                                            aria-label="Next"
                                        >
                                            <ChevronRight className="w-5 h-5 text-black" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div style={{ width: viewerFrameWidth }}>
                            <div ref={thumbContainerRef} className="flex items-center justify-start gap-2 overflow-x-auto py-1 px-1 sm:px-2">
                                {containerImages.map((imageItem, idx) => (
                                    <button
                                        key={`${imageItem.src}-${idx}`}
                                        data-index={idx}
                                        onClick={() => setCurrentImageIndex(idx)}
                                        className={`flex-none p-1 rounded ${idx === currentImageIndex ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                                    >
                                        <img
                                            src={imageItem.src}
                                            alt={imageItem.name}
                                            className="w-24 sm:w-28 aspect-[4/3] object-cover rounded"
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Approval Modal */}
            <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
                <DialogContent className="max-w-md bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900">Approve Container</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {selectedRecord && (
                            <div className="space-y-2">
                                <div className="text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">Container No:</span> {selectedRecord.container_no}
                                </div>
                                <div className="text-sm text-gray-700">
                                    <span className="font-semibold text-gray-900">Client:</span> {selectedRecord.client}
                                </div>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="approval-notes" className="text-gray-900">Approval Notes (Max 300 characters) *</Label>
                            <Textarea
                                id="approval-notes"
                                value={approvalNotes}
                                onChange={(e) => setApprovalNotes(e.target.value)}
                                placeholder="Enter approval notes..."
                                maxLength={300}
                                rows={4}
                                className="resize-none text-gray-900 bg-white border-gray-300"
                            />
                            <div className="text-xs text-gray-600 text-right">
                                {approvalNotes.length}/300
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <ModernButton
                            variant="secondary"
                            onClick={() => setShowApprovalModal(false)}
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton
                            variant="primary"
                            onClick={handleSubmitApprovalNotes}
                            disabled={!approvalNotes.trim()}
                        >
                            Continue
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Details Modal */}
            <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
                <DialogContent className="min-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
                            Container Details
                        </DialogTitle>
                    </DialogHeader>
                    {viewRecord && (
                        <div className="grid gap-4 py-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl" style={{ backgroundColor: colors.brand.primary }}>
                                    <Package className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900">{viewRecord.container_no}</h3>
                                    <p className="text-sm text-gray-600">{viewRecord.client}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-6 pt-4 border-t">
                                {/* Column 1 */}
                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600 flex items-center gap-1">
                                            <FileText className="w-3.5 h-3.5" />
                                            Container No.
                                        </Label>
                                        <p className="mt-1 text-gray-900 font-medium">{viewRecord.container_no}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Client</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.client}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Gate In Date</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.date}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Gate In Time</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.time}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Date Manufactured</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.dmf || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Status</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.status}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Size/Type</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.size}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">ISO Code</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.iso_code || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Column 2 */}
                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Class</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.class}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Vessel</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.vessel || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Voyage</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.voyage || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Checker</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.checker || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Consignee</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.ex_consignee || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Load</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.load || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Plate No.</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.plate_no || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Hauler</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.hauler || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Column 3 */}
                                <div className="space-y-3">
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Hauler Driver</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.hauler_driver || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">License No.</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.license_no || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Location</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.location}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Chasis</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.chasis || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Contact No.</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.contact_no || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Bill of Lading</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.bill_of_lading || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Days in Yard</Label>
                                        <p className="mt-1 text-gray-900">{formatDurationFrom(viewRecord.date as string, viewRecord.time as string, viewRecord.days)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Gate Status</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.gate}</p>
                                    </div>
                                </div>

                                {/* Full-width fields */}
                                <div className="col-span-3 space-y-3">
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Remarks (EIR Notes)</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.eir_notes || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Approval Notes</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.app_notes || 'N/A'}</p>
                                    </div>
                                    {viewRecord.is_hold && viewRecord.hold_notes ? (
                                        <div>
                                            <Label className="text-xs uppercase text-gray-600">Hold Notes</Label>
                                            <p className="mt-1 text-gray-900">{viewRecord.hold_notes}</p>
                                            {viewRecord.hold_date && (
                                                <p className="text-xs text-gray-500 mt-1">Placed on: {formatDate(viewRecord.hold_date as string)}</p>
                                            )}
                                        </div>
                                    ) : null}
                                    {containerImages.length > 0 && (
                                        <div>
                                            <Label className="text-xs uppercase text-gray-600">Images</Label>
                                            <div className="flex gap-2 overflow-x-auto py-2">
                                                {containerImages.map((imageItem, idx) => (
                                                    <img
                                                        key={`${imageItem.src}-${idx}`}
                                                        src={imageItem.src}
                                                        alt={imageItem.name}
                                                        className="w-28 h-20 object-cover rounded cursor-pointer border"
                                                        onClick={() => { setCurrentImageIndex(idx); setShowImageViewer(true); }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <ModernButton variant="toggle" onClick={() => setShowViewModal(false)}>
                            Close
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Modal */}
            <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                <DialogContent className="min-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
                            Edit Container
                        </DialogTitle>
                        <DialogDescription className="text-gray-600">
                            Update container information
                        </DialogDescription>
                    </DialogHeader>
                    {editFormData && (
                        <div className="grid grid-cols-3 gap-6 py-4">
                            {/* Column 1 */}
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-gray-900">Container No. <span className="text-red-500">*</span></Label>
                                    <Input 
                                        value={editFormData.container_no} 
                                        onChange={(e) => setEditFormData({...editFormData, container_no: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Client</Label>
                                    <Select 
                                        value={editFormData.client_id?.toString() || ''} 
                                        onValueChange={(value) => {
                                            const selectedClient = clients.find(c => c.c_id.toString() === value);
                                            setEditFormData({
                                                ...editFormData, 
                                                client_id: value,
                                                client: selectedClient?.name || ''
                                            });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                                        <SelectContent>
                                            {clients.map((client) => (
                                                <SelectItem key={client.c_id} value={client.c_id.toString()}>
                                                    {client.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-gray-900">Gate In Date</Label>
                                    <Input 
                                        type="date"
                                        value={editFormData.date} 
                                        onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Gate In Time</Label>
                                    <Input 
                                        type="time"
                                        value={editFormData.time} 
                                        onChange={(e) => setEditFormData({...editFormData, time: e.target.value})}
                                        className="bg-white cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Date Manufactured</Label>
                                    <Input 
                                        type="date"
                                        value={editFormData.dmf} 
                                        onChange={(e) => setEditFormData({...editFormData, dmf: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Status</Label>
                                    <Select 
                                        value={editFormData.status_id?.toString() || ''} 
                                        onValueChange={(value) => {
                                            const selectedStatus = statusOptions.find(s => s.s_id.toString() === value);
                                            setEditFormData({
                                                ...editFormData, 
                                                status_id: value,
                                                status: selectedStatus?.status || ''
                                            });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                        <SelectContent>
                                            {statusOptions.map((status) => (
                                                <SelectItem key={status.s_id} value={status.s_id.toString()}>
                                                    {status.status}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-gray-900">Size/Type</Label>
                                    <Select 
                                        value={editFormData.size_type_id?.toString() || ''} 
                                        onValueChange={(value) => {
                                            const selectedSize = sizeTypeOptions.find(s => s.s_id.toString() === value);
                                            setEditFormData({
                                                ...editFormData, 
                                                size_type_id: parseInt(value),
                                                size: selectedSize ? `${selectedSize.size}${selectedSize.type}` : ''
                                            });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select size/type" /></SelectTrigger>
                                        <SelectContent>
                                            {sizeTypeOptions.map((size) => (
                                                <SelectItem key={size.s_id} value={size.s_id.toString()}>
                                                    {size.size}{size.type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-gray-900">ISO Code</Label>
                                    <Input 
                                        value={editFormData.iso_code || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, iso_code: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* Column 2 */}
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-gray-900">Class</Label>
                                    <Select 
                                        value={editFormData.class} 
                                        onValueChange={(value) => setEditFormData({...editFormData, class: value})}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="A">A</SelectItem>
                                            <SelectItem value="B">B</SelectItem>
                                            <SelectItem value="C">C</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-gray-900">Vessel</Label>
                                    <Input 
                                        value={editFormData.vessel || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, vessel: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Voyage</Label>
                                    <Input 
                                        value={editFormData.voyage || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, voyage: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Checker</Label>
                                    <Input 
                                        value={editFormData.checker || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, checker: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Consignee</Label>
                                    <Input 
                                        value={editFormData.ex_consignee || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, ex_consignee: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Load</Label>
                                    <Select 
                                        value={editFormData.load_id?.toString() || ''} 
                                        onValueChange={(value) => {
                                            const selectedLoad = loadOptions.find(l => l.l_id.toString() === value);
                                            setEditFormData({
                                                ...editFormData, 
                                                load_id: value,
                                                load: selectedLoad?.type || ''
                                            });
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select load" /></SelectTrigger>
                                        <SelectContent>
                                            {loadOptions.map((load) => (
                                                <SelectItem key={load.l_id} value={load.l_id.toString()}>
                                                    {load.type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-gray-900">Plate No.</Label>
                                    <Input 
                                        value={editFormData.plate_no || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, plate_no: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Hauler</Label>
                                    <Input 
                                        value={editFormData.hauler || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, hauler: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* Column 3 */}
                            <div className="space-y-3">
                                <div>
                                    <Label className="text-gray-900">Hauler Driver</Label>
                                    <Input 
                                        value={editFormData.hauler_driver || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, hauler_driver: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">License No.</Label>
                                    <Input 
                                        value={editFormData.license_no || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, license_no: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Location</Label>
                                    <Input 
                                        value={editFormData.location} 
                                        onChange={(e) => setEditFormData({...editFormData, location: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Chasis</Label>
                                    <Input 
                                        value={editFormData.chasis || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, chasis: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Contact No.</Label>
                                    <Input 
                                        value={editFormData.contact_no || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, contact_no: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Bill of Lading</Label>
                                    <Input 
                                        value={editFormData.bill_of_lading || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, bill_of_lading: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Remarks (EIR Notes)</Label>
                                    <Textarea 
                                        value={editFormData.eir_notes} 
                                        onChange={(e) => setEditFormData({...editFormData, eir_notes: e.target.value})}
                                        className="min-h-[80px]"
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Approval Notes</Label>
                                    <Textarea 
                                        value={editFormData.app_notes} 
                                        onChange={(e) => setEditFormData({...editFormData, app_notes: e.target.value})}
                                        className="min-h-[80px]"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <ModernButton
                            variant="toggle"
                            onClick={() => setShowEditModal(false)}
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton
                            variant="edit"
                            onClick={handleSubmitEdit}
                        >
                            <Pencil className="w-4 h-4" />
                            Update Container
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Approve Confirmation Dialog */}
            <ModernConfirmDialog
                open={showApproveConfirm}
                onOpenChange={setShowApproveConfirm}
                type="success"
                title="Approve Container?"
                description={`Are you sure you want to approve container ${selectedRecord?.container_no}?`}
                confirmText="Yes, Approve"
                onConfirm={handleApproveContainer}
            />

            {/* Hold Confirmation Dialog */}
            <ModernConfirmDialog
                open={showHoldConfirm}
                onOpenChange={setShowHoldConfirm}
                type="warning"
                title="Place Container on Hold?"
                description={`Are you sure you want to place container ${selectedRecord?.container_no} on hold?`}
                confirmText="Yes, Place on Hold"
                onConfirm={handleConfirmHold}
            />

            {/* Unhold Confirmation Dialog */}
            <ModernConfirmDialog
                open={showUnholdConfirm}
                onOpenChange={setShowUnholdConfirm}
                type="success"
                title="Remove from Hold?"
                description={`Are you sure you want to remove container ${recordForAction?.container_no} from hold?`}
                confirmText="Yes, Remove Hold"
                onConfirm={handleUnholdContainer}
            />

            {/* Repo/Available Toggle Confirmation Dialog */}
            <ModernConfirmDialog
                open={showRepoToggleConfirm}
                onOpenChange={setShowRepoToggleConfirm}
                type="warning"
                title={`Update to ${recordForAction?.container_status_id === 8 ? 'Available' : 'Repo'}?`}
                description={`Are you sure you want to update container ${recordForAction?.container_no} to ${recordForAction?.container_status_id === 8 ? 'Available' : 'Repo'}?`}
                confirmText={`Yes, Update to ${recordForAction?.container_status_id === 8 ? 'Available' : 'Repo'}`}
                onConfirm={handleToggleRepoStatus}
            />

            {/* Delete Confirmation Dialog */}
            <ModernConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                type="danger"
                title="Delete Container?"
                description={`Are you sure you want to delete container ${recordToDelete?.container_no}? This action cannot be undone.`}
                confirmText="Yes, Delete"
                onConfirm={handleDeleteRecord}
            />

            {/* Edit Confirmation Dialog */}
            <ModernConfirmDialog
                open={showEditConfirm}
                onOpenChange={setShowEditConfirm}
                type="warning"
                title="Edit Container?"
                description={`Are you sure you want to edit container ${editFormData?.container_no}?`}
                confirmText="Yes, Edit"
                onConfirm={handleConfirmEdit}
            />

            

            {/* Export Confirmation Dialog */}
            <ModernConfirmDialog
                open={showExportConfirm}
                onOpenChange={setShowExportConfirm}
                type="success"
                title="Export to CSV?"
                description={`Are you sure you want to export ${reportData.length} records to CSV?`}
                confirmText="Yes, Export"
                onConfirm={handleExport}
            />

            {/* Summary Report Modal */}
            <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
                <DialogContent className="!max-w-[90vw] !w-[90vw] !max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
                            Summary Report
                        </DialogTitle>
                        <DialogDescription>
                            Container inventory summary by client and size/type with TEUs calculation
                        </DialogDescription>
                    </DialogHeader>
                    
                    {summaryData && Object.keys(summaryData.by_client || {}).length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-300 text-xs">
                                <thead>
                                    <tr style={{ backgroundColor: colors.brand.primary }}>
                                        <th className="border border-gray-300 px-2 py-2 text-left text-white font-semibold whitespace-nowrap">
                                            Client Name
                                        </th>
                                        {summaryData.size_types.map((sizeType) => (
                                            <th key={sizeType} className="border border-gray-300 px-2 py-2 text-center text-white font-semibold whitespace-nowrap">
                                                {sizeType}
                                            </th>
                                        ))}
                                        <th className="border border-gray-300 px-2 py-2 text-center text-white font-semibold whitespace-nowrap">
                                            Total
                                        </th>
                                        <th className="border border-gray-300 px-2 py-2 text-center text-white font-semibold whitespace-nowrap">
                                            TEUS
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(summaryData.by_client).map(([client, sizeCounts], idx) => {
                                        let totalCount = 0;
                                        let totalTeus = 0;
                                        
                                        // Calculate totals - EXACT logic from legacy system
                                        summaryData.size_types.forEach((sizeType) => {
                                            const count = sizeCounts[sizeType] || 0;
                                            totalCount += count;
                                            
                                            // Calculate TEUs based on size (first 2 characters)
                                            const size = sizeType.substring(0, 2);
                                            if (size === '45') {
                                                totalTeus += count * 2.0;
                                            } else if (size === '40') {
                                                totalTeus += count * 2.0;
                                            } else if (size === '20') {
                                                totalTeus += count * 1.0;
                                            }
                                        });
                                        
                                        return (
                                            <tr key={client} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="border border-gray-300 px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">
                                                    {client}
                                                </td>
                                                {summaryData.size_types.map((sizeType) => (
                                                    <td key={sizeType} className="border border-gray-300 px-2 py-1.5 text-center text-gray-700">
                                                        {sizeCounts[sizeType] || 0}
                                                    </td>
                                                ))}
                                                <td className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-900">
                                                    {totalCount}
                                                </td>
                                                <td className="border border-gray-300 px-2 py-1.5 text-center font-semibold text-gray-900">
                                                    {totalTeus.toFixed(1)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    
                                    {/* Grand Total Row - EXACT logic from legacy system */}
                                    <tr style={{ backgroundColor: colors.brand.primary }}>
                                        <td className="border border-gray-300 px-2 py-2 font-bold text-white whitespace-nowrap">
                                            Total
                                        </td>
                                        {summaryData.size_types.map((sizeType) => {
                                            const grandTotal = Object.values(summaryData.by_client).reduce(
                                                (sum, client) => sum + (client[sizeType] || 0),
                                                0
                                            );
                                            return (
                                                <td key={sizeType} className="border border-gray-300 px-2 py-2 text-center font-bold text-white">
                                                    {grandTotal}
                                                </td>
                                            );
                                        })}
                                        <td className="border border-gray-300 px-2 py-2 text-center font-bold text-white">
                                            {Object.values(summaryData.by_client).reduce((sum, client) => {
                                                return sum + summaryData.size_types.reduce((s, st) => s + (client[st] || 0), 0);
                                            }, 0)}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-2 text-center font-bold text-white">
                                            {Object.values(summaryData.by_client).reduce((sum, client) => {
                                                return sum + summaryData.size_types.reduce((s, st) => {
                                                    const count = client[st] || 0;
                                                    const size = st.substring(0, 2);
                                                    if (size === '45') {
                                                        return s + (count * 2.0);
                                                    } else if (size === '40') {
                                                        return s + (count * 2.0);
                                                    } else if (size === '20') {
                                                        return s + (count * 1.0);
                                                    }
                                                    return s;
                                                }, 0);
                                            }, 0).toFixed(1)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-gray-600">No summary data available. Please try generating the report again.</p>
                        </div>
                    )}
{/*                     
                    <DialogFooter>
                        <ModernButton
                            variant="toggle"
                            onClick={() => setShowSummaryModal(false)}
                        >
                            Close
                        </ModernButton>
                    </DialogFooter> */}
                </DialogContent>
            </Dialog>

            <button
                aria-label="Back to top"
                title="Back to top"
                onClick={() => {
                    try {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    } catch {
                        // ignore
                    }
                }}
                style={{
                    position: 'fixed',
                    right: 20,
                    bottom: 24,
                    zIndex: 9999,
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: '#111827',
                    color: '#ffffff',
                    display: showBackToTop ? 'flex' : 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
                    cursor: 'pointer',
                    border: 'none',
                    outline: 'none',
                    transition: 'opacity 200ms ease',
                }}
            >
                ↑
            </button>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
};

export default Index;

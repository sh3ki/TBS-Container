import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { Package, FileText, Download, CheckCircle, Lock, Unlock, Truck, Eye, Pencil, Trash2, Search, Printer, Filter, RotateCcw, Copy, Highlighter, ChevronUp, ChevronDown, X, Calendar, Loader2, ArrowUpDown } from 'lucide-react';
import { colors } from '@/lib/colors';
import CachedFieldHistory from '@/components/CachedFieldHistory';
import { saveFieldHistory } from '@/components/CachedFieldHistory';
import ImageViewerModal from '@/components/ImageViewerModal';

interface Client {
    id: string;
    c_id: number;
    code: string;
    name: string;
    text: string;
}

const legacySizeToIso: Record<string, string> = {
    '20DC': '22G1',
    '20FR': '22P1',
    '20OT': '22U1',
    '20RF': '22R1',
    '20RH': '25R1',
    '40DC': '42G1',
    '40FR': '42P1',
    '40HC': '45G1',
    '40OT': '42U1',
    '40RH': '45R1',
    '45HC': 'L5G1',
};

const getIsoCodeForSizeType = (size: string, type: string): string => {
    const sizeType = `${size}${type}`.trim().toUpperCase();
    return legacySizeToIso[sizeType] || sizeType;
};

const currentManufacturedYear = () => new Date().getFullYear();

const formatManufacturedMonthYear = (value: unknown): string => {
    const raw = String(value ?? '').trim();
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[2]}/${isoMatch[1]}`;

    const legacyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (legacyMatch) return `${legacyMatch[1]}/${legacyMatch[3]}`;

    return raw;
};

const formatManufacturedInput = (value: string, previousValue: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    if (!digits) return '';

    const monthDigits = digits.slice(0, 2);
    if (monthDigits.length === 2) {
        const month = Number(monthDigits);
        if (month < 1 || month > 12) return previousValue;
    }

    const yearDigits = digits.slice(2);
    if (yearDigits.length === 4) {
        const year = Number(yearDigits);
        if (year < 1900 || year > currentManufacturedYear()) return previousValue;
    }

    return yearDigits ? `${monthDigits}/${yearDigits}` : monthDigits;
};

const normalizeManufacturedDate = (value: string): string | null => {
    const match = value.trim().match(/^(0[1-9]|1[0-2])\/(\d{4})$/);
    if (!match) return null;

    const year = Number(match[2]);
    if (year < 1900 || year > currentManufacturedYear()) return null;

    return `${match[2]}-${match[1]}-01`;
};

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
    booking?: string;
    shipper?: string;
    seal_no?: string;
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

const INVENTORY_FILTER_STORAGE_KEY = 'inventory.filters.v1';
type HighlightColor = 'yellow' | 'green' | 'cyan' | 'pink' | 'orange' | 'blue' | 'red' | 'purple';

const highlightColorClasses: Record<HighlightColor, string> = {
    yellow: 'bg-yellow-300',
    green: 'bg-lime-300',
    cyan: 'bg-cyan-300',
    pink: 'bg-pink-300',
    orange: 'bg-orange-300',
    blue: 'bg-sky-300',
    red: 'bg-red-300',
    purple: 'bg-purple-300',
};

const highlightColorSwatchClasses: Record<HighlightColor, string> = {
    yellow: 'bg-yellow-300',
    green: 'bg-lime-300',
    cyan: 'bg-cyan-300',
    pink: 'bg-pink-300',
    orange: 'bg-orange-300',
    blue: 'bg-sky-300',
    red: 'bg-red-300',
    purple: 'bg-purple-300',
};

const defaultFilters = {
    client: 'all',
    iso_code: '',
    container_no: '',
    date_out_from: '',
    date_in_from: '',
    date_out_to: '',
    date_in_to: '',
    checker: '',
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
    gate_status: 'CURRENTLY',
};

const getCachedInventoryState = () => {
    const emptyState = {
        filters: defaultFilters,
        appliedFilters: defaultFilters,
        searchTerm: '',
        appliedSearchTerm: '',
        highlightColor: 'yellow' as HighlightColor,
    };

    if (typeof window === 'undefined') return emptyState;

    try {
        const cached = window.localStorage.getItem(INVENTORY_FILTER_STORAGE_KEY);
        if (!cached) return emptyState;

        const parsed = JSON.parse(cached) as {
            filters?: Partial<typeof defaultFilters>;
            appliedFilters?: Partial<typeof defaultFilters>;
            searchTerm?: string;
            appliedSearchTerm?: string;
            highlightColor?: HighlightColor;
        };

        return {
            filters: { ...defaultFilters, ...(parsed.filters || {}) },
            appliedFilters: { ...defaultFilters, ...(parsed.appliedFilters || parsed.filters || {}) },
            searchTerm: parsed.searchTerm || '',
            appliedSearchTerm: parsed.appliedSearchTerm || parsed.searchTerm || '',
            highlightColor: parsed.highlightColor || 'yellow',
        };
    } catch {
        return emptyState;
    }
};

const Index: React.FC = () => {
    const { toasts, removeToast, success, error } = useModernToast();
    
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [sizeTypes, setSizeTypes] = useState<{ value: string; label: string }[]>([]);
    const [statusesIn, setStatusesIn] = useState<Array<{ s_id: number; status: string }>>([]);
    const [reportData, setReportData] = useState<InventoryRecord[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState(1);
    // CURRENTLY is intentionally loaded in full (normally ~1,000 rows). Historical
    // BOTH results are requested in bounded windows by the virtualized table.
    const [itemsPerPage, setItemsPerPage] = useState<number>(100);
    const [loadingMoreHistorical, setLoadingMoreHistorical] = useState(false);

    // Summary report data
    const [summaryData, setSummaryData] = useState<{
        by_client: Record<string, Record<string, number>>;
        size_types: string[];
    } | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
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
    const [initialEditFormData, setInitialEditFormData] = useState<InventoryRecord | null>(null);

    // Dropdown options for edit modal
    const [statusOptions, setStatusOptions] = useState<Array<{ s_id: number; status: string }>>([]);
    const [sizeTypeOptions, setSizeTypeOptions] = useState<Array<{ s_id: number; size: string; type: string }>>([]);
    const [loadOptions, setLoadOptions] = useState<Array<{ l_id: number; type: string }>>([]);

    // Filter modal state
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const filterModalApplyRef = useRef(false);

    const cachedInventoryState = getCachedInventoryState();
    
    // Search state
    const [searchTerm, setSearchTerm] = useState(() => cachedInventoryState.searchTerm);
    const [appliedSearchTerm, setAppliedSearchTerm] = useState(() => cachedInventoryState.appliedSearchTerm);
    const [highlightMode, setHighlightMode] = useState(false);
    const [highlightSearchTerm, setHighlightSearchTerm] = useState('');
    const [highlightColor, setHighlightColor] = useState<HighlightColor>(() => cachedInventoryState.highlightColor);
    const [highlightColorMenuOpen, setHighlightColorMenuOpen] = useState(false);
    const [highlightMatchCursor, setHighlightMatchCursor] = useState(0);
    const highlightInputRef = useRef<HTMLInputElement>(null);
    const [sortColumn, setSortColumn] = useState('');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const canResetSearch = Boolean(searchTerm.trim() || appliedSearchTerm || sortColumn);
    const hasEditChanges = Boolean(
        editFormData &&
        initialEditFormData &&
        JSON.stringify(editFormData) !== JSON.stringify(initialEditFormData)
    );
    const isOutEdit = editFormData?.gate === 'OUT';
    const canUseInventoryToggles = (row: InventoryRecord) => (
        String(row.gate_status || row.gate || '').toUpperCase() === 'IN'
        && Number(row.complete) === 0
    );

    const highlightText = (value: unknown): React.ReactNode => {
        const text = String(value ?? '');
        const query = highlightSearchTerm.trim();
        if (!highlightMode || !query || !text) return text;

        const terms = [...new Set(query.split(/\s+/).filter(Boolean))]
            .sort((left, right) => right.length - left.length)
        const escapedTerms = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (escapedTerms.length === 0) return text;

        const matcher = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
        return text.split(matcher).map((part, index) => (
            terms.some((term) => part.toLowerCase() === term.toLowerCase()) ? (
                <mark key={`${part}-${index}`} className={`rounded ${highlightColorClasses[highlightColor]} px-0.5 text-gray-900`}>{part}</mark>
            ) : part
        ));
    };

    // Filter states
    const [filters, setFilters] = useState(() => cachedInventoryState.filters);
    const [appliedFilters, setAppliedFilters] = useState(() => cachedInventoryState.appliedFilters);
    const hasFilterValues = (filterValues: typeof defaultFilters) => Object.entries(filterValues).some(([key, value]) => {
        if (typeof value !== 'string') return false;
        const normalizedValue = value.trim().toLowerCase();
        return normalizedValue !== ''
            && normalizedValue !== 'all'
            && !(key === 'gate_status' && normalizedValue === 'currently');
    });
    const hasAdditionalFilterValues = (filterValues: typeof defaultFilters) => Object.entries(filterValues).some(([key, value]) => {
        if (key === 'gate_status' || typeof value !== 'string') return false;
        if (key === 'date_in_from' || key === 'date_in_to' || key === 'date_out_from' || key === 'date_out_to') {
            return Boolean(dateFilterToApiValue(value.trim()));
        }
        return value.trim() !== '' && value.trim().toLowerCase() !== 'all';
    });
    const hasActiveFilters = hasFilterValues(filters);
    const hasAppliedFilters = hasFilterValues(appliedFilters);
    // Only applied filters are active. Changes currently being edited in the
    // modal remain a draft until the user presses Apply.
    const canResetFilters = hasAppliedFilters;
    const gateInDateFiltersEnabled = ['CURRENTLY', 'IN', 'BOTH'].includes(filters.gate_status);
    const gateOutDateFiltersEnabled = ['OUT', 'BOTH'].includes(filters.gate_status);

    const formatDateFilterInput = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 8);
        if (digits.length <= 2) return digits;
        if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
        return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    };

    const dateFilterToApiValue = (value: string) => {
        const isoMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoMatch) return value.trim();

        const formatted = formatDateFilterInput(value);
        const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) return '';

        const [, month, day, year] = match;
        const date = new Date(Number(year), Number(month) - 1, Number(day));
        if (
            date.getFullYear() !== Number(year)
            || date.getMonth() !== Number(month) - 1
            || date.getDate() !== Number(day)
        ) return '';

        return `${year}-${month}-${day}`;
    };

    const requiredGateDateFields: Array<keyof typeof defaultFilters> = filters.gate_status === 'IN'
        ? ['date_in_from', 'date_in_to']
        : filters.gate_status === 'OUT'
            ? ['date_out_from', 'date_out_to']
            : filters.gate_status === 'BOTH'
                ? ['date_in_from', 'date_in_to', 'date_out_from', 'date_out_to']
                : [];
    const hasRequiredGateDateFilters = requiredGateDateFields.every((field) => (
        Boolean(dateFilterToApiValue(String(filters[field] || '')))
    ));
    const canApplyFilters = hasAdditionalFilterValues(filters) && hasRequiredGateDateFilters;

    const dateFilterDisplayValue = (value: string) => {
        const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return isoMatch
            ? `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`
            : formatDateFilterInput(value);
    };

    const handleDateFilterInput = (field: string, rawValue: string) => {
        const value = formatDateFilterInput(rawValue);
        setFilters((previous) => {
            const next = { ...previous, [field]: value } as typeof defaultFilters;
            const isFromField = field.endsWith('_from');
            const toField = field.replace('_from', '_to');
            const fromField = field.replace('_to', '_from');

            if (isFromField) {
                const fromDate = dateFilterToApiValue(value);
                const toDate = dateFilterToApiValue(String(previous[toField as keyof typeof previous] || ''));
                if (fromDate && toDate && toDate < fromDate) next[toField as keyof typeof defaultFilters] = '';
            } else {
                const fromDate = dateFilterToApiValue(String(previous[fromField as keyof typeof previous] || ''));
                const toDate = dateFilterToApiValue(value);
                if (fromDate && toDate && toDate < fromDate) return previous;
            }

            return next;
        });
    };

    const renderDateFilterInput = (field: keyof typeof defaultFilters, enabled: boolean) => (
        <div className="relative mt-1.5">
            <Input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={dateFilterDisplayValue(filters[field])}
                disabled={!enabled}
                onChange={(e) => handleDateFilterInput(field, e.target.value)}
                className="pr-10"
                placeholder="mm/dd/yyyy"
            />
            <Calendar className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${enabled ? 'text-gray-500' : 'text-gray-300'}`} />
            <input
                type="date"
                tabIndex={-1}
                aria-label={`Choose ${field.replaceAll('_', ' ')}`}
                value={dateFilterToApiValue(filters[field])}
                disabled={!enabled}
                onChange={(e) => handleDateFilterInput(field, dateFilterDisplayValue(e.target.value))}
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
        </div>
    );

    useEffect(() => {
        try {
            window.localStorage.setItem(INVENTORY_FILTER_STORAGE_KEY, JSON.stringify({
                filters,
                appliedFilters,
                searchTerm,
                appliedSearchTerm,
                highlightColor,
            }));
        } catch {
            // Ignore unavailable or restricted browser storage.
        }
    }, [filters, appliedFilters, searchTerm, appliedSearchTerm, highlightColor]);

    useEffect(() => {
        loadDropdownData();
        loadAllInventory();
        fetchDropdownOptions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


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
            // These lookups are independent. Loading them sequentially made the
            // page wait for every round trip before the filter UI became usable.
            const [clientsResponse, sizeTypesResponse, statusesResponse] = await Promise.all([
                axios.get('/api/inventory/clients'),
                axios.get('/api/inventory/size-types'),
                axios.get('/api/inventory/statuses'),
            ]);

            if (clientsResponse.data.success) {
                setClients((clientsResponse.data.data || []).map((client: { c_id: number; client_code: string; client_name: string }) => ({
                    id: String(client.c_id),
                    c_id: client.c_id,
                    code: client.client_code,
                    name: client.client_name,
                    text: `${client.client_code} - ${client.client_name}`,
                })));
            }

            if (sizeTypesResponse.data.success) {
                const combined = sizeTypesResponse.data.data.map((st: { s_id: number; size: string; type: string }) => ({
                    value: String(st.s_id),
                    label: `${st.size}${st.type}`
                }));
                setSizeTypes(combined);
            }

            if (statusesResponse.data.success) {
                setStatusesIn(statusesResponse.data.data || []);
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
        // Load the summary with the table request so opening the summary modal
        // does not trigger a second network request.
        includeSummary = true,
        append = false,
        offset = 0,
        limit = 100,
        sortBy = sortColumn,
        sortDir = sortDirection,
        filterValues = appliedFilters,
    }: {
        page?: number;
        perPage?: number;
        search?: string;
        showToast?: boolean;
        includeSummary?: boolean;
        append?: boolean;
        offset?: number;
        limit?: number;
        sortBy?: string;
        sortDir?: 'asc' | 'desc';
        filterValues?: typeof defaultFilters;
    } = {}) => {
        if (!append) setLoading(true);
        try {
            const payload = {
                ...buildFilterPayload(filterValues),
                gate_status: (filterValues.gate_status || 'CURRENTLY') as string,
                page,
                per_page: perPage,
                search: search?.trim() || '',
                include_summary: includeSummary,
                virtualized: filterValues.gate_status === 'BOTH',
                offset,
                limit,
                sort_by: sortBy,
                sort_direction: sortDir,
            };

            if (append) setLoadingMoreHistorical(true);
            const response = await axios.post('/api/inventory/search', payload);
            
            if (response.data.success) {
                setReportData((previous) => append ? [...previous, ...(response.data.data || [])] : (response.data.data || []));
                const totalFromApi = response.data.total ?? (Array.isArray(response.data.data) ? response.data.data.length : 0);
                setTotalCount(Number(totalFromApi || 0));
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
            setLoadingMoreHistorical(false);
        }
    };

    const loadMoreHistorical = useCallback(() => {
        if (appliedFilters.gate_status !== 'BOTH' || loading || loadingMoreHistorical || reportData.length >= totalCount) {
            return;
        }

        void fetchInventory({
            search: searchTerm,
            append: true,
            offset: reportData.length,
            limit: 100,
        });
    }, [appliedFilters.gate_status, loading, loadingMoreHistorical, reportData.length, searchTerm, totalCount]);

    const handleSort = (column: string) => {
        if (sortColumn === column && sortDirection === 'desc') {
            setSortColumn('');
            setSortDirection('asc');
            return;
        }

        const nextDirection: 'asc' | 'desc' = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
        setSortColumn(column);
        setSortDirection(nextDirection);
    };

    const fetchSummaryData = async () => {
        try {
            // Summary is independent of the visible table. Do not call
            // fetchInventory here because that replaces reportData and toggles
            // the table loading state.
            const response = await axios.post('/api/inventory/search', {
                ...buildFilterPayload(appliedFilters),
                gate_status: (appliedFilters.gate_status || 'CURRENTLY') as string,
                search: searchTerm.trim(),
                include_summary: true,
                virtualized: false,
            });

            if (response.data.success) {
                setSummaryData(response.data.summary || null);
            } else {
                error(response.data.message || 'Failed to load summary report');
            }
        } catch (err: unknown) {
            const errorCaught = err as { response?: { data?: { message?: string } } };
            error(errorCaught.response?.data?.message || 'Failed to load summary report');
        }
    };

    const handleViewSummary = async () => {
        if (summaryLoading) return;
        if (reportData.length === 0) {
            error('Please generate a report first to view the summary');
            return;
        }

        setSummaryLoading(true);
        try {
            if (!summaryData) {
                await fetchSummaryData();
            }
            setShowSummaryModal(true);
        } finally {
            setSummaryLoading(false);
        }
    };

    const loadAllInventory = async () => {
        await fetchInventory({ page: 1, perPage: itemsPerPage, search: appliedSearchTerm, showToast: false });
    };

    const updateInventoryRow = (inventoryId: number, updates: Partial<InventoryRecord>) => {
        setReportData((previous) => previous.map((row) => (
            row.i_id === inventoryId ? { ...row, ...updates } : row
        )));
    };

    const handleFilterChange = (field: string, value: string | boolean) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const handleGateStatusChange = (value: string) => {
        setFilters((previous) => ({
            ...previous,
            gate_status: value,
            ...( ['CURRENTLY', 'IN', 'BOTH'].includes(value) ? {} : {
                date_in_from: '',
                date_in_to: '',
            }),
            ...( ['OUT', 'BOTH'].includes(value) ? {} : {
                date_out_from: '',
                date_out_to: '',
            }),
        }));
    };

    const buildFilterPayload = (filterValues = filters) => {
        const payload: Record<string, unknown> = {};

        Object.entries(filterValues).forEach(([key, value]) => {
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed && trimmed.toLowerCase() !== 'all') {
                    if (key === 'date_in_from' || key === 'date_in_to' || key === 'date_out_from' || key === 'date_out_to') {
                        const apiDate = dateFilterToApiValue(trimmed);
                        if (apiDate) payload[key] = apiDate;
                    } else {
                        payload[key] = trimmed;
                    }
                }
            }
        });

        return payload;
    };

    const filteredReportData = reportData;

    // Header sorting only reorders rows already loaded in the table. It does
    // not re-run the active filtered inventory query.
    const sortedReportData = (records: InventoryRecord[], column: string, direction: 'asc' | 'desc') => {
        if (!column) return records;

        return [...records].sort((a, b) => {
            let left: string | number = '';
            let right: string | number = '';

            if (column === 'date_days' || column === 'date_time') {
                left = new Date(`${a.date || ''}T${a.time || '00:00:00'}`).getTime() || 0;
                right = new Date(`${b.date || ''}T${b.time || '00:00:00'}`).getTime() || 0;
            } else if (column === 'days') {
                left = Number(a.days) || 0;
                right = Number(b.days) || 0;
            } else if (column === 'client') {
                left = a.client || '';
                right = b.client || '';
            } else if (column === 'dmf') {
                left = new Date(a.dmf || '').getTime() || 0;
                right = new Date(b.dmf || '').getTime() || 0;
            } else {
                left = String(a[column] ?? '');
                right = String(b[column] ?? '');
            }

            const comparison = typeof left === 'number' && typeof right === 'number'
                ? left - right
                : String(left).localeCompare(String(right), undefined, { sensitivity: 'base', numeric: true });

            return direction === 'asc' ? comparison : -comparison;
        });
    };

    const inventoryTableData = sortedReportData(filteredReportData, sortColumn, sortDirection);
    const sortIconFor = (column: string) => sortColumn === column
        ? <span className="text-white">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        : (
            <span className="inline-flex text-white" aria-hidden="true">
                <ArrowUpDown className="h-4 w-4 opacity-90" />
            </span>
        );
    const highlightTerms = highlightSearchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const highlightMatchIndexes = highlightMode && highlightTerms.length > 0
        ? inventoryTableData.reduce<number[]>((matches, row, index) => {
            const parsedDate = row.date ? new Date(row.date) : null;
            const parsedManufacturedDate = row.dmf ? new Date(row.dmf) : null;
            const displayDate = parsedDate && !isNaN(parsedDate.getTime())
                ? parsedDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                : '';
            const displayManufacturedDate = parsedManufacturedDate && !isNaN(parsedManufacturedDate.getTime())
                ? parsedManufacturedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                : '';
            const searchableText = [
                row.eir_no,
                row.container_no,
                row.client,
                row.client_code,
                row.size,
                row.status,
                row.class,
                row.date,
                displayDate,
                row.time,
                row.days,
                row.dmf,
                displayManufacturedDate,
                row.location,
                row.eir_notes,
                row.app_notes,
            ]
                .map((value) => String(value ?? '').toLowerCase())
                .join(' ');
            if (highlightTerms.some((term) => searchableText.includes(term))) matches.push(index);
            return matches;
        }, [])
        : [];
    const activeHighlightCursor = highlightMatchIndexes.length > 0
        ? Math.min(highlightMatchCursor, highlightMatchIndexes.length - 1)
        : 0;
    const activeHighlightRowIndex = highlightMatchIndexes[activeHighlightCursor];

    useEffect(() => {
        setHighlightMatchCursor(0);
    }, [highlightSearchTerm, highlightMode]);

    useEffect(() => {
        if (highlightMode) {
            window.setTimeout(() => highlightInputRef.current?.focus(), 0);
        }
    }, [highlightMode]);

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

    // Inventory timestamps are stored as Manila yard time. Display them in
    // 24-hour/military format without converting the already-local DB value.
    const formatTime = (timeString: string) => {
        if (!timeString) return '-';
        try {
            const timeParts = timeString.split(':');
            if (timeParts.length >= 2) {
                const hours = Math.max(0, Math.min(23, parseInt(timeParts[0], 10)));
                const minutes = timeParts[1].padStart(2, '0');
                const seconds = (timeParts[2] || '00').padStart(2, '0');
                return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
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

    // Table Days display uses whole-day ceiling: 2h => 1d, 1d 1h => 2d.
    const formatDurationCompactFrom = (dateString?: string, timeString?: string, fallback?: number) => {
        try {
            if (fallback !== undefined && Number.isFinite(Number(fallback))) {
                return `${Math.max(0, Math.ceil(Number(fallback)))}d`;
            }

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

            const days = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
            return `${days}d`;
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
                saveFieldHistory({ 'inventory.approval_notes': approvalNotes });
                success('Container approved successfully!');
                updateInventoryRow(selectedRecord.i_id, {
                    app_notes: approvalNotes.trim(),
                    status: 'AVL',
                    status_id: '1',
                    container_status_id: 1,
                });
                setShowApproveConfirm(false);
                setSelectedRecord(null);
                setApprovalNotes('');
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
                updateInventoryRow(selectedRecord.i_id, {
                    status: 'HLD',
                    status_id: '4',
                    container_status_id: 4,
                    is_hold: true,
                });
                setShowHoldModal(false);
                setSelectedRecord(null);
                setHoldNotes('');
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
                updateInventoryRow(recordForAction.i_id, {
                    status: 'AVL',
                    status_id: '1',
                    container_status_id: 1,
                    is_hold: false,
                });
                setShowUnholdConfirm(false);
                setRecordForAction(null);
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
                const newStatusId = isRepo ? 1 : 8;
                updateInventoryRow(recordForAction.i_id, {
                    status: isRepo ? 'AVL' : 'REPO',
                    status_id: String(newStatusId),
                    container_status_id: newStatusId,
                });
                setShowRepoToggleConfirm(false);
                setRecordForAction(null);
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
            // Use the indexed numeric primary key for fast detail lookup. The
            // hashed value remains available for external links, but MD5(i_id)
            // forces a table scan in MySQL.
            const identifier = record.i_id;
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
                    dmf: formatManufacturedMonthYear(data.date_manufactured),
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
                    booking: data.booking,
                    shipper: data.shipper,
                    seal_no: data.seal_no,
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
                // Open the modal as soon as the database record is ready. Image
                // discovery is deliberately asynchronous so filesystem work does
                // not block the modal opening.
                if (response.data.data.images && Array.isArray(response.data.data.images) && response.data.data.images.length > 0) {
                    setContainerImages(normalizeViewerImages(response.data.data.images));
                } else {
                    setContainerImages([]);
                }
                setCurrentImageIndex(0);
                setShowViewModal(true);
                void fetchContainerImages(mappedRecord.date as string, mappedRecord.gate as string, mappedRecord.container_no);
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
            // Use the indexed numeric primary key for fast detail lookup.
            const identifier = record.i_id;
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
                    dmf: formatManufacturedMonthYear(data.date_manufactured),
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
                    booking: data.booking,
                    shipper: data.shipper,
                    seal_no: data.seal_no,
                    plate_no: data.plate_no,
                    hauler: data.hauler,
                    hauler_driver: data.hauler_driver,
                    license_no: data.license_no,
                    chasis: data.chasis,
                    contact_no: data.contact_no,
                    bill_of_lading: data.bill_of_lading,
                };
                setEditFormData(mappedRecord);
                setInitialEditFormData(mappedRecord);
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
        if (!editFormData || !hasEditChanges) return;

        if (normalizeManufacturedDate(editFormData.dmf) === null) {
            error('Date Manufactured must use MM/YYYY with a year from 1900 to the current year.');
            return;
        }

        setShowEditModal(false);
        setShowEditConfirm(true);
    };

    const handleConfirmEdit = async () => {
        if (!editFormData) return;

        try {
            // Use the indexed numeric primary key for the update lookup.
            const identifier = editFormData.i_id;
            const approvalNotesAdded = Boolean(
                !(initialEditFormData?.app_notes || '').trim() &&
                (editFormData.app_notes || '').trim()
            );
            
            // Prepare update payload
            const payload: Record<string, unknown> = {
                container_no: editFormData.container_no.toUpperCase(),
                client_id: editFormData.client_id,
                size_type: editFormData.size_type_id,
                container_status: editFormData.status_id,
                ...(isOutEdit ? {} : { class: editFormData.class }),
                booking: editFormData.booking?.toUpperCase(),
                shipper: editFormData.shipper?.toUpperCase(),
                vessel: editFormData.vessel?.toUpperCase(),
                voyage: editFormData.voyage?.toUpperCase(),
                location: editFormData.location?.toUpperCase(),
                remarks: editFormData.eir_notes?.toUpperCase(),
                plate_no: editFormData.plate_no?.toUpperCase(),
                hauler: editFormData.hauler?.toUpperCase(),
                ...(isOutEdit ? {} : { iso_code: editFormData.iso_code?.toUpperCase() }),
                origin: editFormData.checker?.toUpperCase(),
                ...(isOutEdit ? {} : { ex_consignee: editFormData.ex_consignee?.toUpperCase() }),
                hauler_driver: editFormData.hauler_driver?.toUpperCase(),
                license_no: editFormData.license_no?.toUpperCase(),
                chasis: editFormData.chasis?.toUpperCase(),
                seal_no: editFormData.seal_no,
                date_manufactured: normalizeManufacturedDate(editFormData.dmf),
                contact_no: editFormData.contact_no?.toUpperCase(),
                ...(isOutEdit ? {} : { bill_of_lading: editFormData.bill_of_lading?.toUpperCase() }),
                ...(isOutEdit ? {} : { approval_notes: editFormData.app_notes?.toUpperCase() }),
            };

            const response = await axios.put(`/api/inventory/${identifier}`, payload);

            if (response.data.success) {
                saveFieldHistory({
                    'inventory.container_no': editFormData.container_no,
                    'inventory.iso_code': editFormData.iso_code,
                    'inventory.vessel': editFormData.vessel,
                    'inventory.voyage': editFormData.voyage,
                    'inventory.checker': editFormData.checker,
                    'inventory.ex_consignee': editFormData.ex_consignee,
                    'inventory.plate_no': editFormData.plate_no,
                    'inventory.hauler': editFormData.hauler,
                    'inventory.hauler_driver': editFormData.hauler_driver,
                    'inventory.license_no': editFormData.license_no,
                    'inventory.location': editFormData.location,
                    'inventory.chasis': editFormData.chasis,
                    'inventory.contact_no': editFormData.contact_no,
                    'inventory.bill_of_lading': editFormData.bill_of_lading,
                    'inventory.remarks': editFormData.eir_notes,
                    'inventory.approval_notes': editFormData.app_notes,
                });
                success('Container updated successfully!');
                setShowEditConfirm(false);
                setShowEditModal(false);
                setReportData((previous) => previous.map((row) => {
                    if (row.i_id !== editFormData.i_id) return row;

                    const selectedClient = clients.find((client) => String(client.c_id) === String(editFormData.client_id));
                    const selectedSizeType = sizeTypeOptions.find((sizeType) => String(sizeType.s_id) === String(editFormData.size_type_id));

                    return {
                        ...row,
                        container_no: editFormData.container_no.toUpperCase(),
                        client_id: editFormData.client_id,
                        client: selectedClient?.name || row.client,
                        client_code: selectedClient?.code || row.client_code,
                        size: selectedSizeType ? `${selectedSizeType.size}${selectedSizeType.type}` : row.size,
                        size_type_id: editFormData.size_type_id,
                        iso_code: editFormData.iso_code,
                        approval_date: approvalNotesAdded
                            ? response.data.data?.approval_date || new Date().toISOString()
                            : row.approval_date,
                        status: editFormData.status,
                        status_id: editFormData.status_id,
                        container_status_id: Number(editFormData.status_id),
                        class: editFormData.class,
                        dmf: editFormData.dmf,
                        location: editFormData.location,
                        eir_notes: editFormData.eir_notes?.toUpperCase() || '',
                        app_notes: editFormData.app_notes?.toUpperCase() || '',
                    };
                }));
                setEditFormData(null);
                setInitialEditFormData(null);
            } else {
                error(response.data.message || 'Failed to update container');
            }
        } catch (err: unknown) {
            const error_caught = err as { response?: { data?: { message?: string } } };
            error(error_caught.response?.data?.message || 'Failed to update container');
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

    const handleCopyText = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            success(`Copied ${label}`);
        } catch {
            error(`Unable to copy ${label.toLowerCase()}`);
        }
    };

    const handleSearch = async (allowEmpty = false) => {
        const trimmedSearch = searchTerm.trim();
        if (!allowEmpty && !trimmedSearch && !appliedSearchTerm) {
            return;
        }
        setCurrentPage(1);
        await fetchInventory({ page: 1, perPage: itemsPerPage, search: searchTerm, showToast: true });
        setAppliedSearchTerm(trimmedSearch);
    };

    const handleFilterModalOpenChange = (open: boolean) => {
        if (!open && !filterModalApplyRef.current) {
            // Discard unsubmitted edits and keep the previously applied filter active.
            setFilters(appliedFilters);
        }
        filterModalApplyRef.current = false;
        setShowFiltersModal(open);
    };

    const openHighlightMode = () => {
        setHighlightSearchTerm('');
        setHighlightMatchCursor(0);
        setHighlightMode(true);
    };

    const closeHighlightMode = () => {
        setHighlightMode(false);
        setHighlightSearchTerm('');
        setHighlightMatchCursor(0);
        setHighlightColorMenuOpen(false);
    };

    const moveHighlightMatch = (direction: 1 | -1) => {
        if (highlightMatchIndexes.length === 0) return;
        setHighlightMatchCursor((current) => (
            (current + direction + highlightMatchIndexes.length) % highlightMatchIndexes.length
        ));
    };

    const handleApplyFilters = async () => {
        // Changing only the In/Out view must not apply a filter by itself.
        if (!canApplyFilters) return;
        await fetchInventory({
            page: 1,
            perPage: itemsPerPage,
            search: searchTerm,
            showToast: true,
            filterValues: filters,
        });
        setCurrentPage(1);
        setAppliedSearchTerm(searchTerm.trim());
        setAppliedFilters(filters);
        filterModalApplyRef.current = true;
        setShowFiltersModal(false);
    };

    const handleResetFilters = () => {
        if (!canResetFilters) return;
        setFilters(defaultFilters);
        setAppliedFilters(defaultFilters);
        setCurrentPage(1);
        void fetchInventory({
            page: 1,
            perPage: itemsPerPage,
            search: searchTerm,
            showToast: false,
            filterValues: defaultFilters,
        });
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
            <CachedFieldHistory />
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
                            onClick={() => void handleViewSummary()} 
                            disabled={loading || summaryLoading || reportData.length === 0}
                            className="px-6 py-3"
                        >
                            {summaryLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                            {summaryLoading ? 'Generating...' : 'View Summary Report'}
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
                                    <div className="flex gap-2">
                                        <Input
                                            type="text"
                                            placeholder="Search container no. or EIR no..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    void handleSearch();
                                                }
                                            }}
                                            className="pl-10 h-11"
                                        />
                                        <ModernButton
                                            type="button"
                                            variant="primary"
                                            onClick={() => void handleSearch()}
                                            disabled={loading || (!searchTerm.trim() && !appliedSearchTerm)}
                                            className="h-11 px-5 shrink-0"
                                        >
                                            Search
                                        </ModernButton>
                                        <button
                                            type="button"
                                            onClick={() => highlightMode ? closeHighlightMode() : openHighlightMode()}
                                            aria-pressed={highlightMode}
                                            aria-label={highlightMode ? 'Highlight ON' : 'Highlight OFF'}
                                            title={highlightMode ? 'Turn text highlighting off' : 'Turn text highlighting on'}
                                            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-sm font-medium shadow-xs transition-colors ${highlightMode
                                                ? 'border-yellow-400 bg-yellow-100 text-yellow-900 hover:bg-yellow-200'
                                                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                                            }`}
                                        >
                                            <Highlighter className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchTerm('');
                                                setAppliedSearchTerm('');
                                                setSortColumn('');
                                                setSortDirection('asc');
                                                setCurrentPage(1);
                                                void fetchInventory({
                                                    page: 1,
                                                    perPage: itemsPerPage,
                                                    search: '',
                                                    sortBy: '',
                                                    sortDir: 'asc',
                                                    showToast: false,
                                                });
                                            }}
                                            disabled={loading || !canResetSearch}
                                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 shadow-xs transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            title="Reset search and sorting"
                                            aria-label="Reset search and sorting"
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-1">
                                <Label className="text-sm font-semibold mb-2 text-gray-900">Filter Options</Label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowFiltersModal(true)}
                                        className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs"
                                        disabled={loading}
                                    >
                                        <Filter className="w-4 h-4 text-gray-600" />
                                        <span>Filters</span>
                                        {canResetFilters && (
                                            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs px-2 py-0.5">
                                                Active
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleResetFilters}
                                        disabled={loading || !canResetFilters}
                                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 shadow-xs transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        title="Reset filters"
                                        aria-label="Reset filters"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                    </button>
                                </div>
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
                <div className="relative w-full max-w-full overflow-x-auto">
                    {highlightMode && (
                        <div className="fixed right-4 top-4 z-40 flex h-14 w-[440px] items-center gap-2 rounded-xl bg-gray-800 px-3 shadow-xl ring-1 ring-black/20">
                            <Highlighter className="h-4 w-4 shrink-0 text-yellow-300" />
                            <Input
                                ref={highlightInputRef}
                                type="text"
                                value={highlightSearchTerm}
                                onChange={(event) => setHighlightSearchTerm(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        moveHighlightMatch(event.shiftKey ? -1 : 1);
                                    }
                                }}
                                placeholder="Find in current rows..."
                                aria-label="Find text to highlight"
                                className="h-9 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-white placeholder:text-gray-400 focus-visible:ring-0"
                            />
                            <div className="relative shrink-0 border-l border-gray-600 pl-2">
                                <button
                                    type="button"
                                    onClick={() => setHighlightColorMenuOpen((open) => !open)}
                                    aria-label="Choose highlight color"
                                    aria-expanded={highlightColorMenuOpen}
                                    title="Choose highlight color"
                                    className={`h-4 w-4 rounded-full ${highlightColorSwatchClasses[highlightColor]} ring-2 ring-white ring-offset-1 ring-offset-gray-800 transition-transform hover:scale-110`}
                                />
                                {highlightColorMenuOpen && (
                                    <div className="absolute right-0 top-8 z-50 flex gap-2 rounded-lg bg-gray-800 p-2 shadow-xl ring-1 ring-black/30">
                                        {(Object.keys(highlightColorSwatchClasses) as HighlightColor[]).map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => {
                                                    setHighlightColor(color);
                                                    setHighlightColorMenuOpen(false);
                                                }}
                                                aria-label={`${color} highlight`}
                                                aria-pressed={highlightColor === color}
                                                title={`${color.charAt(0).toUpperCase()}${color.slice(1)} highlight`}
                                                className={`h-4 w-4 rounded-full ${highlightColorSwatchClasses[color]} transition-transform hover:scale-125 ${highlightColor === color
                                                    ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-800'
                                                    : 'opacity-75 hover:opacity-100'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                            <span className="shrink-0 border-l border-gray-600 pl-3 text-xs text-gray-300" aria-live="polite">
                                {highlightMatchIndexes.length > 0
                                    ? `${activeHighlightCursor + 1} of ${highlightMatchIndexes.length}`
                                    : '0 of 0'}
                            </span>
                            <button
                                type="button"
                                onClick={() => moveHighlightMatch(-1)}
                                disabled={highlightMatchIndexes.length === 0}
                                className="rounded p-1.5 text-gray-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Previous highlighted container"
                                aria-label="Previous highlighted container"
                            >
                                <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => moveHighlightMatch(1)}
                                disabled={highlightMatchIndexes.length === 0}
                                className="rounded p-1.5 text-gray-300 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Next highlighted container"
                                aria-label="Next highlighted container"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={closeHighlightMode}
                                className="rounded p-1.5 text-gray-300 hover:bg-gray-700"
                                title="Close highlighting"
                                aria-label="Close highlighting"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
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
                                    sortable: true,
                                    disableRowClick: true,
                                    render: (row: InventoryRecord) => (
                                        <div 
                                            className="font-semibold text-gray-900 min-w-[40px]"
                                        >
                                            {highlightText(row.eir_no)}
                                        </div>
                                    )
                                },
                                { 
                                    key: 'container_no', 
                                    label: 'Cont. No.',
                                    sortable: true,
                                    disableRowClick: true,
                                    render: (row: InventoryRecord) => (
                                        <div className="flex items-center gap-1 min-w-[135px]">
                                            <button
                                                type="button"
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    void handleCopyText(row.container_no, row.container_no);
                                                }}
                                                className="inline-flex items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                                title="Copy container number"
                                                aria-label={`Copy container number ${row.container_no}`}
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    openLegacyPrintInOut(row);
                                                }}
                                                className="font-medium text-gray-900 underline underline-offset-2"
                                                title="Print IN/OUT legacy template"
                                            >
                                                {highlightText(row.container_no)}
                                            </button>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'client', 
                                    label: 'Client',
                                    sortable: true,
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-900 min-w-[120px] max-w-[150px]">
                                            <div className="font-medium">{highlightText(row.client)}</div>
                                            <div className="text-xs text-gray-500">{highlightText(row.client_code)}</div>
                                        </div>
                                    )
                                },
                                {
                                    key: 'info',
                                    label: 'Size / Status / Class',
                                    disableRowClick: true,
                                    headerRender: () => (
                                        <div className="flex flex-col items-start gap-0.5 text-xs uppercase leading-tight">
                                            {(['size', 'status', 'class'] as const).map((column) => (
                                                <button
                                                    key={column}
                                                    type="button"
                                                    className="inline-flex items-center gap-1 font-semibold hover:text-white/80"
                                                    onClick={(event) => { event.stopPropagation(); handleSort(column); }}
                                                    title={`Sort by ${column}`}
                                                >
                                                    {column === 'size' ? 'SIZE' : column === 'status' ? 'STATUS' : 'CLASS'}
                                                    {sortIconFor(column)}
                                                </button>
                                            ))}
                                        </div>
                                    ),
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
                                                    <ModernBadge variant={statusVariant}>{highlightText(row.status || '-')}</ModernBadge>
                                                </div>
                                                <div>
                                                    <ModernBadge variant={sizeVariant}>{highlightText(row.size || '-')}</ModernBadge>
                                                </div>
                                                <div>
                                                    <ModernBadge variant={classVariant}>{highlightText(row.class || '-')}</ModernBadge>
                                                </div>
                                            </div>
                                        );
                                    }
                                },
                                {
                                    key: 'date_days',
                                    label: 'DATE / TIME / DAYS',
                                    headerRender: () => (
                                        <div className="flex flex-col items-start gap-0.5 text-xs uppercase leading-tight">
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-1 font-semibold hover:text-white/80"
                                                onClick={(event) => { event.stopPropagation(); handleSort('date_days'); }}
                                                title="Sort by date and time"
                                            >
                                                DATE / TIME
                                                {sortIconFor('date_days')}
                                            </button>
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-1 font-semibold hover:text-white/80"
                                                onClick={(event) => { event.stopPropagation(); handleSort('days'); }}
                                                title="Sort by days"
                                            >
                                                DAYS
                                                {sortIconFor('days')}
                                            </button>
                                        </div>
                                    ),
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-600 min-w-[130px]">
                                            <div className="font-medium">{highlightText(formatDate(row.date))}</div>
                                            <div className="text-sm font-medium text-gray-600 mt-1">{highlightText(formatTime(row.time))}</div>
                                            <div className="mt-1">
                                                <span className="font-bold text-gray-900 text-sm">DAYS: {highlightText(formatDurationCompactFrom(row.date, row.time, row.days))}</span>
                                            </div>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'dmf', 
                                    label: 'Date mfd',
                                    sortable: true,
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-600 min-w-[80px]">{highlightText(formatMonthYear(row.dmf as string))}</div>
                                    )
                                },
                                { 
                                    key: 'location', 
                                    label: 'Loc',
                                    sortable: true,
                                    render: (row: InventoryRecord) => (
                                        <div className="text-sm text-gray-600 min-w-[40px]">{highlightText(row.location)}</div>
                                    )
                                },
                                { 
                                    key: 'eir_notes', 
                                    label: 'EIR Notes',
                                    disableRowClick: true,
                                    render: (row: InventoryRecord) => (
                                        <div className="min-w-[200px] max-w-[250px]">
                                            {row.eir_notes && row.eir_notes.trim() ? (
                                                <div className="flex items-start gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e: React.MouseEvent) => {
                                                            e.stopPropagation();
                                                            void handleCopyText(row.eir_notes, 'EIR notes');
                                                        }}
                                                        className="inline-flex shrink-0 items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                                        title="Copy EIR notes"
                                                        aria-label="Copy EIR notes"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    <span className="text-sm text-gray-600 break-words" title={row.eir_notes}>{highlightText(row.eir_notes)}</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-600">-</span>
                                            )}
                                        </div>
                                    )
                                },
                                { 
                                    key: 'app_notes', 
                                    label: 'App Notes',
                                    disableRowClick: true,
                                    render: (row: InventoryRecord) => (
                                        <div className="flex items-center gap-2 min-w-[150px]">
                                            {row.app_notes && row.app_notes.trim() ? (
                                                <div className="flex items-start gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e: React.MouseEvent) => {
                                                            e.stopPropagation();
                                                            void handleCopyText(row.app_notes, 'App notes');
                                                        }}
                                                        className="inline-flex shrink-0 items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                                        title="Copy app notes"
                                                        aria-label="Copy app notes"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    <span className="text-sm text-gray-600">{highlightText(row.app_notes)}</span>
                                                </div>
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
                                                    variant="print"
                                                    size="sm"
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); openLegacyPrintSingle(row); }}
                                                    title="Print"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                </ModernButton>

                                                <ModernButton 
                                                    variant="edit" 
                                                    size="sm" 
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleOpenEditModal(row); }}
                                                    title="Edit Container"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </ModernButton>

                                                {row.is_hold ? (
                                                    <ModernButton
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleOpenUnholdConfirm(row); }}
                                                        title="Remove from Hold"
                                                        disabled={updatingStatus || !canUseInventoryToggles(row)}
                                                    >
                                                        <Unlock className="w-3.5 h-3.5" />
                                                    </ModernButton>
                                                ) : (
                                                    <ModernButton
                                                        variant="toggle"
                                                        size="sm"
                                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleOpenHoldModal(row); }}
                                                        title="Place on Hold"
                                                        disabled={updatingStatus || !canUseInventoryToggles(row)}
                                                    >
                                                        <Lock className="w-3.5 h-3.5" />
                                                    </ModernButton>
                                                )}

                                                <ModernButton
                                                    variant={row.container_status_id === 8 ? "add" : "repo"}
                                                    size="sm"
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleOpenRepoToggleConfirm(row); }}
                                                    title={row.container_status_id === 8 ? "Update to Available" : "Update to Repo"}
                                                    disabled={updatingStatus || !canUseInventoryToggles(row)}
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
                            onSort={handleSort}
                            sortColumn={sortColumn === 'date_time' ? 'date_days' : sortColumn}
                            sortDirection={sortDirection}
                            data={inventoryTableData}
                            contentKey={highlightMode ? `${highlightSearchTerm}:${highlightColor}` : ''}
                            scrollToIndex={activeHighlightRowIndex}
                            copyHeaders={[
                                'EIR NO.',
                                'CONT. NO.',
                                'CLIENT',
                                'SIZE',
                                'STATUS',
                                'CLASS',
                                'DATE',
                                'TIME',
                                'DAYS',
                                'DATE MFD',
                                'LOC',
                                'EIR NOTES',
                                'APP NOTES',
                            ]}
                            copyRow={(row: InventoryRecord) => [
                                row.eir_no,
                                row.container_no,
                                row.client_code ? `${row.client_code} - ${row.client}` : row.client,
                                row.size,
                                row.status,
                                row.class,
                                formatDate(row.date),
                                formatTime(row.time),
                                formatDurationCompactFrom(row.date, row.time, row.days),
                                formatMonthYear(row.dmf as string),
                                row.location,
                                row.eir_notes,
                                row.app_notes,
                            ]}
                            virtualized
                            rowHeight={128}
                            useWindowScroll
                            onReachEnd={filters.gate_status === 'BOTH' ? loadMoreHistorical : undefined}
                        />
                    ) : (
                        <div className="text-center py-12">
                            <p style={{ color: colors.text.secondary }}>No inventory records found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Filters Modal */}
            <Dialog open={showFiltersModal} onOpenChange={handleFilterModalOpenChange}>
                <DialogContent className="!max-w-6xl !w-[90vw] !max-h-[90vh] overflow-y-auto">
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
                                <Select value={filters.gate_status || 'CURRENTLY'} onValueChange={handleGateStatusChange}>
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
                                <Label className="text-sm font-semibold mb-2">Status</Label>
                                <Select value={filters.status_in} onValueChange={(value) => handleFilterChange('status_in', value)}>
                                    <SelectTrigger className="mt-1.5">
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        {statusesIn.map((status) => (
                                            <SelectItem key={status.s_id} value={String(status.s_id)}>
                                                {status.status}
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
                                <Label className="text-sm font-semibold mb-2">
                                    Gate IN (Date From)
                                    {['IN', 'BOTH'].includes(filters.gate_status) && <span className="ml-1 text-xs font-normal text-red-600">required *</span>}
                                </Label>
                                {renderDateFilterInput('date_in_from', gateInDateFiltersEnabled)}
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">
                                    Gate IN (Date To)
                                    {['IN', 'BOTH'].includes(filters.gate_status) && <span className="ml-1 text-xs font-normal text-red-600">required *</span>}
                                </Label>
                                {renderDateFilterInput('date_in_to', gateInDateFiltersEnabled)}
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Hauler</Label>
                                <Input
                                    type="text"
                                    value={filters.hauler_in}
                                    onChange={(e) => handleFilterChange('hauler_in', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Vessel</Label>
                                <Input
                                    type="text"
                                    value={filters.vessel_in}
                                    onChange={(e) => handleFilterChange('vessel_in', e.target.value)}
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
                                <Label className="text-sm font-semibold mb-2">
                                    Gate OUT (Date From)
                                    {['OUT', 'BOTH'].includes(filters.gate_status) && <span className="ml-1 text-xs font-normal text-red-600">required *</span>}
                                </Label>
                                {renderDateFilterInput('date_out_from', gateOutDateFiltersEnabled)}
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">
                                    Gate OUT (Date To)
                                    {['OUT', 'BOTH'].includes(filters.gate_status) && <span className="ml-1 text-xs font-normal text-red-600">required *</span>}
                                </Label>
                                {renderDateFilterInput('date_out_to', gateOutDateFiltersEnabled)}
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
                                <Label className="text-sm font-semibold mb-2">Consignee</Label>
                                <Input
                                    type="text"
                                    value={filters.consignee}
                                    onChange={(e) => handleFilterChange('consignee', e.target.value)}
                                    className="mt-1.5"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold mb-2">Plate No.</Label>
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
                            disabled={loading || !canResetFilters}
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                        </ModernButton>
                        <ModernButton
                            variant="primary"
                            onClick={handleApplyFilters}
                            disabled={loading || !canApplyFilters}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
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

            <ImageViewerModal
                open={showImageViewer}
                onOpenChange={setShowImageViewer}
                images={containerImages}
                currentIndex={currentImageIndex}
                onIndexChange={setCurrentImageIndex}
            />

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
                                data-history-key="inventory.approval_notes"
                                value={approvalNotes}
                                onChange={(e) => setApprovalNotes(e.target.value.toUpperCase())}
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
                                        <Label className="text-xs uppercase text-gray-600">{viewRecord.gate === 'OUT' ? 'Gate Out Date' : 'Gate In Date'}</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.date}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">{viewRecord.gate === 'OUT' ? 'Gate Out Time' : 'Gate In Time'}</Label>
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
                                    {viewRecord.gate !== 'OUT' && (
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">ISO Code</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.iso_code || 'N/A'}</p>
                                    </div>
                                    )}
                                    {viewRecord.gate === 'OUT' && (
                                        <div>
                                            <Label className="text-xs uppercase text-gray-600">Load</Label>
                                            <p className="mt-1 text-gray-900">{viewRecord.load || 'N/A'}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Column 2 */}
                                <div className="space-y-3">
                                    {viewRecord.gate !== 'OUT' && (
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Class</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.class}</p>
                                    </div>
                                    )}
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
                                    {viewRecord.gate !== 'OUT' && (
                                        <div>
                                            <Label className="text-xs uppercase text-gray-600">Consignee</Label>
                                            <p className="mt-1 text-gray-900">{viewRecord.ex_consignee || 'N/A'}</p>
                                        </div>
                                    )}
                                    {viewRecord.gate !== 'OUT' && (
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Load</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.load || 'N/A'}</p>
                                    </div>
                                    )}
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Plate No.</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.plate_no || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Hauler</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.hauler || 'N/A'}</p>
                                    </div>
                                    {viewRecord.gate === 'OUT' && (
                                        <div>
                                            <Label className="text-xs uppercase text-gray-600">Hauler Driver</Label>
                                            <p className="mt-1 text-gray-900">{viewRecord.hauler_driver || 'N/A'}</p>
                                        </div>
                                    )}
                                    {viewRecord.gate === 'OUT' && (
                                        <>
                                            <div>
                                                <Label className="text-xs uppercase text-gray-600">Booking</Label>
                                                <p className="mt-1 text-gray-900">{viewRecord.booking || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <Label className="text-xs uppercase text-gray-600">Shipper</Label>
                                                <p className="mt-1 text-gray-900">{viewRecord.shipper || 'N/A'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Column 3 */}
                                <div className="space-y-3">
                                    {viewRecord.gate !== 'OUT' && (
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Hauler Driver</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.hauler_driver || 'N/A'}</p>
                                    </div>
                                    )}
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">License No.</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.license_no || 'N/A'}</p>
                                    </div>
                                    {viewRecord.gate === 'OUT' && (
                                        <div>
                                            <Label className="text-xs uppercase text-gray-600">Seal No.</Label>
                                            <p className="mt-1 text-gray-900">{viewRecord.seal_no || 'N/A'}</p>
                                        </div>
                                    )}
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
                                    {viewRecord.gate !== 'OUT' && (
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Bill of Lading</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.bill_of_lading || 'N/A'}</p>
                                    </div>
                                    )}
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
                                    {viewRecord.gate !== 'OUT' && (
                                    <div>
                                        <Label className="text-xs uppercase text-gray-600">Approval Notes</Label>
                                        <p className="mt-1 text-gray-900">{viewRecord.app_notes || 'N/A'}</p>
                                    </div>
                                    )}
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
                                        data-history-key="inventory.container_no"
                                        value={editFormData.container_no} 
                                        onChange={(e) => setEditFormData({...editFormData, container_no: e.target.value.toUpperCase()})}
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
                                        <SelectTrigger className="min-w-0">
                                            <SelectValue
                                                placeholder="Select client"
                                                className="min-w-0 flex-1 truncate whitespace-nowrap"
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clients.map((client) => (
                                                <SelectItem
                                                    key={client.c_id}
                                                    value={client.c_id.toString()}
                                                    className="min-w-0"
                                                >
                                                    <span className="block max-w-full truncate whitespace-nowrap">
                                                        {client.text}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label className="text-gray-900">{isOutEdit ? 'Gate Out Date' : 'Gate In Date'}</Label>
                                    <Input 
                                        type="date"
                                        value={editFormData.date} 
                                        onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">{isOutEdit ? 'Gate Out Time' : 'Gate In Time'}</Label>
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
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={7}
                                        placeholder="mm/yyyy"
                                        value={editFormData.dmf}
                                        onChange={(e) => setEditFormData({
                                            ...editFormData,
                                            dmf: formatManufacturedInput(e.target.value, editFormData.dmf),
                                        })}
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
                                {!isOutEdit && (
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
                                )}
                                <div>
                                    <Label className="text-gray-900">Size/Type</Label>
                                    <Select 
                                        value={editFormData.size_type_id?.toString() || ''} 
                                        onValueChange={(value) => {
                                            const selectedSize = sizeTypeOptions.find(s => s.s_id.toString() === value);
                                            setEditFormData({
                                                ...editFormData, 
                                                size_type_id: parseInt(value),
                                                size: selectedSize ? `${selectedSize.size}${selectedSize.type}` : '',
                                                iso_code: selectedSize
                                                    ? getIsoCodeForSizeType(selectedSize.size, selectedSize.type)
                                                    : ''
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
                                {!isOutEdit && (
                                    <div>
                                        <Label className="text-gray-900">ISO Code</Label>
                                        <Input 
                                            data-history-key="inventory.iso_code"
                                            value={editFormData.iso_code || ''} 
                                            onChange={(e) => setEditFormData({...editFormData, iso_code: e.target.value.toUpperCase()})}
                                        />
                                    </div>
                                )}
                                {isOutEdit && (
                                    <div>
                                        <Label className="text-gray-900">Checker</Label>
                                        <Input
                                            data-history-key="inventory.checker"
                                            value={editFormData.checker || ''}
                                            onChange={(e) => setEditFormData({...editFormData, checker: e.target.value.toUpperCase()})}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Column 2 */}
                            <div className="space-y-3">
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
                                {!isOutEdit && (
                                <div>
                                    <Label className="text-gray-900">Checker</Label>
                                    <Input
                                        data-history-key="inventory.checker"
                                        value={editFormData.checker || ''}
                                        onChange={(e) => setEditFormData({...editFormData, checker: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                )}
                                <div>
                                    <Label className="text-gray-900">Vessel</Label>
                                    <Input 
                                        data-history-key="inventory.vessel"
                                        value={editFormData.vessel || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, vessel: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Voyage</Label>
                                    <Input 
                                        data-history-key="inventory.voyage"
                                        value={editFormData.voyage || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, voyage: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                {!isOutEdit && (
                                <div>
                                    <Label className="text-gray-900">Consignee</Label>
                                    <Input 
                                        data-history-key="inventory.ex_consignee"
                                        value={editFormData.ex_consignee || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, ex_consignee: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                )}
                                <div>
                                    <Label className="text-gray-900">Plate No.</Label>
                                    <Input 
                                        data-history-key="inventory.plate_no"
                                        value={editFormData.plate_no || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, plate_no: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Hauler</Label>
                                    <Input 
                                        data-history-key="inventory.hauler"
                                        value={editFormData.hauler || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, hauler: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                {!isOutEdit && (
                                    <>
                                        <div>
                                            <Label className="text-gray-900">Hauler Driver</Label>
                                            <Input
                                                data-history-key="inventory.hauler_driver"
                                                value={editFormData.hauler_driver || ''}
                                                onChange={(e) => setEditFormData({...editFormData, hauler_driver: e.target.value.toUpperCase()})}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-gray-900">License No.</Label>
                                            <Input
                                                data-history-key="inventory.license_no"
                                                value={editFormData.license_no || ''}
                                                onChange={(e) => setEditFormData({...editFormData, license_no: e.target.value.toUpperCase()})}
                                            />
                                        </div>
                                    </>
                                )}
                                {isOutEdit && (
                                    <>
                                        <div>
                                            <Label className="text-gray-900">Hauler Driver</Label>
                                            <Input
                                                data-history-key="inventory.hauler_driver"
                                                value={editFormData.hauler_driver || ''}
                                                onChange={(e) => setEditFormData({...editFormData, hauler_driver: e.target.value.toUpperCase()})}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-gray-900">License No.</Label>
                                            <Input
                                                data-history-key="inventory.license_no"
                                                value={editFormData.license_no || ''}
                                                onChange={(e) => setEditFormData({...editFormData, license_no: e.target.value.toUpperCase()})}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-gray-900">Chasis</Label>
                                            <Input
                                                data-history-key="inventory.chasis"
                                                value={editFormData.chasis || ''}
                                                onChange={(e) => setEditFormData({...editFormData, chasis: e.target.value.toUpperCase()})}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Column 3 */}
                            <div className="space-y-3">
                                {isOutEdit && (
                                    <>
                                        <div>
                                            <Label className="text-gray-900">Booking</Label>
                                            <Input
                                                data-history-key="inventory.booking"
                                                value={editFormData.booking || ''}
                                                onChange={(e) => setEditFormData({...editFormData, booking: e.target.value.toUpperCase()})}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-gray-900">Seal No.</Label>
                                            <Input
                                                data-history-key="inventory.seal_no"
                                                value={editFormData.seal_no || ''}
                                                onChange={(e) => setEditFormData({...editFormData, seal_no: e.target.value.toUpperCase()})}
                                            />
                                        </div>
                                    </>
                                )}
                                <div>
                                    <Label className="text-gray-900">Location</Label>
                                    <Input 
                                        data-history-key="inventory.location"
                                        value={editFormData.location} 
                                        onChange={(e) => setEditFormData({...editFormData, location: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">{isOutEdit ? 'Shipper' : 'Chasis'}</Label>
                                    <Input
                                        data-history-key={isOutEdit ? 'inventory.shipper' : 'inventory.chasis'}
                                        maxLength={isOutEdit ? 75 : undefined}
                                        value={isOutEdit ? (editFormData.shipper || '') : (editFormData.chasis || '')}
                                        onChange={(e) => setEditFormData({
                                            ...editFormData,
                                            [isOutEdit ? 'shipper' : 'chasis']: e.target.value.toUpperCase(),
                                        })}
                                    />
                                </div>
                                <div>
                                    <Label className="text-gray-900">Contact No.</Label>
                                    <Input 
                                        data-history-key="inventory.contact_no"
                                        value={editFormData.contact_no || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, contact_no: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                {!isOutEdit && (
                                <div>
                                    <Label className="text-gray-900">Bill of Lading</Label>
                                    <Input 
                                        data-history-key="inventory.bill_of_lading"
                                        value={editFormData.bill_of_lading || ''} 
                                        onChange={(e) => setEditFormData({...editFormData, bill_of_lading: e.target.value.toUpperCase()})}
                                    />
                                </div>
                                )}
                                <div>
                                    <Label className="text-gray-900">Remarks (EIR Notes)</Label>
                                    <Textarea 
                                        data-history-key="inventory.remarks"
                                        value={editFormData.eir_notes} 
                                        onChange={(e) => setEditFormData({...editFormData, eir_notes: e.target.value.toUpperCase()})}
                                        className="min-h-[80px]"
                                    />
                                </div>
                                {!isOutEdit && (
                                <div>
                                    <Label className="text-gray-900">Approval Notes (Max 300 characters)</Label>
                                    <Textarea 
                                        data-history-key="inventory.approval_notes"
                                        value={editFormData.app_notes} 
                                        onChange={(e) => setEditFormData({...editFormData, app_notes: e.target.value.toUpperCase()})}
                                        maxLength={300}
                                        rows={4}
                                        className="min-h-[80px]"
                                    />
                                    <div className="text-xs text-gray-600 text-right">
                                        {(editFormData.app_notes || '').length}/300
                                    </div>
                                </div>
                                )}
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
                            disabled={!hasEditChanges}
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

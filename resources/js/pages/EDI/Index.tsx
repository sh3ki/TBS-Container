import { ModernBadge, ModernButton, ModernConfirmDialog, ModernTable, ToastContainer, useModernToast } from '@/components/modern';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { colors } from '@/lib/colors';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import {
    Edit3,
    Download,
    Eye,
    EyeOff,
    FileCode2,
    LoaderCircle,
    Plus,
    Power,
    RefreshCw,
    Save,
    Send,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface EdiField {
    source_column: string;
    output_order: number;
    transform?: string | null;
    is_enabled: boolean;
}
interface EdiDirection {
    direction: 'IN' | 'OUT';
    file_type: 'EDI' | 'TXT';
    sample_filename?: string | null;
    mappings?: Array<{ token: string; source_column: string }>;
    mapping_suggestions?: Array<{ token: string; source_column: string; segment?: string; element?: number; meaning?: string }>;
    structure_analysis?: {
        standard?: string;
        element_separator?: string;
        component_separator?: string;
        segment_terminator?: string;
        segment_count?: number;
        segments?: Array<{ tag: string; element_count: number; qualifier?: string | null }>;
        unique_segments?: Array<{ tag: string; element_count: number; qualifier?: string | null }>;
        mapping_options?: Array<{ key: string; token?: string | null; segment: string; element: number; label: string; meaning?: string | null; source_column?: string | null; catalog_meaning?: string | null }>;
        analysis_source?: 'ai' | 'fallback';
        analysis_message?: string;
        ai_layout?: { segments?: Array<{ tag: string; element_count?: number; qualifier?: string | null }> } | null;
    };
    draft_token?: string;
}
interface EdiLog extends Record<string, unknown> {
    log_id: number;
    profile_id: number;
    direction: 'IN' | 'OUT';
    filename: string;
    transaction_count: number;
    status: string;
    attempts: number;
    error_message?: string | null;
    created_at: string;
}
interface EdiProfile extends Record<string, unknown> {
    profile_id: number;
    profile_name: string;
    client_id: number | null;
    legacy_key: string;
    edi_type: string;
    direction_mode?: 'IN' | 'OUT' | 'BOTH';
    source_table: string;
    is_enabled: boolean;
    manual_enabled: boolean;
    automatic_enabled: boolean;
    start_time: string | null;
    end_time: string | null;
    interval_seconds: number;
    batch_limit: number;
    delimiter: string;
    line_ending: 'LF' | 'CRLF';
    record_terminator: string;
    terminator_mode: 'once' | 'per_record';
    destination_type: string;
    destination_config: Record<string, string>;
    credentials?: Record<string, string>;
    credential_metadata?: {
        host?: string | null;
        port?: string | number | null;
        username?: string | null;
        has_password?: boolean;
        has_api_key?: boolean;
    };
    has_credentials: boolean;
    notes: string | null;
    fields: EdiField[];
    directions?: EdiDirection[];
}
interface ClientOption {
    c_id: number;
    client_code: string;
    client_name: string;
}

const sourceFields = [
    'i_id',
    'gate_status',
    'date_added',
    'container_no',
    'client_id',
    'container_status',
    'size_type',
    'iso_code',
    'class',
    'date_manufactured',
    'vessel',
    'voyage',
    'origin',
    'ex_consignee',
    'load_type',
    'plate_no',
    'hauler',
    'hauler_driver',
    'license_no',
    'location',
    'chasis',
    'contact_no',
    'bill_of_lading',
    'booking',
    'shipper',
    'seal_no',
    'remarks',
    'user_id',
    'complete',
    'out_id',
];
const clone = (profile: EdiProfile): EdiProfile => ({
    ...profile,
    destination_config: { ...(profile.destination_config || {}) },
    credentials: { ...(profile.credentials || {}) },
    fields: profile.fields.map((field) => ({ ...field })),
});

export default function Index() {
    const { toasts, removeToast, success, error: showError } = useModernToast();
    const [profiles, setProfiles] = useState<EdiProfile[]>([]);
    const [logs, setLogs] = useState<EdiLog[]>([]);
    const [logsPage, setLogsPage] = useState(1);
    const [logsPerPage, setLogsPerPage] = useState(25);
    const [logsPagination, setLogsPagination] = useState({ currentPage: 1, totalPages: 1, total: 0, perPage: 25 });
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [selected, setSelected] = useState<EdiProfile | null>(null);
    const [viewOpen, setViewOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [credentials, setCredentials] = useState({
        host: '',
        port: '',
        username: '',
        password: '',
        api_key: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState<number | null>(null);
    const [toggling, setToggling] = useState<number | null>(null);
    const [toggleProfileTarget, setToggleProfileTarget] = useState<EdiProfile | null>(null);
    const [generating, setGenerating] = useState<number | null>(null);
    const [generateOpen, setGenerateOpen] = useState(false);
    const [sendOpen, setSendOpen] = useState(false);
    const [sendProfile, setSendProfile] = useState<EdiProfile | null>(null);
    const [sendDirection, setSendDirection] = useState<'IN' | 'OUT' | 'BOTH'>('BOTH');
    const [generateProfile, setGenerateProfile] = useState<EdiProfile | null>(null);
    const [generateDirection, setGenerateDirection] = useState<'IN' | 'OUT' | 'BOTH'>('BOTH');
    const [generateFileType, setGenerateFileType] = useState<'EDI' | 'TXT'>('EDI');
    const [generateStartDate, setGenerateStartDate] = useState('');
    const [generateEndDate, setGenerateEndDate] = useState('');
    const [generateStartTime, setGenerateStartTime] = useState('');
    const [generateEndTime, setGenerateEndTime] = useState('');
    const [generateSentMode, setGenerateSentMode] = useState<'unsent' | 'sent' | 'both'>('unsent');
    const [sampleFiles, setSampleFiles] = useState<{ IN: File | null; OUT: File | null }>({ IN: null, OUT: null });
    const [sampleAnalyzing, setSampleAnalyzing] = useState<{ IN: boolean; OUT: boolean }>({ IN: false, OUT: false });
    const [mappingSelections, setMappingSelections] = useState<{ IN: Record<string, string>; OUT: Record<string, string> }>({ IN: {}, OUT: {} });
    const [secretsVisible, setSecretsVisible] = useState(false);

    const load = async (page = logsPage, perPage = logsPerPage) => {
        setLoading(true);
        try {
            const [profiles, clientList, logList] = await Promise.all([
                axios.get('/api/edi/profiles'),
                axios.get('/api/edi/clients'),
                axios.get(`/api/edi/logs?page=${page}&per_page=${perPage}`),
            ]);
            setProfiles(profiles.data.data || []);
            setClients(clientList.data.data || []);
            setLogs(logList.data.data?.data || []);
            const meta = logList.data.data || {};
            setLogsPage(meta.current_page || page);
            setLogsPerPage(meta.per_page || perPage);
            setLogsPagination({
                currentPage: meta.current_page || page,
                totalPages: meta.last_page || 1,
                total: meta.total || 0,
                perPage: meta.per_page || perPage,
            });
        } catch {
            showError('Unable to load EDI profiles.');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, []);
    const clientName = (id: number | null) => {
        const client = clients.find((item) => item.c_id === id);
        return client
            ? `${client.client_code} - ${client.client_name}`
            : `Client ${id ?? 'not assigned'}`;
    };
    const update = (changes: Partial<EdiProfile>) =>
        setSelected((current) =>
            current ? { ...current, ...changes } : current,
        );
    const openView = (profile: EdiProfile) => {
        setSelected(clone(profile));
        setViewOpen(true);
    };
    const openEdit = (profile: EdiProfile) => {
        setSelected(clone(profile));
        setIsAdding(false);
        setCredentials({
            host: profile.credential_metadata?.host || '',
            port: profile.credential_metadata?.port?.toString() || '',
            username: profile.credential_metadata?.username || '',
            password: '',
            api_key: '',
        });
        setSecretsVisible(false);
        setEditOpen(true);
    };
    const openAdd = () => {
        setSelected({
            profile_id: 0,
            profile_name: '',
            client_id: clients[0]?.c_id ?? null,
            legacy_key: '',
            edi_type: 'CODECO',
            direction_mode: 'BOTH',
            source_table: 'inventory',
            is_enabled: false,
            manual_enabled: true,
            automatic_enabled: false,
            start_time: null,
            end_time: null,
            interval_seconds: 300,
            max_attempts: 3,
            retry_delay_seconds: 120,
            batch_limit: 500,
            delimiter: 'TAB',
            line_ending: 'LF',
            record_terminator: 'ENDRECORD',
            terminator_mode: 'once',
            destination_type: 'manual',
            destination_config: {},
            has_credentials: false,
            notes: null,
            fields: sourceFields.map((source_column, index) => ({
                source_column,
                output_order: index + 1,
                is_enabled: true,
            })),
            directions: [],
        });
        setCredentials({
            host: '',
            port: '',
            username: '',
            password: '',
            api_key: '',
        });
        setSecretsVisible(false);
        setIsAdding(true);
        setEditOpen(true);
    };
    const interval = useMemo(() => {
        const total = selected?.interval_seconds || 0;
        return {
            hours: Math.floor(total / 3600),
            minutes: Math.floor((total % 3600) / 60),
            seconds: total % 60,
        };
    }, [selected?.interval_seconds]);
    const analyzeSampleFile = async (_direction: 'IN' | 'OUT', _file: File) => {
        // Sample uploads are intentionally disabled. Client-specific EDI
        // structures are maintained as fixed application formatters.
    };
    const setIntervalValue = (
        hours: number,
        minutes: number,
        seconds: number,
    ) => update({ interval_seconds: hours * 3600 + minutes * 60 + seconds });
    const save = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            const profilePayload = {
                ...selected,
            };
            const isFileTransfer = ['sftp', 'ftp', 'ftps'].includes(selected.destination_type);
            const entered = Object.fromEntries(
                Object.entries(credentials).filter(([key, value]) => {
                    // Port and username are non-secret editable values. Keep
                    // an empty port in the request so the server can remove a
                    // previously saved value such as 22.
                    if (isFileTransfer && (key === 'port' || key === 'username')) return true;
                    return Boolean(value) && (secretsVisible || !['password', 'api_key'].includes(key));
                }),
            );
            const response = isAdding
                ? await axios.post('/api/edi/profiles', {
                      ...profilePayload,
                      credentials: entered,
                  })
                : await axios.put(
                      `/api/edi/profiles/${selected.profile_id}`,
                      Object.keys(entered).length
                          ? { ...profilePayload, credentials: entered }
                          : profilePayload,
                  );
            const saved = response.data.data as EdiProfile;
            setProfiles((current) =>
                isAdding
                    ? [...current, saved]
                    : current.map((item) =>
                          item.profile_id === saved.profile_id ? saved : item,
                      ),
            );
            setSelected(clone(saved));
            setIsAdding(false);
            setEditOpen(false);
            success(isAdding ? 'EDI profile created.' : 'EDI profile saved.');
        } catch (error: any) {
            showError(error?.response?.data?.message || 'Unable to save EDI profile.');
        } finally {
            setSaving(false);
        }
    };
    const revealSecrets = async () => {
        if (!selected?.profile_id) return;
        if (secretsVisible) {
            setCredentials((current) => ({ ...current, password: '', api_key: '' }));
            setSecretsVisible(false);
            return;
        }
        try {
            const response = await axios.get(`/api/edi/profiles/${selected.profile_id}/credentials`);
            setCredentials((current) => ({
                ...current,
                password: response.data.data?.password || '',
                api_key: response.data.data?.api_key || '',
            }));
            setSecretsVisible(true);
        } catch {
            showError('Unable to reveal the saved credentials.');
        }
    };
    const sendNow = async (profile: EdiProfile) => {
        setSendProfile(profile);
        setSendDirection(profile.direction_mode || 'BOTH');
        setGenerateFileType('EDI');
        setGenerateStartDate('');
        setGenerateEndDate('');
        setGenerateStartTime('');
        setGenerateEndTime('');
        setGenerateSentMode('unsent');
        setSendOpen(true);
    };
    const requestToggleProfile = (profile: EdiProfile) => {
        setToggleProfileTarget(profile);
    };
    const toggleProfile = async () => {
        if (!toggleProfileTarget) return;
        const profile = toggleProfileTarget;
        setToggling(profile.profile_id);
        try {
            await axios.post(`/api/edi/profiles/${profile.profile_id}/toggle`);
            await load();
            success(`${profile.profile_name} ${profile.is_enabled ? 'disabled' : 'enabled'}.`);
        } catch (error: any) {
            showError(error?.response?.data?.message || 'Unable to toggle EDI profile.');
        } finally {
            setToggling(null);
            setToggleProfileTarget(null);
        }
    };
    const sendManual = async () => {
        if (!sendProfile) return;
        setSending(sendProfile.profile_id);
        try {
            const response = await axios.post(
                `/api/edi/profiles/${sendProfile.profile_id}/send`,
                {
                    file_type: generateFileType,
                    direction: sendDirection,
                    start_date: generateStartDate || null,
                    end_date: generateEndDate || null,
                    start_time: generateStartTime || null,
                    end_time: generateEndTime || null,
                    sent_mode: generateSentMode,
                },
            );
            await load();
            success(`EDI send completed for ${response.data.data?.count || 0} direction(s).`);
            setSendOpen(false);
        } catch (error: any) {
            showError(error?.response?.data?.message || 'Unable to queue EDI send.');
        } finally {
            setSending(null);
        }
    };
    const retryLog = async (log: EdiLog) => {
        try {
            await axios.post(`/api/edi/logs/${log.log_id}/retry`);
            await load();
            success(`Retry requested for ${log.filename}.`);
        } catch (error: any) {
            showError(error?.response?.data?.message || 'Unable to retry EDI log.');
        }
    };
    const generateDownload = async () => {
        if (!generateProfile) return;
        setGenerating(generateProfile.profile_id);
        try {
            const response = await axios.post(`/api/edi/profiles/${generateProfile.profile_id}/generate`, {
                direction: generateDirection,
                file_type: generateFileType,
                start_date: generateStartDate || null,
                end_date: generateEndDate || null,
                start_time: generateStartTime || null,
                end_time: generateEndTime || null,
                sent_mode: generateSentMode,
            });
            const results = response.data.data?.results || [];
            if (!results.length) {
                showError('No eligible inventory transactions were found for the selected direction and date/time filters.');
            } else {
                results.forEach((result: { download_url: string }) => window.open(result.download_url, '_blank'));
                await load();
                success(`${results.length} comparison file${results.length === 1 ? '' : 's'} generated for download.`);
                setGenerateOpen(false);
            }
        } catch (error: any) {
            showError(error?.response?.data?.message || 'Unable to generate the EDI comparison file.');
        } finally {
            setGenerating(null);
        }
    };
    const setFieldEnabled = (fieldName: string, isEnabled: boolean) => {
        if (!selected) return;
        const existing = selected.fields.find((field) => field.source_column === fieldName);
        update({
            fields: existing
                ? selected.fields.map((field) =>
                      field.source_column === fieldName
                          ? { ...field, is_enabled: isEnabled }
                          : field,
                  )
                : [
                      ...selected.fields,
                      {
                          source_column: fieldName,
                          output_order: selected.fields.length + 1,
                          is_enabled: isEnabled,
                      },
                  ],
        });
    };
    const destination = selected?.destination_config || {};

    return (
        <AuthenticatedLayout>
            <Head title="EDI" />
            <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="rounded-xl p-3"
                            style={{ backgroundColor: colors.brand.primary }}
                        >
                            <FileCode2 className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                EDI
                            </h1>
                            <p className="mt-1 text-sm text-gray-600">
                                Configure inventory exports and delivery
                                schedules
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ModernButton variant="add" size="sm" onClick={openAdd}>
                            <Plus className="h-4 w-4" />
                            Add EDI Profile
                        </ModernButton>
                        <button
                            onClick={load}
                            className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </button>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-900">EDI Logs</h2>
                        <span className="text-xs text-gray-500">Delivery history, retries, and generated files</span>
                    </div>
                    <div className="w-full overflow-x-auto">
                        <ModernTable<EdiLog>
                            loading={loading}
                            data={logs}
                            emptyMessage="No EDI delivery logs"
                            pagination={{
                                ...logsPagination,
                                onPageChange: (page) => void load(page, logsPerPage),
                                onPerPageChange: (perPage) => void load(1, perPage),
                                rowsOptions: [10, 25, 50, 100],
                            }}
                            columns={[
                                { key: 'filename', label: 'File', render: (row) => <span className="font-mono text-xs">{row.filename}</span> },
                                { key: 'direction', label: 'Direction', render: (row) => <ModernBadge variant="default">{row.direction}</ModernBadge> },
                                { key: 'transaction_count', label: 'Transactions', render: (row) => row.transaction_count },
                                { key: 'status', label: 'Status', render: (row) => <ModernBadge variant={row.status === 'sent' ? 'success' : row.status === 'failed' ? 'error' : 'default'}>{row.status}</ModernBadge> },
                                { key: 'created_at', label: 'Created', render: (row) => new Date(row.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) },
                                { key: 'actions', label: 'Actions', disableRowClick: true, render: (row) => <div className="flex items-center gap-2">
                                    <a
                                        className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-lg bg-[#3E9AF4] text-white shadow-sm transition-all duration-200 hover:bg-[#2563EB] hover:shadow-md"
                                        href={`/api/edi/logs/${row.log_id}/download`}
                                        title="Download EDI file"
                                        aria-label={`Download ${row.filename}`}
                                    >
                                        <Download className="h-4 w-4" />
                                    </a>
                                    {row.status === 'failed' ? (
                                        <button
                                            className="inline-flex h-9 w-9 items-center justify-center gap-2 rounded-lg bg-[#F59E0B] text-white shadow-sm transition-all duration-200 hover:bg-[#D97706] hover:shadow-md"
                                            onClick={() => retryLog(row)}
                                            title="Retry failed EDI delivery"
                                            aria-label={`Retry ${row.filename}`}
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                        </button>
                                    ) : null}
                                </div> },
                            ]}
                        />
                    </div>
                </div>
                <div className="w-full max-w-full overflow-x-auto">
                    <ModernTable<EdiProfile>
                        loading={loading}
                        data={profiles}
                        emptyMessage="No EDI profiles configured"
                        onRowClick={openView}
                        columns={[
                            {
                                key: 'profile_name',
                                label: 'Profile',
                                render: (row) => (
                                    <div className="min-w-[180px]">
                                        <div className="font-semibold text-gray-900">
                                            {row.profile_name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {row.legacy_key} · {row.edi_type}
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'client_id',
                                label: 'Client',
                                render: (row) => (
                                    <div className="min-w-[150px] text-sm text-gray-900">
                                        {clientName(row.client_id)}
                                    </div>
                                ),
                            },
                            {
                                key: 'schedule',
                                label: 'Schedule',
                                render: (row) => (
                                    <div className="min-w-[120px] text-sm text-gray-600">
                                        {row.interval_seconds}s
                                        <div className="text-xs text-gray-500">
                                            {row.is_enabled && row.automatic_enabled
                                                ? 'Automatic'
                                                : 'Manual only'}
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: 'destination_type',
                                label: 'Destination',
                                render: (row) => (
                                    <div className="min-w-[120px] text-sm text-gray-600 uppercase">
                                        {row.destination_type.replace('_', ' ')}
                                    </div>
                                ),
                            },
                            {
                                key: 'status',
                                label: 'Status',
                                render: (row) => (
                                    <ModernBadge
                                        variant={
                                            row.is_enabled
                                                ? 'success'
                                                : 'default'
                                        }
                                    >
                                        {row.is_enabled
                                            ? 'Enabled'
                                            : 'Disabled'}
                                    </ModernBadge>
                                ),
                            },
                            {
                                key: 'actions',
                                label: 'Actions',
                                disableRowClick: true,
                                render: (row) => (
                                    <div className="flex min-w-[110px] gap-2">
                                        <ModernButton
                                            variant="primary"
                                            size="sm"
                                            onClick={(
                                                event: React.MouseEvent,
                                            ) => {
                                                event.stopPropagation();
                                                openView(row);
                                            }}
                                            title="View profile"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </ModernButton>
                                        <ModernButton
                                            variant="edit"
                                            size="sm"
                                            onClick={(
                                                event: React.MouseEvent,
                                            ) => {
                                                event.stopPropagation();
                                                openEdit(row);
                                            }}
                                            title="Edit profile"
                                        >
                                            <Edit3 className="h-3.5 w-3.5" />
                                        </ModernButton>
                                        <ModernButton
                                            variant={row.is_enabled ? 'toggle' : 'add'}
                                            size="sm"
                                            disabled={toggling === row.profile_id}
                                            onClick={(event: React.MouseEvent) => {
                                                event.stopPropagation();
                                                requestToggleProfile(row);
                                            }}
                                            title={row.is_enabled ? 'Disable profile' : 'Enable profile'}
                                        >
                                            {toggling === row.profile_id ? (
                                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Power className="h-3.5 w-3.5" />
                                            )}
                                        </ModernButton>
                                        <ModernButton
                                            variant="add"
                                            size="sm"
                                            disabled={
                                                (row.client_id !== 67 && !row.is_enabled) ||
                                                !row.manual_enabled ||
                                                sending === row.profile_id
                                            }
                                            onClick={(
                                                event: React.MouseEvent,
                                            ) => {
                                                event.stopPropagation();
                                                sendNow(row);
                                            }}
                                            title="Send now"
                                        >
                                            {sending === row.profile_id ? (
                                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Send className="h-3.5 w-3.5" />
                                            )}
                                        </ModernButton>
                                        <ModernButton
                                            variant="primary"
                                            size="sm"
                                            onClick={(event: React.MouseEvent) => {
                                                event.stopPropagation();
                                                setGenerateProfile(row);
                                                setGenerateDirection(row.direction_mode || 'BOTH');
                                                setGenerateFileType('EDI');
                                                setGenerateStartDate('');
                                                setGenerateEndDate('');
                                                setGenerateStartTime('');
                                                setGenerateEndTime('');
                                                setGenerateSentMode('unsent');
                                                setGenerateOpen(true);
                                            }}
                                            title="Generate and download comparison file"
                                        >
                                            {generating === row.profile_id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                        </ModernButton>
                                    </div>
                                ),
                            },
                        ]}
                    />
                </div>
            </div>

            <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
                <DialogContent className="bg-white text-black sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-black">Generate EDI comparison file</DialogTitle>
                        <DialogDescription className="text-gray-600">Generate a file for the selected Manila date/time interval. This does not send the file or mark transactions as sent.</DialogDescription>
                    </DialogHeader>
                    {generateProfile ? (
                        <div className="space-y-4 py-3">
                            <div className="text-sm font-medium text-gray-800">{generateProfile.profile_name}</div>
                            <label className="block text-sm font-medium text-gray-700">
                                Direction
                                <Select value={generateDirection} onValueChange={(value) => setGenerateDirection(value as 'IN' | 'OUT' | 'BOTH')}>
                                    <SelectTrigger className="mt-1 w-full text-gray-900"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="IN">IN only (GIE)</SelectItem>
                                        <SelectItem value="OUT">OUT only (GOE)</SelectItem>
                                        <SelectItem value="BOTH">Both IN and OUT</SelectItem>
                                    </SelectContent>
                                </Select>
                            </label>
                            <label className="block text-sm font-medium text-gray-700">
                                File type
                                <Select value={generateFileType} onValueChange={(value) => setGenerateFileType(value as 'EDI' | 'TXT')}>
                                    <SelectTrigger className="mt-1 w-full text-gray-900"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EDI">EDI</SelectItem>
                                        <SelectItem value="TXT">TXT</SelectItem>
                                    </SelectContent>
                                </Select>
                            </label>
                            <label className="block text-sm font-medium text-gray-700">
                                Transactions
                                <Select value={generateSentMode} onValueChange={(value) => setGenerateSentMode(value as 'unsent' | 'sent' | 'both')}>
                                    <SelectTrigger className="mt-1 w-full text-gray-900"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unsent">Only unsent</SelectItem>
                                        <SelectItem value="sent">Only sent</SelectItem>
                                        <SelectItem value="both">Sent and unsent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="text-sm font-medium text-gray-700">Start date<Input type="date" value={generateStartDate} onChange={(event) => setGenerateStartDate(event.target.value)} className="mt-1 w-full" /></label>
                                <label className="text-sm font-medium text-gray-700">End date<Input type="date" value={generateEndDate} onChange={(event) => setGenerateEndDate(event.target.value)} className="mt-1 w-full" /></label>
                                <label className="text-sm font-medium text-gray-700">Start time<Input type="time" value={generateStartTime} onChange={(event) => setGenerateStartTime(event.target.value)} className="mt-1 w-full" /></label>
                                <label className="text-sm font-medium text-gray-700">End time<Input type="time" value={generateEndTime} onChange={(event) => setGenerateEndTime(event.target.value)} className="mt-1 w-full" /></label>
                            </div>
                        </div>
                    ) : null}
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setGenerateOpen(false)}>Cancel</ModernButton>
                        <ModernButton variant="primary" onClick={generateDownload} disabled={!generateProfile || generating !== null}>
                            {generating ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Generate and download
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={sendOpen} onOpenChange={setSendOpen}>
                <DialogContent className="bg-white text-black sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-black">Send EDI file</DialogTitle>
                        <DialogDescription className="text-gray-600">Send transactions from the selected Manila date/time interval.</DialogDescription>
                    </DialogHeader>
                    {sendProfile ? <div className="space-y-4 py-3">
                        <div className="text-sm font-medium text-gray-800">{sendProfile.profile_name}</div>
                        <label className="block text-sm font-medium text-gray-700">File type
                            <Select value={generateFileType} onValueChange={(value) => setGenerateFileType(value as 'EDI' | 'TXT')}>
                                <SelectTrigger className="mt-1 w-full text-gray-900"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="EDI">EDI</SelectItem><SelectItem value="TXT">TXT</SelectItem></SelectContent>
                            </Select>
                        </label>
                        <label className="block text-sm font-medium text-gray-700">Direction
                            <Select value={sendDirection} onValueChange={(value) => setSendDirection(value as 'IN' | 'OUT' | 'BOTH')}>
                                <SelectTrigger className="mt-1 w-full text-gray-900"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {sendProfile.direction_mode === 'BOTH' || !sendProfile.direction_mode ? <SelectItem value="IN">IN only</SelectItem> : null}
                                    {sendProfile.direction_mode === 'BOTH' || !sendProfile.direction_mode ? <SelectItem value="OUT">OUT only</SelectItem> : null}
                                    {sendProfile.direction_mode === 'BOTH' || !sendProfile.direction_mode ? <SelectItem value="BOTH">IN and OUT</SelectItem> : null}
                                    {sendProfile.direction_mode === 'IN' ? <SelectItem value="IN">IN only</SelectItem> : null}
                                    {sendProfile.direction_mode === 'OUT' ? <SelectItem value="OUT">OUT only</SelectItem> : null}
                                </SelectContent>
                            </Select>
                        </label>
                        <label className="block text-sm font-medium text-gray-700">Transactions
                            <Select value={generateSentMode} onValueChange={(value) => setGenerateSentMode(value as 'unsent' | 'sent' | 'both')}>
                                <SelectTrigger className="mt-1 w-full text-gray-900"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="unsent">Only unsent</SelectItem><SelectItem value="sent">Only sent</SelectItem><SelectItem value="both">Sent and unsent</SelectItem></SelectContent>
                            </Select>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-sm font-medium text-gray-700">Start date<Input type="date" value={generateStartDate} onChange={(event) => setGenerateStartDate(event.target.value)} className="mt-1 w-full" /></label>
                            <label className="text-sm font-medium text-gray-700">End date<Input type="date" value={generateEndDate} onChange={(event) => setGenerateEndDate(event.target.value)} className="mt-1 w-full" /></label>
                            <label className="text-sm font-medium text-gray-700">Start time<Input type="time" value={generateStartTime} onChange={(event) => setGenerateStartTime(event.target.value)} className="mt-1 w-full" /></label>
                            <label className="text-sm font-medium text-gray-700">End time<Input type="time" value={generateEndTime} onChange={(event) => setGenerateEndTime(event.target.value)} className="mt-1 w-full" /></label>
                        </div>
                    </div> : null}
                    <DialogFooter>
                        <ModernButton variant="secondary" onClick={() => setSendOpen(false)}>Cancel</ModernButton>
                        <ModernButton variant="primary" onClick={sendManual} disabled={!sendProfile || sending !== null}>
                            {sending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                            Send EDI
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="max-h-[90vh] min-w-3xl overflow-y-auto bg-white text-black [&_input]:!text-black [&_label]:!text-black [&_option]:!text-black [&_p]:!text-black [&_select]:!text-black [&_textarea]:!text-black">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-black">
                            EDI Profile
                        </DialogTitle>
                        <DialogDescription className="text-black">
                            Profile configuration and legacy delivery details.
                        </DialogDescription>
                    </DialogHeader>
                    {selected && (
                        <div className="grid grid-cols-2 gap-5 py-4 text-sm">
                            <div>
                                <span className="text-xs text-gray-500 uppercase">
                                    Profile
                                </span>
                                <p className="font-semibold text-gray-900">
                                    {selected.profile_name}
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase">
                                    Client
                                </span>
                                <p className="text-gray-900">
                                    {clientName(selected.client_id)}
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase">
                                    Legacy profile
                                </span>
                                <p className="text-gray-900">
                                    {selected.legacy_key}
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase">
                                    Format
                                </span>
                                <p className="text-gray-900">
                                    {selected.delimiter} ·{' '}
                                    {selected.record_terminator} ·{' '}
                                    {selected.terminator_mode}
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase">
                                    Schedule
                                </span>
                                <p className="text-gray-900">
                                    Every {selected.interval_seconds} seconds{' '}
                                    {selected.start_time || selected.end_time
                                        ? `(${selected.start_time || 'any'} - ${selected.end_time || 'any'})`
                                        : ''}
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 uppercase">
                                    Destination
                                </span>
                                <p className="text-gray-900">
                                    {selected.destination_type.replace(
                                        '_',
                                        ' ',
                                    )}
                                </p>
                            </div>
                            <div className="col-span-2">
                                <span className="text-xs text-gray-500 uppercase">
                                    Output fields
                                </span>
                                <p className="mt-1 break-words text-gray-700">
                                    {selected.fields
                                        .filter((field) => field.is_enabled)
                                        .sort(
                                            (a, b) =>
                                                a.output_order - b.output_order,
                                        )
                                        .map((field) => field.source_column)
                                        .join(' → ')}
                                </p>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <ModernButton
                            variant="secondary"
                            onClick={() => setViewOpen(false)}
                        >
                            Close
                        </ModernButton>
                        <ModernButton
                            variant="edit"
                            onClick={() => {
                                setViewOpen(false);
                                if (selected) openEdit(selected);
                            }}
                        >
                            <Edit3 className="h-4 w-4" />
                            Edit profile
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) setIsAdding(false);
                }}
            >
                <DialogContent className="max-h-[92vh] w-[96vw] !max-w-6xl overflow-y-auto bg-white p-0 text-black [&_input]:!text-black [&_input]:h-9 [&_input]:rounded-md [&_input]:border-gray-300 [&_input]:bg-white [&_input]:px-3 [&_input]:text-sm [&_input]:shadow-xs [&_label]:!text-black [&_option]:!text-black [&_p]:!text-black [&_select]:!text-black [&_textarea]:!text-black [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                    <DialogHeader className="border-b border-gray-200 bg-gray-50 px-6 py-5">
                        <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
                            {isAdding ? 'Add EDI Profile' : 'Edit EDI Profile'}
                        </DialogTitle>
                        <DialogDescription className="text-gray-600">
                            Configure the inventory fields, schedule, format,
                            and destination.
                        </DialogDescription>
                    </DialogHeader>
                    {selected && (
                        <div className="space-y-5 px-6 py-5">
                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-[#3E9AF4]" />
                                    <h3 className="font-semibold text-gray-900">Profile details</h3>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <label className="space-y-1 text-sm font-medium text-gray-700">
                                    Profile name
                                    <Input
                                        value={selected.profile_name}
                                        onChange={(e) =>
                                            update({
                                                profile_name: e.target.value,
                                            })
                                        }
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-gray-900"
                                    />
                                </label>
                                    <label className="space-y-1 text-sm font-medium text-gray-700">
                                    Client
                                    <Select
                                        value={
                                            selected.client_id?.toString() ?? ''
                                        }
                                        onValueChange={(value) =>
                                            update({
                                                client_id: value
                                                    ? Number(value)
                                                    : null,
                                            })
                                        }
                                    >
                                        <SelectTrigger className="mt-1 w-full min-w-0 text-left text-gray-900">
                                            <SelectValue placeholder="Select client" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clients.map((client) => (
                                                <SelectItem
                                                    key={client.c_id}
                                                    value={client.c_id.toString()}
                                                >
                                                    {client.client_code} -{' '}
                                                    {client.client_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </label>
                                    <label className="space-y-1 text-sm font-medium text-gray-700">
                                        EDI IN/OUT
                                        <Select
                                            value={selected.direction_mode || 'BOTH'}
                                            onValueChange={(value) =>
                                                update({
                                                    direction_mode: value as EdiProfile['direction_mode'],
                                                })
                                            }
                                        >
                                            <SelectTrigger className="mt-1 w-full text-gray-900">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="IN">IN only</SelectItem>
                                                <SelectItem value="OUT">OUT only</SelectItem>
                                                <SelectItem value="BOTH">IN and OUT</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </label>
                                    <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                                        <Checkbox
                                            id="edi-profile-enabled"
                                            checked={Boolean(selected.is_enabled)}
                                            onCheckedChange={(checked) => update({ is_enabled: checked === true })}
                                            aria-label="Enabled"
                                        />
                                        <label htmlFor="edi-profile-enabled" className="cursor-pointer">Enabled</label>
                                    </div>
                                </div>
                            <div className="mt-5 border-t border-gray-200 pt-4">
                                <h3 className="mb-3 font-semibold text-gray-900">
                                    Schedule
                                </h3>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <label className="text-sm font-medium text-gray-700">
                                    Run every
                                    <Select
                                        value={String(Math.round((selected.interval_seconds || 300) / 60))}
                                        onValueChange={(value) => update({ interval_seconds: Number(value) * 60 })}
                                    >
                                        <SelectTrigger className="mt-1 w-full text-gray-900"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {[5, 10, 15, 20, 30, 60].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes} minutes</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </label>
                                <div className="contents">
                                    <label className="text-sm font-medium text-gray-700">
                                        Start time
                                        <Input
                                            type="time"
                                            value={selected.start_time || ''}
                                            onChange={(e) =>
                                                update({
                                                    start_time:
                                                        e.target.value || null,
                                                })
                                            }
                                            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                                        />
                                    </label>
                                    <label className="text-sm font-medium text-gray-700">
                                        End time
                                        <Input
                                            type="time"
                                            value={selected.end_time || ''}
                                            onChange={(e) =>
                                                update({
                                                    end_time:
                                                        e.target.value || null,
                                                })
                                            }
                                            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                                        />
                                    </label>
                                </div>
                                </div>
                            </div>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <h3 className="mb-3 font-semibold text-gray-900">Destination</h3>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <label className="text-sm font-medium text-gray-700">
                                        Destination type
                                        <Select value={selected.destination_type} onValueChange={(value) => update({ destination_type: value })}>
                                            <SelectTrigger className="mt-1 w-full text-gray-900"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="cache_csp">Cache / CSP</SelectItem>
                                                <SelectItem value="sftp">SFTP</SelectItem>
                                                <SelectItem value="ftp">FTP</SelectItem>
                                                <SelectItem value="ftps">FTPS</SelectItem>
                                                <SelectItem value="http">HTTP</SelectItem>
                                                <SelectItem value="https">HTTPS/API</SelectItem>
                                                <SelectItem value="manual">Manual / not configured</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </label>
                                {['sftp', 'ftp', 'ftps'].includes(selected.destination_type) ? (
                                    <>
                                        <label className="text-sm font-medium text-gray-700">
                                            Host
                                            <Input
                                                value={destination.host || selected.credential_metadata?.host || ''}
                                                onChange={(e) => update({ destination_config: { ...destination, host: e.target.value } })}
                                                placeholder="ftp.msc.com"
                                                aria-label="Host"
                                                className="mt-1 w-full"
                                            />
                                        </label>
                                        <label className="text-sm font-medium text-gray-700">
                                            Remote path
                                            <Input
                                                value={destination.remote_path || ''}
                                                onChange={(e) => update({ destination_config: { ...destination, remote_path: e.target.value } })}
                                                placeholder="/To_MSC/CODECO"
                                                aria-label="Remote path"
                                                className="mt-1 w-full"
                                            />
                                        </label>
                                    </>
                                ) : (
                                    <label className="text-sm font-medium text-gray-700 md:col-span-2">
                                        Endpoint URL
                                        <Input
                                            value={destination.endpoint || ''}
                                            onChange={(e) => update({ destination_config: { ...destination, endpoint: e.target.value } })}
                                            placeholder="https://example.com/edi"
                                            aria-label="Endpoint URL"
                                            className="mt-1 w-full"
                                        />
                                    </label>
                                )}
                                </div>
                                <div className="mt-5 border-t border-gray-200 pt-4">
                                <h3 className="mb-3 font-semibold text-gray-900">
                                    Destination credentials
                                </h3>
                                    <p className="mb-2 text-xs text-gray-500">
                                    Connection address is configured above. Port, username, and saved secrets are loaded from the profile; leave secret fields unchanged to keep the encrypted values.
                                </p>
                                {selected.credential_metadata?.has_password || selected.credential_metadata?.has_api_key ? (
                                    <p className="mb-2 text-xs font-medium text-emerald-700">
                                        Saved secret: {selected.credential_metadata?.has_password ? 'password' : ''}{selected.credential_metadata?.has_password && selected.credential_metadata?.has_api_key ? ' and ' : ''}{selected.credential_metadata?.has_api_key ? 'API key' : ''}
                                    </p>
                                ) : null}
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    {(
                                        [
                                            'port',
                                            'username',
                                            'password',
                                            'api_key',
                                        ] as const
                                    ).filter((key) => {
                                        if (['sftp', 'ftp', 'ftps'].includes(selected.destination_type)) {
                                            return ['port', 'username', 'password'].includes(key);
                                        }
                                        if (['http', 'https', 'cache_csp'].includes(selected.destination_type)) {
                                            return ['username', 'password', 'api_key'].includes(key);
                                        }
                                        return false;
                                    }).map((key) => (
                                        <label key={key} className="relative text-sm font-medium text-gray-700">
                                            <span className="mb-1 block capitalize">{key === 'api_key' ? 'API key' : key}</span>
                                            <div className="relative">
                                            <Input
                                                type={key === 'password' || key === 'api_key' ? (secretsVisible ? 'text' : 'password') : 'text'}
                                                value={key === 'password' || key === 'api_key'
                                                    ? (!secretsVisible && (selected.credential_metadata?.has_password || selected.credential_metadata?.has_api_key) ? '••••••••' : credentials[key])
                                                    : credentials[key]}
                                                onChange={(e) => setCredentials({ ...credentials, [key]: e.target.value })}
                                                placeholder={key.replace('_', ' ')}
                                                aria-label={key.replace('_', ' ')}
                                                readOnly={(key === 'password' || key === 'api_key') && !secretsVisible && Boolean(selected.credential_metadata?.has_password || selected.credential_metadata?.has_api_key)}
                                                className="w-full pr-10"
                                            />
                                            {(key === 'password' || key === 'api_key') && (selected.credential_metadata?.has_password || selected.credential_metadata?.has_api_key) ? (
                                                <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); void revealSecrets(); }} className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800" aria-label={secretsVisible ? 'Hide saved secret' : 'Show saved secret'}>
                                                    {secretsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            ) : null}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            </div>
                            <div className="hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <h3 className="mb-3 font-semibold text-gray-900">
                                    Movement direction and CODECO samples
                                </h3>
                                {selected.client_id === 67 ? <div className="mb-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                                    <div className="font-semibold">MSC client 67 — fixed IN/CODECO formatter</div>
                                    <div className="mt-1 font-mono text-xs leading-5">UNB → UNH → BGM → NAD → EQD → DTM → LOC → TDT → IMD → FTX → CNT → UNT → UNZ</div>
                                    <div className="mt-1 text-xs">The formatter reads values directly from the inventory table. Sample upload and field mapping do not control this profile.</div>
                                </div> : null}
                                <Select value={selected.direction_mode || 'BOTH'} onValueChange={(value) => update({ direction_mode: value as EdiProfile['direction_mode'] })}>
                                    <SelectTrigger className="mb-2 w-full text-gray-900"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="IN">IN only</SelectItem>
                                        <SelectItem value="OUT">OUT only</SelectItem>
                                        <SelectItem value="BOTH">IN and OUT</SelectItem>
                                    </SelectContent>
                                </Select>
                                <div className="grid grid-cols-1 gap-4 rounded-md border p-3 text-xs text-gray-600 md:grid-cols-2">
                                    {(['IN', 'OUT'] as const).map((direction) => (
                                        <label key={direction}>
                                            <span className="mb-1 block font-semibold">{direction} sample ({direction === 'IN' ? 'GIE' : 'GOE'})</span>
                                                <input
                                                type="file"
                                                accept=".edi,.txt,text/plain"
                                                disabled={sampleAnalyzing[direction]}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0] || null;
                                                    setSampleFiles((current) => ({ ...current, [direction]: file }));
                                                    if (file) void analyzeSampleFile(direction, file);
                                                }}
                                                className="w-full text-xs"
                                            />
                                            {sampleAnalyzing[direction] ? (
                                                <span className="mt-2 flex items-center gap-2 font-medium text-blue-700">
                                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                                    Analyzing CODECO structure and mapping fields…
                                                </span>
                                            ) : null}
                                            <span className="mt-1 block">{selected.directions?.find((item) => item.direction === direction)?.sample_filename || 'No sample uploaded yet'}</span>
                                            <div className="mt-2 rounded border bg-gray-50 p-2 text-gray-600">
                                                <div className="font-semibold text-gray-800">Exact detected CODECO structure</div>
                                                <div>{selected.directions?.find((item) => item.direction === direction)?.structure_analysis?.segment_count || 0} segments detected: {selected.directions?.find((item) => item.direction === direction)?.structure_analysis?.segments?.map((segment) => segment.tag).join(' → ') || 'not analyzed'}</div>
                                                <div className="mt-1 text-[11px]">{selected.directions?.find((item) => item.direction === direction)?.structure_analysis?.analysis_message || 'Structure analysis will appear after upload.'}</div>
                                                {selected.directions?.find((item) => item.direction === direction)?.structure_analysis?.analysis_source === 'fallback' ? <div className="mt-1 text-[11px] text-red-600">AI unavailable; CODECO D95B database fallback used.</div> : null}
                                            </div>
                                            <div className="mt-2 text-[11px] text-blue-700">
                                                Suggested mappings: {selected.directions?.find((item) => item.direction === direction)?.mapping_suggestions?.length || 0}. Review and confirm the matches below.
                                            </div>
                                            <div className="mt-3 overflow-hidden rounded-lg border bg-white text-xs">
                                                <div className="grid grid-cols-2 border-b bg-gray-50 font-semibold text-gray-700">
                                                    <div className="p-2">CODECO structure segment</div>
                                                    <div className="p-2">Output field</div>
                                                </div>
                                                {(selected.directions?.find((item) => item.direction === direction)?.structure_analysis?.mapping_options || []).filter((option) => Boolean(option.token)).map((option) => {
                                                    const directionData = selected.directions?.find((item) => item.direction === direction);
                                                    const matchedField = option.token ? Object.entries(mappingSelections[direction]).find(([, token]) => token === option.token)?.[0] || '' : '';
                                                    const suggestion = option.token ? directionData?.mapping_suggestions?.find((item) => item.token === option.token) : undefined;
                                                    return (
                                                        <div key={`${direction}-${option.key}`} className="grid grid-cols-2 items-center border-b last:border-b-0">
                                                            <div className="p-2 font-medium text-gray-800">{option.segment} — {option.meaning || option.catalog_meaning || option.label.replace(`${option.key} — `, '')}</div>
                                                            <div className="p-2">
                                                                <Select
                                                                    disabled={!option.token}
                                                                    value={matchedField || 'unmapped'}
                                                                    onValueChange={(value) => setMappingSelections((current) => ({
                                                                        ...current,
                                                                        [direction]: {
                                                                            ...Object.fromEntries(Object.entries(current[direction]).filter(([, token]) => token !== option.token)),
                                                                            ...(value === 'unmapped' || !option.token ? {} : { [value]: option.token }),
                                                                        },
                                                                    }))}
                                                                >
                                                                    <SelectTrigger className="h-8 w-full"><SelectValue placeholder="Select output field" /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="unmapped">Not mapped</SelectItem>
                                                                        {sourceFields.filter((field) => selected.fields.find((item) => item.source_column === field)?.is_enabled).map((field) => (
                                                                            <SelectItem key={`${direction}-${option.key}-${field}`} value={field}>
                                                                                {field}{suggestion?.source_column === field ? ' (suggested)' : ''}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                {suggestion ? <div className="mt-1 text-[10px] text-blue-600">Suggested inventory field: <span className="font-semibold">{suggestion.source_column}</span></div> : null}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {!selected.directions?.find((item) => item.direction === direction)?.structure_analysis?.mapping_options?.length ? (
                                                    <div className="p-3 text-gray-500">Upload a sample to detect unique CODECO structure fields.</div>
                                                ) : null}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <h3 className="mb-3 font-semibold text-gray-900">
                                    Output fields
                                </h3>
                                <div className="grid max-h-56 grid-cols-1 gap-x-4 overflow-y-auto rounded-md border p-2 md:grid-cols-3">
                                    {sourceFields.map((field, index) => {
                                        const current = selected.fields.find(
                                            (item) =>
                                                item.source_column === field,
                                        );
                                        return (
                                            <div
                                                key={field}
                                                className="flex items-center gap-2 border-b py-1.5 text-sm last:border-0"
                                            >
                                                <Checkbox
                                                    id={`edi-output-field-${field}`}
                                                    checked={
                                                        current?.is_enabled ??
                                                        false
                                                    }
                                                    onCheckedChange={(checked) =>
                                                        setFieldEnabled(field, checked === true)
                                                    }
                                                />
                                                <label htmlFor={`edi-output-field-${field}`} className="flex cursor-pointer items-center gap-2">
                                                <span className="w-6 text-xs text-gray-400">
                                                    {current?.output_order ??
                                                        index + 1}
                                                </span>
                                                <span>{field}</span>
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                        <ModernButton
                            variant="secondary"
                            onClick={() => setEditOpen(false)}
                        >
                            Cancel
                        </ModernButton>
                        <ModernButton
                            variant="primary"
                            onClick={save}
                            disabled={saving}
                        >
                            <Save className="h-4 w-4" />
                            {saving ? 'Saving...' : 'Save profile'}
                        </ModernButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <ModernConfirmDialog
                open={toggleProfileTarget !== null}
                onOpenChange={(open) => {
                    if (!open && toggling === null) setToggleProfileTarget(null);
                }}
                title={toggleProfileTarget?.is_enabled ? 'Disable EDI profile?' : 'Enable EDI profile?'}
                description={toggleProfileTarget
                    ? `Are you sure you want to ${toggleProfileTarget.is_enabled ? 'disable' : 'enable'} "${toggleProfileTarget.profile_name}"?`
                    : ''}
                confirmText={toggleProfileTarget?.is_enabled ? 'Yes, disable' : 'Yes, enable'}
                type={toggleProfileTarget?.is_enabled ? 'warning' : 'success'}
                onConfirm={() => void toggleProfile()}
            />
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
}

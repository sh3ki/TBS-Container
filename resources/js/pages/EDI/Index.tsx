import { ModernBadge, ModernButton, ModernTable } from '@/components/modern';
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
import { Head } from '@inertiajs/react';
import axios from 'axios';
import {
    CheckCircle2,
    Edit3,
    Eye,
    FileCode2,
    Plus,
    RefreshCw,
    Save,
    Send,
    XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface EdiField {
    source_column: string;
    output_order: number;
    transform?: string | null;
    is_enabled: boolean;
}
interface EdiProfile extends Record<string, unknown> {
    profile_id: number;
    profile_name: string;
    client_id: number | null;
    legacy_key: string;
    edi_type: string;
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
    has_credentials: boolean;
    notes: string | null;
    fields: EdiField[];
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
    const [profiles, setProfiles] = useState<EdiProfile[]>([]);
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
    const [message, setMessage] = useState<{
        type: 'success' | 'error';
        text: string;
    } | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const [profiles, clientList] = await Promise.all([
                axios.get('/api/edi/profiles'),
                axios.get('/api/edi/clients'),
            ]);
            setProfiles(profiles.data.data || []);
            setClients(clientList.data.data || []);
        } catch {
            setMessage({ type: 'error', text: 'Unable to load EDI profiles.' });
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
            host: profile.credentials?.host || '',
            port: profile.credentials?.port || '',
            username: profile.credentials?.username || '',
            password: profile.credentials?.password || '',
            api_key: profile.credentials?.api_key || '',
        });
        setEditOpen(true);
    };
    const openAdd = () => {
        setSelected({
            profile_id: 0,
            profile_name: '',
            client_id: clients[0]?.c_id ?? null,
            legacy_key: '',
            edi_type: 'CODECO',
            source_table: 'inventory',
            is_enabled: false,
            manual_enabled: true,
            automatic_enabled: false,
            start_time: null,
            end_time: null,
            interval_seconds: 300,
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
        });
        setCredentials({
            host: '',
            port: '',
            username: '',
            password: '',
            api_key: '',
        });
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
    const setIntervalValue = (
        hours: number,
        minutes: number,
        seconds: number,
    ) => update({ interval_seconds: hours * 3600 + minutes * 60 + seconds });
    const save = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            const entered = Object.fromEntries(
                Object.entries(credentials).filter(([, value]) => value),
            );
            const response = isAdding
                ? await axios.post('/api/edi/profiles', {
                      ...selected,
                      credentials: entered,
                  })
                : await axios.put(
                      `/api/edi/profiles/${selected.profile_id}`,
                      Object.keys(entered).length
                          ? { ...selected, credentials: entered }
                          : selected,
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
            setMessage({
                type: 'success',
                text: isAdding ? 'EDI profile created.' : 'EDI profile saved.',
            });
        } catch (error: any) {
            setMessage({
                type: 'error',
                text:
                    error?.response?.data?.message ||
                    'Unable to save EDI profile.',
            });
        } finally {
            setSaving(false);
        }
    };
    const sendNow = async (profile: EdiProfile) => {
        setSending(profile.profile_id);
        try {
            const response = await axios.post(
                `/api/edi/profiles/${profile.profile_id}/send`,
            );
            setMessage({
                type: 'success',
                text: `${response.data.message} Batch #${response.data.batch_id}.`,
            });
        } catch (error: any) {
            setMessage({
                type: 'error',
                text:
                    error?.response?.data?.message ||
                    'Unable to queue EDI send.',
            });
        } finally {
            setSending(null);
        }
    };
    const toggleField = (fieldName: string) => {
        if (selected)
            update({
                fields: selected.fields.map((field) =>
                    field.source_column === fieldName
                        ? { ...field, is_enabled: !field.is_enabled }
                        : field,
                ),
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
                {message && (
                    <div
                        className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                    >
                        {message.type === 'success' ? (
                            <CheckCircle2 className="h-4 w-4" />
                        ) : (
                            <XCircle className="h-4 w-4" />
                        )}
                        {message.text}
                    </div>
                )}
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
                                            {row.automatic_enabled
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
                                            variant="add"
                                            size="sm"
                                            disabled={
                                                !row.is_enabled ||
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
                                    </div>
                                ),
                            },
                        ]}
                    />
                </div>
            </div>

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
                <DialogContent className="max-h-[92vh] min-w-4xl overflow-y-auto bg-white text-black [&_input]:!text-black [&_label]:!text-black [&_option]:!text-black [&_p]:!text-black [&_select]:!text-black [&_textarea]:!text-black">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-black">
                            {isAdding ? 'Add EDI Profile' : 'Edit EDI Profile'}
                        </DialogTitle>
                        <DialogDescription className="text-black">
                            Configure the inventory fields, schedule, format,
                            and destination.
                        </DialogDescription>
                    </DialogHeader>
                    {selected && (
                        <div className="space-y-5 py-4">
                            <div className="grid grid-cols-2 gap-3">
                                <label className="text-sm text-gray-600">
                                    Profile name
                                    <input
                                        value={selected.profile_name}
                                        onChange={(e) =>
                                            update({
                                                profile_name: e.target.value,
                                            })
                                        }
                                        className="mt-1 w-full rounded-md border px-3 py-2 text-gray-900"
                                    />
                                </label>
                                <label className="text-sm text-gray-600">
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
                                        <SelectTrigger className="mt-1.5 text-gray-900">
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
                            </div>
                            <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-sm">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selected.is_enabled}
                                        onChange={(e) =>
                                            update({
                                                is_enabled: e.target.checked,
                                            })
                                        }
                                    />
                                    Enabled
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selected.manual_enabled}
                                        onChange={(e) =>
                                            update({
                                                manual_enabled:
                                                    e.target.checked,
                                            })
                                        }
                                    />
                                    Manual
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selected.automatic_enabled}
                                        onChange={(e) =>
                                            update({
                                                automatic_enabled:
                                                    e.target.checked,
                                            })
                                        }
                                    />
                                    Automatic
                                </label>
                            </div>
                            <div>
                                <h3 className="mb-2 font-semibold text-gray-900">
                                    Schedule
                                </h3>
                                <div className="grid grid-cols-3 gap-2">
                                    {(
                                        ['hours', 'minutes', 'seconds'] as const
                                    ).map((part) => {
                                        const total =
                                            selected.interval_seconds || 0;
                                        const values = {
                                            hours: Math.floor(total / 3600),
                                            minutes: Math.floor(
                                                (total % 3600) / 60,
                                            ),
                                            seconds: total % 60,
                                        };
                                        return (
                                            <label
                                                key={part}
                                                className="text-xs text-gray-500 capitalize"
                                            >
                                                {part}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={
                                                        part === 'hours'
                                                            ? undefined
                                                            : 59
                                                    }
                                                    value={values[part]}
                                                    onChange={(e) => {
                                                        const next = {
                                                            ...values,
                                                            [part]: Number(
                                                                e.target.value,
                                                            ),
                                                        };
                                                        update({
                                                            interval_seconds:
                                                                next.hours *
                                                                    3600 +
                                                                next.minutes *
                                                                    60 +
                                                                next.seconds,
                                                        });
                                                    }}
                                                    className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <label className="text-xs text-gray-500">
                                        Start time
                                        <input
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
                                    <label className="text-xs text-gray-500">
                                        End time
                                        <input
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
                            <div>
                                <h3 className="mb-2 font-semibold text-gray-900">
                                    Format and destination
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="text-xs text-gray-500">
                                        Delimiter
                                        <select
                                            value={selected.delimiter}
                                            onChange={(e) =>
                                                update({
                                                    delimiter: e.target.value,
                                                })
                                            }
                                            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                                        >
                                            <option value="TAB">Tab</option>
                                            <option value=",">Comma</option>
                                            <option value="|">Pipe</option>
                                        </select>
                                    </label>
                                    <label className="text-xs text-gray-500">
                                        Terminator
                                        <input
                                            value={selected.record_terminator}
                                            onChange={(e) =>
                                                update({
                                                    record_terminator:
                                                        e.target.value,
                                                })
                                            }
                                            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                                        />
                                    </label>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <label className="text-xs text-gray-500">
                                        Placement
                                        <select
                                            value={selected.terminator_mode}
                                            onChange={(e) =>
                                                update({
                                                    terminator_mode: e.target
                                                        .value as EdiProfile['terminator_mode'],
                                                })
                                            }
                                            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                                        >
                                            <option value="once">
                                                Once at end
                                            </option>
                                            <option value="per_record">
                                                Every record
                                            </option>
                                        </select>
                                    </label>
                                    <label className="text-xs text-gray-500">
                                        Batch limit
                                        <input
                                            type="number"
                                            min="1"
                                            value={selected.batch_limit}
                                            onChange={(e) =>
                                                update({
                                                    batch_limit: Number(
                                                        e.target.value,
                                                    ),
                                                })
                                            }
                                            className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
                                        />
                                    </label>
                                </div>
                                <select
                                    value={selected.destination_type}
                                    onChange={(e) =>
                                        update({
                                            destination_type: e.target.value,
                                        })
                                    }
                                    className="mt-2 w-full rounded-md border px-2 py-2 text-sm"
                                >
                                    <option value="cache_csp">
                                        Cache / CSP
                                    </option>
                                    <option value="sftp">SFTP</option>
                                    <option value="http">HTTP</option>
                                    <option value="file">File drop</option>
                                    <option value="email">Email</option>
                                    <option value="manual">
                                        Manual / not configured
                                    </option>
                                </select>
                                <input
                                    value={
                                        destination.endpoint ||
                                        destination.remote_path ||
                                        ''
                                    }
                                    onChange={(e) =>
                                        update({
                                            destination_config: {
                                                ...destination,
                                                endpoint: e.target.value,
                                                remote_path: e.target.value,
                                            },
                                        })
                                    }
                                    placeholder="Endpoint or remote path"
                                    className="mt-2 w-full rounded-md border px-2 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <h3 className="mb-2 font-semibold text-gray-900">
                                    Destination credentials
                                </h3>
                                <p className="mb-2 text-xs text-gray-500">
                                    Leave blank to keep existing credentials.
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {(
                                        [
                                            'host',
                                            'port',
                                            'username',
                                            'password',
                                            'api_key',
                                        ] as const
                                    ).map((key) => (
                                        <input
                                            key={key}
                                            type={
                                                key === 'password' ||
                                                key === 'api_key'
                                                    ? 'password'
                                                    : 'text'
                                            }
                                            value={credentials[key]}
                                            onChange={(e) =>
                                                setCredentials({
                                                    ...credentials,
                                                    [key]: e.target.value,
                                                })
                                            }
                                            placeholder={key.replace('_', ' ')}
                                            className="rounded-md border px-2 py-2 text-sm"
                                        />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="mb-2 font-semibold text-gray-900">
                                    Output fields
                                </h3>
                                <div className="grid max-h-56 grid-cols-2 gap-x-4 overflow-y-auto rounded-md border p-2">
                                    {sourceFields.map((field, index) => {
                                        const current = selected.fields.find(
                                            (item) =>
                                                item.source_column === field,
                                        );
                                        return (
                                            <label
                                                key={field}
                                                className="flex items-center gap-2 border-b py-1.5 text-sm last:border-0"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        current?.is_enabled ??
                                                        false
                                                    }
                                                    onChange={() =>
                                                        toggleField(field)
                                                    }
                                                />
                                                <span className="w-6 text-xs text-gray-400">
                                                    {current?.output_order ??
                                                        index + 1}
                                                </span>
                                                <span>{field}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
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
        </AuthenticatedLayout>
    );
}

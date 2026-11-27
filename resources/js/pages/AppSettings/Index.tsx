import {
    ModernButton,
    ModernCard,
    RichTextEditor,
    ToastContainer,
    useModernToast,
} from '@/components/modern';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
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
    ChevronDown,
    ChevronUp,
    Copy,
    Eye,
    EyeOff,
    Plus,
    Settings,
    ToggleLeft,
    ToggleRight,
    Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface DmrGroup {
    client_id: string;
    receiver_emails: string;
    cc_emails: string;
    subject: string;
    content: string;
}

interface QueueStatusMessage {
    id: number;
    status: string;
    message: string;
    enabled: boolean;
}

interface StandbyStatusMessage {
    id: number;
    code: string;
    name: string;
    message: string;
    enabled: boolean;
}

interface AppSettingsProps {
    clients: Array<{ c_id: number; client_name: string; client_code: string }>;
    settings: {
        incoming_rate: number;
        outgoing_rate: number;
        hauler_exceptions: string;
        preout_hauler_exceptions: string;
        prein_hauler_exceptions: string;
        prein_scraping_client_ids: number[];
        booking_scraping_enabled: boolean;
        prein_booking_dependent: boolean;
        preout_booking_dependent: boolean;
        booking_system_url: string;
        booking_system_login_url: string;
        booking_system_username: string;
        booking_system_password: string;
        booking_system_timeout: number;
        calling_expiration_minutes: number | null;
        floating_expiration_minutes: number | null;
        queue_status_messages: QueueStatusMessage[];
        standby_status_messages: StandbyStatusMessage[];
        queue_internal_password_configured: boolean;
        queue_internal_password: string;
        dmr_time: string;
        dmr_sender_email: string;
        dmr_sender_password: string;
        dmr_auto_send: boolean;
        dmr_sender_name: string;
        dmr_day_exceptions: string[];
        dmr_signature: string;
        dmr_groups: Array<Partial<DmrGroup> & { client_id?: number | string }>;
        utilization_time: string;
        utilization_day_exceptions: string[];
        utilization_capacity_teus: number;
        smtp_host: string;
        smtp_incoming_port: number;
        smtp_port: number;
        smtp_encryption: string;
        smtp_username: string;
        smtp_password: string;
        smtp_from_email: string;
        smtp_from_name: string;
        sms_driver: string;
        smsgate_api_url: string;
        smsgate_username: string;
        smsgate_password: string;
        smsgate_password_configured: boolean;
        smsgate_device_id: string;
        smsgate_sim_number: string;
        smsgate_timeout: number;
        sms_header_text: string;
        sms_footer_text: string;
        smsgate_webhook_url: string;
    };
}

export default function AppSettings({ settings, clients }: AppSettingsProps) {
    const [incomingRate, setIncomingRate] = useState(
        String(settings.incoming_rate),
    );
    const [outgoingRate, setOutgoingRate] = useState(
        String(settings.outgoing_rate),
    );
    const [haulerExceptions, setHaulerExceptions] = useState(
        settings.hauler_exceptions,
    );
    const [preoutHaulerExceptions, setPreoutHaulerExceptions] = useState(
        settings.preout_hauler_exceptions,
    );
    const [preinHaulerExceptions, setPreinHaulerExceptions] = useState(
        settings.prein_hauler_exceptions,
    );
    const [preinScrapingClientIds, setPreinScrapingClientIds] = useState<
        string[]
    >(settings.prein_scraping_client_ids.map(String));
    const [bookingScrapingEnabled, setBookingScrapingEnabled] = useState(
        settings.booking_scraping_enabled,
    );
    const [preInBookingDependent, setPreInBookingDependent] = useState(
        settings.prein_booking_dependent,
    );
    const [preOutBookingDependent, setPreOutBookingDependent] = useState(
        settings.preout_booking_dependent,
    );
    const [bookingSystemUrl, setBookingSystemUrl] = useState(
        settings.booking_system_url,
    );
    const [bookingSystemLoginUrl, setBookingSystemLoginUrl] = useState(
        settings.booking_system_login_url,
    );
    const [bookingSystemUsername, setBookingSystemUsername] = useState(
        settings.booking_system_username,
    );
    const [bookingSystemPassword, setBookingSystemPassword] = useState(
        settings.booking_system_password,
    );
    const [showBookingSystemPassword, setShowBookingSystemPassword] =
        useState(false);
    const [bookingSystemTimeout, setBookingSystemTimeout] = useState(
        String(settings.booking_system_timeout),
    );
    const [callingExpirationMinutes, setCallingExpirationMinutes] = useState(
        settings.calling_expiration_minutes === null
            ? ''
            : String(settings.calling_expiration_minutes),
    );
    const [floatingExpirationMinutes, setFloatingExpirationMinutes] = useState(
        settings.floating_expiration_minutes === null
            ? ''
            : String(settings.floating_expiration_minutes),
    );
    const [queueStatusMessages, setQueueStatusMessages] = useState(
        settings.queue_status_messages,
    );
    const [standbyStatusMessages, setStandbyStatusMessages] = useState(
        settings.standby_status_messages,
    );
    const [queueInternalPassword, setQueueInternalPassword] = useState(
        settings.queue_internal_password.toUpperCase(),
    );
    const [showQueueInternalPassword, setShowQueueInternalPassword] =
        useState(false);
    const [dmrTime, setDmrTime] = useState(settings.dmr_time);
    const [dmrSenderEmail, setDmrSenderEmail] = useState(
        settings.dmr_sender_email,
    );
    const [dmrSenderPassword, setDmrSenderPassword] = useState(
        settings.dmr_sender_password,
    );
    const [dmrAutoSend, setDmrAutoSend] = useState(settings.dmr_auto_send);
    const [dmrSenderName, setDmrSenderName] = useState(
        settings.dmr_sender_name,
    );
    const [showDmrSenderPassword, setShowDmrSenderPassword] = useState(false);
    const [dmrDayExceptions, setDmrDayExceptions] = useState<string[]>(
        settings.dmr_day_exceptions,
    );
    const [dmrSignature, setDmrSignature] = useState(settings.dmr_signature);
    const [dmrGroups, setDmrGroups] = useState<DmrGroup[]>(
        settings.dmr_groups.map((group) => ({
            client_id: String(group.client_id ?? ''),
            receiver_emails: group.receiver_emails ?? '',
            cc_emails: group.cc_emails ?? '',
            subject: group.subject ?? '',
            content: group.content ?? '',
        })),
    );
    const [collapsedDmrGroups, setCollapsedDmrGroups] = useState<
        Record<string, boolean>
    >(() => {
        if (typeof window === 'undefined') return {};
        try {
            return JSON.parse(
                window.localStorage.getItem(
                    'app-settings:dmr-group-collapse',
                ) || '{}',
            ) as Record<string, boolean>;
        } catch {
            return {};
        }
    });
    const [utilizationTime, setUtilizationTime] = useState(
        settings.utilization_time,
    );
    const [utilizationDayExceptions, setUtilizationDayExceptions] = useState<
        string[]
    >(settings.utilization_day_exceptions);
    const [utilizationCapacityTeus, setUtilizationCapacityTeus] = useState(
        String(settings.utilization_capacity_teus),
    );
    const [smtpHost, setSmtpHost] = useState(settings.smtp_host);
    const [smtpIncomingPort, setSmtpIncomingPort] = useState(
        String(settings.smtp_incoming_port),
    );
    const [smtpPort, setSmtpPort] = useState(String(settings.smtp_port));
    const [smtpEncryption, setSmtpEncryption] = useState(
        settings.smtp_encryption === 'ssl'
            ? 'smtps'
            : settings.smtp_encryption || 'smtps',
    );
    const [smtpUsername, setSmtpUsername] = useState(settings.smtp_username);
    const [smtpPassword, setSmtpPassword] = useState(settings.smtp_password);
    const [smtpFromEmail, setSmtpFromEmail] = useState(
        settings.smtp_from_email,
    );
    const [smtpFromName, setSmtpFromName] = useState(settings.smtp_from_name);
    const [showSmtpPassword, setShowSmtpPassword] = useState(false);
    const [smsDriver] = useState('smsgate');
    const [smsgateApiUrl, setSmsgateApiUrl] = useState(
        settings.smsgate_api_url,
    );
    const [smsgateUsername, setSmsgateUsername] = useState(
        settings.smsgate_username,
    );
    const [smsgatePassword, setSmsgatePassword] = useState(
        settings.smsgate_password,
    );
    const [smsgateDeviceId, setSmsgateDeviceId] = useState(
        settings.smsgate_device_id,
    );
    const [smsgateSimNumber, setSmsgateSimNumber] = useState(
        settings.smsgate_sim_number,
    );
    const [smsgateTimeout, setSmsgateTimeout] = useState(
        String(settings.smsgate_timeout),
    );
    const [showSmsgatePassword, setShowSmsgatePassword] = useState(false);
    const [smsHeaderText, setSmsHeaderText] = useState(
        settings.sms_header_text,
    );
    const [smsFooterText, setSmsFooterText] = useState(
        settings.sms_footer_text,
    );
    const [smsgateWebhookUrl, setSmsgateWebhookUrl] = useState(
        settings.smsgate_webhook_url,
    );
    const [saving, setSaving] = useState<
        | 'docs'
        | 'queue'
        | 'booking'
        | 'smtp'
        | 'sms'
        | 'dmr'
        | 'utilization'
        | null
    >(null);
    const { toasts, removeToast, success, error } = useModernToast();

    const saveDocsSettings = async () => {
        setSaving('docs');
        try {
            const response = await axios.put('/app-settings', {
                section: 'docs_fee',
                incoming_rate: Number(incomingRate),
                outgoing_rate: Number(outgoingRate),
                hauler_exceptions: haulerExceptions,
            });
            success(
                response.data.message ||
                    'Docs Fee settings updated successfully.',
            );
        } catch (exception) {
            console.error('Failed to update Docs Fee settings:', exception);
            error('Rates must be numbers greater than 0.');
        } finally {
            setSaving(null);
        }
    };

    const saveQueueSettings = async () => {
        setSaving('queue');
        try {
            const response = await axios.put('/app-settings', {
                section: 'queue',
                booking_scraping_enabled: bookingScrapingEnabled,
                prein_booking_dependent: preInBookingDependent,
                preout_booking_dependent: preOutBookingDependent,
                preout_hauler_exceptions: preoutHaulerExceptions,
                prein_hauler_exceptions: preinHaulerExceptions,
                prein_scraping_client_ids: preinScrapingClientIds,
            });
            success(
                response.data.message ||
                    'Booking System Scraping settings updated successfully.',
            );
        } catch (exception) {
            console.error(
                'Failed to update Booking System Scraping settings:',
                exception,
            );
            error('Failed to update Booking System Scraping settings.');
        } finally {
            setSaving(null);
        }
    };

    const saveQueueExpirationSettings = async () => {
        setSaving('queue');
        try {
            const response = await axios.put('/app-settings', {
                section: 'queue',
                calling_expiration_minutes:
                    callingExpirationMinutes === ''
                        ? null
                        : Number(callingExpirationMinutes),
                floating_expiration_minutes:
                    floatingExpirationMinutes === ''
                        ? null
                        : Number(floatingExpirationMinutes),
                ...(queueInternalPassword
                    ? { queue_internal_password: queueInternalPassword }
                    : {}),
            });
            success(
                response.data.message ||
                    'Queue expiration settings updated successfully.',
            );
        } catch (exception) {
            console.error(
                'Failed to update Queue expiration settings:',
                exception,
            );
            error(
                'Expiration values must be blank or whole numbers of at least 1 minute.',
            );
        } finally {
            setSaving(null);
        }
    };

    const saveBookingCredentials = async () => {
        setSaving('booking');
        try {
            const response = await axios.put('/app-settings', {
                section: 'booking_credentials',
                booking_system_url: bookingSystemUrl,
                booking_system_login_url: bookingSystemLoginUrl || null,
                booking_system_username: bookingSystemUsername,
                ...(bookingSystemPassword
                    ? { booking_system_password: bookingSystemPassword }
                    : {}),
                booking_system_timeout: Number(bookingSystemTimeout),
            });
            success(
                response.data.message ||
                    'Booking System credentials updated successfully.',
            );
        } catch (exception) {
            console.error(
                'Failed to update Booking System credentials:',
                exception,
            );
            error('Please check the Booking System credential fields.');
        } finally {
            setSaving(null);
        }
    };

    const updateDmrGroup = (
        index: number,
        field: keyof DmrGroup,
        value: string,
    ) => {
        setDmrGroups((groups) =>
            groups.map((group, groupIndex) =>
                groupIndex === index ? { ...group, [field]: value } : group,
            ),
        );
    };

    const formatEmailList = (value: string) =>
        value
            .split(/[,;\s]+/)
            .map((email) => email.trim())
            .filter(Boolean)
            .join(',\n');

    const formatEmailListWhileTyping = (value: string) => {
        const hasTrailingSeparator = /[,;\s]$/.test(value);
        const formatted = formatEmailList(value);
        return hasTrailingSeparator && formatted !== ''
            ? `${formatted},`
            : formatted;
    };

    const addDmrGroup = () => {
        setDmrGroups((groups) => [
            ...groups,
            {
                client_id: '',
                receiver_emails: '',
                cc_emails: '',
                subject: '',
                content: '',
            },
        ]);
    };

    const removeDmrGroup = (index: number) => {
        setDmrGroups((groups) =>
            groups.filter((_, groupIndex) => groupIndex !== index),
        );
    };

    const duplicateDmrGroup = (index: number) => {
        setDmrGroups((groups) => {
            const group = groups[index];
            return [
                ...groups.slice(0, index + 1),
                { ...group, client_id: '' },
                ...groups.slice(index + 1),
            ];
        });
    };

    useEffect(() => {
        window.localStorage.setItem(
            'app-settings:dmr-group-collapse',
            JSON.stringify(collapsedDmrGroups),
        );
    }, [collapsedDmrGroups]);

    const toggleDmrGroup = (index: number) => {
        const key = String(index);
        setCollapsedDmrGroups((groups) => ({ ...groups, [key]: !groups[key] }));
    };

    const saveDmrSettings = async () => {
        setSaving('dmr');
        try {
            const response = await axios.put('/app-settings', {
                section: 'dmr',
                dmr_time: dmrTime,
                dmr_sender_email: dmrSenderEmail || null,
                ...(dmrSenderPassword
                    ? { dmr_sender_password: dmrSenderPassword }
                    : {}),
                dmr_sender_name: dmrSenderName || null,
                dmr_auto_send: dmrAutoSend,
                dmr_day_exceptions: dmrDayExceptions,
                dmr_signature: dmrSignature,
                dmr_groups: dmrGroups.map((group) => ({
                    ...group,
                    receiver_emails: formatEmailList(group.receiver_emails),
                    cc_emails: formatEmailList(group.cc_emails),
                })),
            });
            success(
                response.data.message || 'DMR settings updated successfully.',
            );
        } catch (exception) {
            console.error('Failed to update DMR settings:', exception);
            error(
                'Please check the DMR settings and make sure each client is selected only once.',
            );
        } finally {
            setSaving(null);
        }
    };

    const saveUtilizationSettings = async () => {
        setSaving('utilization');
        try {
            const response = await axios.put('/app-settings', {
                section: 'utilization',
                utilization_time: utilizationTime,
                utilization_day_exceptions: utilizationDayExceptions,
                utilization_capacity_teus: Number(utilizationCapacityTeus),
            });
            success(
                response.data.message ||
                    'Utilization settings updated successfully.',
            );
        } catch (exception) {
            console.error('Failed to update Utilization settings:', exception);
            error('Capacity TEUS must be a number of at least 1.');
        } finally {
            setSaving(null);
        }
    };

    const saveSmtpSettings = async () => {
        setSaving('smtp');
        try {
            const response = await axios.put('/app-settings', {
                section: 'smtp',
                smtp_host: smtpHost,
                smtp_incoming_port: Number(smtpIncomingPort),
                smtp_port: Number(smtpPort),
                smtp_encryption: smtpEncryption,
                smtp_username: smtpUsername || null,
                smtp_password: smtpPassword || null,
                smtp_from_email: smtpFromEmail,
                smtp_from_name: smtpFromName || null,
            });
            success(
                response.data.message || 'SMTP settings updated successfully.',
            );
        } catch (exception) {
            console.error('Failed to update SMTP settings:', exception);
            error(
                'Please check the SMTP host, port, encryption, and from email fields.',
            );
        } finally {
            setSaving(null);
        }
    };

    const saveSmsSettings = async () => {
        setSaving('sms');
        try {
            const response = await axios.put('/app-settings', {
                section: 'sms',
                sms_driver: smsDriver,
                smsgate_api_url: smsgateApiUrl,
                smsgate_username: smsgateUsername,
                ...(smsgatePassword
                    ? { smsgate_password: smsgatePassword }
                    : {}),
                smsgate_device_id: smsgateDeviceId || null,
                smsgate_sim_number:
                    smsgateSimNumber === '' ? null : Number(smsgateSimNumber),
                smsgate_timeout: Number(smsgateTimeout),
                sms_header_text: smsHeaderText || null,
                sms_footer_text: smsFooterText || null,
                smsgate_webhook_url: smsgateWebhookUrl || null,
                queue_status_messages: queueStatusMessages,
                standby_status_messages: standbyStatusMessages,
            });
            success(
                response.data.message || 'SMS settings updated successfully.',
            );
        } catch (exception) {
            console.error('Failed to update SMS settings:', exception);
            error('Please check the SMS and SMSGate settings.');
        } finally {
            setSaving(null);
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="App Settings" />

            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div
                        className="rounded-xl p-3"
                        style={{ backgroundColor: colors.brand.primary }}
                    >
                        <Settings className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            App Settings
                        </h1>
                        <p className="mt-1 text-sm text-gray-600">
                            Manage application settings
                        </p>
                    </div>
                </div>

                <div className="relative space-y-0 [&>div]:mb-6 lg:[&>div]:w-[calc(50%-0.75rem)]">
                    <ModernCard
                        title="Booking System Scraping Settings"
                        subtitle="Configure Booking System verification for Add Pre-In and Add Pre-Out"
                        icon={<Settings className="h-5 w-5 text-white" />}
                    >
                        <div className="flex max-w-4xl items-center justify-between rounded-lg border border-gray-200 p-4">
                            <div>
                                <p className="font-semibold text-gray-900">
                                    Booking System Scraping
                                </p>
                                <p className="mt-1 text-sm text-gray-600">
                                    {bookingScrapingEnabled
                                        ? 'Verified booking checks are enabled for both queue entry modals.'
                                        : 'Booking checks are disabled for both queue entry modals.'}
                                </p>
                            </div>
                            <ModernButton
                                type="button"
                                variant={
                                    bookingScrapingEnabled
                                        ? 'primary'
                                        : 'secondary'
                                }
                                size="sm"
                                icon={
                                    bookingScrapingEnabled ? (
                                        <ToggleRight className="h-5 w-5" />
                                    ) : (
                                        <ToggleLeft className="h-5 w-5" />
                                    )
                                }
                                onClick={() =>
                                    setBookingScrapingEnabled(
                                        (enabled) => !enabled,
                                    )
                                }
                            >
                                {bookingScrapingEnabled ? 'ON' : 'OFF'}
                            </ModernButton>
                        </div>
                        <div className="mt-4 grid max-w-4xl gap-4 md:grid-cols-2">
                            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                                <div>
                                    <p className="font-semibold text-gray-900">
                                        PRE-IN BOOKING DEPENDENT
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Scrape by container number when enabled.
                                    </p>
                                </div>
                                <ModernButton
                                    type="button"
                                    variant={
                                        preInBookingDependent
                                            ? 'primary'
                                            : 'secondary'
                                    }
                                    size="sm"
                                    icon={
                                        preInBookingDependent ? (
                                            <ToggleRight className="h-5 w-5" />
                                        ) : (
                                            <ToggleLeft className="h-5 w-5" />
                                        )
                                    }
                                    onClick={() =>
                                        setPreInBookingDependent(
                                            (enabled) => !enabled,
                                        )
                                    }
                                >
                                    {preInBookingDependent ? 'ON' : 'OFF'}
                                </ModernButton>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                                <div>
                                    <p className="font-semibold text-gray-900">
                                        PRE-OUT BOOKING DEPENDENT
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Scrape by plate number when enabled.
                                    </p>
                                </div>
                                <ModernButton
                                    type="button"
                                    variant={
                                        preOutBookingDependent
                                            ? 'primary'
                                            : 'secondary'
                                    }
                                    size="sm"
                                    icon={
                                        preOutBookingDependent ? (
                                            <ToggleRight className="h-5 w-5" />
                                        ) : (
                                            <ToggleLeft className="h-5 w-5" />
                                        )
                                    }
                                    onClick={() =>
                                        setPreOutBookingDependent(
                                            (enabled) => !enabled,
                                        )
                                    }
                                >
                                    {preOutBookingDependent ? 'ON' : 'OFF'}
                                </ModernButton>
                            </div>
                        </div>
                        <div className="mt-4 max-w-4xl">
                            <Label
                                htmlFor="prein-scraping-clients"
                                className="text-sm font-semibold text-gray-900"
                            >
                                CLIENTS EXCEPTION
                            </Label>
                            <div className="mt-2">
                                <MultiSelect
                                    options={clients.map((client) => ({
                                        value: String(client.c_id),
                                        label: `${client.client_name}${client.client_code ? ` (${client.client_code})` : ''}`,
                                    }))}
                                    value={preinScrapingClientIds}
                                    onChange={setPreinScrapingClientIds}
                                    placeholder="Select clients"
                                    searchPlaceholder="Search clients..."
                                />
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                Selected clients are treated as exceptions to
                                Booking System verification.
                            </p>
                        </div>
                        <div className="mt-4 max-w-4xl">
                            <Label
                                htmlFor="prein-hauler-exceptions"
                                className="text-sm font-semibold text-gray-900"
                            >
                                PRE-IN HAULER EXCEPTIONS
                            </Label>
                            <Input
                                id="prein-hauler-exceptions"
                                type="text"
                                value={preinHaulerExceptions}
                                onChange={(event) =>
                                    setPreinHaulerExceptions(
                                        event.target.value.toUpperCase(),
                                    )
                                }
                                placeholder="HAULER ONE, HAULER TWO"
                                className="mt-2 h-11 uppercase"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Separate haulers with commas. These haulers
                                appear in Add Pre-In as “Not in Booking” options
                                and bypass Booking System verification.
                            </p>
                        </div>
                        <div className="mt-4 max-w-4xl">
                            <Label
                                htmlFor="preout-hauler-exceptions"
                                className="text-sm font-semibold text-gray-900"
                            >
                                PRE-OUT HAULER EXCEPTIONS
                            </Label>
                            <Input
                                id="preout-hauler-exceptions"
                                type="text"
                                value={preoutHaulerExceptions}
                                onChange={(event) =>
                                    setPreoutHaulerExceptions(
                                        event.target.value.toUpperCase(),
                                    )
                                }
                                placeholder="HAULER ONE, HAULER TWO"
                                className="mt-2 h-11 uppercase"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Separate haulers with commas. These haulers
                                appear in Add Pre-Out as “Not in Booking”
                                options and bypass Booking System verification.
                            </p>
                        </div>
                        <div className="mt-6 flex items-center gap-3">
                            <ModernButton
                                type="button"
                                variant="primary"
                                loading={saving === 'queue'}
                                onClick={saveQueueSettings}
                            >
                                Save Settings
                            </ModernButton>
                        </div>
                    </ModernCard>

                    <ModernCard
                        title="Booking System Credentials"
                        subtitle="Configure the account and connection used for Booking System scraping"
                        icon={<Settings className="h-5 w-5 text-white" />}
                    >
                        <div className="grid max-w-4xl gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <Label
                                    htmlFor="booking-system-url"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    BOOKING SYSTEM URL
                                </Label>
                                <Input
                                    id="booking-system-url"
                                    type="url"
                                    value={bookingSystemUrl}
                                    onChange={(event) =>
                                        setBookingSystemUrl(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label
                                    htmlFor="booking-system-login-url"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    LOGIN URL
                                </Label>
                                <Input
                                    id="booking-system-login-url"
                                    type="url"
                                    value={bookingSystemLoginUrl}
                                    onChange={(event) =>
                                        setBookingSystemLoginUrl(
                                            event.target.value,
                                        )
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="booking-system-username"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    USERNAME
                                </Label>
                                <Input
                                    id="booking-system-username"
                                    type="text"
                                    value={bookingSystemUsername}
                                    onChange={(event) =>
                                        setBookingSystemUsername(
                                            event.target.value,
                                        )
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="booking-system-password"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    PASSWORD
                                </Label>
                                <div className="relative mt-2">
                                    <Input
                                        id="booking-system-password"
                                        type={
                                            showBookingSystemPassword
                                                ? 'text'
                                                : 'password'
                                        }
                                        value={bookingSystemPassword}
                                        onChange={(event) =>
                                            setBookingSystemPassword(
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Leave blank to keep current password"
                                        className="h-11 pr-11"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowBookingSystemPassword(
                                                (visible) => !visible,
                                            )
                                        }
                                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-900"
                                        aria-label={
                                            showBookingSystemPassword
                                                ? 'Hide password'
                                                : 'Show password'
                                        }
                                    >
                                        {showBookingSystemPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <Label
                                    htmlFor="booking-system-timeout"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    TIMEOUT (SECONDS)
                                </Label>
                                <Input
                                    id="booking-system-timeout"
                                    type="number"
                                    min="1"
                                    max="300"
                                    value={bookingSystemTimeout}
                                    onChange={(event) =>
                                        setBookingSystemTimeout(
                                            event.target.value,
                                        )
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div className="flex items-center gap-3 md:col-span-2">
                                <ModernButton
                                    type="button"
                                    variant="primary"
                                    loading={saving === 'booking'}
                                    onClick={saveBookingCredentials}
                                >
                                    Save Settings
                                </ModernButton>
                            </div>
                        </div>
                    </ModernCard>

                    <ModernCard
                        title="SMTP Settings"
                        subtitle="Configure the SMTP server used for dynamic email delivery"
                        icon={<Settings className="h-5 w-5 text-white" />}
                    >
                        <div className="grid max-w-4xl gap-4 md:grid-cols-2">
                            <div>
                                <Label
                                    htmlFor="smtp-host"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SMTP HOST
                                </Label>
                                <Input
                                    id="smtp-host"
                                    value={smtpHost}
                                    onChange={(event) =>
                                        setSmtpHost(event.target.value)
                                    }
                                    placeholder="smtp.example.com"
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-semibold text-gray-900">
                                    ENCRYPTION
                                </Label>
                                <Select
                                    value={smtpEncryption}
                                    onValueChange={setSmtpEncryption}
                                >
                                    <SelectTrigger className="mt-2 h-11">
                                        <SelectValue placeholder="Select encryption" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="smtps">
                                            SSL/TLS
                                        </SelectItem>
                                        <SelectItem value="tls">
                                            STARTTLS
                                        </SelectItem>
                                        <SelectItem value="none">
                                            None
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label
                                    htmlFor="smtp-incoming-port"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    INCOMING PORT
                                </Label>
                                <Input
                                    id="smtp-incoming-port"
                                    type="number"
                                    min="1"
                                    max="65535"
                                    value={smtpIncomingPort}
                                    onChange={(event) =>
                                        setSmtpIncomingPort(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="smtp-outgoing-port"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    OUTGOING PORT
                                </Label>
                                <Input
                                    id="smtp-outgoing-port"
                                    type="number"
                                    min="1"
                                    max="65535"
                                    value={smtpPort}
                                    onChange={(event) =>
                                        setSmtpPort(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="smtp-username"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SMTP USERNAME
                                </Label>
                                <Input
                                    id="smtp-username"
                                    value={smtpUsername}
                                    onChange={(event) =>
                                        setSmtpUsername(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="smtp-password"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SMTP PASSWORD
                                </Label>
                                <div className="relative mt-2">
                                    <Input
                                        id="smtp-password"
                                        type={
                                            showSmtpPassword
                                                ? 'text'
                                                : 'password'
                                        }
                                        value={smtpPassword}
                                        onChange={(event) =>
                                            setSmtpPassword(event.target.value)
                                        }
                                        className="h-11 pr-11"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowSmtpPassword(
                                                (visible) => !visible,
                                            )
                                        }
                                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-900"
                                        aria-label={
                                            showSmtpPassword
                                                ? 'Hide password'
                                                : 'Show password'
                                        }
                                    >
                                        {showSmtpPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <Label
                                    htmlFor="smtp-from-email"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    FROM EMAIL
                                </Label>
                                <Input
                                    id="smtp-from-email"
                                    type="email"
                                    value={smtpFromEmail}
                                    onChange={(event) =>
                                        setSmtpFromEmail(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="smtp-from-name"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    FROM NAME
                                </Label>
                                <Input
                                    id="smtp-from-name"
                                    value={smtpFromName}
                                    onChange={(event) =>
                                        setSmtpFromName(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div className="flex items-center gap-3 md:col-span-2">
                                <ModernButton
                                    type="button"
                                    variant="primary"
                                    loading={saving === 'smtp'}
                                    onClick={saveSmtpSettings}
                                >
                                    Save Settings
                                </ModernButton>
                            </div>
                        </div>
                    </ModernCard>

                    <ModernCard
                        title="DMR Settings"
                        subtitle="Configure the DMR schedule, sender, signature, and client-specific email content"
                        icon={<Settings className="h-5 w-5 text-white" />}
                    >
                        <div className="grid max-w-5xl gap-4 md:grid-cols-2">
                            <div>
                                <Label
                                    htmlFor="dmr-time"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    TIME
                                </Label>
                                <Input
                                    id="dmr-time"
                                    type="time"
                                    value={dmrTime}
                                    onChange={(event) =>
                                        setDmrTime(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="dmr-day-exceptions"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    DAY EXCEPTIONS
                                </Label>
                                <div className="mt-2">
                                    <MultiSelect
                                        options={[
                                            'Sunday',
                                            'Monday',
                                            'Tuesday',
                                            'Wednesday',
                                            'Thursday',
                                            'Friday',
                                            'Saturday',
                                        ].map((day) => ({
                                            value: day,
                                            label: day,
                                        }))}
                                        value={dmrDayExceptions}
                                        onChange={setDmrDayExceptions}
                                        placeholder="Select exception days"
                                        searchPlaceholder="Search days..."
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    The DMR worker will skip sending on selected
                                    days.
                                </p>
                            </div>
                            <div>
                                <Label
                                    htmlFor="dmr-sender-email"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SENDER EMAIL
                                </Label>
                                <Input
                                    id="dmr-sender-email"
                                    type="email"
                                    value={dmrSenderEmail}
                                    onChange={(event) =>
                                        setDmrSenderEmail(event.target.value)
                                    }
                                    placeholder="sender@example.com"
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="dmr-sender-name"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SENDER NAME
                                </Label>
                                <Input
                                    id="dmr-sender-name"
                                    value={dmrSenderName}
                                    onChange={(event) =>
                                        setDmrSenderName(event.target.value)
                                    }
                                    placeholder="TBS Container Yard"
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="dmr-sender-password"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SENDER PASSWORD
                                </Label>
                                <div className="relative mt-2">
                                    <Input
                                        id="dmr-sender-password"
                                        type={
                                            showDmrSenderPassword
                                                ? 'text'
                                                : 'password'
                                        }
                                        value={dmrSenderPassword}
                                        onChange={(event) =>
                                            setDmrSenderPassword(
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Leave blank to keep current password"
                                        className="h-11 pr-11"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowDmrSenderPassword(
                                                (visible) => !visible,
                                            )
                                        }
                                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-900"
                                        aria-label={
                                            showDmrSenderPassword
                                                ? 'Hide password'
                                                : 'Show password'
                                        }
                                    >
                                        {showDmrSenderPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Used with the sender email to send DMR
                                    emails.
                                </p>
                            </div>
                            <div>
                                <Label className="text-sm font-semibold text-gray-900">
                                    AUTO SEND
                                </Label>
                                <div className="mt-2 flex h-11 items-center justify-between rounded-md border border-gray-300 px-3">
                                    <span className="text-sm text-gray-600">
                                        Send DMR on schedule
                                    </span>
                                    <ModernButton
                                        type="button"
                                        variant={
                                            dmrAutoSend
                                                ? 'primary'
                                                : 'secondary'
                                        }
                                        size="sm"
                                        icon={
                                            dmrAutoSend ? (
                                                <ToggleRight className="h-5 w-5" />
                                            ) : (
                                                <ToggleLeft className="h-5 w-5" />
                                            )
                                        }
                                        onClick={() =>
                                            setDmrAutoSend(
                                                (enabled) => !enabled,
                                            )
                                        }
                                    >
                                        {dmrAutoSend ? 'ON' : 'OFF'}
                                    </ModernButton>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Controls automatic DMR sending at the
                                    configured time and days.
                                </p>
                            </div>
                            <div className="md:col-span-2">
                                <Label className="text-sm font-semibold text-gray-900">
                                    SIGNATURE
                                </Label>
                                <RichTextEditor
                                    value={dmrSignature}
                                    onChange={setDmrSignature}
                                    placeholder="Enter the default DMR signature..."
                                />
                            </div>
                        </div>

                        <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
                            <div>
                                <h4 className="font-semibold text-gray-900">
                                    Client Email Groups
                                </h4>
                                <p className="mt-1 text-sm text-gray-500">
                                    Configure a separate recipient list,
                                    subject, and message for each client.
                                </p>
                            </div>
                            <ModernButton
                                type="button"
                                variant="secondary"
                                size="sm"
                                icon={<Plus className="h-4 w-4" />}
                                onClick={addDmrGroup}
                            >
                                Add Group
                            </ModernButton>
                        </div>

                        <div className="mt-4 space-y-5">
                            {dmrGroups.length === 0 && (
                                <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                                    No client groups added yet.
                                </p>
                            )}
                            {dmrGroups.map((group, index) => {
                                const selectedClientIds = new Set(
                                    dmrGroups
                                        .filter(
                                            (_, groupIndex) =>
                                                groupIndex !== index,
                                        )
                                        .map((item) => item.client_id)
                                        .filter(Boolean),
                                );
                                return (
                                    <div
                                        key={`dmr-group-${index}`}
                                        className="rounded-xl border border-gray-200 bg-gray-50 p-5"
                                    >
                                        <div className="mb-4 flex items-center justify-between">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleDmrGroup(index)
                                                }
                                                className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600"
                                                aria-expanded={
                                                    !collapsedDmrGroups[
                                                        String(index)
                                                    ]
                                                }
                                                aria-controls={`dmr-group-content-${index}`}
                                            >
                                                {collapsedDmrGroups[
                                                    String(index)
                                                ] ? (
                                                    <ChevronDown className="h-5 w-5" />
                                                ) : (
                                                    <ChevronUp className="h-5 w-5" />
                                                )}
                                                Group {index + 1}
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <ModernButton
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={
                                                        <Copy className="h-4 w-4" />
                                                    }
                                                    onClick={() =>
                                                        duplicateDmrGroup(index)
                                                    }
                                                >
                                                    Duplicate
                                                </ModernButton>
                                                <ModernButton
                                                    type="button"
                                                    variant="delete"
                                                    size="sm"
                                                    icon={
                                                        <Trash2 className="h-4 w-4" />
                                                    }
                                                    onClick={() =>
                                                        removeDmrGroup(index)
                                                    }
                                                >
                                                    Remove
                                                </ModernButton>
                                            </div>
                                        </div>
                                        <div
                                            id={`dmr-group-content-${index}`}
                                            className={
                                                collapsedDmrGroups[
                                                    String(index)
                                                ]
                                                    ? 'hidden'
                                                    : 'grid gap-4 md:grid-cols-2'
                                            }
                                        >
                                            <div className="md:col-span-2">
                                                <Label
                                                    htmlFor={`dmr-client-${index}`}
                                                    className="text-sm font-semibold text-gray-900"
                                                >
                                                    CLIENT
                                                </Label>
                                                <Select
                                                    value={
                                                        group.client_id ||
                                                        undefined
                                                    }
                                                    onValueChange={(value) =>
                                                        updateDmrGroup(
                                                            index,
                                                            'client_id',
                                                            value,
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id={`dmr-client-${index}`}
                                                        className="mt-2 h-11 w-full"
                                                    >
                                                        <SelectValue placeholder="Select a client" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {clients
                                                            .filter(
                                                                (client) =>
                                                                    !selectedClientIds.has(
                                                                        String(
                                                                            client.c_id,
                                                                        ),
                                                                    ) ||
                                                                    String(
                                                                        client.c_id,
                                                                    ) ===
                                                                        group.client_id,
                                                            )
                                                            .map((client) => (
                                                                <SelectItem
                                                                    key={
                                                                        client.c_id
                                                                    }
                                                                    value={String(
                                                                        client.c_id,
                                                                    )}
                                                                >
                                                                    {
                                                                        client.client_name
                                                                    }
                                                                    {client.client_code
                                                                        ? ` (${client.client_code})`
                                                                        : ''}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label
                                                    htmlFor={`dmr-receiver-${index}`}
                                                    className="text-sm font-semibold text-gray-900"
                                                >
                                                    RECEIVER EMAILS
                                                </Label>
                                                <textarea
                                                    id={`dmr-receiver-${index}`}
                                                    value={
                                                        group.receiver_emails
                                                    }
                                                    onChange={(event) =>
                                                        updateDmrGroup(
                                                            index,
                                                            'receiver_emails',
                                                            formatEmailListWhileTyping(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    onBlur={(event) =>
                                                        updateDmrGroup(
                                                            index,
                                                            'receiver_emails',
                                                            formatEmailList(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    placeholder={
                                                        'qwe@gmail.com,\nasd@gmail.com'
                                                    }
                                                    rows={5}
                                                    style={{
                                                        colorScheme: 'light',
                                                    }}
                                                    className="mt-2 h-32 min-h-[7.5rem] w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                                <p className="mt-1 text-xs text-gray-500">
                                                    One email per line. The
                                                    field can be resized
                                                    vertically.
                                                </p>
                                            </div>
                                            <div>
                                                <Label
                                                    htmlFor={`dmr-cc-${index}`}
                                                    className="text-sm font-semibold text-gray-900"
                                                >
                                                    CC EMAILS
                                                </Label>
                                                <textarea
                                                    id={`dmr-cc-${index}`}
                                                    value={group.cc_emails}
                                                    onChange={(event) =>
                                                        updateDmrGroup(
                                                            index,
                                                            'cc_emails',
                                                            formatEmailListWhileTyping(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    onBlur={(event) =>
                                                        updateDmrGroup(
                                                            index,
                                                            'cc_emails',
                                                            formatEmailList(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    placeholder="cc@example.com"
                                                    rows={5}
                                                    style={{
                                                        colorScheme: 'light',
                                                    }}
                                                    className="mt-2 h-32 min-h-[7.5rem] w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                />
                                                <p className="mt-1 text-xs text-gray-500">
                                                    One email per line. The
                                                    field can be resized
                                                    vertically.
                                                </p>
                                            </div>
                                            <div className="md:col-span-2">
                                                <Label className="text-sm font-semibold text-gray-900">
                                                    SUBJECT
                                                </Label>
                                                <RichTextEditor
                                                    value={group.subject}
                                                    onChange={(value) =>
                                                        updateDmrGroup(
                                                            index,
                                                            'subject',
                                                            value,
                                                        )
                                                    }
                                                    placeholder="Enter the email subject..."
                                                    minHeight="90px"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <Label className="text-sm font-semibold text-gray-900">
                                                    CONTENT
                                                </Label>
                                                <RichTextEditor
                                                    value={group.content}
                                                    onChange={(value) =>
                                                        updateDmrGroup(
                                                            index,
                                                            'content',
                                                            value,
                                                        )
                                                    }
                                                    placeholder="Enter the email content..."
                                                    minHeight="180px"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-6 flex items-center gap-3">
                            <ModernButton
                                type="button"
                                variant="primary"
                                loading={saving === 'dmr'}
                                onClick={saveDmrSettings}
                            >
                                Save Settings
                            </ModernButton>
                        </div>
                    </ModernCard>

                    <ModernCard
                        title="Utilization Settings"
                        subtitle="Configure the daily real-time inventory utilization snapshot"
                        icon={<Settings className="h-5 w-5 text-white" />}
                    >
                        <div className="grid max-w-4xl gap-4 md:grid-cols-2">
                            <div>
                                <Label
                                    htmlFor="utilization-time"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    TIME
                                </Label>
                                <Input
                                    id="utilization-time"
                                    type="time"
                                    value={utilizationTime}
                                    onChange={(event) =>
                                        setUtilizationTime(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="utilization-capacity"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    CAPACITY (TEUS)
                                </Label>
                                <Input
                                    id="utilization-capacity"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={utilizationCapacityTeus}
                                    onChange={(event) =>
                                        setUtilizationCapacityTeus(
                                            event.target.value,
                                        )
                                    }
                                    className="mt-2 h-11"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Must be a number greater than or equal to 1.
                                </p>
                            </div>
                            <div className="md:col-span-2">
                                <Label
                                    htmlFor="utilization-day-exceptions"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    DAY EXCEPTIONS
                                </Label>
                                <div className="mt-2">
                                    <MultiSelect
                                        options={[
                                            'Sunday',
                                            'Monday',
                                            'Tuesday',
                                            'Wednesday',
                                            'Thursday',
                                            'Friday',
                                            'Saturday',
                                        ].map((day) => ({
                                            value: day,
                                            label: day,
                                        }))}
                                        value={utilizationDayExceptions}
                                        onChange={setUtilizationDayExceptions}
                                        placeholder="Select exception days"
                                        searchPlaceholder="Search days..."
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    The worker skips utilization capture on
                                    selected days.
                                </p>
                            </div>
                            <div className="flex items-center gap-3 md:col-span-2">
                                <ModernButton
                                    type="button"
                                    variant="primary"
                                    loading={saving === 'utilization'}
                                    onClick={saveUtilizationSettings}
                                >
                                    Save Settings
                                </ModernButton>
                            </div>
                        </div>
                    </ModernCard>

                    <ModernCard
                        title="Queue Settings"
                        subtitle="Configure automatic calling and floating expiration"
                        icon={<Settings className="h-5 w-5 text-white" />}
                    >
                        <div className="grid max-w-4xl gap-4 md:grid-cols-2">
                            <div>
                                <Label
                                    htmlFor="calling-expiration-minutes"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    CALLING EXPIRATION (MINUTES)
                                </Label>
                                <Input
                                    id="calling-expiration-minutes"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={callingExpirationMinutes}
                                    onChange={(event) =>
                                        setCallingExpirationMinutes(
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Disabled"
                                    className="mt-2 h-11"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Calling automatically changes to Floating.
                                    Leave blank to disable.
                                </p>
                            </div>
                            <div>
                                <Label
                                    htmlFor="floating-expiration-minutes"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    FLOATING EXPIRATION (MINUTES)
                                </Label>
                                <Input
                                    id="floating-expiration-minutes"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={floatingExpirationMinutes}
                                    onChange={(event) =>
                                        setFloatingExpirationMinutes(
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Disabled"
                                    className="mt-2 h-11"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Floating automatically changes to Forfeited.
                                    Leave blank to disable.
                                </p>
                            </div>
                            <div className="md:col-span-2">
                                <Label
                                    htmlFor="queue-internal-password"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    QUEUE-INTERNAL PASSWORD
                                </Label>
                                <div className="relative mt-2">
                                    <Input
                                        id="queue-internal-password"
                                        type={
                                            showQueueInternalPassword
                                                ? 'text'
                                                : 'password'
                                        }
                                        autoComplete="new-password"
                                        value={queueInternalPassword}
                                        onChange={(event) =>
                                            setQueueInternalPassword(
                                                event.target.value.toUpperCase(),
                                            )
                                        }
                                        onCopy={(event) =>
                                            event.preventDefault()
                                        }
                                        onCut={(event) =>
                                            event.preventDefault()
                                        }
                                        onPaste={(event) =>
                                            event.preventDefault()
                                        }
                                        placeholder={
                                            settings.queue_internal_password_configured &&
                                            !queueInternalPassword
                                                ? 'Existing password cannot be recovered; set a new one'
                                                : 'Set Queue Internal password'
                                        }
                                        className="h-11 pr-11 uppercase"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowQueueInternalPassword(
                                                (visible) => !visible,
                                            )
                                        }
                                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-900"
                                        aria-label={
                                            showQueueInternalPassword
                                                ? 'Hide password'
                                                : 'Show password'
                                        }
                                    >
                                        {showQueueInternalPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Used to unlock /queue-internal and full
                                    access on /queue. Saved passwords can be
                                    displayed.
                                </p>
                            </div>
                            <div className="flex items-center gap-3 md:col-span-2">
                                <ModernButton
                                    type="button"
                                    variant="primary"
                                    loading={saving === 'queue'}
                                    onClick={saveQueueExpirationSettings}
                                >
                                    Save Settings
                                </ModernButton>
                            </div>
                        </div>
                    </ModernCard>

                    <ModernCard
                        title="Docs Fee Settings"
                        subtitle="Configure incoming and outgoing Docs Fee rates"
                        icon={<Settings className="h-5 w-5 text-white" />}
                    >
                        <div className="grid max-w-4xl gap-6 md:grid-cols-3">
                            <div>
                                <Label
                                    htmlFor="incoming-rate"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    INCOMING RATE
                                </Label>
                                <Input
                                    id="incoming-rate"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={incomingRate}
                                    onChange={(event) =>
                                        setIncomingRate(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>

                            <div>
                                <Label
                                    htmlFor="outgoing-rate"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    OUTGOING RATE
                                </Label>
                                <Input
                                    id="outgoing-rate"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={outgoingRate}
                                    onChange={(event) =>
                                        setOutgoingRate(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>

                            <div>
                                <Label
                                    htmlFor="hauler-exceptions"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    HAULER EXCEPTIONS
                                </Label>
                                <Input
                                    id="hauler-exceptions"
                                    type="text"
                                    value={haulerExceptions}
                                    onChange={(event) =>
                                        setHaulerExceptions(
                                            event.target.value.toUpperCase(),
                                        )
                                    }
                                    placeholder="HAULER ONE, HAULER TWO"
                                    className="mt-2 h-11 uppercase"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Separate haulers with commas. These haulers
                                    receive a 0 Docs Fee rate.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 md:col-span-3">
                                <ModernButton
                                    type="button"
                                    variant="primary"
                                    loading={saving === 'docs'}
                                    onClick={saveDocsSettings}
                                >
                                    Save Settings
                                </ModernButton>
                            </div>
                        </div>
                    </ModernCard>

                    <ModernCard
                        title="SMS Settings"
                        subtitle="Configure the SMS provider used by TBS notifications"
                        icon={<Settings className="h-5 w-5 text-white" />}
                    >
                        <div className="grid max-w-4xl gap-4 md:grid-cols-2">
                            <div>
                                <Label
                                    htmlFor="sms-driver"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SMS PROVIDER
                                </Label>
                                <Input
                                    id="sms-driver"
                                    value="SMSGate"
                                    readOnly
                                    className="mt-2 h-11 bg-gray-100"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="smsgate-timeout"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    TIMEOUT (SECONDS)
                                </Label>
                                <Input
                                    id="smsgate-timeout"
                                    type="number"
                                    min="1"
                                    max="300"
                                    value={smsgateTimeout}
                                    onChange={(event) =>
                                        setSmsgateTimeout(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label
                                    htmlFor="smsgate-api-url"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SMSGATE API URL
                                </Label>
                                <Input
                                    id="smsgate-api-url"
                                    type="url"
                                    value={smsgateApiUrl}
                                    onChange={(event) =>
                                        setSmsgateApiUrl(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label
                                    htmlFor="smsgate-webhook-url"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SMSGATE WEBHOOK URL (OPTIONAL)
                                </Label>
                                <Input
                                    id="smsgate-webhook-url"
                                    type="url"
                                    value={smsgateWebhookUrl}
                                    onChange={(event) =>
                                        setSmsgateWebhookUrl(event.target.value)
                                    }
                                    placeholder="https://your-domain.com/api/webhooks/smsgate"
                                    className="mt-2 h-11"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Register this URL in SMSGate for SMS Sent,
                                    Delivered, and Failed events.
                                </p>
                            </div>
                            <div>
                                <Label
                                    htmlFor="smsgate-username"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SMSGATE USERNAME
                                </Label>
                                <Input
                                    id="smsgate-username"
                                    type="text"
                                    value={smsgateUsername}
                                    onChange={(event) =>
                                        setSmsgateUsername(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="smsgate-device-id"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SMSGATE DEVICE ID
                                </Label>
                                <Input
                                    id="smsgate-device-id"
                                    type="text"
                                    value={smsgateDeviceId}
                                    onChange={(event) =>
                                        setSmsgateDeviceId(event.target.value)
                                    }
                                    className="mt-2 h-11"
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="smsgate-password"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SMSGATE PASSWORD
                                </Label>
                                <div className="relative mt-2">
                                    <Input
                                        id="smsgate-password"
                                        type={
                                            showSmsgatePassword
                                                ? 'text'
                                                : 'password'
                                        }
                                        autoComplete="new-password"
                                        value={smsgatePassword}
                                        onChange={(event) =>
                                            setSmsgatePassword(
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Enter SMSGate password"
                                        className="h-11 pr-11"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowSmsgatePassword(
                                                (visible) => !visible,
                                            )
                                        }
                                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-gray-900"
                                        aria-label={
                                            showSmsgatePassword
                                                ? 'Hide password'
                                                : 'Show password'
                                        }
                                    >
                                        {showSmsgatePassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Stored encrypted in the database.
                                </p>
                            </div>
                            <div>
                                <Label
                                    htmlFor="smsgate-sim-number"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SIM NUMBER (OPTIONAL)
                                </Label>
                                <Input
                                    id="smsgate-sim-number"
                                    type="number"
                                    min="1"
                                    max="3"
                                    value={smsgateSimNumber}
                                    onChange={(event) =>
                                        setSmsgateSimNumber(event.target.value)
                                    }
                                    placeholder="Blank for default SIM"
                                    className="mt-2 h-11"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Leave blank for a single-SIM phone.
                                </p>
                            </div>
                            <div className="md:col-span-2">
                                <Label
                                    htmlFor="sms-header-text"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SMS HEADER TEXT
                                </Label>
                                <textarea
                                    id="sms-header-text"
                                    value={smsHeaderText}
                                    onChange={(event) =>
                                        setSmsHeaderText(event.target.value)
                                    }
                                    rows={2}
                                    placeholder="Optional text placed before the queue message"
                                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label
                                    htmlFor="sms-footer-text"
                                    className="text-sm font-semibold text-gray-900"
                                >
                                    SMS FOOTER TEXT
                                </Label>
                                <textarea
                                    id="sms-footer-text"
                                    value={smsFooterText}
                                    onChange={(event) =>
                                        setSmsFooterText(event.target.value)
                                    }
                                    rows={2}
                                    placeholder="Optional text placed after the queue message"
                                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                            <div className="border-t border-gray-200 pt-6 md:col-span-2">
                                <h3 className="text-lg font-bold text-gray-900">
                                    Queue Status SMS Messages
                                </h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    The final SMS format is header, queue
                                    message, then footer.
                                </p>
                                <div className="mt-4 grid gap-4">
                                    {queueStatusMessages.map(
                                        (statusMessage, index) => (
                                            <div key={statusMessage.id}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <Label
                                                        htmlFor={`queue-status-message-${statusMessage.id}`}
                                                        className="text-sm font-semibold text-gray-900 uppercase"
                                                    >
                                                        {statusMessage.status}
                                                    </Label>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setQueueStatusMessages(
                                                                (messages) =>
                                                                    messages.map(
                                                                        (
                                                                            message,
                                                                            messageIndex,
                                                                        ) =>
                                                                            messageIndex ===
                                                                            index
                                                                                ? {
                                                                                      ...message,
                                                                                      enabled:
                                                                                          !message.enabled,
                                                                                  }
                                                                                : message,
                                                                    ),
                                                            )
                                                        }
                                                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${statusMessage.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                                                        aria-pressed={
                                                            statusMessage.enabled
                                                        }
                                                    >
                                                        {statusMessage.enabled ? (
                                                            <ToggleRight className="h-4 w-4" />
                                                        ) : (
                                                            <ToggleLeft className="h-4 w-4" />
                                                        )}{' '}
                                                        {statusMessage.enabled
                                                            ? 'On'
                                                            : 'Off'}
                                                    </button>
                                                </div>
                                                <textarea
                                                    id={`queue-status-message-${statusMessage.id}`}
                                                    value={
                                                        statusMessage.message
                                                    }
                                                    onChange={(event) =>
                                                        setQueueStatusMessages(
                                                            (messages) =>
                                                                messages.map(
                                                                    (
                                                                        message,
                                                                        messageIndex,
                                                                    ) =>
                                                                        messageIndex ===
                                                                        index
                                                                            ? {
                                                                                  ...message,
                                                                                  message:
                                                                                      event
                                                                                          .target
                                                                                          .value,
                                                                              }
                                                                            : message,
                                                                ),
                                                        )
                                                    }
                                                    rows={3}
                                                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                />
                                            </div>
                                        ),
                                    )}
                                </div>
                                <h3 className="mt-8 text-lg font-bold text-gray-900">
                                    Standby SMS Messages
                                </h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Standby messages use the selected standby
                                    code and reason.
                                </p>
                                <div className="mt-4 grid gap-4">
                                    {standbyStatusMessages.map(
                                        (statusMessage, index) => (
                                            <div key={statusMessage.id}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <Label
                                                        htmlFor={`standby-status-message-${statusMessage.id}`}
                                                        className="text-sm font-semibold text-gray-900 uppercase"
                                                    >
                                                        {statusMessage.code} —{' '}
                                                        {statusMessage.name}
                                                    </Label>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setStandbyStatusMessages(
                                                                (messages) =>
                                                                    messages.map(
                                                                        (
                                                                            message,
                                                                            messageIndex,
                                                                        ) =>
                                                                            messageIndex ===
                                                                            index
                                                                                ? {
                                                                                      ...message,
                                                                                      enabled:
                                                                                          !message.enabled,
                                                                                  }
                                                                                : message,
                                                                    ),
                                                            )
                                                        }
                                                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${statusMessage.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                                                        aria-pressed={
                                                            statusMessage.enabled
                                                        }
                                                    >
                                                        {statusMessage.enabled ? (
                                                            <ToggleRight className="h-4 w-4" />
                                                        ) : (
                                                            <ToggleLeft className="h-4 w-4" />
                                                        )}{' '}
                                                        {statusMessage.enabled
                                                            ? 'On'
                                                            : 'Off'}
                                                    </button>
                                                </div>
                                                <textarea
                                                    id={`standby-status-message-${statusMessage.id}`}
                                                    value={
                                                        statusMessage.message
                                                    }
                                                    onChange={(event) =>
                                                        setStandbyStatusMessages(
                                                            (messages) =>
                                                                messages.map(
                                                                    (
                                                                        message,
                                                                        messageIndex,
                                                                    ) =>
                                                                        messageIndex ===
                                                                        index
                                                                            ? {
                                                                                  ...message,
                                                                                  message:
                                                                                      event
                                                                                          .target
                                                                                          .value,
                                                                              }
                                                                            : message,
                                                                ),
                                                        )
                                                    }
                                                    rows={3}
                                                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                                                />
                                            </div>
                                        ),
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 md:col-span-2">
                                <ModernButton
                                    type="button"
                                    variant="primary"
                                    loading={saving === 'sms'}
                                    onClick={saveSmsSettings}
                                >
                                    Save Settings
                                </ModernButton>
                            </div>
                        </div>
                    </ModernCard>
                </div>
            </div>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </AuthenticatedLayout>
    );
}

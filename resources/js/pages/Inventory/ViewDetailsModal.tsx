import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface DamageRecord {
    damage_id: number;
    description: string;
    date_reported: string;
    repair_status: string;
    repair_cost: number | null;
    remarks: string | null;
}

interface ActivityLog {
    activity_id: number;
    timestamp: string;
    user: string;
    field_changed: string;
    old_value: string | null;
    new_value: string | null;
    action: string;
}

interface InventoryDetails {
    inv_id: number;
    hashed_id: string;
    container_no: string;
    client: {
        client_code: string;
        client_name: string;
    } | null;
    container_size: string;
    container_type: string;
    load_type: string;
    booking: string | null;
    shipper: string | null;
    vessel: string | null;
    voyage: string | null;
    date_in: string;
    time_in: string;
    date_out: string | null;
    time_out: string | null;
    slot: string | null;
    status: string;
    hold: boolean;
    damage: boolean;
    remarks: string | null;
    created_at: string;
    created_by: string;
    updated_at: string | null;
    updated_by: string | null;
    damage_records?: DamageRecord[];
    activity_logs?: ActivityLog[];
}

interface ViewDetailsModalProps {
    open: boolean;
    hashedId: string;
    onClose: () => void;
}

export default function ViewDetailsModal({ open, hashedId, onClose }: ViewDetailsModalProps) {
    const axios = window.axios;
    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<InventoryDetails | null>(null);

    useEffect(() => {
        if (open && hashedId) {
            fetchDetails();
        }
    }, [open, hashedId]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/inventory/${hashedId}`);
            if (response.data.success) {
                setDetails(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch container details:', error);
            toast.error('Failed to load container details');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'IN':
                return <Badge className="bg-blue-600">IN</Badge>;
            case 'OUT':
                return <Badge className="bg-orange-600">OUT</Badge>;
            case 'COMPLETE':
                return <Badge className="bg-green-600">COMPLETE</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const getRepairStatusBadge = (status: string) => {
        switch (status?.toUpperCase()) {
            case 'PENDING':
                return <Badge variant="destructive">Pending</Badge>;
            case 'IN PROGRESS':
                return <Badge className="bg-orange-600">In Progress</Badge>;
            case 'COMPLETED':
                return <Badge className="bg-green-600">Completed</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Container Details</DialogTitle>
                    <DialogDescription>
                        {details?.container_no || 'Loading...'}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading details...</span>
                    </div>
                ) : details ? (
                    <Tabs defaultValue="info" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="info">Container Info</TabsTrigger>
                            <TabsTrigger value="dates">Dates & Times</TabsTrigger>
                            <TabsTrigger value="damage">
                                Damage Records {details.damage && `(${details.damage_records?.length || 0})`}
                            </TabsTrigger>
                            <TabsTrigger value="activity">Activity History</TabsTrigger>
                        </TabsList>

                        {/* TAB 1: Container Information */}
                        <TabsContent value="info" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Container Number</Label>
                                    <p className="text-base font-medium">{details.container_no}</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Client</Label>
                                    <p className="text-base">
                                        {details.client 
                                            ? `${details.client.client_code} - ${details.client.client_name}`
                                            : '---'}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Size</Label>
                                    <p className="text-base">{details.container_size}"</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Type</Label>
                                    <p className="text-base">{details.container_type}</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Condition</Label>
                                    <p className="text-base">
                                        {details.load_type === 'E' ? 'Empty' : details.load_type === 'F' ? 'Full' : details.load_type}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Booking Number</Label>
                                    <p className="text-base">{details.booking || '---'}</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Shipper</Label>
                                    <p className="text-base">{details.shipper || '---'}</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Vessel</Label>
                                    <p className="text-base">{details.vessel || '---'}</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Voyage</Label>
                                    <p className="text-base">{details.voyage || '---'}</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Slot Location</Label>
                                    <p className="text-base">{details.slot || '---'}</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Status</Label>
                                    <div className="mt-1">
                                        {getStatusBadge(details.status)}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Hold Status</Label>
                                    <p className="text-base">
                                        {details.hold ? (
                                            <span className="text-red-600 font-semibold">YES - ON HOLD</span>
                                        ) : (
                                            <span className="text-green-600">No</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm font-semibold text-gray-700">Remarks</Label>
                                <p className="text-base mt-1 p-3 bg-gray-50 rounded border">
                                    {details.remarks || 'No remarks'}
                                </p>
                            </div>
                        </TabsContent>

                        {/* TAB 2: Dates & Times */}
                        <TabsContent value="dates" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Gate In Date</Label>
                                    <p className="text-base font-medium">{details.date_in}</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Gate In Time</Label>
                                    <p className="text-base font-medium">{details.time_in}</p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Gate Out Date</Label>
                                    <p className="text-base font-medium">
                                        {details.date_out || <span className="text-gray-400">Not gated out</span>}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-sm font-semibold text-gray-700">Gate Out Time</Label>
                                    <p className="text-base font-medium">
                                        {details.time_out || <span className="text-gray-400">Not gated out</span>}
                                    </p>
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Audit Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700">Created Date</Label>
                                        <p className="text-base">{details.created_at}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700">Created By</Label>
                                        <p className="text-base">{details.created_by}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700">Modified Date</Label>
                                        <p className="text-base">{details.updated_at || '---'}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700">Modified By</Label>
                                        <p className="text-base">{details.updated_by || '---'}</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB 3: Damage Records */}
                        <TabsContent value="damage" className="space-y-4">
                            {details.damage_records && details.damage_records.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date Reported</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Repair Status</TableHead>
                                                <TableHead>Repair Cost</TableHead>
                                                <TableHead>Remarks</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details.damage_records.map((damage) => (
                                                <TableRow key={damage.damage_id}>
                                                    <TableCell>{damage.date_reported}</TableCell>
                                                    <TableCell className="max-w-xs">{damage.description}</TableCell>
                                                    <TableCell>{getRepairStatusBadge(damage.repair_status)}</TableCell>
                                                    <TableCell>
                                                        {damage.repair_cost 
                                                            ? `₱${damage.repair_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                                            : '---'}
                                                    </TableCell>
                                                    <TableCell>{damage.remarks || '---'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center py-8">
                                    <div className="text-center">
                                        <p className="text-sm text-muted-foreground">No damage records found</p>
                                        <p className="text-xs text-gray-400 mt-1">This container has no reported damages</p>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* TAB 4: Activity History */}
                        <TabsContent value="activity" className="space-y-4">
                            {details.activity_logs && details.activity_logs.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Timestamp</TableHead>
                                                <TableHead>User</TableHead>
                                                <TableHead>Action</TableHead>
                                                <TableHead>Field</TableHead>
                                                <TableHead>Old Value</TableHead>
                                                <TableHead>New Value</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {details.activity_logs.map((log) => (
                                                <TableRow key={log.activity_id}>
                                                    <TableCell className="text-sm">{log.timestamp}</TableCell>
                                                    <TableCell>{log.user}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{log.action}</Badge>
                                                    </TableCell>
                                                    <TableCell className="font-medium">{log.field_changed}</TableCell>
                                                    <TableCell className="text-red-600">{log.old_value || '---'}</TableCell>
                                                    <TableCell className="text-green-600">{log.new_value || '---'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center py-8">
                                    <div className="text-center">
                                        <p className="text-sm text-muted-foreground">No activity history found</p>
                                        <p className="text-xs text-gray-400 mt-1">No modifications have been recorded</p>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div className="flex items-center justify-center py-8">
                        <p className="text-sm text-muted-foreground">Failed to load container details</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

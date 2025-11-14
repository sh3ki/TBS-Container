import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import { InventoryRecord } from '@/types/inventory';

interface ClientOption {
    c_id: number;
    hashed_id: string;
    client_code: string;
    client_name: string;
}

interface EditInventoryModalProps {
    open: boolean;
    record: InventoryRecord;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EditInventoryModal({ open, record, onClose, onSuccess }: EditInventoryModalProps) {
    const axios = window.axios;
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [sizes, setSizes] = useState<string[]>([]);
    const [types, setTypes] = useState<string[]>([]);
    
    const [formData, setFormData] = useState({
        container_no: record.container_no,
        client_id: record.client?.hashed_id || '',
        container_size: record.container_size,
        container_type: record.container_type,
        load_type: record.load_type,
        booking: record.booking || '',
        shipper: record.shipper || '',
        vessel: record.vessel || '',
        voyage: record.voyage || '',
        date_in: record.date_in,
        time_in: record.time_in,
        date_out: record.date_out || '',
        time_out: record.time_out || '',
        slot: record.slot || '',
        status: record.status,
        hold: record.hold,
        remarks: record.remarks || '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            fetchDropdownData();
        }
    }, [open]);

    const fetchDropdownData = async () => {
        try {
            const [clientsRes, sizesRes, typesRes] = await Promise.all([
                axios.get('/api/inventory/clients'),
                axios.get('/api/inventory/sizes'),
                axios.get('/api/inventory/types'),
            ]);

            if (clientsRes.data.success) setClients(clientsRes.data.data || []);
            if (sizesRes.data.success) setSizes(sizesRes.data.data || []);
            if (typesRes.data.success) setTypes(typesRes.data.data || []);
        } catch (error) {
            console.error('Error fetching dropdown data:', error);
        }
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Container number validation (11 characters)
        if (!formData.container_no.trim()) {
            newErrors.container_no = 'Container number is required';
        } else if (formData.container_no.length !== 11) {
            newErrors.container_no = 'Container number must be exactly 11 characters';
        }

        // Client validation
        if (!formData.client_id) {
            newErrors.client_id = 'Client is required';
        }

        // Date validation
        if (!formData.date_in) {
            newErrors.date_in = 'Gate in date is required';
        }

        if (!formData.time_in) {
            newErrors.time_in = 'Gate in time is required';
        }

        // Date Out >= Date In
        if (formData.date_out && formData.date_in) {
            if (new Date(formData.date_out) < new Date(formData.date_in)) {
                newErrors.date_out = 'Gate out date cannot be before gate in date';
            }
        }

        // Hold validation
        if (formData.hold && formData.date_out) {
            newErrors.hold = 'Cannot gate out a container that is on hold. Remove hold first.';
        }

        // Status validation
        if (formData.date_out && formData.status === 'IN') {
            newErrors.status = 'Status must be OUT or COMPLETE if container is gated out';
        }

        if (!formData.date_out && (formData.status === 'OUT' || formData.status === 'COMPLETE')) {
            newErrors.status = 'Status cannot be OUT or COMPLETE without gate out date';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            toast.error('Please fix validation errors');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.put(`/api/inventory/${record.hashed_id}`, formData);

            if (response.data.success) {
                toast.success('Container updated successfully');
                onSuccess();
            } else {
                toast.error(response.data.message || 'Failed to update container');
            }
        } catch (error: any) {
            console.error('Error updating container:', error);
            toast.error(error.response?.data?.message || 'Failed to update container');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: string, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        // Clear error for this field
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Container</DialogTitle>
                    <DialogDescription>
                        Update container information for {record.container_no}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Container Information */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700">Container Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="container_no">
                                    Container Number <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="container_no"
                                    value={formData.container_no}
                                    onChange={(e) => handleChange('container_no', e.target.value.toUpperCase())}
                                    maxLength={11}
                                    placeholder="ABCD1234567"
                                    className={errors.container_no ? 'border-red-500' : ''}
                                />
                                {errors.container_no && (
                                    <p className="text-xs text-red-500 mt-1">{errors.container_no}</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="client_id">
                                    Client <span className="text-red-500">*</span>
                                </Label>
                                <Select value={formData.client_id} onValueChange={(value) => handleChange('client_id', value)}>
                                    <SelectTrigger className={errors.client_id ? 'border-red-500' : ''}>
                                        <SelectValue placeholder="Select client" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clients.map((client) => (
                                            <SelectItem key={client.c_id} value={client.hashed_id}>
                                                {client.client_code} - {client.client_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.client_id && (
                                    <p className="text-xs text-red-500 mt-1">{errors.client_id}</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="container_size">Size</Label>
                                <Select value={formData.container_size} onValueChange={(value) => handleChange('container_size', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sizes.map((size) => (
                                            <SelectItem key={size} value={size}>
                                                {size}"
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="container_type">Type</Label>
                                <Select value={formData.container_type} onValueChange={(value) => handleChange('container_type', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {types.map((type) => (
                                            <SelectItem key={type} value={type}>
                                                {type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Condition</Label>
                                <Select value={formData.load_type} onValueChange={(value) => handleChange('load_type', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="E">Empty</SelectItem>
                                        <SelectItem value="F">Full</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="status">
                                    Status <span className="text-red-500">*</span>
                                </Label>
                                <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                                    <SelectTrigger className={errors.status ? 'border-red-500' : ''}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="IN">IN</SelectItem>
                                        <SelectItem value="OUT">OUT</SelectItem>
                                        <SelectItem value="COMPLETE">COMPLETE</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.status && (
                                    <p className="text-xs text-red-500 mt-1">{errors.status}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Shipping Information */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700">Shipping Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="booking">Booking Number</Label>
                                <Input
                                    id="booking"
                                    value={formData.booking}
                                    onChange={(e) => handleChange('booking', e.target.value)}
                                    placeholder="Booking number"
                                />
                            </div>

                            <div>
                                <Label htmlFor="shipper">Shipper</Label>
                                <Input
                                    id="shipper"
                                    value={formData.shipper}
                                    onChange={(e) => handleChange('shipper', e.target.value)}
                                    placeholder="Shipper name"
                                />
                            </div>

                            <div>
                                <Label htmlFor="vessel">Vessel</Label>
                                <Input
                                    id="vessel"
                                    value={formData.vessel}
                                    onChange={(e) => handleChange('vessel', e.target.value)}
                                    placeholder="Vessel name"
                                />
                            </div>

                            <div>
                                <Label htmlFor="voyage">Voyage</Label>
                                <Input
                                    id="voyage"
                                    value={formData.voyage}
                                    onChange={(e) => handleChange('voyage', e.target.value)}
                                    placeholder="Voyage number"
                                />
                            </div>

                            <div>
                                <Label htmlFor="slot">Slot Location</Label>
                                <Input
                                    id="slot"
                                    value={formData.slot}
                                    onChange={(e) => handleChange('slot', e.target.value)}
                                    placeholder="e.g., A-12-34"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Dates & Times */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700">Dates & Times</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="date_in">
                                    Gate In Date <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="date_in"
                                    type="date"
                                    value={formData.date_in}
                                    onChange={(e) => handleChange('date_in', e.target.value)}
                                    className={errors.date_in ? 'border-red-500' : ''}
                                />
                                {errors.date_in && (
                                    <p className="text-xs text-red-500 mt-1">{errors.date_in}</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="time_in">
                                    Gate In Time <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="time_in"
                                    type="time"
                                    value={formData.time_in}
                                    onChange={(e) => handleChange('time_in', e.target.value)}
                                    className={errors.time_in ? 'border-red-500' : ''}
                                />
                                {errors.time_in && (
                                    <p className="text-xs text-red-500 mt-1">{errors.time_in}</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="date_out">Gate Out Date</Label>
                                <Input
                                    id="date_out"
                                    type="date"
                                    value={formData.date_out}
                                    onChange={(e) => handleChange('date_out', e.target.value)}
                                    className={errors.date_out ? 'border-red-500' : ''}
                                    disabled={formData.hold}
                                />
                                {errors.date_out && (
                                    <p className="text-xs text-red-500 mt-1">{errors.date_out}</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="time_out">Gate Out Time</Label>
                                <Input
                                    id="time_out"
                                    type="time"
                                    value={formData.time_out}
                                    onChange={(e) => handleChange('time_out', e.target.value)}
                                    disabled={formData.hold}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Hold & Remarks */}
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="hold"
                                checked={formData.hold}
                                onCheckedChange={(checked) => handleChange('hold', checked)}
                            />
                            <Label htmlFor="hold" className="text-sm font-medium cursor-pointer">
                                Put container on hold
                            </Label>
                        </div>
                        {formData.hold && (
                            <div className="flex items-start space-x-2 p-3 bg-amber-50 border border-amber-200 rounded">
                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                                <p className="text-xs text-amber-800">
                                    Container on hold cannot be gated out. Gate out date and time will be disabled.
                                </p>
                            </div>
                        )}
                        {errors.hold && (
                            <p className="text-xs text-red-500">{errors.hold}</p>
                        )}

                        <div>
                            <Label htmlFor="remarks">Remarks</Label>
                            <Textarea
                                id="remarks"
                                value={formData.remarks}
                                onChange={(e) => handleChange('remarks', e.target.value)}
                                placeholder="Additional notes or remarks..."
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loading ? 'Updating...' : 'Update Container'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

import React, { useState, useEffect } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, X } from 'lucide-react';
import { router } from '@inertiajs/react';
import { toast } from 'sonner';

interface ProcessGateOutModalProps {
    open: boolean;
    onClose: () => void;
    record: {
        p_id: number;
        container_no?: string;
        client_id?: number;
        client_name?: string;
        plate_no: string;
        hauler: string;
        remarks?: string;
        iso_code?: string;
        checker_id?: string;
        gate_in_remarks?: string;
        approval_notes?: string;
    } | null;
    statusOptions: Array<{ s_id: number; status: string }>;
    sizeTypeOptions: Array<{ s_id: number; size: string; type: string }>;
    loadOptions: Array<{ l_id: number; type: string }>;
}

export default function ProcessGateOutModal({
    open,
    onClose,
    record,
    statusOptions,
    sizeTypeOptions,
    loadOptions,
}: ProcessGateOutModalProps) {
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [processing, setProcessing] = useState(false);
    
    const [formData, setFormData] = useState({
        container_no: '',
        client_name: '',
        status: '',
        sizetype: '',
        iso_code: '',
        vessel: '',
        voyage: '',
        hauler: '',
        hauler_driver: '',
        license_no: '',
        checker: '',
        location: '',
        plate_no: '',
        load: '',
        chasis: '',
        booking: '',
        shipper: '',
        seal_no: '',
        contact_no: '',
        gate_in_remarks: '',
        approval_notes: '',
        remarks: '',
        save_and_book: 'NO',
    });

    useEffect(() => {
        if (record && open) {
            setFormData({
                container_no: record.container_no || '',
                client_name: record.client_name || '',
                status: '',
                sizetype: '',
                iso_code: record.iso_code || '',
                vessel: '',
                voyage: '',
                hauler: record.hauler || '',
                hauler_driver: '',
                license_no: '',
                checker: record.checker_id || '',
                location: '',
                plate_no: record.plate_no || '',
                load: '',
                chasis: '',
                booking: '',
                shipper: '',
                seal_no: '',
                contact_no: '',
                gate_in_remarks: record.gate_in_remarks || '',
                approval_notes: record.approval_notes || '',
                remarks: record.remarks || '',
                save_and_book: 'NO',
            });
        }
    }, [record, open]);

    const validateForm = () => {
        if (!formData.container_no.trim()) {
            toast.error('Container number is required!');
            return false;
        }

        if (formData.container_no.length !== 11) {
            toast.error('Container number must be exactly 11 characters!');
            return false;
        }

        if (!formData.checker.trim()) {
            toast.error('Checker is required!');
            return false;
        }

        if (!formData.contact_no.trim()) {
            toast.error('Contact number is required!');
            return false;
        }

        return true;
    };

    const handleSubmit = () => {
        if (!validateForm()) return;
        setShowConfirmation(true);
    };

    const handleConfirm = () => {
        setProcessing(true);

        router.post(
            '/api/gateinout/process-out',
            {
                procid: record?.p_id,
                ...formData,
            },
            {
                onSuccess: () => {
                    toast.success('Gate Out processed successfully!');
                    setShowConfirmation(false);
                    onClose();
                },
                onError: (errors) => {
                    toast.error(errors.message || 'Failed to process Gate Out');
                },
                onFinish: () => {
                    setProcessing(false);
                },
            }
        );
    };

    const handleChange = (field: string, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    if (!record) return null;

    return (
        <>
            <Dialog open={open && !showConfirmation} onOpenChange={onClose}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-blue-600" />
                            Add Gate Out
                        </DialogTitle>
                        <DialogDescription>
                            Process gate out for truck {record.plate_no}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Column 1 */}
                        <div className="space-y-3">
                            <div>
                                <Label>Container No.</Label>
                                <Input
                                    value={formData.container_no}
                                    onChange={(e) => handleChange('container_no', e.target.value)}
                                    placeholder="Enter container number"
                                    maxLength={11}
                                />
                            </div>

                            <div>
                                <Label>Client</Label>
                                <Input
                                    value={formData.client_name}
                                    disabled
                                    className="bg-gray-100"
                                />
                            </div>

                            <div>
                                <Label>Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) => handleChange('status', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {statusOptions.map((option) => (
                                            <SelectItem
                                                key={option.s_id}
                                                value={option.s_id.toString()}
                                            >
                                                {option.status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Size/Type</Label>
                                <Select
                                    value={formData.sizetype}
                                    onValueChange={(value) => handleChange('sizetype', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select size/type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sizeTypeOptions.map((option) => (
                                            <SelectItem
                                                key={option.s_id}
                                                value={option.s_id.toString()}
                                            >
                                                {option.size} - {option.type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>ISO Code</Label>
                                <Input
                                    value={formData.iso_code}
                                    onChange={(e) => handleChange('iso_code', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>Vessel <span className="text-red-500">*</span></Label>
                                <Input
                                    value={formData.vessel}
                                    onChange={(e) => handleChange('vessel', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>Voyage <span className="text-red-500">*</span></Label>
                                <Input
                                    value={formData.voyage}
                                    onChange={(e) => handleChange('voyage', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>Hauler <span className="text-red-500">*</span></Label>
                                <Input
                                    value={formData.hauler}
                                    onChange={(e) => handleChange('hauler', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>
                                    Hauler Driver <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.hauler_driver}
                                    onChange={(e) =>
                                        handleChange('hauler_driver', e.target.value)
                                    }
                                />
                            </div>

                            <div>
                                <Label>
                                    License No. <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.license_no}
                                    onChange={(e) => handleChange('license_no', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>
                                    Checker <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.checker}
                                    onChange={(e) => handleChange('checker', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-3">
                            <div>
                                <Label>
                                    Location <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.location}
                                    onChange={(e) => handleChange('location', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>
                                    Plate No. <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.plate_no}
                                    onChange={(e) => handleChange('plate_no', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>Load</Label>
                                <Select
                                    value={formData.load}
                                    onValueChange={(value) => handleChange('load', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select load type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {loadOptions.map((option) => (
                                            <SelectItem
                                                key={option.l_id}
                                                value={option.l_id.toString()}
                                            >
                                                {option.type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>
                                    Chasis <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.chasis}
                                    onChange={(e) => handleChange('chasis', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>
                                    Booking <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.booking}
                                    onChange={(e) => handleChange('booking', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>
                                    Shipper <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.shipper}
                                    onChange={(e) => handleChange('shipper', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>
                                    Seal No. <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.seal_no}
                                    onChange={(e) => handleChange('seal_no', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>
                                    Contact No. <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.contact_no}
                                    onChange={(e) => handleChange('contact_no', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>Gate In Remarks</Label>
                                <Textarea
                                    value={formData.gate_in_remarks}
                                    disabled
                                    rows={2}
                                    className="resize-none bg-gray-100"
                                />
                            </div>

                            <div>
                                <Label>Approval Notes</Label>
                                <Textarea
                                    value={formData.approval_notes}
                                    disabled
                                    rows={2}
                                    className="resize-none bg-gray-100"
                                />
                            </div>

                            <div>
                                <Label>
                                    Remarks <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    value={formData.remarks}
                                    onChange={(e) => handleChange('remarks', e.target.value)}
                                    rows={3}
                                    className="resize-none"
                                />
                            </div>

                            <div>
                                <Label>Save and Book</Label>
                                <Select
                                    value={formData.save_and_book}
                                    onValueChange={(value) =>
                                        handleChange('save_and_book', value)
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NO">NO</SelectItem>
                                        <SelectItem value="YES">YES</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>
                            <X className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                        <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Save & Print
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmation Modal */}
            <Dialog open={showConfirmation} onOpenChange={() => setShowConfirmation(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Gate Out Processing</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to process this gate out for container{' '}
                            <strong>{formData.container_no}</strong>?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowConfirmation(false)}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={processing}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {processing ? 'Processing...' : 'Confirm'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

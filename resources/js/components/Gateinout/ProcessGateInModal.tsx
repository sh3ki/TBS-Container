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

interface ProcessGateInModalProps {
    open: boolean;
    onClose: () => void;
    record: {
        p_id: number;
        container_no: string;
        client_id: number;
        client_name: string;
        remarks?: string;
        iso_code?: string;
        date_mnfg?: string;
        size_type?: number;
        cnt_class?: string;
        cnt_status?: string;
        checker_id?: string;
    } | null;
    statusOptions: Array<{ s_id: number; status: string }>;
    sizeTypeOptions: Array<{ s_id: number; size: string; type: string }>;
    loadOptions: Array<{ l_id: number; type: string }>;
}

export default function ProcessGateInModal({
    open,
    onClose,
    record,
    statusOptions,
    sizeTypeOptions,
    loadOptions,
}: ProcessGateInModalProps) {
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [processing, setProcessing] = useState(false);
    
    const [formData, setFormData] = useState({
        container_no: '',
        client_id: '',
        date_manufactured: '',
        status: '',
        sizetype: '',
        iso_code: '',
        class: 'A',
        vessel: '',
        voyage: '',
        checker: '',
        ex_consignee: '',
        load: '',
        plate_no: '',
        hauler: '',
        hauler_driver: '',
        license_no: '',
        location: '',
        chasis: '',
        contact_no: '',
        bill_of_lading: '',
        remarks: '',
    });

    useEffect(() => {
        if (record && open) {
            setFormData({
                container_no: record.container_no || '',
                client_id: record.client_id?.toString() || '',
                date_manufactured: record.date_mnfg || '',
                status: record.cnt_status || '',
                sizetype: record.size_type?.toString() || '',
                iso_code: record.iso_code || '',
                class: record.cnt_class || 'A',
                vessel: '',
                voyage: '',
                checker: record.checker_id || '',
                ex_consignee: '',
                load: '',
                plate_no: '',
                hauler: '',
                hauler_driver: '',
                license_no: '',
                location: '',
                chasis: '',
                contact_no: '',
                bill_of_lading: '',
                remarks: record.remarks || '',
            });
        }
    }, [record, open]);

    const validateForm = () => {
        const requiredFields = [
            { field: 'date_manufactured', label: 'Date Manufactured' },
            { field: 'iso_code', label: 'ISO Code' },
            { field: 'class', label: 'Class' },
            { field: 'vessel', label: 'Vessel' },
            { field: 'voyage', label: 'Voyage' },
            { field: 'checker', label: 'Checker' },
            { field: 'ex_consignee', label: 'Ex-Consignee' },
            { field: 'plate_no', label: 'Plate No.' },
            { field: 'hauler', label: 'Hauler' },
            { field: 'hauler_driver', label: 'Hauler Driver' },
            { field: 'license_no', label: 'License No.' },
            { field: 'location', label: 'Location' },
            { field: 'chasis', label: 'Chasis' },
            { field: 'contact_no', label: 'Contact No.' },
            { field: 'bill_of_lading', label: 'Bill of Lading' },
            { field: 'remarks', label: 'Remarks' },
        ];

        for (const { field, label } of requiredFields) {
            if (!formData[field as keyof typeof formData]?.trim()) {
                toast.error(`${label} is required!`);
                return false;
            }
        }

        if (formData.container_no.length !== 11) {
            toast.error('Container number must be exactly 11 characters!');
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
            '/api/gateinout/process-in',
            {
                procid: record?.p_id,
                ...formData,
            },
            {
                onSuccess: () => {
                    toast.success('Gate In processed successfully!');
                    setShowConfirmation(false);
                    onClose();
                },
                onError: (errors) => {
                    toast.error(errors.message || 'Failed to process Gate In');
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
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            Add Gate In
                        </DialogTitle>
                        <DialogDescription>
                            Process gate in for container {record.container_no}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Column 1 */}
                        <div className="space-y-3">
                            <div>
                                <Label>Container No.</Label>
                                <Input
                                    value={formData.container_no}
                                    disabled
                                    className="bg-gray-100"
                                />
                            </div>

                            <div>
                                <Label>
                                    Date Manufactured <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="month"
                                    value={formData.date_manufactured}
                                    onChange={(e) =>
                                        handleChange('date_manufactured', e.target.value)
                                    }
                                    placeholder="mm/yyyy"
                                />
                            </div>

                            <div>
                                <Label>
                                    Client <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={record.client_name}
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
                                <Label>
                                    ISO Code <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.iso_code}
                                    onChange={(e) => handleChange('iso_code', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>
                                    Class <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.class}
                                    onValueChange={(value) => handleChange('class', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="A">A</SelectItem>
                                        <SelectItem value="B">B</SelectItem>
                                        <SelectItem value="C">C</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>
                                    Vessel <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.vessel}
                                    onChange={(e) => handleChange('vessel', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>
                                    Voyage <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.voyage}
                                    onChange={(e) => handleChange('voyage', e.target.value)}
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
                                    Ex-Consignee <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.ex_consignee}
                                    onChange={(e) => handleChange('ex_consignee', e.target.value)}
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
                                    Plate No. <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.plate_no}
                                    onChange={(e) => handleChange('plate_no', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>
                                    Hauler <span className="text-red-500">*</span>
                                </Label>
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
                                    Location <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.location}
                                    onChange={(e) => handleChange('location', e.target.value)}
                                />
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
                                    Contact No. <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.contact_no}
                                    onChange={(e) => handleChange('contact_no', e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>
                                    Bill of Lading <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    value={formData.bill_of_lading}
                                    onChange={(e) =>
                                        handleChange('bill_of_lading', e.target.value)
                                    }
                                />
                            </div>

                            <div>
                                <Label>
                                    Remarks <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    value={formData.remarks}
                                    onChange={(e) => handleChange('remarks', e.target.value)}
                                    rows={5}
                                    className="resize-none"
                                />
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
                        <DialogTitle>Confirm Gate In Processing</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to process this gate in for container{' '}
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

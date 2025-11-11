import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import { ModernButton, ModernConfirmDialog } from '@/components/modern';
import { CheckCircle } from 'lucide-react';
import axios from 'axios';
import { colors } from '@/lib/colors';

interface ProcessGateOutModalProps {
    open: boolean;
    onClose: () => void;
    record: {
        p_id: number;
        container_no: string;
        client_id: number;
        client_name: string;
        plate_no?: string;
        hauler?: string;
    } | null;
    statusOptions: Array<{ s_id: number; status: string }>;
    sizeTypeOptions: Array<{ s_id: number; size: string; type: string }>;
    loadOptions: Array<{ l_id: number; type: string }>;
    onSuccess: () => void;
}

export default function ProcessGateOutModal({
    open,
    onClose,
    record,
    statusOptions,
    sizeTypeOptions,
    loadOptions,
    onSuccess,
}: ProcessGateOutModalProps) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [formData, setFormData] = useState({
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
        pulling_date: '',
        picking_date: '',
        return_date: '',
        gate_out_remarks: '',
        gate_in_remarks: '',
    });

    useEffect(() => {
        if (record && open) {
            setFormData(prev => ({
                ...prev,
                plate_no: record.plate_no || '',
                hauler: record.hauler || '',
            }));
        }
    }, [record, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation
        if (!record) return;
        
        if (record.container_no.length !== 11) {
            alert('Container number must be exactly 11 characters');
            return;
        }
        
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        if (!record) return;
        
        try {
            const response = await axios.post('/api/gateinout/process-out', {
                p_id: record.p_id,
                container_no: record.container_no,
                client_id: record.client_id,
                date_mnfg: formData.date_manufactured,
                cnt_status: parseInt(formData.status),
                size_type: parseInt(formData.sizetype),
                iso_code: formData.iso_code,
                cnt_class: formData.class,
                vessel: formData.vessel,
                voyage: formData.voyage,
                checker_id: formData.checker,
                ex_consignee: formData.ex_consignee,
                load_type: parseInt(formData.load),
                plate_no: formData.plate_no,
                hauler: formData.hauler,
                hauler_driver: formData.hauler_driver,
                license_no: formData.license_no,
                location: formData.location,
                chasis: formData.chasis,
                contact_no: formData.contact_no,
                bol: formData.bill_of_lading,
                pulling_date: formData.pulling_date,
                picking_date: formData.picking_date,
                return_date: formData.return_date,
                gate_out_remarks: formData.gate_out_remarks,
                gate_in_remarks: formData.gate_in_remarks,
            });

            if (response.data.success) {
                // 🖨️ AUTO-PRINT: Open print window (EXACT LEGACY BEHAVIOR)
                const inventoryId = response.data.inventory_id;
                const printUrl = `/api/gateinout/print-gate-pass/${inventoryId}`;
                window.open(printUrl, '_blank', 'width=1280,height=800');
                
                onSuccess();
                onClose();
                setShowConfirm(false);
            }
        } catch (error: unknown) {
            const axiosError = error as { response?: { data?: { message?: string } } };
            alert(axiosError.response?.data?.message || 'Failed to process Gate OUT');
            setShowConfirm(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
                            Process Gate OUT
                        </DialogTitle>
                        <DialogDescription>
                            Complete all required fields to process gate-out for {record?.container_no}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-2 gap-4 py-4">
                            {/* Left Column */}
                            <div className="space-y-3">
                                <div>
                                    <Label>Container No.</Label>
                                    <Input value={record?.container_no || ''} disabled className="bg-gray-100" />
                                </div>
                                <div>
                                    <Label>Client</Label>
                                    <Input value={record?.client_name || ''} disabled className="bg-gray-100" />
                                </div>
                                <div>
                                    <Label>Date Manufactured <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="month"
                                        value={formData.date_manufactured}
                                        onChange={(e) => setFormData({ ...formData, date_manufactured: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Status <span className="text-red-500">*</span></Label>
                                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })} required>
                                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                        <SelectContent>
                                            {statusOptions.map((opt) => (
                                                <SelectItem key={opt.s_id} value={opt.s_id.toString()}>{opt.status}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Size/Type <span className="text-red-500">*</span></Label>
                                    <Select value={formData.sizetype} onValueChange={(value) => setFormData({ ...formData, sizetype: value })} required>
                                        <SelectTrigger><SelectValue placeholder="Select size/type" /></SelectTrigger>
                                        <SelectContent>
                                            {sizeTypeOptions.map((opt) => (
                                                <SelectItem key={opt.s_id} value={opt.s_id.toString()}>{opt.size} {opt.type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>ISO Code <span className="text-red-500">*</span></Label>
                                    <Input value={formData.iso_code} onChange={(e) => setFormData({ ...formData, iso_code: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Class <span className="text-red-500">*</span></Label>
                                    <Select value={formData.class} onValueChange={(value) => setFormData({ ...formData, class: value })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="A">A</SelectItem>
                                            <SelectItem value="B">B</SelectItem>
                                            <SelectItem value="C">C</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Vessel <span className="text-red-500">*</span></Label>
                                    <Input value={formData.vessel} onChange={(e) => setFormData({ ...formData, vessel: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Voyage <span className="text-red-500">*</span></Label>
                                    <Input value={formData.voyage} onChange={(e) => setFormData({ ...formData, voyage: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Checker <span className="text-red-500">*</span></Label>
                                    <Input value={formData.checker} onChange={(e) => setFormData({ ...formData, checker: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Ex-Consignee <span className="text-red-500">*</span></Label>
                                    <Input value={formData.ex_consignee} onChange={(e) => setFormData({ ...formData, ex_consignee: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Load <span className="text-red-500">*</span></Label>
                                    <Select value={formData.load} onValueChange={(value) => setFormData({ ...formData, load: value })} required>
                                        <SelectTrigger><SelectValue placeholder="Select load" /></SelectTrigger>
                                        <SelectContent>
                                            {loadOptions.map((opt) => (
                                                <SelectItem key={opt.l_id} value={opt.l_id.toString()}>{opt.type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-3">
                                <div>
                                    <Label>Plate No. <span className="text-red-500">*</span></Label>
                                    <Input value={formData.plate_no} onChange={(e) => setFormData({ ...formData, plate_no: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Hauler <span className="text-red-500">*</span></Label>
                                    <Input value={formData.hauler} onChange={(e) => setFormData({ ...formData, hauler: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Hauler Driver <span className="text-red-500">*</span></Label>
                                    <Input value={formData.hauler_driver} onChange={(e) => setFormData({ ...formData, hauler_driver: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>License No. <span className="text-red-500">*</span></Label>
                                    <Input value={formData.license_no} onChange={(e) => setFormData({ ...formData, license_no: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Location <span className="text-red-500">*</span></Label>
                                    <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Chasis <span className="text-red-500">*</span></Label>
                                    <Input value={formData.chasis} onChange={(e) => setFormData({ ...formData, chasis: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Contact No. <span className="text-red-500">*</span></Label>
                                    <Input value={formData.contact_no} onChange={(e) => setFormData({ ...formData, contact_no: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Bill of Lading <span className="text-red-500">*</span></Label>
                                    <Input value={formData.bill_of_lading} onChange={(e) => setFormData({ ...formData, bill_of_lading: e.target.value })} required />
                                </div>
                                <div>
                                    <Label>Pulling Date <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={formData.pulling_date}
                                        onChange={(e) => setFormData({ ...formData, pulling_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Picking Date <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={formData.picking_date}
                                        onChange={(e) => setFormData({ ...formData, picking_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Return Date <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="date"
                                        value={formData.return_date}
                                        onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Gate OUT Remarks <span className="text-red-500">*</span></Label>
                                    <Textarea
                                        value={formData.gate_out_remarks}
                                        onChange={(e) => setFormData({ ...formData, gate_out_remarks: e.target.value })}
                                        className="min-h-[60px]"
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Gate IN Remarks</Label>
                                    <Textarea
                                        value={formData.gate_in_remarks}
                                        onChange={(e) => setFormData({ ...formData, gate_in_remarks: e.target.value })}
                                        className="min-h-[60px]"
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <ModernButton type="button" variant="toggle" onClick={onClose}>
                                Cancel
                            </ModernButton>
                            <ModernButton type="submit" variant="add">
                                <CheckCircle className="w-4 h-4" />
                                Process & Save
                            </ModernButton>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ModernConfirmDialog
                open={showConfirm}
                onOpenChange={setShowConfirm}
                onConfirm={handleConfirm}
                title="Process Gate OUT"
                description="Are you sure you want to process this Gate OUT? This will create a permanent record."
                confirmText="Confirm Process"
                type="success"
            />
        </>
    );
}

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
import { Printer, Calendar } from 'lucide-react';
import axios from 'axios';
import { colors } from '@/lib/colors';

interface ProcessGateInModalProps {
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

export default function ProcessGateInModal({
    open,
    onClose,
    record,
    statusOptions,
    sizeTypeOptions,
    loadOptions,
    onSuccess,
}: ProcessGateInModalProps) {
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
        remarks: '',
    });

    useEffect(() => {
        if (record && open) {
            // Clean plate_no and hauler: if contains "-", set as empty
            const cleanPlateNo = record.plate_no && record.plate_no.includes('-') ? '' : (record.plate_no || '');
            const cleanHauler = record.hauler && record.hauler.includes('-') ? '' : (record.hauler || '');
            
            setFormData(prev => ({
                ...prev,
                plate_no: cleanPlateNo,
                hauler: cleanHauler,
            }));
        }
    }, [record, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation: All dropdowns must have selected option, all inputs must not be null
        if (!record) return;
        
        // Validate container number length
        if (record.container_no.length !== 11) {
            alert('Container number must be exactly 11 characters');
            return;
        }
        
        // Validate all dropdowns are selected
        if (!formData.status) {
            alert('Please select a Status');
            return;
        }
        if (!formData.sizetype) {
            alert('Please select Size/Type');
            return;
        }
        if (!formData.load) {
            alert('Please select Load type');
            return;
        }
        if (!formData.class) {
            alert('Please select Class');
            return;
        }
        
        // Validate all required inputs are not empty
        const requiredFields = [
            { field: 'date_manufactured', label: 'Date Manufactured' },
            { field: 'iso_code', label: 'ISO Code' },
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
            if (!formData[field as keyof typeof formData] || formData[field as keyof typeof formData].toString().trim() === '') {
                alert(`Please fill in ${label}`);
                return;
            }
        }
        
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        if (!record) return;
        
        try {
            const response = await axios.post('/api/gateinout/process-in', {
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
                remarks: formData.remarks,
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
            alert(axiosError.response?.data?.message || 'Failed to process Gate IN');
            setShowConfirm(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="min-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold" style={{ color: colors.brand.primary }}>
                            Process Gate IN
                        </DialogTitle>
                        <DialogDescription>
                            Complete all required fields to process gate-in for {record?.container_no}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-3 gap-6 py-4">
                            {/* Column 1 */}
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
                                    <div className="relative">
                                        <Input
                                            type="date"
                                            value={formData.date_manufactured}
                                            onChange={(e) => setFormData({ ...formData, date_manufactured: e.target.value })}
                                            className="pr-10"
                                            placeholder="mm/dd/yyyy"
                                        />
                                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <Label>Status <span className="text-red-500">*</span></Label>
                                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
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
                                    <Select value={formData.sizetype} onValueChange={(value) => setFormData({ ...formData, sizetype: value })}>
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
                                    <Input value={formData.iso_code} onChange={(e) => setFormData({ ...formData, iso_code: e.target.value })} />
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
                                    <Input value={formData.vessel} onChange={(e) => setFormData({ ...formData, vessel: e.target.value })} />
                                </div>
                            </div>

                            {/* Column 2 */}
                            <div className="space-y-3">
                                <div>
                                    <Label>Voyage <span className="text-red-500">*</span></Label>
                                    <Input value={formData.voyage} onChange={(e) => setFormData({ ...formData, voyage: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Checker <span className="text-red-500">*</span></Label>
                                    <Input value={formData.checker} onChange={(e) => setFormData({ ...formData, checker: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Ex-Consignee <span className="text-red-500">*</span></Label>
                                    <Input value={formData.ex_consignee} onChange={(e) => setFormData({ ...formData, ex_consignee: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Load <span className="text-red-500">*</span></Label>
                                    <Select value={formData.load} onValueChange={(value) => setFormData({ ...formData, load: value })}>
                                        <SelectTrigger><SelectValue placeholder="Select load" /></SelectTrigger>
                                        <SelectContent>
                                            {loadOptions.map((opt) => (
                                                <SelectItem key={opt.l_id} value={opt.l_id.toString()}>{opt.type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Plate No. <span className="text-red-500">*</span></Label>
                                    <Input value={formData.plate_no} onChange={(e) => setFormData({ ...formData, plate_no: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Hauler <span className="text-red-500">*</span></Label>
                                    <Input value={formData.hauler} onChange={(e) => setFormData({ ...formData, hauler: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Hauler Driver <span className="text-red-500">*</span></Label>
                                    <Input value={formData.hauler_driver} onChange={(e) => setFormData({ ...formData, hauler_driver: e.target.value })} />
                                </div>
                                <div>
                                    <Label>License No. <span className="text-red-500">*</span></Label>
                                    <Input value={formData.license_no} onChange={(e) => setFormData({ ...formData, license_no: e.target.value })} />
                                </div>
                            </div>

                            {/* Column 3 */}
                            <div className="space-y-3">
                                <div>
                                    <Label>Location <span className="text-red-500">*</span></Label>
                                    <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Chasis <span className="text-red-500">*</span></Label>
                                    <Input value={formData.chasis} onChange={(e) => setFormData({ ...formData, chasis: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Contact No. <span className="text-red-500">*</span></Label>
                                    <Input value={formData.contact_no} onChange={(e) => setFormData({ ...formData, contact_no: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Bill of Lading <span className="text-red-500">*</span></Label>
                                    <Input value={formData.bill_of_lading} onChange={(e) => setFormData({ ...formData, bill_of_lading: e.target.value })} />
                                </div>
                                <div>
                                    <Label>Remarks <span className="text-red-500">*</span></Label>
                                    <Textarea
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                        className="min-h-[80px]"
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="gap-2">
                            <ModernButton type="button" variant="toggle" onClick={onClose}>
                                Cancel
                            </ModernButton>
                            <ModernButton type="submit" variant="add">
                                <Printer className="w-4 h-4" />
                                Save & Print
                            </ModernButton>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ModernConfirmDialog
                open={showConfirm}
                onOpenChange={setShowConfirm}
                onConfirm={handleConfirm}
                title="Process Gate IN"
                description="Are you sure you want to process this Gate IN? This will create a permanent record."
                confirmText="Confirm Process"
                type="success"
            />
        </>
    );
}

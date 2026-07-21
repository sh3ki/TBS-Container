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
import { Printer, Search } from 'lucide-react';
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

interface ContainerOption {
    i_id: number;
    container_no: string;
    client_name: string;
    client_id: number;
    size_type: string;
    sizetype_id: number;
    iso_code: string;
    location: string;
    plate_no: string;
    hauler: string;
    shipper: string;
    days_in_yard: number;
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
    const [containerOptions, setContainerOptions] = useState<ContainerOption[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isContainerSelected, setIsContainerSelected] = useState(false);
    const [checkerName, setCheckerName] = useState('');
    
    const [formData, setFormData] = useState({
        container_no: '',
        client_id: 0,
        client_name: '',
        size_type: 0,
        size_type_display: '',
        iso_code: '',
        plate_no: '',
        hauler: '',
        shipper: '',
        status: '',
        vessel: '',
        voyage: '',
        hauler_driver: '',
        license_no: '',
        checker: '',
        location: '',
        load: '', // Will be set to 'Empty' l_id once options load
        chasis: '',
        contact_no: '',
        booking: '',
        seal_no: '',
        approval_remarks: '', // Readonly remarks from inventory approval_notes
        gate_in_remarks: '', // Readonly remarks from inventory
        remarks: '', // Editable remarks for user input
        save_and_book: 'NO',
    });

    const [bookingOptions, setBookingOptions] = useState<Array<{ book_no: string }>>([]);
    const [showBookingDropdown, setShowBookingDropdown] = useState(false);
    const [bookingSearchTerm, setBookingSearchTerm] = useState('');
    const [defaultStatusId, setDefaultStatusId] = useState<string>('');
    const [defaultLoadId, setDefaultLoadId] = useState<string>('');

    // Set default status to AVL when statusOptions are loaded
    useEffect(() => {
        if (statusOptions && statusOptions.length > 0) {
            const avlStatus = statusOptions.find(s => s.status === 'AVL');
            if (avlStatus) {
                setDefaultStatusId(avlStatus.s_id.toString());
            }
        }
    }, [statusOptions]);

    // Set default load to 'Empty' when loadOptions are loaded
    useEffect(() => {
        if (loadOptions && loadOptions.length > 0) {
            const emptyLoad = loadOptions.find((l: any) => l.type === 'Empty');
            if (emptyLoad) {
                setDefaultLoadId(emptyLoad.l_id.toString());
                setFormData(prev => ({
                    ...prev,
                    load: emptyLoad.l_id.toString()
                }));
            }
        }
    }, [loadOptions]);

    // Fetch available containers on mount and when search term changes
    useEffect(() => {
        if (open && searchTerm.length >= 1) {
            fetchAvailableContainers(searchTerm);
        }
    }, [open, searchTerm]);

    // Initialize with pre-gate data and fetch container details if exists
    useEffect(() => {
        if (open) {
            // Always reset search fields first
            setSearchTerm('');
            setShowDropdown(false);
            setCheckerName('');
            setIsContainerSelected(false);

            if (record) {
                const cleanedPlateNo = record.plate_no || '';
                const cleanedHauler = record.hauler || '';
                
                // Always set plate no and hauler
                setFormData(prev => ({
                    ...prev,
                    plate_no: cleanedPlateNo,
                    hauler: cleanedHauler,
                    container_no: '',
                    client_id: 0,
                    client_name: '',
                    size_type: 0,
                    size_type_display: '',
                    iso_code: '',
                    approval_remarks: '',
                    gate_in_remarks: '',
                    status: defaultStatusId,
                    load: defaultLoadId,
                }));

                // Only fetch and populate if container_no already exists in record
                if (record.container_no && record.container_no.trim() !== '') {
                    setSearchTerm(record.container_no);
                    fetchContainerDetailsOnInit(record.container_no);
                }
            } else {
                // No record provided - reset all fields
                setFormData(prev => ({
                    ...prev,
                    plate_no: '',
                    hauler: '',
                    container_no: '',
                    client_id: 0,
                    client_name: '',
                    size_type: 0,
                    size_type_display: '',
                    iso_code: '',
                    approval_remarks: '',
                    gate_in_remarks: '',
                    status: defaultStatusId,
                    load: defaultLoadId,
                }));
            }
        }
    }, [open, record, defaultStatusId, defaultLoadId]);

    // Fetch container details when container already exists in pre_inventory
    const fetchContainerDetailsOnInit = async (containerNo: string) => {
        try {
            const response = await axios.get('/api/mobile/gateinout/container-details', {
                params: {
                    container_no: containerNo,
                    gate_status: 'OUT',
                }
            });

            if (response.data.success) {
                const data = response.data.data;
                // Look up size_type display from sizeTypeOptions using sizetype_id
                const sizeTypeObj = sizeTypeOptions.find(st => st.s_id === data.sizetype_id);
                const sizeTypeDisplay = sizeTypeObj ? `${sizeTypeObj.size}${sizeTypeObj.type}` : '';
                
                setFormData(prev => ({
                    ...prev,
                    container_no: data.container_no,
                    client_id: data.client_id,
                    client_name: data.client_name,
                    size_type: data.sizetype_id,
                    size_type_display: sizeTypeDisplay,
                    iso_code: data.iso_code || '',
                    plate_no: record?.plate_no || data.plate_no || '',
                    hauler: record?.hauler || data.hauler || '',
                    approval_remarks: data.approval_notes || '',
                    gate_in_remarks: data.remarks || '',
                    remarks: data.pre_inventory_remarks || '',
                    status: defaultStatusId,
                    load: defaultLoadId,
                }));
                
                // Set checker name if available from API
                if (data.checker_name) {
                    setCheckerName(data.checker_name);
                } else if (data.checker_id) {
                    try {
                        const checkerResponse = await axios.get(`/api/users/${data.checker_id}`);
                        if (checkerResponse.data.success) {
                            setCheckerName(checkerResponse.data.data.full_name || 'Unknown');
                        } else {
                            setCheckerName('');
                        }
                    } catch (checkerError) {
                        console.error('Failed to fetch checker name:', checkerError);
                        setCheckerName('');
                    }
                } else {
                    setCheckerName('');
                }
                
                setIsContainerSelected(true);
                setShowDropdown(false);
            }
        } catch (error) {
            console.error('Failed to fetch container details:', error);
            setCheckerName('');
        }
    };



    const fetchAvailableContainers = async (search: string) => {
        try {
            const response = await axios.get('/api/gateinout/available-containers', {
                params: { search }
            });
            if (response.data.success) {
                setContainerOptions(response.data.data);
                setShowDropdown(true);
            }
        } catch (error) {
            console.error('Failed to fetch containers:', error);
        }
    };

    const handleContainerSearch = (value: string) => {
        setSearchTerm(value);
        setFormData(prev => ({ ...prev, container_no: value }));
        
        if (value.length >= 1) {
            setShowDropdown(true);
        } else {
            setShowDropdown(false);
        }
    };

    const handleContainerSelect = async (container: ContainerOption) => {
        // Validate the container first
        try {
            const response = await axios.post('/api/gateinout/validate-container', {
                container_no: container.container_no
            });

            if (response.data.success) {
                const data = response.data.data;
                
                // Fetch additional details from inventory including approval_notes and remarks
                try {
                    const inventoryResponse = await axios.get('/api/mobile/gateinout/container-details', {
                        params: {
                            container_no: data.container_no,
                            gate_status: 'OUT',
                        }
                    });

                    if (inventoryResponse.data.success) {
                        const inventoryData = inventoryResponse.data.data;
                        // Look up size_type display from sizeTypeOptions using sizetype_id
                        const sizeTypeObj = sizeTypeOptions.find(st => st.s_id === inventoryData.sizetype_id);
                        const sizeTypeDisplay = sizeTypeObj ? `${sizeTypeObj.size}${sizeTypeObj.type}` : '';
                        
                        setFormData({
                            container_no: data.container_no,
                            client_id: data.client_id,
                            client_name: data.client_name,
                            size_type: inventoryData.sizetype_id,
                            size_type_display: sizeTypeDisplay,
                            iso_code: data.iso_code || '',
                            plate_no: record?.plate_no || data.plate_no || '',
                            hauler: record?.hauler || data.hauler || '',
                            shipper: '', // Will be filled from booking selection
                            // All editable fields empty - user must fill them (old system behavior)
                            status: defaultStatusId, // Default to AVL status
                            vessel: '',
                            voyage: '',
                            hauler_driver: '',
                            license_no: '',
                            checker: '',
                            location: '',
                            load: defaultLoadId, // Load defaults to 'Empty' l_id
                            chasis: '',
                            contact_no: '',
                            booking: '',
                            seal_no: '',
                            approval_remarks: inventoryData.approval_notes || '', // From inventory
                            gate_in_remarks: inventoryData.remarks || '', // From inventory
                            remarks: inventoryData.pre_inventory_remarks || '', // From pre_inventory
                            save_and_book: 'NO',
                        });
                        
                        // Set checker name if available from API
                        if (inventoryData.checker_name) {
                            setCheckerName(inventoryData.checker_name);
                        } else if (inventoryData.checker_id) {
                            try {
                                const checkerResponse = await axios.get(`/api/users/${inventoryData.checker_id}`);
                                if (checkerResponse.data.success) {
                                    setCheckerName(checkerResponse.data.data.full_name || 'Unknown');
                                } else {
                                    setCheckerName('');
                                }
                            } catch (checkerError) {
                                console.error('Failed to fetch checker name:', checkerError);
                                setCheckerName('');
                            }
                        } else {
                            setCheckerName('');
                        }
                    }
                } catch (inventoryError) {
                    console.error('Failed to fetch inventory details:', inventoryError);
                    // Fall back to basic data if inventory fetch fails
                    setFormData({
                        container_no: data.container_no,
                        client_id: data.client_id,
                        client_name: data.client_name,
                        size_type: data.sizetype_id,
                        size_type_display: data.size_type_display || `${container.size_type}`,
                        iso_code: data.iso_code || '',
                        plate_no: record?.plate_no || data.plate_no || '',
                        hauler: record?.hauler || data.hauler || '',
                        shipper: '',
                        status: defaultStatusId,
                        vessel: '',
                        voyage: '',
                        hauler_driver: '',
                        license_no: '',
                        checker: '',
                        location: '',
                        load: defaultLoadId,
                        chasis: '',
                        contact_no: '',
                        booking: '',
                        seal_no: '',
                        approval_remarks: '',
                        gate_in_remarks: '',
                        remarks: '',
                        save_and_book: 'NO',
                    });
                    setCheckerName('');
                }
                
                setShowDropdown(false);
                setSearchTerm(container.container_no);
                setIsContainerSelected(true); // Enable other fields
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string; hold_notes?: string } } };
            if (err.response?.data?.message) {
                alert(err.response.data.message);
                if (err.response.data.hold_notes) {
                    alert(`HOLD NOTES: ${err.response.data.hold_notes}`);
                }
            }
        }
    };

    const handleInputChange = (field: string, value: string | number) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // Fetch bookings list for autocomplete
    const fetchBookingsList = async (search: string) => {
        if (!isContainerSelected || !formData.client_id) {
            return;
        }
        
        try {
            const response = await axios.post('/api/gateinout/get-bookings-list', {
                key: search,
                client_id: formData.client_id,
            });
            
            if (response.data.success) {
                setBookingOptions(response.data.bookings || []);
                if ((response.data.bookings || []).length > 0) {
                    setShowBookingDropdown(true);
                }
            }
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
            alert('Error fetching bookings: ' + (error as any).response?.data?.message || 'Unknown error');
        }
    };

    // Fetch shipper when booking is selected
    const handleBookingSelect = async (bookingNo: string) => {
        try {
            const response = await axios.post('/api/gateinout/get-shipper', {
                booking_no: bookingNo,
                container_no: formData.container_no,
                client_id: formData.client_id,
            });
            
            if (response.data.success) {
                setFormData((prev) => ({
                    ...prev,
                    booking: bookingNo,
                    shipper: response.data.shipper || '',
                }));
                setShowBookingDropdown(false);
                setBookingSearchTerm(bookingNo);
            } else {
                alert(response.data.message || 'Booking not found or client mismatch');
            }
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to get shipper');
        }
    };

    const handleConfirm = async () => {
        // Validation
        if (!formData.container_no || formData.container_no.trim() === '') {
            alert('Please enter Container Number');
            return;
        }
        if (formData.container_no.length !== 11) {
            alert('Container Number must be exactly 11 characters');
            return;
        }
        if (!formData.status || formData.status === '') {
            alert('Please select Status');
            return;
        }
        if (!formData.vessel || formData.vessel.trim() === '') {
            alert('Please enter Vessel');
            return;
        }
        if (!formData.voyage || formData.voyage.trim() === '') {
            alert('Please enter Voyage');
            return;
        }
        if (!formData.hauler_driver || formData.hauler_driver.trim() === '') {
            alert('Please enter Hauler Driver');
            return;
        }
        if (!formData.license_no || formData.license_no.trim() === '') {
            alert('Please enter License Number');
            return;
        }
        if (!checkerName || checkerName.trim() === '') {
            alert('Checker information not available');
            return;
        }
        if (!formData.location || formData.location.trim() === '') {
            alert('Please enter Location');
            return;
        }
        if (!formData.load || formData.load === '') {
            alert('Please select Load type');
            return;
        }
        if (!formData.chasis || formData.chasis.trim() === '') {
            alert('Please enter Chasis');
            return;
        }
        if (!formData.contact_no || formData.contact_no.trim() === '') {
            alert('Please enter Contact No.');
            return;
        }
        if (!formData.booking || formData.booking.trim() === '') {
            alert('Please enter Booking number');
            return;
        }
        if (!formData.shipper || formData.shipper.trim() === '') {
            alert('Please select a booking first');
            return;
        }
        if (!formData.seal_no || formData.seal_no.trim() === '') {
            alert('Please enter Seal No.');
            return;
        }
        if (!formData.remarks || formData.remarks.trim() === '') {
            alert('Please enter Remarks');
            return;
        }
        if (!formData.save_and_book || formData.save_and_book === '') {
            alert('Please select Save and Book option');
            return;
        }

        try {
            const response = await axios.post('/api/gateinout/process-out', {
                p_id: record?.p_id,
                container_no: formData.container_no,
                client_id: formData.client_id,
                container_status: parseInt(formData.status),
                size_type: formData.size_type,
                iso_code: formData.iso_code,
                vessel: formData.vessel,
                voyage: formData.voyage,
                plate_no: formData.plate_no,
                hauler: formData.hauler,
                hauler_driver: formData.hauler_driver,
                license_no: formData.license_no,
                checker: formData.checker,
                location: formData.location,
                load_type: parseInt(formData.load),
                chasis: formData.chasis,
                contact_no: formData.contact_no,
                shipper: formData.shipper,
                booking_no: formData.booking,
                seal_no: formData.seal_no,
                remarks: formData.remarks,
                save_and_book: formData.save_and_book,
            });

            if (response.data.success) {
                // Open print window
                window.open(
                    `/api/gateinout/print-gate-pass/${response.data.inventory_id}?status=OUT`,
                    '_blank',
                    'width=1280,height=800'
                );

                // Handle Save and Book - Open external CSP portal like old system
                if (formData.save_and_book === 'YES') {
                    window.open(
                        `http://cdap.ph/csp/acyop-booking/admin/fjp/PreCNTBooking.csp?a=FJP||${formData.plate_no}||${formData.container_no}`,
                        '_blank'
                    );
                }
                
                onSuccess();
                onClose();
            }
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to process Gate OUT');
        }
    };

    if (!record) return null;

    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="min-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Process Gate OUT</DialogTitle>
                        <DialogDescription>
                            Process container gate out for Plate No: {record.plate_no || 'N/A'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-3 gap-6">
                        {/* COLUMN 1: Container Search + Auto-filled Non-Editable */}
                        <div className="space-y-4">
                            {/* Container Number with Autocomplete */}
                            <div className="relative">
                                <Label>Container Number *</Label>
                                <div className="relative">
                                    <Input
                                        value={searchTerm}
                                        onChange={(e) => handleContainerSearch(e.target.value)}
                                        placeholder="Type to search..."
                                        maxLength={11}
                                        className="pr-10"
                                    />
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                </div>
                                
                                {/* Dropdown - styled exactly like Select dropdown */}
                                {showDropdown && containerOptions.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white text-gray-900 border border-gray-200 rounded-md shadow-md max-h-96 overflow-hidden">
                                        <div
                                            className="p-1 max-h-[200px] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-400"
                                            style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6' }}
                                        >
                                            {containerOptions.map((container) => (
                                                <div
                                                    key={container.i_id}
                                                    onClick={() => handleContainerSelect(container)}
                                                    className="relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none hover:bg-blue-50 hover:text-gray-900 text-gray-900"
                                                >
                                                    {container.container_no}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Non-Editable Auto-filled Fields */}
                            <div>
                                <Label>Client</Label>
                                <Input value={formData.client_name} disabled className="bg-gray-50" />
                            </div>

                            <div>
                                <Label>Size Type</Label>
                                <Input value={formData.size_type_display} disabled className="bg-gray-50" />
                            </div>

                            <div>
                                <Label>ISO Code</Label>
                                <Input value={formData.iso_code} disabled className="bg-gray-50" />
                            </div>

                            <div>
                                <Label>Plate No.</Label>
                                <Input value={formData.plate_no} disabled className="bg-gray-50" />
                            </div>

                            <div>
                                <Label>Hauler</Label>
                                <Input
                                    value={formData.hauler}
                                    onChange={(e) => handleInputChange('hauler', e.target.value)}
                                />
                            </div>
                            
                            <div>
                                <Label>Status *</Label>
                                <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)} disabled={!isContainerSelected}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {statusOptions.map((status) => (
                                            <SelectItem key={status.s_id} value={status.s_id.toString()}>
                                                {status.status}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Checker</Label>
                                <Input
                                    value={checkerName}
                                    disabled
                                    className="bg-gray-100 cursor-not-allowed"
                                    placeholder="Auto-populated from system"
                                />
                            </div>
                        </div>

                        {/* COLUMN 2: Editable Fields 1 */}
                        <div className="space-y-4">

                            <div>
                                <Label>Vessel *</Label>
                                <Input
                                    value={formData.vessel}
                                    onChange={(e) => handleInputChange('vessel', e.target.value)}
                                    disabled={!isContainerSelected}
                                />
                            </div>

                            <div>
                                <Label>Voyage *</Label>
                                <Input
                                    value={formData.voyage}
                                    onChange={(e) => handleInputChange('voyage', e.target.value)}
                                    disabled={!isContainerSelected}
                                />
                            </div>

                            <div>
                                <Label>Hauler Driver *</Label>
                                <Input
                                    value={formData.hauler_driver}
                                    onChange={(e) => handleInputChange('hauler_driver', e.target.value)}
                                    disabled={!isContainerSelected}
                                />
                            </div>

                            <div>
                                <Label>License Number *</Label>
                                <Input
                                    value={formData.license_no}
                                    onChange={(e) => handleInputChange('license_no', e.target.value)}
                                    disabled={!isContainerSelected}
                                />
                            </div>

                            <div>
                                <Label>Location *</Label>
                                <Input
                                    value={formData.location}
                                    onChange={(e) => handleInputChange('location', e.target.value)}
                                    disabled={!isContainerSelected}
                                />
                            </div>
                            
                            <div>
                                <Label>Load *</Label>
                                <Select value={formData.load} onValueChange={(value) => handleInputChange('load', value)} disabled={!isContainerSelected}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select load" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {loadOptions.map((load) => (
                                            <SelectItem key={load.l_id} value={load.l_id.toString()}>
                                                {load.type}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Chasis *</Label>
                                <Input
                                    value={formData.chasis}
                                    onChange={(e) => handleInputChange('chasis', e.target.value)}
                                    disabled={!isContainerSelected}
                                />
                            </div>
                            
                            <div>
                                <Label>Save and Book *</Label>
                                <Select value={formData.save_and_book} onValueChange={(value) => handleInputChange('save_and_book', value)} disabled={!isContainerSelected}>
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

                        {/* COLUMN 3: Editable Fields 2 + New Inputs */}
                        <div className="space-y-4">


                            <div>
                                <Label>Contact No. *</Label>
                                <Input
                                    value={formData.contact_no}
                                    onChange={(e) => handleInputChange('contact_no', e.target.value)}
                                    disabled={!isContainerSelected}
                                />
                            </div>

                            <div>
                                <Label>Booking *</Label>
                                <div className="relative">
                                    <Input
                                        value={bookingSearchTerm}
                                        onChange={(e) => {
                                            setBookingSearchTerm(e.target.value);
                                            if (e.target.value.length >= 1) {
                                                fetchBookingsList(e.target.value);
                                            } else {
                                                setShowBookingDropdown(false);
                                            }
                                        }}
                                        onFocus={() => {
                                            if (bookingOptions.length > 0 && bookingSearchTerm.length > 0) {
                                                setShowBookingDropdown(true);
                                            }
                                        }}
                                        placeholder="Search booking..."
                                        disabled={!isContainerSelected}
                                        autoComplete="off"
                                    />
                                    
                                    {/* Booking Dropdown - Shows matching bookings for same client */}
                                    {showBookingDropdown && bookingOptions.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white text-gray-900 border border-gray-200 rounded-md shadow-md max-h-48 overflow-hidden">
                                            <div
                                                className="p-1 max-h-[150px] overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-400"
                                                style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6' }}
                                            >
                                                {bookingOptions.map((booking, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => handleBookingSelect(booking.book_no)}
                                                        className="relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none hover:bg-blue-50 hover:text-gray-900 text-gray-900"
                                                    >
                                                        {booking.book_no}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <Label>Shipper *</Label>
                                <Input value={formData.shipper} disabled className="bg-gray-50" />
                            </div>

                            <div>
                                <Label>Seal No. *</Label>
                                <Input
                                    value={formData.seal_no}
                                    onChange={(e) => handleInputChange('seal_no', e.target.value)}
                                    disabled={!isContainerSelected}
                                />
                            </div>

                            <div>
                                <Label>Approval Remarks</Label>
                                <Textarea
                                    value={formData.approval_remarks}
                                    disabled
                                    className="min-h-[60px] bg-gray-50"
                                />
                            </div>

                            <div>
                                <Label>Gate In Remarks</Label>
                                <Textarea
                                    value={formData.gate_in_remarks}
                                    disabled
                                    className="min-h-[60px] bg-gray-50"
                                />
                            </div>

                            <div>
                                <Label>Remarks *</Label>
                                <Textarea
                                    value={formData.remarks}
                                    onChange={(e) => handleInputChange('remarks', e.target.value)}
                                    className="min-h-[80px]"
                                    disabled={!isContainerSelected}
                                />
                            </div>

                        </div>
                    </div>

                    <DialogFooter>
                        <ModernButton type="button" variant="toggle" onClick={onClose}>
                            Cancel
                        </ModernButton>
                        <ModernButton
                            variant="add"
                            onClick={() => setShowConfirm(true)}
                        >
                            <Printer className="h-4 w-4" />
                            Save & Print
                        </ModernButton>
                    </DialogFooter>
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

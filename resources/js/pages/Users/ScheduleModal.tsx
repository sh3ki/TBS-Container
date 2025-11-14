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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface User {
    user_id: number;
    hashed_id: string;
    username: string;
    full_name: string;
}

interface Schedule {
    day: string;
    shift_start: string | null;
    shift_end: string | null;
    is_active: boolean;
    schedule_id: number | null;
}

interface ScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

export default function ScheduleModal({ isOpen, onClose, user }: ScheduleModalProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [enableForceLogout, setEnableForceLogout] = useState(false);
    const [schedules, setSchedules] = useState<Schedule[]>([
        { day: 'Monday', shift_start: '08:00', shift_end: '17:00', is_active: false, schedule_id: null },
        { day: 'Tuesday', shift_start: '08:00', shift_end: '17:00', is_active: false, schedule_id: null },
        { day: 'Wednesday', shift_start: '08:00', shift_end: '17:00', is_active: false, schedule_id: null },
        { day: 'Thursday', shift_start: '08:00', shift_end: '17:00', is_active: false, schedule_id: null },
        { day: 'Friday', shift_start: '08:00', shift_end: '17:00', is_active: false, schedule_id: null },
        { day: 'Saturday', shift_start: '08:00', shift_end: '17:00', is_active: false, schedule_id: null },
        { day: 'Sunday', shift_start: '08:00', shift_end: '17:00', is_active: false, schedule_id: null },
    ]);

    useEffect(() => {
        if (isOpen) {
            fetchSchedule();
        }
    }, [isOpen]);

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/users/${user.hashed_id}/schedule`);
            const data = await response.json();

            if (data.success) {
                setEnableForceLogout(data.user.force_logout_enabled === 1);
                setSchedules(data.schedules.map((s: any) => ({
                    day: s.day,
                    shift_start: s.shift_start || '08:00',
                    shift_end: s.shift_end || '17:00',
                    is_active: s.is_active === 1,
                    schedule_id: s.schedule_id,
                })));
            }
        } catch (error) {
            console.error('Error fetching schedule:', error);
            toast.error('Failed to fetch schedule');
        } finally {
            setLoading(false);
        }
    };

    const handleDayToggle = (day: string, checked: boolean) => {
        setSchedules(schedules.map(s =>
            s.day === day ? { ...s, is_active: checked } : s
        ));
    };

    const handleTimeChange = (day: string, field: 'shift_start' | 'shift_end', value: string) => {
        setSchedules(schedules.map(s =>
            s.day === day ? { ...s, [field]: value } : s
        ));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch(`/api/users/${user.hashed_id}/schedule`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    enable_force_logout: enableForceLogout,
                    schedules: schedules,
                }),
            });

            const data = await response.json();
            if (data.success) {
                toast.success(data.message);
                onClose();
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            console.error('Error saving schedule:', error);
            toast.error('Failed to save schedule');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Manage Work Schedule - {user.username}</DialogTitle>
                    <DialogDescription>
                        Configure work schedule and automatic logout settings for {user.full_name}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center items-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Enable Force Logout */}
                        <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <Checkbox
                                id="enable-force-logout"
                                checked={enableForceLogout}
                                onCheckedChange={(checked) => setEnableForceLogout(checked as boolean)}
                            />
                            <div className="flex-1">
                                <Label htmlFor="enable-force-logout" className="font-semibold cursor-pointer">
                                    Enable Automatic Force Logout
                                </Label>
                                <p className="text-sm text-gray-600 mt-1">
                                    User will be automatically logged out when their shift ends
                                </p>
                            </div>
                        </div>

                        {/* Schedule Grid */}
                        <div className="space-y-4">
                            <Label className="text-base font-semibold">Work Schedule</Label>
                            <div className="space-y-3">
                                {schedules.map((schedule) => (
                                    <div
                                        key={schedule.day}
                                        className="grid grid-cols-12 gap-4 items-center p-3 rounded-lg border bg-gray-50"
                                    >
                                        {/* Day Checkbox */}
                                        <div className="col-span-3 flex items-center space-x-2">
                                            <Checkbox
                                                id={`day-${schedule.day}`}
                                                checked={schedule.is_active}
                                                onCheckedChange={(checked) =>
                                                    handleDayToggle(schedule.day, checked as boolean)
                                                }
                                            />
                                            <Label
                                                htmlFor={`day-${schedule.day}`}
                                                className="font-medium cursor-pointer"
                                            >
                                                {schedule.day}
                                            </Label>
                                        </div>

                                        {/* Shift Start */}
                                        <div className="col-span-4">
                                            <Label className="text-xs text-gray-600 mb-1">Shift Start</Label>
                                            <Input
                                                type="time"
                                                value={schedule.shift_start || ''}
                                                onChange={(e) =>
                                                    handleTimeChange(schedule.day, 'shift_start', e.target.value)
                                                }
                                                disabled={!schedule.is_active}
                                                className="text-sm"
                                            />
                                        </div>

                                        {/* Shift End */}
                                        <div className="col-span-4">
                                            <Label className="text-xs text-gray-600 mb-1">Shift End</Label>
                                            <Input
                                                type="time"
                                                value={schedule.shift_end || ''}
                                                onChange={(e) =>
                                                    handleTimeChange(schedule.day, 'shift_end', e.target.value)
                                                }
                                                disabled={!schedule.is_active}
                                                className="text-sm"
                                            />
                                        </div>

                                        {/* Status Badge */}
                                        <div className="col-span-1 flex justify-end">
                                            {schedule.is_active ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    ON
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    OFF
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Help Text */}
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                            <p className="text-sm text-yellow-800">
                                <strong>Note:</strong> If force logout is enabled, the user will be automatically logged
                                out at the end of their shift. Unchecked days are considered off-days (no force logout).
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving || loading}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Schedule
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

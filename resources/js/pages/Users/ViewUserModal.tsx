import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, User, Shield, Calendar, History, Activity } from 'lucide-react';

interface User {
    user_id: number;
    hashed_id: string;
    username: string;
    full_name: string;
    email: string;
    contact: string;
    privilege_name: string;
    status: string;
    date_added: string;
}

interface ViewUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
}

export default function ViewUserModal({ isOpen, onClose, user }: ViewUserModalProps) {
    const [loading, setLoading] = useState(false);
    const [userDetails, setUserDetails] = useState<any>(null);
    const [privileges, setPrivileges] = useState<any[]>([]);
    const [schedule, setSchedule] = useState<any>(null);
    const [loginHistory, setLoginHistory] = useState<any[]>([]);
    const [activityLog, setActivityLog] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState('info');

    useEffect(() => {
        if (isOpen) {
            fetchUserDetails();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && activeTab === 'modules') {
            fetchPrivileges();
        } else if (isOpen && activeTab === 'schedule') {
            fetchSchedule();
        } else if (isOpen && activeTab === 'login-history') {
            fetchLoginHistory();
        } else if (isOpen && activeTab === 'activity') {
            fetchActivityLog();
        }
    }, [activeTab, isOpen]);

    const fetchUserDetails = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/users/${user.hashed_id}`);
            const data = await response.json();
            if (data.success) {
                setUserDetails(data.data);
            }
        } catch (error) {
            console.error('Error fetching user details:', error);
            toast.error('Failed to fetch user details');
        } finally {
            setLoading(false);
        }
    };

    const fetchPrivileges = async () => {
        try {
            const response = await fetch(`/api/users/${user.hashed_id}/privileges`);
            const data = await response.json();
            if (data.success) {
                setPrivileges(data.privileges);
            }
        } catch (error) {
            console.error('Error fetching privileges:', error);
        }
    };

    const fetchSchedule = async () => {
        try {
            const response = await fetch(`/api/users/${user.hashed_id}/schedule`);
            const data = await response.json();
            if (data.success) {
                setSchedule(data);
            }
        } catch (error) {
            console.error('Error fetching schedule:', error);
        }
    };

    const fetchLoginHistory = async () => {
        try {
            const response = await fetch(`/api/users/${user.hashed_id}/login-history`);
            const data = await response.json();
            if (data.success) {
                setLoginHistory(data.history);
            }
        } catch (error) {
            console.error('Error fetching login history:', error);
        }
    };

    const fetchActivityLog = async () => {
        try {
            const response = await fetch(`/api/users/${user.hashed_id}/activity-log`);
            const data = await response.json();
            if (data.success) {
                setActivityLog(data.activity);
            }
        } catch (error) {
            console.error('Error fetching activity log:', error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>User Details - {user.username}</DialogTitle>
                    <DialogDescription>
                        Complete information about {user.full_name}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="info" className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <span className="hidden sm:inline">User Info</span>
                            </TabsTrigger>
                            <TabsTrigger value="modules" className="flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                <span className="hidden sm:inline">Modules</span>
                            </TabsTrigger>
                            <TabsTrigger value="schedule" className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span className="hidden sm:inline">Schedule</span>
                            </TabsTrigger>
                            <TabsTrigger value="login-history" className="flex items-center gap-2">
                                <History className="w-4 h-4" />
                                <span className="hidden sm:inline">Logins</span>
                            </TabsTrigger>
                            <TabsTrigger value="activity" className="flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                <span className="hidden sm:inline">Activity</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* Tab 1: User Information */}
                        <TabsContent value="info" className="space-y-4 mt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Username</label>
                                        <p className="text-base font-semibold">{user.username}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Full Name</label>
                                        <p className="text-base">{user.full_name}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Email</label>
                                        <p className="text-base">{user.email}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Contact</label>
                                        <p className="text-base">{user.contact || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Role/Privilege</label>
                                        <p className="text-base">{user.privilege_name}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Status</label>
                                        <div>
                                            <Badge variant={user.status === 'Active' ? 'default' : 'destructive'}>
                                                {user.status}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">Date Added</label>
                                        <p className="text-base">
                                            {user.date_added ? new Date(user.date_added).toLocaleString() : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500">User ID</label>
                                        <p className="text-base font-mono text-sm">{user.user_id}</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Tab 2: Assigned Modules */}
                        <TabsContent value="modules" className="mt-4">
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Module</TableHead>
                                            <TableHead className="text-center">View</TableHead>
                                            <TableHead className="text-center">Add</TableHead>
                                            <TableHead className="text-center">Edit</TableHead>
                                            <TableHead className="text-center">Delete</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {privileges.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-gray-500">
                                                    No privileges assigned
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            privileges.map((priv) => (
                                                <TableRow key={priv.page_id}>
                                                    <TableCell className="font-medium">{priv.page_name}</TableCell>
                                                    <TableCell className="text-center">
                                                        {priv.has_access ? (
                                                            <Badge variant="default" className="bg-green-600">✓</Badge>
                                                        ) : (
                                                            <Badge variant="secondary">-</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {priv.has_access ? (
                                                            <Badge variant="default" className="bg-green-600">✓</Badge>
                                                        ) : (
                                                            <Badge variant="secondary">-</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {priv.can_edit ? (
                                                            <Badge variant="default" className="bg-green-600">✓</Badge>
                                                        ) : (
                                                            <Badge variant="secondary">-</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {priv.can_delete ? (
                                                            <Badge variant="default" className="bg-green-600">✓</Badge>
                                                        ) : (
                                                            <Badge variant="secondary">-</Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        {/* Tab 3: Work Schedule */}
                        <TabsContent value="schedule" className="mt-4">
                            {schedule ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="font-medium">
                                            Force Logout: {' '}
                                            <Badge variant={schedule.user.force_logout_enabled ? 'default' : 'secondary'}>
                                                {schedule.user.force_logout_enabled ? 'Enabled' : 'Disabled'}
                                            </Badge>
                                        </p>
                                    </div>
                                    <div className="rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Day</TableHead>
                                                    <TableHead>Shift Start</TableHead>
                                                    <TableHead>Shift End</TableHead>
                                                    <TableHead>Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {schedule.schedules.map((s: any) => (
                                                    <TableRow key={s.day}>
                                                        <TableCell className="font-medium">{s.day}</TableCell>
                                                        <TableCell>{s.shift_start || '-'}</TableCell>
                                                        <TableCell>{s.shift_end || '-'}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={s.is_active ? 'default' : 'secondary'}>
                                                                {s.is_active ? 'Active' : 'Off'}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">No schedule configured</div>
                            )}
                        </TabsContent>

                        {/* Tab 4: Login History */}
                        <TabsContent value="login-history" className="mt-4">
                            <div className="rounded-lg border max-h-96 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Login Time</TableHead>
                                            <TableHead>Logout Time</TableHead>
                                            <TableHead>IP Address</TableHead>
                                            <TableHead>Duration</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loginHistory.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-gray-500">
                                                    No login history
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            loginHistory.map((log) => (
                                                <TableRow key={log.log_id}>
                                                    <TableCell>
                                                        {log.login_time ? new Date(log.login_time).toLocaleString() : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {log.logout_time ? new Date(log.logout_time).toLocaleString() : 'Active'}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">{log.ip_address}</TableCell>
                                                    <TableCell>{log.duration || '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={
                                                                log.status === 'Success'
                                                                    ? 'default'
                                                                    : log.status === 'Forced'
                                                                    ? 'destructive'
                                                                    : 'secondary'
                                                            }
                                                        >
                                                            {log.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        {/* Tab 5: Activity Log */}
                        <TabsContent value="activity" className="mt-4">
                            <div className="rounded-lg border max-h-96 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date & Time</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Description</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activityLog.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-gray-500">
                                                    No activity log
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            activityLog.map((log) => (
                                                <TableRow key={log.audit_id}>
                                                    <TableCell className="whitespace-nowrap">
                                                        {log.date_added ? new Date(log.date_added).toLocaleString() : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{log.action}</Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-md truncate">
                                                        {log.description || '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    </Tabs>
                )}

                <div className="flex justify-end mt-4">
                    <Button onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

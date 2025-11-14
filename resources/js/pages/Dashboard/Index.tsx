import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, LogIn, LogOut, Calendar, TrendingUp, TrendingDown, BarChart3, PieChart, Activity } from 'lucide-react';
import { colors } from '@/lib/colors';

interface DashboardStats {
    preInventory: {
        totalPreIn: number;
        totalPreOut: number;
        pendingPreIn: number;
        pendingPreOut: number;
    };
    inventory: {
        total: number;
        gateIn: number;
        gateOut: number;
        repo: number;
        available: number;
        hold: number;
    };
    bookings: {
        total: number;
        active: number;
        expired: number;
        totalContainers: number;
        remainingContainers: number;
    };
    gateActivity: {
        today: { gateIn: number; gateOut: number };
        week: { gateIn: number; gateOut: number };
        month: { gateIn: number; gateOut: number };
    };
}

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats>({
        preInventory: { totalPreIn: 0, totalPreOut: 0, pendingPreIn: 0, pendingPreOut: 0 },
        inventory: { total: 0, gateIn: 0, gateOut: 0, repo: 0, available: 0, hold: 0 },
        bookings: { total: 0, active: 0, expired: 0, totalContainers: 0, remainingContainers: 0 },
        gateActivity: {
            today: { gateIn: 0, gateOut: 0 },
            week: { gateIn: 0, gateOut: 0 },
            month: { gateIn: 0, gateOut: 0 }
        }
    });
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<{
        containersByStatus: { status: string; count: number }[];
        containersByClient: { client: string; count: number }[];
        gateActivity7Days: { date: string; gateIn: number; gateOut: number }[];
        bookingTrend: { month: string; bookings: number; containers: number }[];
        preInventoryTrend: { date: string; preIn: number; preOut: number }[];
    }>({
        containersByStatus: [],
        containersByClient: [],
        gateActivity7Days: [],
        bookingTrend: [],
        preInventoryTrend: []
    });

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/api/dashboard/stats');
            if (response.data.success) {
                setStats(response.data.stats);
                setChartData(response.data.charts);
            }
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const StatCard = ({ title, value, icon, subtitle, trend, color }: {
        title: string;
        value: number | string;
        icon: React.ReactNode;
        subtitle?: string;
        trend?: { value: number; isPositive: boolean };
        color: string;
    }) => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
                </div>
                <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${color}20` }}
                >
                    <div style={{ color }}>{icon}</div>
                </div>
            </div>
            {trend && (
                <div className="flex items-center gap-1 text-sm">
                    {trend.isPositive ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <span className={trend.isPositive ? 'text-green-600' : 'text-red-600'}>
                        {Math.abs(trend.value)}%
                    </span>
                    <span className="text-gray-500">vs last period</span>
                </div>
            )}
        </div>
    );

    const SimpleBarChart = ({ data, color }: { data: { label: string; value: number }[]; color: string }) => {
        const maxValue = Math.max(...data.map(d => d.value), 1);
        return (
            <div className="space-y-3">
                {data.map((item, index) => (
                    <div key={index} className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 font-medium">{item.label}</span>
                            <span className="text-gray-900 font-semibold">{item.value}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className="h-2.5 rounded-full transition-all duration-500"
                                style={{ 
                                    width: `${(item.value / maxValue) * 100}%`,
                                    backgroundColor: color 
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const LineChart = ({ data }: { data: { date: string; gateIn: number; gateOut: number }[] }) => {
        const maxValue = Math.max(...data.flatMap(d => [d.gateIn, d.gateOut]), 1);
        
        return (
            <div className="space-y-4">
                <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.brand.primary }} />
                        <span className="text-gray-600">Gate In</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.brand.secondary }} />
                        <span className="text-gray-600">Gate Out</span>
                    </div>
                </div>
                <div className="relative h-64">
                    <div className="absolute inset-0 flex items-end justify-between gap-2">
                        {data.map((item, index) => (
                            <div key={index} className="flex-1 flex flex-col items-center gap-2 h-full">
                                <div className="flex-1 w-full flex items-end justify-center gap-1">
                                    <div 
                                        className="w-full rounded-t transition-all duration-500 hover:opacity-80"
                                        style={{ 
                                            height: `${(item.gateIn / maxValue) * 100}%`,
                                            backgroundColor: colors.brand.primary,
                                            minHeight: '4px'
                                        }}
                                        title={`Gate In: ${item.gateIn}`}
                                    />
                                    <div 
                                        className="w-full rounded-t transition-all duration-500 hover:opacity-80"
                                        style={{ 
                                            height: `${(item.gateOut / maxValue) * 100}%`,
                                            backgroundColor: colors.brand.secondary,
                                            minHeight: '4px'
                                        }}
                                        title={`Gate Out: ${item.gateOut}`}
                                    />
                                </div>
                                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                    {item.date}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <AuthenticatedLayout>
                <Head title="Dashboard" />
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: colors.brand.primary }} />
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl" style={{ backgroundColor: colors.brand.primary }}>
                            <BarChart3 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                            <p className="text-sm mt-1 text-gray-600">Container Management System Overview</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Activity className="w-4 h-4" />
                        <span>Real-time updates</span>
                    </div>
                </div>

                {/* Pre-Inventory Stats */}
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5" style={{ color: colors.brand.primary }} />
                        Pre-Inventory Overview
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Total Pre-In"
                            value={stats.preInventory.totalPreIn}
                            icon={<LogIn className="w-6 h-6" />}
                            subtitle="Containers registered for gate in"
                            color={colors.brand.primary}
                        />
                        <StatCard
                            title="Pending Pre-In"
                            value={stats.preInventory.pendingPreIn}
                            icon={<LogIn className="w-6 h-6" />}
                            subtitle="Awaiting gate in process"
                            color="#f59e0b"
                        />
                        <StatCard
                            title="Total Pre-Out"
                            value={stats.preInventory.totalPreOut}
                            icon={<LogOut className="w-6 h-6" />}
                            subtitle="Containers registered for gate out"
                            color={colors.brand.secondary}
                        />
                        <StatCard
                            title="Pending Pre-Out"
                            value={stats.preInventory.pendingPreOut}
                            icon={<LogOut className="w-6 h-6" />}
                            subtitle="Awaiting gate out process"
                            color="#ef4444"
                        />
                    </div>
                </div>

                {/* Inventory Stats */}
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5" style={{ color: colors.brand.primary }} />
                        Inventory Status
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <StatCard
                            title="Total Containers"
                            value={stats.inventory.total}
                            icon={<Package className="w-6 h-6" />}
                            color={colors.brand.primary}
                        />
                        <StatCard
                            title="Gate In"
                            value={stats.inventory.gateIn}
                            icon={<LogIn className="w-6 h-6" />}
                            color="#10b981"
                        />
                        <StatCard
                            title="Gate Out"
                            value={stats.inventory.gateOut}
                            icon={<LogOut className="w-6 h-6" />}
                            color="#8b5cf6"
                        />
                        <StatCard
                            title="Repo"
                            value={stats.inventory.repo}
                            icon={<Package className="w-6 h-6" />}
                            color="#f59e0b"
                        />
                        <StatCard
                            title="Available"
                            value={stats.inventory.available}
                            icon={<Package className="w-6 h-6" />}
                            color="#06b6d4"
                        />
                        <StatCard
                            title="On Hold"
                            value={stats.inventory.hold}
                            icon={<Package className="w-6 h-6" />}
                            color="#ef4444"
                        />
                    </div>
                </div>

                {/* Booking Stats */}
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5" style={{ color: colors.brand.primary }} />
                        Booking Statistics
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Total Bookings"
                            value={stats.bookings.total}
                            icon={<Calendar className="w-6 h-6" />}
                            color={colors.brand.primary}
                        />
                        <StatCard
                            title="Active Bookings"
                            value={stats.bookings.active}
                            icon={<Calendar className="w-6 h-6" />}
                            color="#10b981"
                        />
                        <StatCard
                            title="Expired Bookings"
                            value={stats.bookings.expired}
                            icon={<Calendar className="w-6 h-6" />}
                            color="#ef4444"
                        />
                        <StatCard
                            title="Total Containers"
                            value={stats.bookings.totalContainers}
                            icon={<Package className="w-6 h-6" />}
                            subtitle="Booked containers"
                            color={colors.brand.secondary}
                        />
                    </div>
                </div>

                {/* Gate Activity */}
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5" style={{ color: colors.brand.primary }} />
                        Gate Activity
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Today</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LogIn className="w-4 h-4 text-green-600" />
                                        <span className="text-sm text-gray-600">Gate In</span>
                                    </div>
                                    <span className="text-lg font-bold text-gray-900">{stats.gateActivity.today.gateIn}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LogOut className="w-4 h-4 text-purple-600" />
                                        <span className="text-sm text-gray-600">Gate Out</span>
                                    </div>
                                    <span className="text-lg font-bold text-gray-900">{stats.gateActivity.today.gateOut}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">This Week</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LogIn className="w-4 h-4 text-green-600" />
                                        <span className="text-sm text-gray-600">Gate In</span>
                                    </div>
                                    <span className="text-lg font-bold text-gray-900">{stats.gateActivity.week.gateIn}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LogOut className="w-4 h-4 text-purple-600" />
                                        <span className="text-sm text-gray-600">Gate Out</span>
                                    </div>
                                    <span className="text-lg font-bold text-gray-900">{stats.gateActivity.week.gateOut}</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">This Month</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LogIn className="w-4 h-4 text-green-600" />
                                        <span className="text-sm text-gray-600">Gate In</span>
                                    </div>
                                    <span className="text-lg font-bold text-gray-900">{stats.gateActivity.month.gateIn}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LogOut className="w-4 h-4 text-purple-600" />
                                        <span className="text-sm text-gray-600">Gate Out</span>
                                    </div>
                                    <span className="text-lg font-bold text-gray-900">{stats.gateActivity.month.gateOut}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 7-Day Pre-Inventory Trend */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Package className="w-5 h-5" style={{ color: colors.brand.primary }} />
                                7-Day Pre-Inventory Activity
                            </h3>
                        </div>
                        <LineChart data={chartData.preInventoryTrend.map(item => ({
                            date: item.date,
                            gateIn: item.preIn,
                            gateOut: item.preOut
                        }))} />
                    </div>

                    {/* 7-Day Gate Activity Trend */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" style={{ color: colors.brand.primary }} />
                                7-Day Gate Activity
                            </h3>
                        </div>
                        <LineChart data={chartData.gateActivity7Days} />
                    </div>

                    {/* Container Status Distribution */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <PieChart className="w-5 h-5" style={{ color: colors.brand.primary }} />
                                Container Status Distribution
                            </h3>
                        </div>
                        <SimpleBarChart 
                            data={chartData.containersByStatus.map(item => ({ 
                                label: item.status, 
                                value: item.count 
                            }))} 
                            color={colors.brand.primary}
                        />
                    </div>

                    {/* Containers by Client */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" style={{ color: colors.brand.primary }} />
                                Top Clients
                            </h3>
                        </div>
                        <SimpleBarChart 
                            data={chartData.containersByClient.slice(0, 8).map(item => ({ 
                                label: item.client, 
                                value: item.count 
                            }))} 
                            color={colors.brand.secondary}
                        />
                    </div>

                    {/* Booking Trend */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Calendar className="w-5 h-5" style={{ color: colors.brand.primary }} />
                                Booking Trend (6 Months)
                            </h3>
                        </div>
                        <SimpleBarChart 
                            data={chartData.bookingTrend.map(item => ({ 
                                label: item.month, 
                                value: item.bookings 
                            }))} 
                            color="#10b981"
                        />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

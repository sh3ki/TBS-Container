import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, useState, useEffect } from 'react';
import axios from 'axios';
import { colors } from '@/lib/colors';
import {
    Home,
    Users,
    Calendar,
    FileText,
    Package,
    LogIn,
    LogOut as LogOutIcon,
    BarChart3,
    FileBarChart,
    Layers,
    Ban,
    ChevronLeft,
    ChevronRight,
    Container,
    Menu,
    X,
} from 'lucide-react';
import { ModernConfirmDialog } from '@/components/modern/ModernConfirmDialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface User {
    user_id: number;
    username: string;
    full_name: string;
    email: string;
    priv_id: number;
}

interface Permission {
    p_id: number;
    page: string;
    page_name: string;
    page_icon: string;
    acs_edit: number;
    acs_delete: number;
}

const iconMap: Record<string, React.ReactNode> = {
    dashboard: <Home className="h-5 w-5" />,
    clients: <Users className="h-5 w-5" />,
    users: <Users className="h-5 w-5" />,
    booking: <Calendar className="h-5 w-5" />,
    billing: <FileText className="h-5 w-5" />,
    inventory: <Package className="h-5 w-5" />,
    gateinout: <LogIn className="h-5 w-5" />,
    audit: <BarChart3 className="h-5 w-5" />,
    reports: <FileBarChart className="h-5 w-5" />,
    sizetype: <Layers className="h-5 w-5" />,
    bancon: <Ban className="h-5 w-5" />,
    bancontainers: <Ban className="h-5 w-5" />,
};

export default function Authenticated({ children }: PropsWithChildren) {
    const page = usePage();
    const auth = (page.props as Record<string, unknown>).auth as { user: User; permissions: Permission[] };
    
    // Initialize sidebar state from localStorage (desktop only)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved === 'true';
    });
    
    // Mobile menu state
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const currentPath = page.url;

    // Persist sidebar state to localStorage
    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
    }, [sidebarCollapsed]);

    // Close mobile menu when route changes
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [currentPath]);

    // Define menu order
    const menuOrder = [
        'gateinout',
        'inventory', 
        'booking',
        'billing',
        'reports',
        'bancon',
        'bancontainers',
        'sizetype',
        'clients',
        'users',
        'audit'
    ];

    // Sort permissions according to menuOrder
    const sortedPermissions = [...(auth.permissions || [])].sort((a, b) => {
        const indexA = menuOrder.indexOf(a.page.toLowerCase());
        const indexB = menuOrder.indexOf(b.page.toLowerCase());
        
        // If both are in the order list, sort by their position
        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
        }
        // If only one is in the list, prioritize it
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        // If neither is in the list, maintain original order
        return 0;
    });

    const handleLogoutClick = () => {
        setShowLogoutConfirm(true);
    };

    const handleLogout = async () => {
        try {
            // Get fresh CSRF token
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            
            await axios.post('/api/logout', {}, {
                headers: {
                    'X-CSRF-TOKEN': csrfToken || '',
                }
            });
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout failed:', error);
            // Even if logout fails, redirect to login (session might already be expired)
            window.location.href = '/login';
        }
    };

    const isActivePath = (path: string) => {
        return currentPath === path || currentPath.startsWith(`${path}/`);
    };

    return (
        <div className="min-h-screen" style={{ backgroundColor: colors.secondary }}>
            {/* Modern Professional Header */}
            <nav 
                className="fixed w-full z-30 top-0 shadow-lg"
                style={{ 
                    backgroundColor: colors.brand.primary,
                    borderBottom: `1px solid ${colors.brand.primary}`,
                }}
            >
                <div className="px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* Hamburger Menu for Mobile */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-200"
                        >
                            {mobileMenuOpen ? (
                                <X className="w-6 h-6" />
                            ) : (
                                <Menu className="w-6 h-6" />
                            )}
                        </button>

                        {/* Desktop Toggle Button */}
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="hidden lg:block text-white hover:bg-white/10 p-2 rounded-lg transition-all duration-200"
                        >
                            {sidebarCollapsed ? (
                                <ChevronRight className="w-5 h-5" />
                            ) : (
                                <ChevronLeft className="w-5 h-5" />
                            )}
                        </button>

                        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                            <Container className="h-8 w-8 text-white" />
                            <div className="text-white">
                                <div className="text-lg font-bold tracking-wide">TBS</div>
                                <div className="text-xs opacity-90 -mt-1 hidden sm:block">Container Management System</div>
                            </div>
                        </Link>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Notifications */}
                        {/* <button className="relative text-white hover:bg-white/10 p-2.5 rounded-lg transition-all duration-200">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        </button> */}

                        {/* User Profile */}
                        <div className="flex items-center gap-3 px-4 py-2 bg-blue/10 rounded-lg transition-all duration-200">
                            <div 
                                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-md"
                                style={{ backgroundColor: colors.brand.secondary }}
                            >
                                {auth.user?.username?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div className="hidden lg:block text-white">
                                <div className="text-sm font-semibold">{auth.user?.full_name || auth.user?.username || 'Admin'}</div>
                                <div className="text-xs opacity-80 -mt-0.5">{auth.user?.email || 'admin@fjpwl.com'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="flex pt-16">
                {/* Mobile Backdrop Overlay */}
                {mobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}

                {/* Modern Professional Sidebar */}
                <aside
                    className={`fixed left-0 top-16 h-[calc(100vh-4rem)] z-40 transition-all duration-300 shadow-2xl flex flex-col
                        ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
                        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                        w-64 lg:w-auto
                    `}
                    style={{
                        backgroundColor: colors.sidebar.background,
                    }}
                >
                    {/* Scrollable Menu Section */}
                    <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
                        <ul className="space-y-1 px-2">
                            {/* Dashboard */}
                            <li>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Link
                                            href="/dashboard"
                                            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                                                isActivePath('/dashboard')
                                                    ? 'shadow-lg'
                                                    : 'hover:bg-white/10 hover:text-white'
                                            }`}
                                            style={{
                                                ...(isActivePath('/dashboard') && { backgroundColor: colors.sidebar.active }),
                                                color: isActivePath('/dashboard') ? colors.sidebar.text : 'rgba(255, 255, 255, 0.8)',
                                            }}
                                        >
                                            <Home className={`h-5 w-5 flex-shrink-0 ${isActivePath('/dashboard') ? 'scale-110' : 'group-hover:animate-[wiggle_0.6s_ease-in-out]'} transition-transform`} />
                                            <div className={`flex-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                                                <div className="text-sm font-semibold">Dashboard</div>
                                            </div>
                                            {!sidebarCollapsed && isActivePath('/dashboard') && (
                                                <div className="w-1 h-6 rounded-full bg-white"></div>
                                            )}
                                        </Link>
                                    </TooltipTrigger>
                                    {sidebarCollapsed && (
                                        <TooltipContent side="right" className="hidden lg:block bg-gray-700 text-white border-gray-700">
                                            Dashboard
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </li>

                            {/* Dynamic Menu Items */}
                            {sortedPermissions?.map((permission) => {
                                const icon = iconMap[permission.page.toLowerCase()] || <Package className="h-5 w-5" />;
                                const isActive = isActivePath(`/${permission.page}`);

                                return (
                                    <li key={permission.p_id}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Link
                                                    href={`/${permission.page}`}
                                                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                                                        isActive
                                                            ? 'shadow-lg'
                                                            : 'hover:bg-white/10 hover:text-white'
                                                    }`}
                                                    style={{
                                                        ...(isActive && { backgroundColor: colors.sidebar.active }),
                                                        color: isActive ? colors.sidebar.text : 'rgba(255, 255, 255, 0.8)',
                                                    }}
                                                >
                                                    <span className={`${isActive ? 'scale-110' : 'group-hover:animate-[wiggle_0.6s_ease-in-out]'} transition-transform`}>
                                                        {icon}
                                                    </span>
                                                    <span className={`text-sm font-medium flex-1 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                                                        {permission.page_name}
                                                    </span>
                                                    {!sidebarCollapsed && isActive && (
                                                        <div className="w-1 h-6 rounded-full bg-white"></div>
                                                    )}
                                                </Link>
                                            </TooltipTrigger>
                                            {sidebarCollapsed && (
                                                <TooltipContent side="right" className="hidden lg:block bg-gray-700 text-white border-gray-700">
                                                    {permission.page_name}
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    {/* Logout Button at Bottom */}
                    <div className="border-t border-white/10 p-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleLogoutClick}
                                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-white/80 hover:bg-red-500/20 hover:text-white transition-all duration-200 group w-full"
                                >
                                    <LogOutIcon className="h-5 w-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                                    <span className={`text-sm font-medium ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                                        Logout
                                    </span>
                                </button>
                            </TooltipTrigger>
                            {sidebarCollapsed && (
                                <TooltipContent side="right" className="hidden lg:block bg-gray-700 text-white border-gray-700">
                                    Logout
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main
                    className={`flex-1 transition-all duration-300 overflow-x-hidden
                        ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}
                    `}
                >
                    <div className="p-4 sm:p-8" style={{ backgroundColor: colors.secondary, minHeight: 'calc(100vh - 4rem)' }}>
                        {children}
                    </div>
                </main>
            </div>

            {/* Logout Confirmation Modal */}
            <ModernConfirmDialog
                open={showLogoutConfirm}
                onOpenChange={setShowLogoutConfirm}
                onConfirm={handleLogout}
                title="Confirm Logout"
                description="Are you sure you want to logout?"
                confirmText="Logout"
                cancelText="Cancel"
            />
        </div>
    );
}

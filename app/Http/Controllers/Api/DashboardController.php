<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Booking;
use App\Models\Invoice;
use App\Models\GateLog;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Get dashboard statistics.
     */
    public function statistics(Request $request)
    {
        try {
            // Active clients count
            $activeClients = Client::where('archived', 0)->count();

            // Active bookings count - bookings with remaining containers
            $activeBookings = Booking::where(function ($query) {
                $query->where('twenty_rem', '>', 0)
                    ->orWhere('fourty_rem', '>', 0)
                    ->orWhere('fourty_five_rem', '>', 0);
            })->count();

            // Pending invoices - Table may not exist yet
            $pendingInvoices = 0;
            $overdueInvoices = 0;
            $monthlyRevenue = 0;

            try {
                $pendingInvoices = Invoice::where('payment_status', 'pending')->count();
                $overdueInvoices = Invoice::where('payment_status', '!=', 'paid')
                    ->where('due_date', '<', now())
                    ->count();
                $monthlyRevenue = Invoice::where('payment_status', 'paid')
                    ->whereMonth('paid_date', now()->month)
                    ->whereYear('paid_date', now()->year)
                    ->sum('total_amount');
            } catch (\Exception $e) {
                // Invoice table doesn't exist yet
            }

            // Containers in yard - Use inventory table instead
            $containersInYard = DB::table('inventory')
                ->where('gate_status', 'IN')
                ->whereNull('out_id')
                ->count();

            // Recent gate activities - Count from inventory
            $recentGateIns = DB::table('inventory')
                ->where('gate_status', 'IN')
                ->where('date_added', '>=', now()->subDays(7))
                ->count();

            $recentGateOuts = DB::table('inventory')
                ->where('gate_status', 'OUT')
                ->where('date_added', '>=', now()->subDays(7))
                ->count();

            // Expiring bookings (next 7 days) - bookings with remaining containers expiring soon
            $expiringBookings = Booking::where(function ($query) {
                $query->where('twenty_rem', '>', 0)
                    ->orWhere('fourty_rem', '>', 0)
                    ->orWhere('fourty_five_rem', '>', 0);
            })
            ->whereBetween('expiration_date', [now(), now()->addDays(7)])
            ->count();

            // Recent activities count (today)
            $todayActivities = AuditLog::whereDate('date_added', today())->count();

            return response()->json([
                'success' => true,
                'data' => [
                    'clients' => [
                        'active' => $activeClients,
                    ],
                    'bookings' => [
                        'active' => $activeBookings,
                        'expiring_soon' => $expiringBookings,
                    ],
                    'invoices' => [
                        'pending' => $pendingInvoices,
                        'overdue' => $overdueInvoices,
                        'monthly_revenue' => number_format($monthlyRevenue, 2),
                    ],
                    'gate' => [
                        'containers_in_yard' => $containersInYard,
                        'recent_ins' => $recentGateIns,
                        'recent_outs' => $recentGateOuts,
                    ],
                    'activities' => [
                        'today' => $todayActivities,
                    ],
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch dashboard statistics: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get recent activities.
     */
    public function recentActivities(Request $request)
    {
        $limit = $request->get('limit', 20);

        $activities = AuditLog::with('user')
            ->orderBy('date_added', 'desc')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $activities,
        ]);
    }

    /**
     * Get monthly statistics for charts.
     */
    public function monthlyStats(Request $request)
    {
        $year = $request->get('year', now()->year);

        // Monthly revenue
        $monthlyRevenue = Invoice::where('payment_status', 'paid')
            ->whereYear('paid_date', $year)
            ->selectRaw('MONTH(paid_date) as month, SUM(total_amount) as total')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->pluck('total', 'month')
            ->toArray();

        // Monthly bookings
        $monthlyBookings = Booking::whereYear('date_added', $year)
            ->selectRaw('MONTH(date_added) as month, COUNT(*) as total')
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->pluck('total', 'month')
            ->toArray();

        // Fill in missing months with 0
        $months = range(1, 12);
        $revenue = [];
        $bookings = [];

        foreach ($months as $month) {
            $revenue[] = $monthlyRevenue[$month] ?? 0;
            $bookings[] = $monthlyBookings[$month] ?? 0;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'year' => $year,
                'revenue' => $revenue,
                'bookings' => $bookings,
                'months' => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            ],
        ]);
    }

    /**
     * Get top clients by revenue.
     */
    public function topClients(Request $request)
    {
        $limit = $request->get('limit', 10);
        $year = $request->get('year', now()->year);

        $topClients = Client::select('fjp_clients.*')
            ->Join('invoices', 'fjp_clients.c_id', '=', 'fjp_invoices.client_id')
            ->where('fjp_invoices.payment_status', 'paid')
            ->whereYear('fjp_invoices.paid_date', $year)
            ->selectRaw('fjp_clients.*, SUM(fjp_invoices.total_amount) as total_revenue')
            ->groupBy('fjp_clients.c_id')
            ->orderByDesc('total_revenue')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $topClients,
        ]);
    }

    /**
     * Get comprehensive dashboard statistics including charts data
     */
    public function getStats(Request $request)
    {
        try {
            // Pre-Inventory Statistics
            $totalPreIn = 0;
            $pendingPreIn = 0;
            $totalPreOut = 0;
            $pendingPreOut = 0;

            try {
                // Total Pre-In: records with gate_status = 'IN'
                $totalPreIn = DB::table('pre_inventory')
                    ->where('gate_status', 'IN')
                    ->count();
                
                // Pending Pre-In: records with gate_status = 'IN' and status = 0 (pending)
                $pendingPreIn = DB::table('pre_inventory')
                    ->where('gate_status', 'IN')
                    ->where('status', 0)
                    ->count();
                
                // Total Pre-Out: records with gate_status = 'OUT'
                $totalPreOut = DB::table('pre_inventory')
                    ->where('gate_status', 'OUT')
                    ->count();
                
                // Pending Pre-Out: records with gate_status = 'OUT' and status = 0 (pending)
                $pendingPreOut = DB::table('pre_inventory')
                    ->where('gate_status', 'OUT')
                    ->where('status', 0)
                    ->count();
            } catch (\Exception $e) {
                // Pre-inventory table might not exist or have different structure
                // Keep default 0 values
            }

            // Inventory Statistics
            $totalInventory = 0;
            $gateInCount = 0;
            $gateOutCount = 0;
            $repoCount = 0;
            $availableCount = 0;
            $holdCount = 0;

            try {
                $totalInventory = DB::table('inventory')->count();
                
                $gateInCount = DB::table('inventory')
                    ->where('gate_status', 'IN')
                    ->count();
                
                $gateOutCount = DB::table('inventory')
                    ->where('gate_status', 'OUT')
                    ->count();
                
                // Get status counts
                $repoCount = DB::table('inventory')
                    ->where('gate_status', 'IN')
                    ->where('container_status_id', 1)
                    ->count();
                
                $availableCount = DB::table('inventory')
                    ->where('gate_status', 'IN')
                    ->where('container_status_id', 2)
                    ->count();
                
                $holdCount = DB::table('inventory')
                    ->where('is_hold', 1)
                    ->count();
            } catch (\Exception $e) {
                // Handle inventory table errors
            }

            // Booking Statistics
            $totalBookings = 0;
            $activeBookings = 0;
            $expiredBookings = 0;
            $totalBookedContainers = 0;
            $remainingContainers = 0;

            try {
                $totalBookings = Booking::count();
                
                $activeBookings = Booking::where(function ($query) {
                    $query->where('twenty_rem', '>', 0)
                        ->orWhere('fourty_rem', '>', 0)
                        ->orWhere('fourty_five_rem', '>', 0);
                })
                ->where('expiration_date', '>=', now())
                ->count();
                
                $expiredBookings = Booking::where('expiration_date', '<', now())->count();
                
                $totalBookedContainers = (int) Booking::sum(DB::raw('COALESCE(twenty, 0) + COALESCE(fourty, 0) + COALESCE(fourty_five, 0)'));
                $remainingContainers = (int) Booking::sum(DB::raw('COALESCE(twenty_rem, 0) + COALESCE(fourty_rem, 0) + COALESCE(fourty_five_rem, 0)'));
            } catch (\Exception $e) {
                // Handle booking errors
            }

            // Gate Activity - Today
            $todayStart = now()->startOfDay()->format('Y-m-d H:i:s');
            $todayGateIn = 0;
            $todayGateOut = 0;
            $weekGateIn = 0;
            $weekGateOut = 0;
            $monthGateIn = 0;
            $monthGateOut = 0;

            try {
                $todayGateIn = DB::table('inventory')
                    ->where('gate_status', 'IN')
                    ->where('date_added', '>=', $todayStart)
                    ->count();
                
                $todayGateOut = DB::table('inventory')
                    ->where('gate_status', 'OUT')
                    ->where('date_added', '>=', $todayStart)
                    ->count();

                // Gate Activity - This Week
                $weekStart = now()->startOfWeek()->format('Y-m-d H:i:s');
                $weekGateIn = DB::table('inventory')
                    ->where('gate_status', 'IN')
                    ->where('date_added', '>=', $weekStart)
                    ->count();
                
                $weekGateOut = DB::table('inventory')
                    ->where('gate_status', 'OUT')
                    ->where('date_added', '>=', $weekStart)
                    ->count();

                // Gate Activity - This Month
                $monthStart = now()->startOfMonth()->format('Y-m-d H:i:s');
                $monthGateIn = DB::table('inventory')
                    ->where('gate_status', 'IN')
                    ->where('date_added', '>=', $monthStart)
                    ->count();
                
                $monthGateOut = DB::table('inventory')
                    ->where('gate_status', 'OUT')
                    ->where('date_added', '>=', $monthStart)
                    ->count();
            } catch (\Exception $e) {
                // Handle gate activity errors
            }

            // Chart Data: 7-Day Gate Activity
            $gateActivity7Days = [];
            try {
                for ($i = 6; $i >= 0; $i--) {
                    $date = now()->subDays($i)->startOfDay();
                    $nextDate = now()->subDays($i)->endOfDay();
                    
                    $dayGateIn = DB::table('inventory')
                        ->where('gate_status', 'IN')
                        ->whereBetween('date_added', [$date->format('Y-m-d H:i:s'), $nextDate->format('Y-m-d H:i:s')])
                        ->count();
                    
                    $dayGateOut = DB::table('inventory')
                        ->where('gate_status', 'OUT')
                        ->whereBetween('date_added', [$date->format('Y-m-d H:i:s'), $nextDate->format('Y-m-d H:i:s')])
                        ->count();
                    
                    $gateActivity7Days[] = [
                        'date' => $date->format('M d'),
                        'gateIn' => $dayGateIn,
                        'gateOut' => $dayGateOut,
                    ];
                }
            } catch (\Exception $e) {
                // Provide default data if query fails
                for ($i = 6; $i >= 0; $i--) {
                    $date = now()->subDays($i);
                    $gateActivity7Days[] = [
                        'date' => $date->format('M d'),
                        'gateIn' => 0,
                        'gateOut' => 0,
                    ];
                }
            }

            // Chart Data: Container Status Distribution
            $containersByStatus = [];
            try {
                // Get status distribution from inventory joined with container_status table
                $statusData = DB::table('inventory as i')
                    ->leftJoin('container_status as cs', 'i.container_status', '=', 'cs.s_id')
                    ->select('cs.status', DB::raw('COUNT(*) as count'))
                    ->where('i.gate_status', 'IN')
                    ->whereNotNull('cs.status')
                    ->groupBy('cs.status')
                    ->orderByDesc('count')
                    ->get();
                
                foreach ($statusData as $status) {
                    $containersByStatus[] = [
                        'status' => strtoupper($status->status),
                        'count' => (int) $status->count,
                    ];
                }
                
                // Add hold containers
                $holdCount = DB::table('inventory')
                    ->where('is_hold', 1)
                    ->count();
                
                if ($holdCount > 0) {
                    $containersByStatus[] = [
                        'status' => 'HLD (On Hold)',
                        'count' => $holdCount,
                    ];
                }
            } catch (\Exception $e) {
                $containersByStatus = [
                    ['status' => 'AVL', 'count' => 0],
                    ['status' => 'REPO', 'count' => 0],
                    ['status' => 'WSH', 'count' => 0],
                ];
            }
            
            // Chart Data: Pre-Inventory Trend (Last 7 Days)
            $preInventoryTrend = [];
            try {
                for ($i = 6; $i >= 0; $i--) {
                    $date = now()->subDays($i)->startOfDay();
                    $nextDate = now()->subDays($i)->endOfDay();
                    
                    $dayPreIn = DB::table('pre_inventory')
                        ->where('gate_status', 'IN')
                        ->whereBetween('date_added', [$date->format('Y-m-d H:i:s'), $nextDate->format('Y-m-d H:i:s')])
                        ->count();
                    
                    $dayPreOut = DB::table('pre_inventory')
                        ->where('gate_status', 'OUT')
                        ->whereBetween('date_added', [$date->format('Y-m-d H:i:s'), $nextDate->format('Y-m-d H:i:s')])
                        ->count();
                    
                    $preInventoryTrend[] = [
                        'date' => $date->format('M d'),
                        'preIn' => $dayPreIn,
                        'preOut' => $dayPreOut,
                    ];
                }
            } catch (\Exception $e) {
                for ($i = 6; $i >= 0; $i--) {
                    $date = now()->subDays($i);
                    $preInventoryTrend[] = [
                        'date' => $date->format('M d'),
                        'preIn' => 0,
                        'preOut' => 0,
                    ];
                }
            }

            // Chart Data: Containers by Client (Top 10)
            $containersByClient = [];
            try {
                $containersByClient = DB::table('inventory')
                    ->join('clients', 'inventory.client_id', '=', 'clients.c_id')
                    ->select('clients.client_name as client', DB::raw('COUNT(*) as count'))
                    ->where('inventory.gate_status', 'IN')
                    ->groupBy('clients.c_id', 'clients.client_name')
                    ->orderByDesc('count')
                    ->limit(10)
                    ->get()
                    ->map(function ($item) {
                        return [
                            'client' => $item->client,
                            'count' => (int) $item->count,
                        ];
                    })
                    ->toArray();
            } catch (\Exception $e) {
                $containersByClient = [];
            }

            // Chart Data: Booking Trend (Last 6 Months)
            $bookingTrend = [];
            try {
                for ($i = 5; $i >= 0; $i--) {
                    $monthStart = now()->subMonths($i)->startOfMonth();
                    $monthEnd = now()->subMonths($i)->endOfMonth();
                    
                    $monthBookings = Booking::whereBetween('date_added', [$monthStart->format('Y-m-d H:i:s'), $monthEnd->format('Y-m-d H:i:s')])->count();
                    $monthContainers = (int) Booking::whereBetween('date_added', [$monthStart->format('Y-m-d H:i:s'), $monthEnd->format('Y-m-d H:i:s')])
                        ->sum(DB::raw('COALESCE(twenty, 0) + COALESCE(fourty, 0) + COALESCE(fourty_five, 0)'));
                    
                    $bookingTrend[] = [
                        'month' => $monthStart->format('M Y'),
                        'bookings' => $monthBookings,
                        'containers' => $monthContainers,
                    ];
                }
            } catch (\Exception $e) {
                for ($i = 5; $i >= 0; $i--) {
                    $monthStart = now()->subMonths($i);
                    $bookingTrend[] = [
                        'month' => $monthStart->format('M Y'),
                        'bookings' => 0,
                        'containers' => 0,
                    ];
                }
            }

            return response()->json([
                'success' => true,
                'stats' => [
                    'preInventory' => [
                        'totalPreIn' => $totalPreIn,
                        'totalPreOut' => $totalPreOut,
                        'pendingPreIn' => $pendingPreIn,
                        'pendingPreOut' => $pendingPreOut,
                    ],
                    'inventory' => [
                        'total' => $totalInventory,
                        'gateIn' => $gateInCount,
                        'gateOut' => $gateOutCount,
                        'repo' => $repoCount,
                        'available' => $availableCount,
                        'hold' => $holdCount,
                    ],
                    'bookings' => [
                        'total' => $totalBookings,
                        'active' => $activeBookings,
                        'expired' => $expiredBookings,
                        'totalContainers' => $totalBookedContainers,
                        'remainingContainers' => $remainingContainers,
                    ],
                    'gateActivity' => [
                        'today' => [
                            'gateIn' => $todayGateIn,
                            'gateOut' => $todayGateOut,
                        ],
                        'week' => [
                            'gateIn' => $weekGateIn,
                            'gateOut' => $weekGateOut,
                        ],
                        'month' => [
                            'gateIn' => $monthGateIn,
                            'gateOut' => $monthGateOut,
                        ],
                    ],
                ],
                'charts' => [
                    'gateActivity7Days' => $gateActivity7Days,
                    'containersByStatus' => $containersByStatus,
                    'containersByClient' => $containersByClient,
                    'bookingTrend' => $bookingTrend,
                    'preInventoryTrend' => $preInventoryTrend,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch dashboard statistics: ' . $e->getMessage(),
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}


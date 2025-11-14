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
            // Pre-Inventory Statistics - Optimized with single query
            $totalPreIn = 0;
            $pendingPreIn = 0;
            $totalPreOut = 0;
            $pendingPreOut = 0;

            try {
                $prefix = DB::getTablePrefix();
                // Single query to get all pre-inventory counts
                $preResult = DB::selectOne("
                    SELECT 
                        SUM(CASE WHEN gate_status = 'IN' THEN 1 ELSE 0 END) as total_in,
                        SUM(CASE WHEN gate_status = 'IN' AND status = 0 THEN 1 ELSE 0 END) as pending_in,
                        SUM(CASE WHEN gate_status = 'OUT' THEN 1 ELSE 0 END) as total_out,
                        SUM(CASE WHEN gate_status = 'OUT' AND status = 0 THEN 1 ELSE 0 END) as pending_out
                    FROM {$prefix}pre_inventory
                ");
                
                $totalPreIn = (int) $preResult->total_in;
                $pendingPreIn = (int) $preResult->pending_in;
                $totalPreOut = (int) $preResult->total_out;
                $pendingPreOut = (int) $preResult->pending_out;
            } catch (\Exception $e) {
                // Pre-inventory table might not exist or have different structure
                // Keep default 0 values
            }

            // Inventory Statistics - Optimized with single query
            $totalInventory = 0;
            $gateInCount = 0;
            $gateOutCount = 0;
            $repoCount = 0;
            $availableCount = 0;
            $holdCount = 0;
            $damagedCount = 0;
            $bannedCount = 0;

            try {
                $prefix = DB::getTablePrefix();
                $monthStart = now()->startOfMonth()->format('Y-m-d H:i:s');
                
                // Single optimized query to get all counts at once
                $result = DB::selectOne("
                    SELECT 
                        SUM(CASE WHEN i.gate_status = 'IN' AND i.complete = 0 THEN 1 ELSE 0 END) as total_in_yard,
                        SUM(CASE WHEN i.gate_status = 'IN' AND i.date_added >= ? THEN 1 ELSE 0 END) as gate_in_month,
                        SUM(CASE WHEN i.gate_status = 'OUT' AND i.date_added >= ? THEN 1 ELSE 0 END) as gate_out_month,
                        SUM(CASE WHEN i.gate_status = 'IN' AND i.complete = 0 AND cs.status = 'AVL' THEN 1 ELSE 0 END) as avl_count,
                        SUM(CASE WHEN i.gate_status = 'IN' AND i.complete = 0 AND cs.status = 'REPO' THEN 1 ELSE 0 END) as repo_count,
                        SUM(CASE WHEN i.gate_status = 'IN' AND i.complete = 0 AND cs.status = 'DMG' THEN 1 ELSE 0 END) as dmg_count,
                        SUM(CASE WHEN i.gate_status = 'IN' AND i.complete = 0 AND cs.status = 'HLD' THEN 1 ELSE 0 END) as hld_count
                    FROM {$prefix}inventory i
                    LEFT JOIN {$prefix}container_status cs ON i.container_status = cs.s_id
                ", [$monthStart, $monthStart]);
                
                $totalInventory = (int) $result->total_in_yard;
                $gateInCount = (int) $result->gate_in_month;
                $gateOutCount = (int) $result->gate_out_month;
                $availableCount = (int) $result->avl_count;
                $repoCount = (int) $result->repo_count;
                $damagedCount = (int) $result->dmg_count;
                $holdCount = (int) $result->hld_count;
                
                // Banned containers - simple count query
                $bannedCount = (int) DB::table('ban_containers')->count();
            } catch (\Exception $e) {
                // Handle inventory table errors
            }

            // Booking Statistics - Optimized with single query
            $totalBookings = 0;
            $activeBookings = 0;
            $expiredBookings = 0;
            $totalBookedContainers = 0;
            $remainingContainers = 0;

            try {
                $prefix = DB::getTablePrefix();
                $now = now()->format('Y-m-d H:i:s');
                
                // Single optimized query for all booking stats
                $bookingResult = DB::selectOne("
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN (twenty_rem > 0 OR fourty_rem > 0 OR fourty_five_rem > 0) 
                            AND expiration_date >= ? THEN 1 ELSE 0 END) as active,
                        SUM(CASE WHEN expiration_date < ? THEN 1 ELSE 0 END) as expired,
                        SUM(COALESCE(twenty, 0) + COALESCE(fourty, 0) + COALESCE(fourty_five, 0)) as total_containers,
                        SUM(COALESCE(twenty_rem, 0) + COALESCE(fourty_rem, 0) + COALESCE(fourty_five_rem, 0)) as remaining
                    FROM {$prefix}bookings
                ", [$now, $now]);
                
                $totalBookings = (int) $bookingResult->total;
                $activeBookings = (int) $bookingResult->active;
                $expiredBookings = (int) $bookingResult->expired;
                $totalBookedContainers = (int) $bookingResult->total_containers;
                $remainingContainers = (int) $bookingResult->remaining;
            } catch (\Exception $e) {
                // Handle booking errors
            }

            // Gate Activity - Optimized single query
            $todayGateIn = 0;
            $todayGateOut = 0;
            $weekGateIn = 0;
            $weekGateOut = 0;
            $monthGateIn = 0;
            $monthGateOut = 0;

            try {
                $todayStart = now()->startOfDay()->format('Y-m-d H:i:s');
                $weekStart = now()->startOfWeek()->format('Y-m-d H:i:s');
                $monthStart = now()->startOfMonth()->format('Y-m-d H:i:s');
                
                $gateResult = DB::selectOne("
                    SELECT 
                        SUM(CASE WHEN gate_status = 'IN' AND date_added >= ? THEN 1 ELSE 0 END) as today_in,
                        SUM(CASE WHEN gate_status = 'OUT' AND date_added >= ? THEN 1 ELSE 0 END) as today_out,
                        SUM(CASE WHEN gate_status = 'IN' AND date_added >= ? THEN 1 ELSE 0 END) as week_in,
                        SUM(CASE WHEN gate_status = 'OUT' AND date_added >= ? THEN 1 ELSE 0 END) as week_out,
                        SUM(CASE WHEN gate_status = 'IN' AND date_added >= ? THEN 1 ELSE 0 END) as month_in,
                        SUM(CASE WHEN gate_status = 'OUT' AND date_added >= ? THEN 1 ELSE 0 END) as month_out
                    FROM {$prefix}inventory
                ", [$todayStart, $todayStart, $weekStart, $weekStart, $monthStart, $monthStart]);
                
                $todayGateIn = (int) $gateResult->today_in;
                $todayGateOut = (int) $gateResult->today_out;
                $weekGateIn = (int) $gateResult->week_in;
                $weekGateOut = (int) $gateResult->week_out;
                $monthGateIn = (int) $gateResult->month_in;
                $monthGateOut = (int) $gateResult->month_out;
            } catch (\Exception $e) {
                // Handle gate activity errors
            }

            // Chart Data: 7-Day Gate Activity - Optimized single query
            $gateActivity7Days = [];
            try {
                $sevenDaysAgo = now()->subDays(6)->startOfDay()->format('Y-m-d H:i:s');
                
                $dayData = DB::select("
                    SELECT 
                        DATE(date_added) as day,
                        SUM(CASE WHEN gate_status = 'IN' THEN 1 ELSE 0 END) as gate_in,
                        SUM(CASE WHEN gate_status = 'OUT' THEN 1 ELSE 0 END) as gate_out
                    FROM {$prefix}inventory
                    WHERE date_added >= ?
                    GROUP BY DATE(date_added)
                    ORDER BY day
                ", [$sevenDaysAgo]);
                
                $dataByDate = [];
                foreach ($dayData as $row) {
                    $dataByDate[$row->day] = [
                        'gateIn' => (int) $row->gate_in,
                        'gateOut' => (int) $row->gate_out
                    ];
                }
                
                for ($i = 6; $i >= 0; $i--) {
                    $date = now()->subDays($i);
                    $dateKey = $date->format('Y-m-d');
                    $gateActivity7Days[] = [
                        'date' => $date->format('M d'),
                        'gateIn' => $dataByDate[$dateKey]['gateIn'] ?? 0,
                        'gateOut' => $dataByDate[$dateKey]['gateOut'] ?? 0,
                    ];
                }
            } catch (\Exception $e) {
                for ($i = 6; $i >= 0; $i--) {
                    $date = now()->subDays($i);
                    $gateActivity7Days[] = [
                        'date' => $date->format('M d'),
                        'gateIn' => 0,
                        'gateOut' => 0,
                    ];
                }
            }

            // Chart Data: Container Status Distribution (only containers in yard)
            $containersByStatus = [];
            try {
                // Get status distribution from inventory (gate_status='IN' and complete=0)
                $statusData = DB::table('inventory as i')
                    ->join('container_status as cs', 'i.container_status', '=', 'cs.s_id')
                    ->select('cs.status', DB::raw('COUNT(*) as count'))
                    ->where('i.gate_status', 'IN')
                    ->where('i.complete', 0)
                    ->groupBy('cs.status', 'cs.s_id')
                    ->orderBy('cs.s_id')
                    ->get();
                
                foreach ($statusData as $status) {
                    $containersByStatus[] = [
                        'status' => strtoupper($status->status),
                        'count' => (int) $status->count,
                    ];
                }
                
                // Add banned containers as a separate status
                $bannedCount = DB::table('ban_containers')->count();
                if ($bannedCount > 0) {
                    $containersByStatus[] = [
                        'status' => 'BAN',
                        'count' => $bannedCount,
                    ];
                }
            } catch (\Exception $e) {
                $containersByStatus = [
                    ['status' => 'AVL', 'count' => 0],
                    ['status' => 'REPO', 'count' => 0],
                    ['status' => 'DMG', 'count' => 0],
                    ['status' => 'HLD', 'count' => 0],
                    ['status' => 'BAN', 'count' => 0],
                ];
            }
            
            // Chart Data: Pre-Inventory Trend (Last 7 Days) - Optimized single query
            $preInventoryTrend = [];
            try {
                $sevenDaysAgo = now()->subDays(6)->startOfDay()->format('Y-m-d H:i:s');
                
                $preData = DB::select("
                    SELECT 
                        DATE(date_added) as day,
                        SUM(CASE WHEN gate_status = 'IN' THEN 1 ELSE 0 END) as pre_in,
                        SUM(CASE WHEN gate_status = 'OUT' THEN 1 ELSE 0 END) as pre_out
                    FROM {$prefix}pre_inventory
                    WHERE date_added >= ?
                    GROUP BY DATE(date_added)
                    ORDER BY day
                ", [$sevenDaysAgo]);
                
                $preDataByDate = [];
                foreach ($preData as $row) {
                    $preDataByDate[$row->day] = [
                        'preIn' => (int) $row->pre_in,
                        'preOut' => (int) $row->pre_out
                    ];
                }
                
                for ($i = 6; $i >= 0; $i--) {
                    $date = now()->subDays($i);
                    $dateKey = $date->format('Y-m-d');
                    $preInventoryTrend[] = [
                        'date' => $date->format('M d'),
                        'preIn' => $preDataByDate[$dateKey]['preIn'] ?? 0,
                        'preOut' => $preDataByDate[$dateKey]['preOut'] ?? 0,
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

            // Chart Data: Containers by Client (Top 10) - Optimized
            $containersByClient = [];
            try {
                $clientData = DB::select("
                    SELECT 
                        c.client_name as client,
                        COUNT(*) as count
                    FROM {$prefix}inventory i
                    INNER JOIN {$prefix}clients c ON i.client_id = c.c_id
                    WHERE i.gate_status = 'IN' AND i.complete = 0
                    GROUP BY c.c_id, c.client_name
                    ORDER BY count DESC
                    LIMIT 10
                ");
                
                foreach ($clientData as $row) {
                    $containersByClient[] = [
                        'client' => $row->client,
                        'count' => (int) $row->count,
                    ];
                }
            } catch (\Exception $e) {
                $containersByClient = [];
            }

            // Chart Data: Booking Trend (Last 6 Months) - Optimized single query
            $bookingTrend = [];
            try {
                $sixMonthsAgo = now()->subMonths(5)->startOfMonth()->format('Y-m-d H:i:s');
                
                $monthlyData = DB::select("
                    SELECT 
                        DATE_FORMAT(date_added, '%Y-%m') as month,
                        COUNT(*) as bookings,
                        SUM(COALESCE(twenty, 0) + COALESCE(fourty, 0) + COALESCE(fourty_five, 0)) as containers
                    FROM {$prefix}bookings
                    WHERE date_added >= ?
                    GROUP BY DATE_FORMAT(date_added, '%Y-%m')
                    ORDER BY month
                ", [$sixMonthsAgo]);
                
                $dataByMonth = [];
                foreach ($monthlyData as $row) {
                    $dataByMonth[$row->month] = [
                        'bookings' => (int) $row->bookings,
                        'containers' => (int) $row->containers
                    ];
                }
                
                for ($i = 5; $i >= 0; $i--) {
                    $monthStart = now()->subMonths($i)->startOfMonth();
                    $monthKey = $monthStart->format('Y-m');
                    $monthBookings = $dataByMonth[$monthKey]['bookings'] ?? 0;
                    $monthContainers = $dataByMonth[$monthKey]['containers'] ?? 0;
                    
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
                        'damaged' => $damagedCount,
                        'banned' => $bannedCount,
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


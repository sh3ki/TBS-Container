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
        $startTime = microtime(true);
        $timings = [];
        
        try {
            // Pre-Inventory Statistics - Optimized with single query
            $queryStart = microtime(true);
            $pendingPreIn = 0;
            $pendingPreOut = 0;
            $processedPreInToday = 0;
            $processedPreOutToday = 0;

            try {
                $todayStart = now()->startOfDay()->format('Y-m-d H:i:s');
                
                // Pending counts (status = 0)
                $pendingPreIn = (int) DB::table('pre_inventory')->where('gate_status', 'IN')->where('status', 0)->count();
                $pendingPreOut = (int) DB::table('pre_inventory')->where('gate_status', 'OUT')->where('status', 0)->count();
                
                // Processed today counts (status = 1 and today)
                $processedPreInToday = (int) DB::table('pre_inventory')->where('gate_status', 'IN')->where('status', 1)->where('date_added', '>=', $todayStart)->count();
                $processedPreOutToday = (int) DB::table('pre_inventory')->where('gate_status', 'OUT')->where('status', 1)->where('date_added', '>=', $todayStart)->count();
                
                $timings['pre_inventory'] = round((microtime(true) - $queryStart) * 1000, 2);
            } catch (\Exception $e) {
                // Pre-inventory table might not exist or have different structure
                // Keep default 0 values
                $timings['pre_inventory'] = round((microtime(true) - $queryStart) * 1000, 2);
            }

            // Inventory Statistics - Optimized with single query
            $queryStart = microtime(true);
            $containers = 0;
            $gateInToday = 0;
            $gateOutToday = 0;
            $availableCount = 0;
            $repoCount = 0;
            $washCount = 0;
            $damagedCount = 0;
            $bannedCount = 0;

            try {
                $todayStart = now()->startOfDay()->format('Y-m-d H:i:s');
                
                // Total containers IN (match inventory page logic, excluding archived clients)
                $containers = (int) DB::table('inventory as i')
                    ->leftJoin('clients as c', 'c.c_id', '=', 'i.client_id')
                    ->where('i.gate_status', 'IN')
                    ->where('i.complete', 0)
                    ->where(function ($query) {
                        $query->where('c.archived', 0)
                              ->orWhereNull('c.archived');
                    })
                    ->count();
                
                // Gate IN and OUT today
                $gateInToday = (int) DB::table('inventory')->where('gate_status', 'IN')->where('date_added', '>=', $todayStart)->count();
                $gateOutToday = (int) DB::table('inventory')->where('gate_status', 'OUT')->where('date_added', '>=', $todayStart)->count();
                
                // Status counts (only for containers IN yard)
                $availableCount = (int) DB::table('inventory')->where('gate_status', 'IN')->where('complete', 0)->where('container_status', 1)->count();
                $repoCount = (int) DB::table('inventory')->where('gate_status', 'IN')->where('complete', 0)->where('container_status', 8)->count();
                $washCount = (int) DB::table('inventory')->where('gate_status', 'IN')->where('complete', 0)->where('container_status', 2)->count();
                $damagedCount = (int) DB::table('inventory')->where('gate_status', 'IN')->where('complete', 0)->where('container_status', 3)->count();
                
                // Banned containers
                $bannedCount = (int) DB::table('ban_containers')->count();
                
                $timings['inventory_stats'] = round((microtime(true) - $queryStart) * 1000, 2);
            } catch (\Exception $e) {
                // Handle inventory table errors
                $timings['inventory_stats'] = round((microtime(true) - $queryStart) * 1000, 2);
            }

            // Booking Statistics - Optimized with single query
            $queryStart = microtime(true);
            $activeBookings = 0;
            $totalContainersInActiveBookings = 0;
            $remainingContainersInActiveBookings = 0;

            try {
                $now = now()->format('Y-m-d');
                
                // Active bookings (with remaining containers and not expired)
                $activeBookingsData = DB::table('bookings')
                    ->selectRaw('
                        COUNT(*) as count,
                        SUM(COALESCE(twenty, 0) + COALESCE(fourty, 0) + COALESCE(fourty_five, 0)) as total_containers,
                        SUM(COALESCE(twenty_rem, 0) + COALESCE(fourty_rem, 0) + COALESCE(fourty_five_rem, 0)) as remaining_containers
                    ')
                    ->where(function($q) {
                        $q->where('twenty_rem', '>', 0)
                          ->orWhere('fourty_rem', '>', 0)
                          ->orWhere('fourty_five_rem', '>', 0);
                    })
                    ->where('expiration_date', '>=', $now)
                    ->first();
                
                $activeBookings = (int) ($activeBookingsData->count ?? 0);
                $totalContainersInActiveBookings = (int) ($activeBookingsData->total_containers ?? 0);
                $remainingContainersInActiveBookings = (int) ($activeBookingsData->remaining_containers ?? 0);
                
                $timings['booking_stats'] = round((microtime(true) - $queryStart) * 1000, 2);
            } catch (\Exception $e) {
                // Handle booking errors
                $timings['booking_stats'] = round((microtime(true) - $queryStart) * 1000, 2);
            }

            // Chart Data: 7-Day Gate Activity - Optimized single query
            $queryStart = microtime(true);
            $gateActivity7Days = [];
            try {
                $sevenDaysAgo = now()->subDays(6)->startOfDay()->format('Y-m-d H:i:s');
                $prefix = DB::getTablePrefix();
                
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
                $timings['gate_7day_chart'] = round((microtime(true) - $queryStart) * 1000, 2);
            } catch (\Exception $e) {
                for ($i = 6; $i >= 0; $i--) {
                    $date = now()->subDays($i);
                    $gateActivity7Days[] = [
                        'date' => $date->format('M d'),
                        'gateIn' => 0,
                        'gateOut' => 0,
                    ];
                }
                $timings['gate_7day_chart'] = round((microtime(true) - $queryStart) * 1000, 2);
            }

            // Chart Data: Container Status Distribution (only containers in yard)
            $queryStart = microtime(true);
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
                $timings['status_distribution'] = round((microtime(true) - $queryStart) * 1000, 2);
            } catch (\Exception $e) {
                $containersByStatus = [
                    ['status' => 'AVL', 'count' => 0],
                    ['status' => 'REPO', 'count' => 0],
                    ['status' => 'DMG', 'count' => 0],
                    ['status' => 'HLD', 'count' => 0],
                    ['status' => 'BAN', 'count' => 0],
                ];
                $timings['status_distribution'] = round((microtime(true) - $queryStart) * 1000, 2);
            }
            
            // Chart Data: Pre-Inventory Trend (Last 7 Days) - Optimized single query
            $queryStart = microtime(true);
            $preInventoryTrend = [];
            try {
                $sevenDaysAgo = now()->subDays(6)->startOfDay()->format('Y-m-d H:i:s');
                $prefix = DB::getTablePrefix();
                
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
                $timings['preinv_7day_chart'] = round((microtime(true) - $queryStart) * 1000, 2);
            } catch (\Exception $e) {
                for ($i = 6; $i >= 0; $i--) {
                    $date = now()->subDays($i);
                    $preInventoryTrend[] = [
                        'date' => $date->format('M d'),
                        'preIn' => 0,
                        'preOut' => 0,
                    ];
                }
                $timings['preinv_7day_chart'] = round((microtime(true) - $queryStart) * 1000, 2);
            }

            // Chart Data: Containers by Client (Top 10) - Optimized
            $queryStart = microtime(true);
            $containersByClient = [];
            try {
                $prefix = DB::getTablePrefix();
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
                $timings['containers_by_client'] = round((microtime(true) - $queryStart) * 1000, 2);
            } catch (\Exception $e) {
                $containersByClient = [];
                $timings['containers_by_client'] = round((microtime(true) - $queryStart) * 1000, 2);
            }

            // Chart Data: Booking Trend (Last 6 Months) - Optimized single query
            $queryStart = microtime(true);
            $bookingTrend = [];
            try {
                $sixMonthsAgo = now()->subMonths(5)->startOfMonth()->format('Y-m-d H:i:s');
                $prefix = DB::getTablePrefix();
                
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
                $timings['booking_trend'] = round((microtime(true) - $queryStart) * 1000, 2);
            } catch (\Exception $e) {
                for ($i = 5; $i >= 0; $i--) {
                    $monthStart = now()->subMonths($i);
                    $bookingTrend[] = [
                        'month' => $monthStart->format('M Y'),
                        'bookings' => 0,
                        'containers' => 0,
                    ];
                }
                $timings['booking_trend'] = round((microtime(true) - $queryStart) * 1000, 2);
            }

            $totalTime = round((microtime(true) - $startTime) * 1000, 2);
            $timings['total'] = $totalTime;

            return response()->json([
                'success' => true,
                'timings' => $timings,
                'stats' => [
                    'preInventory' => [
                        'pendingPreIn' => $pendingPreIn,
                        'pendingPreOut' => $pendingPreOut,
                        'processedPreInToday' => $processedPreInToday,
                        'processedPreOutToday' => $processedPreOutToday,
                    ],
                    'inventory' => [
                        'containers' => $containers,
                        'gateInToday' => $gateInToday,
                        'gateOutToday' => $gateOutToday,
                        'available' => $availableCount,
                        'repo' => $repoCount,
                        'wash' => $washCount,
                        'damaged' => $damagedCount,
                        'banned' => $bannedCount,
                    ],
                    'bookings' => [
                        'active' => $activeBookings,
                        'totalContainersInActive' => $totalContainersInActiveBookings,
                        'remainingContainersInActive' => $remainingContainersInActiveBookings,
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


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
}


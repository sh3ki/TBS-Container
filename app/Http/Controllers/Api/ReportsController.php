<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\Booking;
use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    /**
     * Get clients list for dropdown
     */
    public function getClients()
    {
        $clients = Client::where('archived', 0)
            ->orderBy('client_name')
            ->get()
            ->map(function ($client) {
                return [
                    'id' => (string) $client->c_id,
                    'c_id' => $client->c_id,
                    'code' => $client->client_code,
                    'name' => $client->client_name,
                    'text' => $client->client_code . ' - ' . $client->client_name,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $clients,
        ]);
    }

    /**
     * REPORT 1: Daily Gate In/Out Report
     * Shows all containers gated in/out within date range
     */
    public function dailyGateReport(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to' => 'required|date',
            'client_id' => 'nullable|integer',
            'gate_status' => 'nullable|in:IN,OUT,both',
        ]);

        $dateFrom = $request->date_from . ' 00:00:00';
        $dateTo = $request->date_to . ' 23:59:59';
        $clientId = $request->client_id;
        $gateStatus = $request->gate_status ?? 'both';

        // Gate IN records
        $gateInQuery = Inventory::with(['client:c_id,client_name,client_code', 'sizeType'])
            ->whereBetween('date_added', [$dateFrom, $dateTo])
            ->where('gate_status', 'IN');

        if ($clientId) {
            $gateInQuery->where('client_id', $clientId);
        }

        $gateIn = $gateStatus === 'OUT' ? [] : $gateInQuery->get()->map(function ($item) {
            return [
                'date_in' => $item->date_added,
                'container_no' => $item->container_no,
                'client' => $item->client->client_code ?? 'N/A',
                'client_name' => $item->client->client_name ?? 'N/A',
                'size' => $item->sizeType->size ?? 'N/A',
                'type' => $item->sizeType->type ?? 'N/A',
                'condition' => $item->class ?? 'N/A',
                'booking' => $item->booking ?? 'N/A',
                'shipper' => $item->shipper ?? 'N/A',
                'location' => $item->location ?? 'N/A',
            ];
        });

        // Gate OUT records
        $gateOutQuery = Inventory::with(['client:c_id,client_name,client_code', 'sizeType'])
            ->whereBetween('date_added', [$dateFrom, $dateTo])
            ->where('gate_status', 'OUT');

        if ($clientId) {
            $gateOutQuery->where('client_id', $clientId);
        }

        $gateOut = $gateStatus === 'IN' ? [] : $gateOutQuery->get()->map(function ($item) {
            $daysInYard = $item->approval_date 
                ? now()->diffInDays($item->date_added)
                : null;

            return [
                'date_out' => $item->approval_date ?? 'N/A',
                'container_no' => $item->container_no,
                'client' => $item->client->client_code ?? 'N/A',
                'client_name' => $item->client->client_name ?? 'N/A',
                'size' => $item->sizeType->size ?? 'N/A',
                'vessel' => $item->vessel ?? 'N/A',
                'voyage' => $item->voyage ?? 'N/A',
                'days_in_yard' => $daysInYard,
            ];
        });

        // Calculate summary
        $summary = [
            'total_gate_in' => $gateIn->count(),
            'total_gate_out' => $gateOut->count(),
            'gate_in_by_size' => $gateIn->groupBy('size')->map->count(),
            'gate_out_by_size' => $gateOut->groupBy('size')->map->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'gate_in' => $gateIn,
                'gate_out' => $gateOut,
                'summary' => $summary,
            ],
        ]);
    }

    /**
     * REPORT 2: Inventory Status Report
     * Shows all containers currently in yard
     */
    public function inventoryStatusReport(Request $request)
    {
        $query = Inventory::with(['client:c_id,client_name,client_code', 'sizeType'])
            ->where('complete', 0); // In yard

        // Apply filters
        if ($request->client_id) {
            $query->where('client_id', $request->client_id);
        }

        if ($request->size) {
            $query->whereHas('sizeType', function ($q) use ($request) {
                $q->where('size', $request->size);
            });
        }

        if ($request->condition) {
            $query->where('class', $request->condition);
        }

        if ($request->hold_only) {
            $query->whereExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('hold_containers')
                    ->whereColumn('hold_containers.container_no', 'inventory.container_no');
            });
        }

        $inventory = $query->get()->map(function ($item) {
            $daysInYard = now()->diffInDays($item->date_added);
            
            // Check if on hold
            $onHold = DB::table('hold_containers')
                ->where('container_no', $item->container_no)
                ->exists();

            // Check if damaged (based on remarks)
            $isDamaged = stripos($item->remarks, 'damage') !== false ||
                        stripos($item->remarks, 'broken') !== false;

            return [
                'container_no' => $item->container_no,
                'client' => $item->client->client_code ?? 'N/A',
                'client_name' => $item->client->client_name ?? 'N/A',
                'size' => $item->sizeType->size ?? 'N/A',
                'type' => $item->sizeType->type ?? 'N/A',
                'condition' => $item->class ?? 'N/A',
                'date_in' => $item->date_added,
                'days_in_yard' => $daysInYard,
                'booking' => $item->booking ?? 'N/A',
                'location' => $item->location ?? 'N/A',
                'on_hold' => $onHold,
                'damaged' => $isDamaged,
                'remarks' => $item->remarks ?? '',
            ];
        });

        // Calculate summary
        $summary = [
            'total_containers' => $inventory->count(),
            'by_size' => $inventory->groupBy('size')->map->count(),
            'by_condition' => $inventory->groupBy('condition')->map->count(),
            'on_hold' => $inventory->where('on_hold', true)->count(),
            'damaged' => $inventory->where('damaged', true)->count(),
            'average_days' => round($inventory->avg('days_in_yard'), 2),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'inventory' => $inventory,
                'summary' => $summary,
            ],
        ]);
    }

    /**
     * REPORT 3: Client Activity Report
     * Shows all activities for a specific client
     */
    public function clientActivityReport(Request $request)
    {
        $request->validate([
            'client_id' => 'required|integer',
            'date_from' => 'required|date',
            'date_to' => 'required|date',
        ]);

        $clientId = $request->client_id;
        $dateFrom = $request->date_from . ' 00:00:00';
        $dateTo = $request->date_to . ' 23:59:59';

        // Get client info
        $client = Client::find($clientId);

        // Gate IN summary
        $gateInData = Inventory::where('client_id', $clientId)
            ->whereBetween('date_added', [$dateFrom, $dateTo])
            ->where('gate_status', 'IN')
            ->with('sizeType')
            ->get();

        $gateInSummary = [
            'total' => $gateInData->count(),
            'by_size' => $gateInData->groupBy('sizeType.size')->map->count(),
            'by_condition' => $gateInData->groupBy('class')->map->count(),
        ];

        // Gate OUT summary
        $gateOutData = Inventory::where('client_id', $clientId)
            ->whereBetween('approval_date', [$dateFrom, $dateTo])
            ->where('gate_status', 'OUT')
            ->with('sizeType')
            ->get();

        $avgDays = $gateOutData->map(function ($item) {
            return $item->approval_date 
                ? \Carbon\Carbon::parse($item->approval_date)->diffInDays($item->date_added)
                : 0;
        })->avg();

        $gateOutSummary = [
            'total' => $gateOutData->count(),
            'by_size' => $gateOutData->groupBy('sizeType.size')->map->count(),
            'average_days' => round($avgDays, 2),
        ];

        // Current inventory
        $currentInventory = Inventory::where('client_id', $clientId)
            ->where('complete', 0)
            ->with('sizeType')
            ->get();

        $currentInvSummary = [
            'total' => $currentInventory->count(),
            'by_size' => $currentInventory->groupBy('sizeType.size')->map->count(),
            'average_storage' => round($currentInventory->map(function ($item) {
                return now()->diffInDays($item->date_added);
            })->avg(), 2),
        ];

        // Bookings
        $bookings = Booking::where('client_id', $clientId)
            ->whereBetween('date_added', [$dateFrom, $dateTo])
            ->get();

        $bookingsSummary = [
            'total' => $bookings->count(),
            'active' => $bookings->where('expiration_date', '>=', now())->count(),
            'expired' => $bookings->where('expiration_date', '<', now())->count(),
        ];

        // Billing calculation (simplified)
        $billingData = Inventory::where('client_id', $clientId)
            ->whereBetween('date_added', [$dateFrom, $dateTo])
            ->with('sizeType')
            ->get();

        $totalStorageCharges = 0;
        $totalHandlingCharges = 0;

        foreach ($billingData as $item) {
            // Simplified calculation - would need actual rates from fjp_storage_rate
            $days = now()->diffInDays($item->date_added);
            $size = $item->sizeType->size ?? '20';
            $storageRate = 10; // Default rate - should fetch from database
            $handlingRate = 50; // Default rate - should fetch from database

            $totalStorageCharges += $days * $storageRate;
            $totalHandlingCharges += $handlingRate * 2; // In + Out
        }

        return response()->json([
            'success' => true,
            'data' => [
                'client' => $client,
                'gate_in_summary' => $gateInSummary,
                'gate_out_summary' => $gateOutSummary,
                'current_inventory_summary' => $currentInvSummary,
                'bookings_summary' => $bookingsSummary,
                'billing_summary' => [
                    'storage_charges' => $totalStorageCharges,
                    'handling_charges' => $totalHandlingCharges,
                    'total_charges' => $totalStorageCharges + $totalHandlingCharges,
                ],
            ],
        ]);
    }

    /**
     * REPORT 4: Billing Summary Report
     * Comprehensive billing report
     */
    public function billingSummaryReport(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to' => 'required|date',
            'client_id' => 'nullable|integer',
            'include_details' => 'nullable|boolean',
        ]);

        $dateFrom = $request->date_from . ' 00:00:00';
        $dateTo = $request->date_to . ' 23:59:59';

        $query = Inventory::with(['client:c_id,client_name,client_code', 'sizeType'])
            ->whereBetween('date_added', [$dateFrom, $dateTo]);

        if ($request->client_id) {
            $query->where('client_id', $request->client_id);
        }

        $data = $query->get();

        // Group by client and calculate charges
        $summaryByClient = $data->groupBy('client_id')->map(function ($items, $clientId) {
            $totalStorage = 0;
            $totalHandling = 0;

            foreach ($items as $item) {
                $days = now()->diffInDays($item->date_added);
                // Simplified - should fetch actual rates
                $storageRate = 10;
                $handlingRate = 50;

                $totalStorage += $days * $storageRate;
                $totalHandling += $handlingRate * 2;
            }

            return [
                'client_id' => $clientId,
                'client_name' => $items->first()->client->client_name ?? 'N/A',
                'containers' => $items->count(),
                'storage_charges' => $totalStorage,
                'handling_charges' => $totalHandling,
                'total' => $totalStorage + $totalHandling,
            ];
        });

        // Grand totals
        $grandTotal = [
            'total_containers' => $data->count(),
            'total_storage_charges' => $summaryByClient->sum('storage_charges'),
            'total_handling_charges' => $summaryByClient->sum('handling_charges'),
            'grand_total' => $summaryByClient->sum('total'),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'summary_by_client' => $summaryByClient->values(),
                'grand_total' => $grandTotal,
            ],
        ]);
    }

    /**
     * REPORT 5: Container Movement Report
     * Track container movements over time
     */
    public function containerMovementReport(Request $request)
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to' => 'required|date',
            'container_no' => 'nullable|string',
        ]);

        $dateFrom = $request->date_from . ' 00:00:00';
        $dateTo = $request->date_to . ' 23:59:59';

        $query = Inventory::with(['client:c_id,client_name,client_code', 'sizeType'])
            ->whereBetween('date_added', [$dateFrom, $dateTo])
            ->orderBy('date_added', 'asc');

        if ($request->container_no) {
            $query->where('container_no', 'LIKE', '%' . $request->container_no . '%');
        }

        $movements = $query->get()->map(function ($item) {
            $daysInYard = $item->approval_date
                ? \Carbon\Carbon::parse($item->approval_date)->diffInDays($item->date_added)
                : null;

            return [
                'date' => $item->date_added,
                'container_no' => $item->container_no,
                'client' => $item->client->client_code ?? 'N/A',
                'movement' => $item->gate_status === 'IN' ? 'GATE IN' : 'GATE OUT',
                'size' => $item->sizeType->size ?? 'N/A',
                'booking' => $item->booking ?? 'N/A',
                'vessel' => $item->vessel ?? 'N/A',
                'days_in_yard' => $daysInYard,
            ];
        });

        // Statistics
        $stats = [
            'total_movements' => $movements->count(),
            'average_turnaround' => round($movements->where('days_in_yard', '!=', null)->avg('days_in_yard'), 2),
            'containers_with_cycles' => $movements->groupBy('container_no')->filter(function ($group) {
                return $group->count() > 1;
            })->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'movements' => $movements,
                'statistics' => $stats,
            ],
        ]);
    }

    /**
     * REPORT 6: Booking Status Report
     * Shows booking allocations and usage
     */
    public function bookingStatusReport(Request $request)
    {
        $query = Booking::with('client:c_id,client_name,client_code');

        if ($request->status) {
            if ($request->status === 'active') {
                $query->where('expiration_date', '>=', now());
            } elseif ($request->status === 'expired') {
                $query->where('expiration_date', '<', now());
            }
        }

        if ($request->client_id) {
            $query->where('client_id', $request->client_id);
        }

        $bookings = $query->get()->map(function ($booking) {
            $status = $booking->expiration_date >= now() ? 'Active' : 'Expired';

            return [
                'booking_no' => $booking->book_no,
                'client' => $booking->client->client_code ?? 'N/A',
                'shipper' => $booking->shipper,
                'twenty_alloc' => $booking->twenty,
                'twenty_used' => $booking->twenty - $booking->twenty_rem,
                'twenty_rem' => $booking->twenty_rem,
                'fourty_alloc' => $booking->fourty,
                'fourty_used' => $booking->fourty - $booking->fourty_rem,
                'fourty_rem' => $booking->fourty_rem,
                'fourty_five_alloc' => $booking->fourty_five,
                'fourty_five_used' => $booking->fourty_five - $booking->fourty_five_rem,
                'fourty_five_rem' => $booking->fourty_five_rem,
                'expiration_date' => $booking->expiration_date,
                'status' => $status,
            ];
        });

        // Summary
        $summary = [
            'total_active' => $bookings->where('status', 'Active')->count(),
            'total_expired' => $bookings->where('status', 'Expired')->count(),
            'total_allocated' => $bookings->sum('twenty_alloc') + $bookings->sum('fourty_alloc') + $bookings->sum('fourty_five_alloc'),
            'total_used' => $bookings->sum('twenty_used') + $bookings->sum('fourty_used') + $bookings->sum('fourty_five_used'),
            'total_remaining' => $bookings->sum('twenty_rem') + $bookings->sum('fourty_rem') + $bookings->sum('fourty_five_rem'),
        ];

        $summary['utilization_rate'] = $summary['total_allocated'] > 0
            ? round(($summary['total_used'] / $summary['total_allocated']) * 100, 2)
            : 0;

        return response()->json([
            'success' => true,
            'data' => [
                'bookings' => $bookings,
                'summary' => $summary,
            ],
        ]);
    }

    /**
     * REPORT 7: Hold Containers Report
     * Shows all containers currently on hold
     */
    public function holdContainersReport(Request $request)
    {
        $query = DB::table('hold_containers')
            ->join('inventory', 'hold_containers.container_no', '=', 'inventory.container_no')
            ->join('clients', 'inventory.client_id', '=', 'clients.c_id')
            ->leftJoin('container_size_type', 'inventory.size_type', '=', 'container_size_type.s_id')
            ->select(
                'hold_containers.container_no',
                'clients.client_code',
                'clients.client_name',
                'container_size_type.size',
                'inventory.date_added',
                'hold_containers.notes',
                'hold_containers.date_added as hold_date'
            );

        if ($request->client_id) {
            $query->where('inventory.client_id', $request->client_id);
        }

        $holdContainers = collect($query->get())->map(function ($item) {
            $daysInYard = now()->diffInDays($item->date_added);
            $daysOnHold = now()->diffInDays($item->hold_date);

            return [
                'container_no' => $item->container_no,
                'client' => $item->client_code,
                'client_name' => $item->client_name,
                'size' => $item->size ?? 'N/A',
                'date_in' => $item->date_added,
                'days_in_yard' => $daysInYard,
                'days_on_hold' => $daysOnHold,
                'hold_reason' => $item->notes ?? 'N/A',
            ];
        });

        // Summary
        $summary = [
            'total_on_hold' => $holdContainers->count(),
            'by_client' => $holdContainers->groupBy('client')->map->count(),
            'average_hold_duration' => round($holdContainers->avg('days_on_hold'), 2),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'hold_containers' => $holdContainers,
                'summary' => $summary,
            ],
        ]);
    }

    /**
     * REPORT 8: Damaged Containers Report
     * Shows containers with damage records
     */
    public function damagedContainersReport(Request $request)
    {
        $query = Inventory::with(['client:c_id,client_name,client_code', 'sizeType'])
            ->where(function ($q) {
                $q->where('remarks', 'LIKE', '%damage%')
                  ->orWhere('remarks', 'LIKE', '%broken%')
                  ->orWhere('remarks', 'LIKE', '%repair%');
            });

        if ($request->client_id) {
            $query->where('client_id', $request->client_id);
        }

        $damagedContainers = $query->get()->map(function ($item) {
            // Parse damage info from remarks (simplified)
            $severity = 'Minor'; // Default
            if (stripos($item->remarks, 'major') !== false) {
                $severity = 'Major';
            } elseif (stripos($item->remarks, 'critical') !== false) {
                $severity = 'Critical';
            }

            return [
                'container_no' => $item->container_no,
                'client' => $item->client->client_code ?? 'N/A',
                'client_name' => $item->client->client_name ?? 'N/A',
                'size' => $item->sizeType->size ?? 'N/A',
                'damage_type' => 'Damage', // Simplified - no damage table
                'severity' => $severity,
                'date_reported' => $item->date_added,
                'remarks' => $item->remarks,
            ];
        });

        // Summary
        $summary = [
            'total_damaged' => $damagedContainers->count(),
            'by_severity' => $damagedContainers->groupBy('severity')->map->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'damaged_containers' => $damagedContainers,
                'summary' => $summary,
            ],
        ]);
    }

    /**
     * REPORT 9: Storage Utilization Report
     * Shows yard capacity and utilization
     */
    public function storageUtilizationReport(Request $request)
    {
        $date = $request->date ?? now()->format('Y-m-d');

        // Get current inventory
        $inventory = Inventory::with('sizeType')
            ->where('complete', 0)
            ->get();

        // Calculate TEU (Twenty-foot Equivalent Unit)
        $teuCalculation = $inventory->map(function ($item) {
            $size = $item->sizeType->size ?? '20';
            if ($size == '20') return 1;
            if ($size == '40') return 2;
            if ($size == '45') return 2.25;
            return 1;
        });

        $totalTEU = $teuCalculation->sum();

        // Assumed yard capacity (should be configurable)
        $yardCapacity = 1000; // TEU

        // By size breakdown
        $bySize = $inventory->groupBy('sizeType.size')->map(function ($items, $size) use ($yardCapacity) {
            $count = $items->count();
            $teu = $count * ($size == '20' ? 1 : ($size == '40' ? 2 : 2.25));
            $utilization = $yardCapacity > 0 ? round(($teu / $yardCapacity) * 100, 2) : 0;

            return [
                'size' => $size ?? 'N/A',
                'count' => $count,
                'teu' => $teu,
                'utilization' => $utilization,
            ];
        });

        // By client
        $byClient = $inventory->groupBy('client_id')->map(function ($items, $clientId) {
            $client = $items->first()->client;
            return [
                'client_code' => $client->client_code ?? 'N/A',
                'client_name' => $client->client_name ?? 'N/A',
                'containers' => $items->count(),
            ];
        })->sortByDesc('containers')->take(10)->values();

        // Summary
        $summary = [
            'total_capacity' => $yardCapacity,
            'current_inventory' => $totalTEU,
            'utilization_rate' => $yardCapacity > 0 ? round(($totalTEU / $yardCapacity) * 100, 2) : 0,
            'available_space' => $yardCapacity - $totalTEU,
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => $summary,
                'by_size' => $bySize->values(),
                'by_client' => $byClient,
            ],
        ]);
    }

    /**
     * Export Report to CSV
     */
    public function exportReport(Request $request)
    {
        $reportType = $request->report_type;
        $data = $request->report_data; // JSON data from frontend

        if (empty($data)) {
            return response()->json(['error' => 'No data to export'], 400);
        }

        // Generate filename
        $filename = $reportType . '_' . now()->format('Y-m-d_H-i-s') . '.csv';

        return response()->json([
            'success' => true,
            'data' => [
                'filename' => $filename,
                'report_data' => $data,
            ],
        ]);
    }

    /**
     * Incoming Report - Gate IN containers
     */
    public function incomingReport(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
            'client_id' => 'nullable|string',
        ]);

        $startDate = $request->start_date . ' 00:00:00';
        $endDate = $request->end_date . ' 23:59:59';
        $clientId = $request->client_id;

        $prefix = DB::getTablePrefix();
        $query = DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'clients` as c'), 'inv.client_id', '=', 'c.c_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st'), 'inv.size_type', '=', 'st.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs'), 'inv.container_status', '=', 'cs.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt'), 'inv.load_type', '=', 'lt.l_id')
            ->whereBetween('inv.date_added', [$startDate, $endDate])
            ->where('inv.gate_status', 'IN')
            ->select(
                DB::raw('inv.i_id as eir_no'),
                DB::raw('DATE(inv.date_added) as date'),
                DB::raw('TIME(inv.date_added) as time'),
                'inv.container_no',
                DB::raw('CONCAT(st.size, "/", st.type) as size_type'),
                'cs.status',
                'inv.vessel',
                'inv.voyage',
                'inv.class',
                'inv.date_manufactured',
                'inv.ex_consignee',
                'inv.hauler',
                'inv.plate_no',
                'lt.type as load',
                'inv.origin',
                'inv.chasis'
            );

        if ($clientId && $clientId !== 'all' && $clientId !== '') {
            $query->where('inv.client_id', $clientId);
        }

        $data = $query->orderBy('inv.date_added', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Outgoing Report - Gate OUT containers
     */
    public function outgoingReport(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
            'client_id' => 'nullable|string',
        ]);

        $startDate = $request->start_date . ' 00:00:00';
        $endDate = $request->end_date . ' 23:59:59';
        $clientId = $request->client_id;

        $prefix = DB::getTablePrefix();
        $query = DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'clients` as c'), 'inv.client_id', '=', 'c.c_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st'), 'inv.size_type', '=', 'st.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs'), 'inv.container_status', '=', 'cs.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt'), 'inv.load_type', '=', 'lt.l_id')
            ->whereBetween('inv.approval_date', [$startDate, $endDate])
            ->where('inv.gate_status', 'OUT')
            ->select(
                DB::raw('inv.i_id as eir_no'),
                DB::raw('DATE(inv.approval_date) as date'),
                DB::raw('TIME(inv.approval_date) as time'),
                'inv.container_no',
                DB::raw('CONCAT(st.size, "/", st.type) as size_type'),
                'cs.status',
                'inv.vessel',
                'inv.voyage',
                'inv.shipper',
                'inv.hauler',
                'inv.booking',
                DB::raw('NULL as destination'),
                'inv.plate_no',
                'lt.type as load',
                'inv.chasis',
                'inv.seal_no'
            );

        if ($clientId && $clientId !== 'all' && $clientId !== '') {
            $query->where('inv.client_id', $clientId);
        }

        $data = $query->orderBy('inv.approval_date', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * DMR Report - Daily Monitoring Report
     */
    public function dmrReport(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
            'client_id' => 'nullable|string',
        ]);

        $date = $request->date;
        $clientId = $request->client_id;

        $prefix = DB::getTablePrefix();
        $query = DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'clients` as c'), 'inv.client_id', '=', 'c.c_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st'), 'inv.size_type', '=', 'st.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs'), 'inv.container_status', '=', 'cs.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt'), 'inv.load_type', '=', 'lt.l_id')
            ->whereDate('inv.date_added', $date)
            ->select(
                'inv.container_no',
                DB::raw('CONCAT(st.size, "/", st.type) as size_type'),
                'cs.status',
                'lt.type as load',
                'c.client_name as client',
                DB::raw('DATE(inv.date_added) as date')
            );

        if ($clientId && $clientId !== 'all' && $clientId !== '') {
            $query->where('inv.client_id', $clientId);
        }

        $data = $query->orderBy('inv.date_added', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * DCR Report - Daily Container Report
     */
    public function dcrReport(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
        ]);

        $date = $request->date;

        $prefix = DB::getTablePrefix();
        $data = DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st'), 'inv.size_type', '=', 'st.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs'), 'inv.container_status', '=', 'cs.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt'), 'inv.load_type', '=', 'lt.l_id')
            ->whereDate('inv.date_added', $date)
            ->select(
                'inv.container_no',
                DB::raw('CONCAT(st.size, "/", st.type) as size_type'),
                'cs.status',
                'lt.type as load',
                DB::raw('DATE(inv.date_added) as date')
            )
            ->orderBy('inv.date_added', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Export Incoming Report to CSV
     */
    public function exportIncomingReport(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
            'client_id' => 'nullable|string',
        ]);

        // Get the data using the same logic as incomingReport
        $startDate = $request->start_date . ' 00:00:00';
        $endDate = $request->end_date . ' 23:59:59';
        $clientId = $request->client_id;

        $prefix = DB::getTablePrefix();
        $query = DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'clients` as c'), 'inv.client_id', '=', 'c.c_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st'), 'inv.size_type', '=', 'st.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs'), 'inv.container_status', '=', 'cs.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt'), 'inv.load_type', '=', 'lt.l_id')
            ->whereBetween('inv.date_added', [$startDate, $endDate])
            ->where('inv.gate_status', 'IN')
            ->select(
                DB::raw('inv.i_id as eir_no'),
                DB::raw('DATE(inv.date_added) as date'),
                DB::raw('TIME(inv.date_added) as time'),
                'inv.container_no',
                DB::raw('CONCAT(st.size, "/", st.type) as size_type'),
                'cs.status',
                'inv.vessel',
                'inv.voyage',
                'inv.class',
                'inv.date_manufactured',
                'inv.ex_consignee',
                'inv.hauler',
                'inv.plate_no',
                'lt.type as load',
                'inv.origin',
                'inv.chasis'
            );

        if ($clientId && $clientId !== 'all' && $clientId !== '') {
            $query->where('inv.client_id', $clientId);
        }

        $data = $query->orderBy('inv.date_added', 'desc')->get();

        // Generate CSV
        $filename = 'incoming_report_' . now()->format('Y-m-d_H-i-s') . '.csv';
        $filePath = storage_path('app/public/exports/' . $filename);

        // Ensure directory exists
        if (!file_exists(dirname($filePath))) {
            mkdir(dirname($filePath), 0755, true);
        }

        $file = fopen($filePath, 'w');
        
        // Add headers
        fputcsv($file, ['EIR No.', 'Date', 'Time', 'Container No.', 'Size/Type', 'Status', 'Vessel', 'Voyage', 'Class', 'Date Manufactured', 'Ex-Consignee', 'Hauler', 'Plate No.', 'Load', 'Origin', 'Chasis']);
        
        // Add data
        foreach ($data as $row) {
            fputcsv($file, (array) $row);
        }
        
        fclose($file);

        return response()->download($filePath)->deleteFileAfterSend(true);
    }

    /**
     * Export Outgoing Report to CSV
     */
    public function exportOutgoingReport(Request $request)
    {
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date',
            'client_id' => 'nullable|string',
        ]);

        $startDate = $request->start_date . ' 00:00:00';
        $endDate = $request->end_date . ' 23:59:59';
        $clientId = $request->client_id;

        $prefix = DB::getTablePrefix();
        $query = DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'clients` as c'), 'inv.client_id', '=', 'c.c_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st'), 'inv.size_type', '=', 'st.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs'), 'inv.container_status', '=', 'cs.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt'), 'inv.load_type', '=', 'lt.l_id')
            ->whereBetween('inv.approval_date', [$startDate, $endDate])
            ->where('inv.gate_status', 'OUT')
            ->select(
                DB::raw('inv.i_id as eir_no'),
                DB::raw('DATE(inv.approval_date) as date'),
                DB::raw('TIME(inv.approval_date) as time'),
                'inv.container_no',
                DB::raw('CONCAT(st.size, "/", st.type) as size_type'),
                'cs.status',
                'inv.vessel',
                'inv.voyage',
                'inv.shipper',
                'inv.hauler',
                'inv.booking',
                DB::raw('NULL as destination'),
                'inv.plate_no',
                'lt.type as load',
                'inv.chasis',
                'inv.seal_no'
            );

        if ($clientId && $clientId !== 'all' && $clientId !== '') {
            $query->where('inv.client_id', $clientId);
        }

        $data = $query->orderBy('inv.approval_date', 'desc')->get();

        $filename = 'outgoing_report_' . now()->format('Y-m-d_H-i-s') . '.csv';
        $filePath = storage_path('app/public/exports/' . $filename);

        if (!file_exists(dirname($filePath))) {
            mkdir(dirname($filePath), 0755, true);
        }

        $file = fopen($filePath, 'w');
        fputcsv($file, ['EIR No.', 'Date', 'Time', 'Container No.', 'Size/Type', 'Status', 'Vessel', 'Voyage', 'Shipper', 'Hauler', 'Booking', 'Destination', 'Plate No.', 'Load', 'Chasis', 'Seal No.']);
        
        foreach ($data as $row) {
            fputcsv($file, (array) $row);
        }
        
        fclose($file);

        return response()->download($filePath)->deleteFileAfterSend(true);
    }

    /**
     * Export DMR Report to CSV
     */
    public function exportDmrReport(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
            'client_id' => 'nullable|string',
        ]);

        $date = $request->date;
        $clientId = $request->client_id;

        $prefix = DB::getTablePrefix();
        $query = DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'clients` as c'), 'inv.client_id', '=', 'c.c_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st'), 'inv.size_type', '=', 'st.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs'), 'inv.container_status', '=', 'cs.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt'), 'inv.load_type', '=', 'lt.l_id')
            ->whereDate('inv.date_added', $date)
            ->select(
                'inv.container_no',
                DB::raw('CONCAT(st.size, "/", st.type) as size_type'),
                'cs.status',
                'lt.type as load',
                'c.client_name as client',
                DB::raw('DATE(inv.date_added) as date')
            );

        if ($clientId && $clientId !== 'all' && $clientId !== '') {
            $query->where('inv.client_id', $clientId);
        }

        $data = $query->orderBy('inv.date_added', 'desc')->get();

        $filename = 'dmr_report_' . now()->format('Y-m-d_H-i-s') . '.csv';
        $filePath = storage_path('app/public/exports/' . $filename);

        if (!file_exists(dirname($filePath))) {
            mkdir(dirname($filePath), 0755, true);
        }

        $file = fopen($filePath, 'w');
        fputcsv($file, ['Container No.', 'Size/Type', 'Status', 'Load', 'Client', 'Date']);
        
        foreach ($data as $row) {
            fputcsv($file, (array) $row);
        }
        
        fclose($file);

        return response()->download($filePath)->deleteFileAfterSend(true);
    }

    /**
     * Export DCR Report to CSV
     */
    public function exportDcrReport(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
        ]);

        $date = $request->date;

        $prefix = DB::getTablePrefix();
        $data = DB::table(DB::raw('`' . DB::getTablePrefix() . 'inventory` as inv'))
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_size_type` as st'), 'inv.size_type', '=', 'st.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'container_status` as cs'), 'inv.container_status', '=', 'cs.s_id')
            ->leftJoin(DB::raw('`' . DB::getTablePrefix() . 'load_type` as lt'), 'inv.load_type', '=', 'lt.l_id')
            ->whereDate('inv.date_added', $date)
            ->select(
                'inv.container_no',
                DB::raw('CONCAT(st.size, "/", st.type) as size_type'),
                'cs.status',
                'lt.type as load',
                DB::raw('DATE(inv.date_added) as date')
            )
            ->orderBy('inv.date_added', 'desc')
            ->get();

        $filename = 'dcr_report_' . now()->format('Y-m-d_H-i-s') . '.csv';
        $filePath = storage_path('app/public/exports/' . $filename);

        if (!file_exists(dirname($filePath))) {
            mkdir(dirname($filePath), 0755, true);
        }

        $file = fopen($filePath, 'w');
        fputcsv($file, ['Container No.', 'Size/Type', 'Status', 'Load', 'Date']);
        
        foreach ($data as $row) {
            fputcsv($file, (array) $row);
        }
        
        fclose($file);

        return response()->download($filePath)->deleteFileAfterSend(true);
    }
}



<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\Client;
use App\Models\StorageRate;
use App\Models\HandlingRate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class BillingController extends Controller
{
    /**
     * Generate billing records for date range
     * 
     * POST /api/billing/generate
     * Params: start (date), end (date)
     */
    public function generate(Request $request)
    {
        $request->validate([
            'start' => 'required|date',
            'end' => 'required|date|after_or_equal:start',
        ]);

        $startDate = $request->start;
        $endDate = $request->end;

        try {
            // Query inventory with self-join for OUT records
            // Legacy DB uses: inventory.out_id → inventory.i_id (self-join)
            $prefix = DB::getTablePrefix();
            $results = DB::select("
                SELECT 
                    i.i_id as inv_id,
                    i.container_no,
                    i.client_id,
                    c.client_code,
                    c.client_name,
                    CONCAT(COALESCE(st.size, 'N/A'), COALESCE(st.type, '')) as container_size,
                    DATE(i.date_added) as date_added,
                    DATE(o.date_added) as date_out,
                    i.gate_status,
                    st.size as size_only
                FROM {$prefix}inventory i
                LEFT JOIN {$prefix}inventory o ON o.i_id = i.out_id
                LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
                WHERE i.gate_status = 'IN'
                AND (
                    (DATE(i.date_added) BETWEEN ? AND ?)
                    OR (? > DATE(i.date_added) AND DATE(o.date_added) BETWEEN ? AND ?)
                    OR (? > DATE(i.date_added) AND DATE(o.date_added) > ?)
                    OR (DATE(o.date_added) IS NULL AND DATE(i.date_added) <= ?)
                )
                ORDER BY i.container_no ASC
                LIMIT 2000
            ", [$startDate, $endDate, $startDate, $startDate, $endDate, $startDate, $endDate, $startDate]);

            $billingData = [];
            $totalStorageCharges = 0;
            $totalHandlingCharges = 0;
            $totalCharges = 0;

            foreach ($results as $item) {
                // Calculate storage days
                $dateIn = Carbon::parse($item->date_added);
                
                // Use OUT date if exists, otherwise use end date for billing period
                if ($item->date_out) {
                    $outDate = Carbon::parse($item->date_out);
                    // Don't count days after billing period end
                    $dateOut = $outDate->lte(Carbon::parse($endDate)) ? $outDate : Carbon::parse($endDate);
                } else {
                    // Still IN - use end date
                    $dateOut = Carbon::parse($endDate);
                }
                
                // Don't count days before billing period start
                if ($dateIn->lt(Carbon::parse($startDate))) {
                    $dateIn = Carbon::parse($startDate);
                }
                
                // Inclusive counting: Add 1 day to include both IN and OUT dates
                $storageDays = $dateIn->diffInDays($dateOut) + 1;

                // Get storage rate based on size only
                $storageRate = $this->getStorageRateForItem($item->client_id, $item->size_only);
                
                // Apply free days if configured
                $freeDays = $storageRate['free_days'] ?? 0;
                $billableDays = max(0, $storageDays - $freeDays);
                
                // Calculate storage charges
                $storageCharges = $billableDays * $storageRate['rate'];

                // Handling charges: Count if container entered OR exited during billing period
                $handlingRate = $this->getHandlingRateForItem($item->client_id, $item->size_only);
                $handlingCount = 0;
                
                // Check if gate IN during period
                $gateInDate = Carbon::parse($item->date_added);
                if ($gateInDate->between(Carbon::parse($startDate), Carbon::parse($endDate))) {
                    $handlingCount++;
                }
                
                // Check if gate OUT during period
                if ($item->date_out) {
                    $gateOutDate = Carbon::parse($item->date_out);
                    if ($gateOutDate->between(Carbon::parse($startDate), Carbon::parse($endDate))) {
                        $handlingCount++;
                    }
                }
                
                $handlingCharges = $handlingCount * $handlingRate['rate'];

                // Calculate total
                $total = $storageCharges + $handlingCharges;

                $billingData[] = [
                    'inv_id' => $item->inv_id,
                    'hashed_id' => md5($item->inv_id),
                    'container_no' => $item->container_no,
                    'client_code' => $item->client_code ?? '',
                    'client_name' => $item->client_name ?? '',
                    'container_size' => $item->container_size,
                    'date_in' => $item->date_added,
                    'date_out' => $item->date_out ?? null,
                    'storage_days' => $storageDays,
                    'billable_days' => $billableDays,
                    'storage_rate' => $storageRate['rate'],
                    'storage_charges' => round($storageCharges, 2),
                    'handling_count' => $handlingCount,
                    'handling_rate' => $handlingRate['rate'],
                    'handling_charges' => round($handlingCharges, 2),
                    'total' => round($total, 2),
                ];

                $totalStorageCharges += $storageCharges;
                $totalHandlingCharges += $handlingCharges;
                $totalCharges += $total;
            }

            // Log audit
            Log::info('Billing generated', [
                'user' => auth()->user()->username ?? 'system',
                'start_date' => $startDate,
                'end_date' => $endDate,
                'count' => count($billingData),
            ]);

            return response()->json([
                'success' => true,
                'data' => $billingData,
                'summary' => [
                    'total_storage_charges' => round($totalStorageCharges, 2),
                    'total_handling_charges' => round($totalHandlingCharges, 2),
                    'total_charges' => round($totalCharges, 2),
                    'record_count' => count($billingData),
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to generate billing', [
                'error' => $e->getMessage(),
                'user' => auth()->user()->username ?? 'system',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to generate billing: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get billing list (already generated)
     * 
     * POST /api/billing/list
     * Params: start, end, client_id (optional)
     */
    public function getBillingList(Request $request)
    {
        $request->validate([
            'start' => 'required|date',
            'end' => 'required|date',
            'client_id' => 'nullable|string',
        ]);

        $startDate = $request->start;
        $endDate = $request->end;
        $clientId = $request->client_id;

        try {
            // Decode MD5 hashed client ID if provided
            $actualClientId = null;
            if ($clientId) {
                $clients = Client::all();
                foreach ($clients as $client) {
                    if (md5($client->c_id) === $clientId) {
                        $actualClientId = $client->c_id;
                        break;
                    }
                }
            }

            // Build query with self-join (inventory.out_id → inventory.i_id)
            $prefix = DB::getTablePrefix();
            $sql = "
                SELECT 
                    i.i_id as inv_id,
                    i.container_no,
                    i.client_id,
                    c.client_code,
                    c.client_name,
                    CONCAT(COALESCE(st.size, 'N/A'), COALESCE(st.type, '')) as container_size,
                    DATE(i.date_added) as date_added,
                    DATE(o.date_added) as date_out,
                    i.gate_status,
                    st.size as size_only
                FROM {$prefix}inventory i
                LEFT JOIN {$prefix}inventory o ON o.i_id = i.out_id
                LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
                WHERE i.gate_status = 'IN'
                AND (
                    (DATE(i.date_added) BETWEEN ? AND ?)
                    OR (? > DATE(i.date_added) AND DATE(o.date_added) BETWEEN ? AND ?)
                    OR (? > DATE(i.date_added) AND DATE(o.date_added) > ?)
                    OR (DATE(o.date_added) IS NULL AND DATE(i.date_added) <= ?)
                )
            ";

            $params = [$startDate, $endDate, $startDate, $startDate, $endDate, $startDate, $endDate, $startDate];

            // Add client filter if provided
            if ($actualClientId) {
                $sql .= " AND i.client_id = ?";
                $params[] = $actualClientId;
            }

            $sql .= " ORDER BY i.container_no ASC LIMIT 2000";

            $results = DB::select($sql, $params);

            $billingData = [];

            foreach ($results as $item) {
                $dateIn = Carbon::parse($item->date_added);
                
                // Use OUT date if exists, otherwise use end date for billing period
                if ($item->date_out) {
                    $outDate = Carbon::parse($item->date_out);
                    $dateOut = $outDate->lte(Carbon::parse($endDate)) ? $outDate : Carbon::parse($endDate);
                } else {
                    $dateOut = Carbon::parse($endDate);
                }
                
                // Don't count days before billing period start
                if ($dateIn->lt(Carbon::parse($startDate))) {
                    $dateIn = Carbon::parse($startDate);
                }
                
                $storageDays = $dateIn->diffInDays($dateOut) + 1;

                $storageRate = $this->getStorageRateForItem($item->client_id, $item->size_only);
                $freeDays = $storageRate['free_days'] ?? 0;
                $billableDays = max(0, $storageDays - $freeDays);
                $storageCharges = $billableDays * $storageRate['rate'];

                // Handling charges: Count if container entered OR exited during billing period
                $handlingRate = $this->getHandlingRateForItem($item->client_id, $item->size_only);
                $handlingCount = 0;
                
                // Check if gate IN during period
                $gateInDate = Carbon::parse($item->date_added);
                if ($gateInDate->between(Carbon::parse($startDate), Carbon::parse($endDate))) {
                    $handlingCount++;
                }
                
                // Check if gate OUT during period
                if ($item->date_out) {
                    $gateOutDate = Carbon::parse($item->date_out);
                    if ($gateOutDate->between(Carbon::parse($startDate), Carbon::parse($endDate))) {
                        $handlingCount++;
                    }
                }
                
                $handlingCharges = $handlingCount * $handlingRate['rate'];

                $total = $storageCharges + $handlingCharges;

                $billingData[] = [
                    'inv_id' => $item->inv_id,
                    'hashed_id' => md5($item->inv_id),
                    'container_no' => $item->container_no,
                    'client_code' => $item->client_code ?? '',
                    'client_name' => $item->client_name ?? '',
                    'container_size' => $item->container_size,
                    'date_in' => $item->date_added,
                    'date_out' => $item->date_out ?? null,
                    'storage_days' => $storageDays,
                    'storage_rate' => $storageRate['rate'],
                    'storage_charges' => round($storageCharges, 2),
                    'handling_count' => $handlingCount,
                    'handling_rate' => $handlingRate['rate'],
                    'handling_charges' => round($handlingCharges, 2),
                    'total' => round($total, 2),
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $billingData,
                'total' => count($billingData),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get billing list: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Export billing to Excel
     * 
     * POST /api/billing/export
     * Params: start, end, client_id (optional)
     */
    public function exportToExcel(Request $request)
    {
        $request->validate([
            'start' => 'required|date',
            'end' => 'required|date',
            'client_id' => 'nullable|string',
        ]);

        // Note: This would use Laravel Excel package
        // For now, return the data that would be exported
        $response = $this->getBillingList($request);
        $data = json_decode($response->content(), true);

        if ($data['success']) {
            // Log export
            Log::info('Billing exported to Excel', [
                'user' => auth()->user()->username ?? 'system',
                'start_date' => $request->start,
                'end_date' => $request->end,
                'count' => count($data['data']),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Excel export data prepared',
                'data' => $data['data'],
                'filename' => 'Billing_Report_' . $request->start . '_to_' . $request->end . '.xlsx',
            ]);
        }

        return $response;
    }

    /**
     * Get client list for dropdown
     * 
     * GET /api/billing/clients
     */
    public function getClientList()
    {
        try {
            $clients = Client::where('archived', 0)
                ->orderBy('client_name')
                ->get()
                ->map(function ($client) {
                    return [
                        'id' => md5($client->c_id),
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

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get client list: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get storage rate for client and size
     * 
     * GET /api/billing/storage-rate/{clientId}/{size}
     */
    public function getStorageRate($clientHashedId, $size)
    {
        try {
            // Decode hashed client ID
            $clients = Client::all();
            $clientId = null;
            foreach ($clients as $client) {
                if (md5($client->c_id) === $clientHashedId) {
                    $clientId = $client->c_id;
                    break;
                }
            }

            if (!$clientId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Client not found',
                ], 404);
            }

            $rateData = $this->getStorageRateForItem($clientId, $size);

            return response()->json([
                'success' => true,
                'data' => $rateData,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get storage rate: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get handling rate for client and size
     * 
     * GET /api/billing/handling-rate/{clientId}/{size}
     */
    public function getHandlingRate($clientHashedId, $size)
    {
        try {
            // Decode hashed client ID
            $clients = Client::all();
            $clientId = null;
            foreach ($clients as $client) {
                if (md5($client->c_id) === $clientHashedId) {
                    $clientId = $client->c_id;
                    break;
                }
            }

            if (!$clientId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Client not found',
                ], 404);
            }

            $rateData = $this->getHandlingRateForItem($clientId, $size);

            return response()->json([
                'success' => true,
                'data' => $rateData,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get handling rate: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update handling count for container
     * 
     * PUT /api/billing/handling-count/{id}
     * Params: count
     */
    public function updateHandlingCount(Request $request, $hashedId)
    {
        $request->validate([
            'count' => 'required|integer|min:0',
        ]);

        try {
            // Decode hashed ID
            $inventory = DB::table('inventory')->get();
            $item = null;
            foreach ($inventory as $inv) {
                if (md5($inv->i_id) === $hashedId) {
                    $item = $inv;
                    break;
                }
            }

            if (!$item) {
                return response()->json([
                    'success' => false,
                    'message' => 'Inventory item not found',
                ], 404);
            }

            $oldCount = $item->handling_count;
            
            DB::table('inventory')
                ->where('i_id', $item->i_id)
                ->update(['handling_count' => $request->count]);

            // Log audit
            Log::info('Handling count updated', [
                'user' => auth()->user()->username ?? 'system',
                'container_no' => $item->container_no,
                'old_count' => $oldCount,
                'new_count' => $request->count,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Handling count updated successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update handling count: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete billing record (admin only)
     * 
     * DELETE /api/billing/{id}
     */
    public function destroy($hashedId)
    {
        // Note: Billing is calculated from inventory, not stored separately
        // This would be for future if billing records are stored
        
        return response()->json([
            'success' => false,
            'message' => 'Billing records are generated from inventory and cannot be deleted directly',
        ], 400);
    }

    /**
     * Helper: Get storage rate for client and size
     */
    private function getStorageRateForItem($clientId, $size)
    {
        // Try to get client-specific rate (match by size only, not size+type)
        $rate = StorageRate::where('client_id', $clientId)
            ->where('size', $size)
            ->first();

        if ($rate) {
            return [
                'rate' => (float) $rate->rate,
                'free_days' => $rate->free_days ?? 0,
            ];
        }

        // Get default rate (client_id = 0 or NULL)
        $defaultRate = StorageRate::whereNull('client_id')
            ->orWhere('client_id', 0)
            ->where('size', $size)
            ->first();

        if ($defaultRate) {
            return [
                'rate' => (float) $defaultRate->rate,
                'free_days' => $defaultRate->free_days ?? 0,
            ];
        }

        // Return zero if no rate found
        return [
            'rate' => 0.00,
            'free_days' => 0,
        ];
    }

    /**
     * Helper: Get handling rate for client and size
     */
    private function getHandlingRateForItem($clientId, $size)
    {
        // Try to get client-specific rate (match by size only, not size+type)
        $rate = HandlingRate::where('client_id', $clientId)
            ->where('size', $size)
            ->first();

        if ($rate) {
            return [
                'rate' => (float) $rate->rate,
            ];
        }

        // Get default rate (client_id = 0 or NULL)
        $defaultRate = HandlingRate::whereNull('client_id')
            ->orWhere('client_id', 0)
            ->where('size', $size)
            ->first();

        if ($defaultRate) {
            return [
                'rate' => (float) $defaultRate->rate,
            ];
        }

        // Return zero if no rate found
        return [
            'rate' => 0.00,
        ];
    }
}



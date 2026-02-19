<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class InventoryController extends Controller
{
    public function getList(Request $request)
    {
        try {
            Log::info('InventoryController::getList called', ['request' => $request->all()]);

            $search = $request->search;
            $status = $request->status;
            $clientId = $request->client_id;
            $start = (int) ($request->start ?? 0);
            $length = (int) ($request->length ?? 50);

            $prefix = DB::getTablePrefix();
            $safeInDate = $this->sanitizeDateExpression('i.date_added');
            $safeOutDate = $this->sanitizeDateExpression('o.date_added');

            $query = "
                SELECT 
                    i.i_id,
                    i.container_no,
                    i.client_id,
                    c.client_code,
                    c.client_name,
                    st.size,
                    st.type,
                    st.description as type_desc,
                    i.class,
                    i.booking,
                    i.shipper,
                    i.vessel,
                    i.voyage,
                    i.location,
                    CASE WHEN {$safeInDate} IS NOT NULL THEN DATE({$safeInDate}) ELSE NULL END as date_in,
                    CASE WHEN {$safeInDate} IS NOT NULL THEN TIME({$safeInDate}) ELSE NULL END as time_in,
                    i.gate_status,
                    i.complete,
                    i.out_id,
                    i.remarks,
                    i.plate_no,
                    i.hauler,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM {$prefix}hold_containers h WHERE h.container_no = i.container_no) THEN 1
                        ELSE 0 
                    END as is_hold,
                    {$safeOutDate} as date_out_full,
                    CASE WHEN {$safeOutDate} IS NOT NULL THEN DATE({$safeOutDate}) ELSE NULL END as date_out,
                    CASE WHEN {$safeOutDate} IS NOT NULL THEN TIME({$safeOutDate}) ELSE NULL END as time_out
                FROM {$prefix}inventory i
                LEFT JOIN {$prefix}inventory o ON o.i_id = i.out_id
                LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
                WHERE 1=1
            ";

            $params = [];

            if (!empty($search)) {
                $query .= " AND i.container_no LIKE :search";
                $params[':search'] = "%{$search}%";
            }

            if (!empty($status)) {
                $query .= " AND i.gate_status = :status";
                $params[':status'] = $status;
            }

            if (!empty($clientId)) {
                $query .= " AND i.client_id = :client_id";
                $params[':client_id'] = $clientId;
            }

            $countQuery = preg_replace('/SELECT\s+.*?\s+FROM/is', 'SELECT COUNT(DISTINCT i.i_id) as total FROM', $query);

            try {
                $total = DB::select($countQuery, $params)[0]->total ?? 0;
            } catch (\Exception $countException) {
                Log::error('Inventory count query failed', ['error' => $countException->getMessage()]);
                $total = 0;
            }

            $query .= " ORDER BY i.i_id DESC LIMIT {$start}, {$length}";

            $results = DB::select($query, $params);

            $data = [];
            foreach ($results as $item) {
                $daysInYard = 0;
                if ($item->date_out_full && !empty($item->date_in) && !empty($item->date_out)) {
                    $dateIn = Carbon::parse($item->date_in);
                    $dateOut = Carbon::parse($item->date_out);
                    $daysInYard = $dateIn->diffInDays($dateOut) + 1;
                } elseif ($item->gate_status === 'IN' && !empty($item->date_in)) {
                    $dateIn = Carbon::parse($item->date_in);
                    $daysInYard = $dateIn->diffInDays(Carbon::now()) + 1;
                }

                $data[] = [
                    'i_id' => $item->i_id,
                    'hashed_id' => md5($item->i_id),
                    'container_no' => $item->container_no,
                    'client_code' => $item->client_code,
                    'client_name' => $item->client_name,
                    'size' => $item->size,
                    'type' => $item->type,
                    'type_desc' => $item->type_desc,
                    'container_size' => $item->size . $item->type,
                    'condition' => $item->class,
                    'booking' => $item->booking,
                    'shipper' => $item->shipper,
                    'vessel' => $item->vessel,
                    'voyage' => $item->voyage,
                    'location' => $item->location,
                    'date_in' => $item->date_in,
                    'time_in' => $item->time_in,
                    'date_out' => $item->date_out,
                    'time_out' => $item->time_out,
                    'gate_status' => $item->gate_status,
                    'status_badge' => $this->getStatusBadge($item),
                    'is_hold' => (bool) $item->is_hold,
                    'days_in_yard' => $daysInYard,
                    'remarks' => $item->remarks,
                    'plate_no' => $item->plate_no,
                    'hauler' => $item->hauler,
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $data,
                'total' => $total,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get inventory list: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function getStatusBadge($item)
    {
        if ($item->complete == 1) {
            return ['text' => 'COMPLETE', 'color' => 'green'];
        }
        if ($item->gate_status === 'IN') {
            return ['text' => 'IN', 'color' => 'blue'];
        }
        if ($item->gate_status === 'OUT') {
            return ['text' => 'OUT', 'color' => 'orange'];
        }
        return ['text' => 'UNKNOWN', 'color' => 'gray'];
    }

    /**
     * Advanced search with multiple criteria
     * POST /api/inventory/search
     */
    public function advancedSearch(Request $request)
    {
        try {
            $prefix = DB::getTablePrefix();
            $safeInDate = $this->sanitizeDateExpression('i.date_added');
            $safeOutDate = $this->sanitizeDateExpression('o.date_added');
            
            $query = "
                SELECT 
                    i.i_id,
                    i.container_no,
                    i.client_id,
                    c.client_code,
                    c.client_name,
                    st.size,
                    st.type,
                    st.description as type_desc,
                    i.class,
                    i.booking,
                    i.shipper,
                    i.vessel,
                    i.voyage,
                    i.origin,
                    i.ex_consignee,
                    i.location,
                    i.plate_no,
                    i.hauler,
                    i.seal_no,
                    i.iso_code,
                    CASE WHEN {$safeInDate} IS NOT NULL THEN DATE({$safeInDate}) ELSE NULL END as date_in,
                    CASE WHEN {$safeInDate} IS NOT NULL THEN TIME({$safeInDate}) ELSE NULL END as time_in,
                    i.complete,
                    i.out_id,
                    i.gate_status,
                    i.remarks,
                    i.approval_notes as app_notes,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM {$prefix}hold_containers h WHERE h.container_no = i.container_no) 
                        THEN 1 ELSE 0 
                    END as is_hold,
                    {$safeOutDate} as date_out_full,
                    CASE WHEN {$safeOutDate} IS NOT NULL THEN DATE({$safeOutDate}) ELSE NULL END as date_out,
                    CASE WHEN {$safeOutDate} IS NOT NULL THEN TIME({$safeOutDate}) ELSE NULL END as time_out
                FROM {$prefix}inventory i
                LEFT JOIN {$prefix}inventory o ON o.i_id = i.out_id
                LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
                WHERE 1=1
            ";

            $params = [];

            // Handle gate status filter (default to Real Time Inventory)
            $gateStatusFilter = $request->input('gate_status', 'CURRENTLY');
            
            if ($gateStatusFilter === 'CURRENTLY') {
                // Real Time Inventory - only IN, not complete, and no out_id (matches legacy system)
                $query .= " AND i.gate_status = 'IN' AND i.complete = 0 AND (i.out_id IS NULL OR i.out_id = 0)";
            } elseif ($gateStatusFilter === 'IN') {
                // All IN containers
                $query .= " AND i.gate_status = 'IN'";
            } elseif ($gateStatusFilter === 'OUT') {
                // All OUT containers
                $query .= " AND i.gate_status = 'OUT'";
            } elseif ($gateStatusFilter === 'BOTH') {
                // Both IN and OUT - no additional filter needed
            }

            // Apply all search filters
            if ($request->container_no) {
                $query .= " AND i.container_no LIKE :container_no";
                $params[':container_no'] = "%{$request->container_no}%";
            }

            if ($request->client_id) {
                $query .= " AND i.client_id = :client_id";
                $params[':client_id'] = $request->client_id;
            }

            if ($request->size) {
                $query .= " AND st.size = :size";
                $params[':size'] = $request->size;
            }

            if ($request->type) {
                $query .= " AND st.type = :type";
                $params[':type'] = $request->type;
            }

            if ($request->condition) {
                $query .= " AND i.class = :condition";
                $params[':condition'] = $request->condition;
            }

            if ($request->booking) {
                $query .= " AND i.booking LIKE :booking";
                $params[':booking'] = "%{$request->booking}%";
            }

            if ($request->shipper) {
                $query .= " AND i.shipper LIKE :shipper";
                $params[':shipper'] = "%{$request->shipper}%";
            }

            if ($request->vessel) {
                $query .= " AND i.vessel LIKE :vessel";
                $params[':vessel'] = "%{$request->vessel}%";
            }

            if ($request->origin) {
                $query .= " AND i.origin LIKE :origin";
                $params[':origin'] = "%{$request->origin}%";
            }

            if ($request->hauler) {
                $query .= " AND i.hauler LIKE :hauler";
                $params[':hauler'] = "%{$request->hauler}%";
            }

            if ($request->plate_no) {
                $query .= " AND i.plate_no LIKE :plate_no";
                $params[':plate_no'] = "%{$request->plate_no}%";
            }

            if ($request->iso_code) {
                $query .= " AND i.iso_code LIKE :iso_code";
                $params[':iso_code'] = "%{$request->iso_code}%";
            }

            // Date range - Gate IN
            if ($request->date_in_from && $request->date_in_to) {
                $query .= " AND {$safeInDate} BETWEEN :date_in_from AND :date_in_to";
                $params[':date_in_from'] = $request->date_in_from;
                $params[':date_in_to'] = $request->date_in_to;
            }

            // Date range - Gate OUT
            if ($request->date_out_from && $request->date_out_to) {
                $query .= " AND {$safeOutDate} BETWEEN :date_out_from AND :date_out_to";
                $params[':date_out_from'] = $request->date_out_from;
                $params[':date_out_to'] = $request->date_out_to;
            }

            // Hold status filter
            if ($request->is_hold === 'yes') {
                $query .= " AND EXISTS (SELECT 1 FROM {$prefix}hold_containers h WHERE h.container_no = i.container_no)";
            } elseif ($request->is_hold === 'no') {
                $query .= " AND NOT EXISTS (SELECT 1 FROM {$prefix}hold_containers h WHERE h.container_no = i.container_no)";
            }

            $query .= " ORDER BY i.i_id DESC";

            $results = DB::select($query, $params);

            $data = [];
            $summaryByClient = [];
            $sizeTypeList = [];
            
            foreach ($results as $item) {
                $daysInYard = 0;
                if ($item->date_out_full && !empty($item->date_in) && !empty($item->date_out)) {
                    $dateIn = Carbon::parse($item->date_in);
                    $dateOut = Carbon::parse($item->date_out);
                    $daysInYard = $dateIn->diffInDays($dateOut) + 1;
                } elseif ($item->gate_status === 'IN' && !empty($item->date_in)) {
                    $dateIn = Carbon::parse($item->date_in);
                    $daysInYard = $dateIn->diffInDays(Carbon::now()) + 1;
                }

                $data[] = [
                    'i_id' => $item->i_id,
                    'hashed_id' => md5($item->i_id),
                    'container_no' => $item->container_no,
                    'client_code' => $item->client_code,
                    'client_name' => $item->client_name,
                    'size' => $item->size,
                    'type' => $item->type,
                    'type_desc' => $item->type_desc,
                    'container_size' => $item->size . $item->type,
                    'condition' => $item->class,
                    'booking' => $item->booking,
                    'shipper' => $item->shipper,
                    'vessel' => $item->vessel,
                    'voyage' => $item->voyage,
                    'origin' => $item->origin,
                    'ex_consignee' => $item->ex_consignee,
                    'location' => $item->location,
                    'plate_no' => $item->plate_no,
                    'hauler' => $item->hauler,
                    'seal_no' => $item->seal_no,
                    'iso_code' => $item->iso_code,
                    'date_in' => $item->date_in,
                    'time_in' => $item->time_in,
                    'date_out' => $item->date_out,
                    'time_out' => $item->time_out,
                    'gate_status' => $item->gate_status,
                    'status_badge' => $this->getStatusBadge($item),
                    'is_hold' => (bool) $item->is_hold,
                    'days_in_yard' => $daysInYard,
                    'remarks' => $item->remarks,
                    'app_notes' => $item->app_notes ?? '',
                ];
                
                // Build summary report data
                $clientDisplay = $item->client_code ?: $item->client_name;
                $sizeType = $item->size . $item->type;
                
                if (!empty($sizeType) && !empty($clientDisplay)) {
                    // Track unique size types
                    if (!in_array($sizeType, $sizeTypeList)) {
                        $sizeTypeList[] = $sizeType;
                    }
                    
                    // Initialize client entry if not exists
                    if (!isset($summaryByClient[$clientDisplay])) {
                        $summaryByClient[$clientDisplay] = [];
                    }
                    
                    // Initialize size type count if not exists
                    if (!isset($summaryByClient[$clientDisplay][$sizeType])) {
                        $summaryByClient[$clientDisplay][$sizeType] = 0;
                    }
                    
                    // Increment count
                    $summaryByClient[$clientDisplay][$sizeType]++;
                }
            }

            return response()->json([
                'success' => true,
                'data' => $data,
                'total' => count($data),
                'summary' => [
                    'by_client' => $summaryByClient,
                    'size_types' => $sizeTypeList,
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to search inventory: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get container details
     * GET /api/inventory/{hashedId}
     */
    public function getDetails($hashedId)
    {
        try {
            $prefix = DB::getTablePrefix();
            
            // Check if it's a numeric ID or hashed ID
            $isNumeric = is_numeric($hashedId);
            
            $inventory = DB::selectOne("
                SELECT 
                    i.*,
                    c.client_code,
                    c.client_name,
                    st.size,
                    st.type,
                    st.description as type_desc,
                    cs.status as container_status_name,
                    lt.type as load_type_name,
                    o.date_added as date_out_full,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM {$prefix}hold_containers h WHERE h.container_no = i.container_no) 
                        THEN 1 ELSE 0 
                    END as is_hold
                FROM {$prefix}inventory i
                LEFT JOIN {$prefix}inventory o ON o.i_id = i.out_id
                LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
                LEFT JOIN {$prefix}container_status cs ON cs.s_id = i.container_status
                LEFT JOIN {$prefix}load_type lt ON lt.l_id = i.load_type
                WHERE " . ($isNumeric ? "i.i_id = ?" : "MD5(i.i_id) = ?") . "
            ", [$hashedId]);

            if (!$inventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            // Calculate days in yard
            $daysInYard = 0;
            if ($inventory->date_out_full) {
                $dateIn = Carbon::parse($inventory->date_added);
                $dateOut = Carbon::parse($inventory->date_out_full);
                $daysInYard = $dateIn->diffInDays($dateOut) + 1;
            } elseif ($inventory->gate_status === 'IN') {
                $dateIn = Carbon::parse($inventory->date_added);
                $daysInYard = $dateIn->diffInDays(Carbon::now()) + 1;
            }

            // Get hold details if on hold
            $holdDetails = null;
            if ($inventory->is_hold) {
                $holdDetails = DB::selectOne("
                    SELECT notes, date_added 
                    FROM {$prefix}hold_containers 
                    WHERE container_no = ?
                    ORDER BY h_id DESC LIMIT 1
                ", [$inventory->container_no]);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'i_id' => $inventory->i_id,
                    'hashed_id' => md5($inventory->i_id),
                    'container_no' => $inventory->container_no,
                    'client_id' => $inventory->client_id,
                    'client_code' => $inventory->client_code,
                    'client_name' => $inventory->client_name,
                    'size' => $inventory->size,
                    'type' => $inventory->type,
                    'type_desc' => $inventory->type_desc,
                    'container_size' => $inventory->size . $inventory->type,
                    'size_type_id' => $inventory->size_type,
                    'container_status' => $inventory->container_status_name,
                    'container_status_id' => $inventory->container_status,
                    'condition' => $inventory->class,
                    'load_type' => $inventory->load_type_name,
                    'load_type_id' => $inventory->load_type,
                    'iso_code' => $inventory->iso_code,
                    'vessel' => $inventory->vessel,
                    'voyage' => $inventory->voyage,
                    'origin' => $inventory->origin,
                    'ex_consignee' => $inventory->ex_consignee,
                    'plate_no' => $inventory->plate_no,
                    'hauler' => $inventory->hauler,
                    'hauler_driver' => $inventory->hauler_driver,
                    'license_no' => $inventory->license_no,
                    'location' => $inventory->location,
                    'chasis' => $inventory->chasis,
                    'booking' => $inventory->booking,
                    'shipper' => $inventory->shipper,
                    'seal_no' => $inventory->seal_no,
                    'date_manufactured' => $inventory->date_manufactured,
                    'date_added' => $inventory->date_added,
                    'date_in' => Carbon::parse($inventory->date_added)->format('Y-m-d'),
                    'time_in' => Carbon::parse($inventory->date_added)->format('H:i:s'),
                    'date_out' => $inventory->date_out_full ? Carbon::parse($inventory->date_out_full)->format('Y-m-d') : null,
                    'time_out' => $inventory->date_out_full ? Carbon::parse($inventory->date_out_full)->format('H:i:s') : null,
                    'gate_status' => $inventory->gate_status,
                    'complete' => $inventory->complete,
                    'is_hold' => (bool) $inventory->is_hold,
                    'hold_details' => $holdDetails,
                    'days_in_yard' => $daysInYard,
                    'remarks' => $inventory->remarks,
                    'approval_notes' => $inventory->approval_notes,
                    'approval_date' => $inventory->approval_date,
                    'contact_no' => $inventory->contact_no,
                    'bill_of_lading' => $inventory->bill_of_lading,
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to get container details: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update inventory record
     * PUT /api/inventory/{hashedId}
     */
    public function update(Request $request, $hashedId)
    {
        try {
            $prefix = DB::getTablePrefix();
            
            // Get full old record for change tracking
            $oldInventory = DB::selectOne("SELECT * FROM {$prefix}inventory WHERE MD5(i_id) = ?", [$hashedId]);
            
            if (!$oldInventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            // Build update dynamically and track changes
            $updateFields = [];
            $params = [];
            $changes = [];

            $allowedFields = [
                'container_no', 'client_id', 'size_type', 'container_status', 'class',
                'booking', 'shipper', 'vessel', 'voyage', 'location', 'remarks',
                'plate_no', 'hauler', 'gate_status', 'origin', 'ex_consignee',
                'iso_code', 'hauler_driver', 'license_no', 'chasis', 'seal_no',
                'date_manufactured', 'approval_notes', 'contact_no', 'bill_of_lading'
            ];

            foreach ($allowedFields as $field) {
                if ($request->has($field)) {
                    $newValue = $request->input($field);
                    $oldValue = $oldInventory->$field ?? null;
                    
                    if ($oldValue != $newValue) {
                        $updateFields[] = "{$field} = :{$field}";
                        $params[":{$field}"] = $newValue;
                        $changes[] = str_replace('_', ' ', $field) . ' from "' . ($oldValue ?? 'empty') . '" to "' . ($newValue ?? 'empty') . '"';
                    }
                }
            }

            if (count($updateFields) === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'No fields to update',
                ], 422);
            }

            $params[':i_id'] = $oldInventory->i_id;

            $sql = "UPDATE {$prefix}inventory SET " . implode(', ', $updateFields) . " WHERE i_id = :i_id";
            
            DB::update($sql, $params);

            // Log audit - EDIT action with detailed changes
            if (count($changes) > 0) {
                $description = '[INVENTORY] Updated container "' . $oldInventory->container_no . '": ' . implode(', ', $changes);
                
                DB::table('audit_logs')->insert([
                    'action' => 'EDIT',
                    'description' => $description,
                    'user_id' => auth()->user()->user_id ?? null,
                    'date_added' => now(),
                    'ip_address' => $request->ip(),
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Container updated successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update container: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete inventory record
     * DELETE /api/inventory/{hashedId}
     */
    public function delete($hashedId)
    {
        try {
            $prefix = DB::getTablePrefix();
            
            // Check if it's a numeric ID or hashed ID
            $isNumeric = is_numeric($hashedId);
            
            $inventory = DB::selectOne(
                "SELECT * FROM {$prefix}inventory WHERE " . ($isNumeric ? "i_id = ?" : "MD5(i_id) = ?"),
                [$hashedId]
            );
            
            if (!$inventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            DB::delete("DELETE FROM {$prefix}inventory WHERE i_id = ?", [$inventory->i_id]);

            // Log audit - DELETE action
            DB::table('audit_logs')->insert([
                'action' => 'DELETE',
                'description' => '[INVENTORY] Deleted container "' . $inventory->container_no . '" (ID: ' . $inventory->i_id . ')',
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => request()->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Container deleted successfully',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete container: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete inventory record by ID
     * DELETE /api/inventory/{id}
     */
    public function deleteById($id)
    {
        try {
            $prefix = DB::getTablePrefix();
            
            $inventory = DB::selectOne("SELECT * FROM {$prefix}inventory WHERE i_id = ?", [$id]);
            
            if (!$inventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            DB::delete("DELETE FROM {$prefix}inventory WHERE i_id = ?", [$id]);

            // Log audit - DELETE action
            DB::table('audit_logs')->insert([
                'action' => 'DELETE',
                'description' => '[INVENTORY] Deleted container "' . $inventory->container_no . '" (ID: ' . $id . ')',
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => request()->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Container deleted successfully',
            ]);

        } catch (\Exception $e) {
            Log::error('Delete inventory failed', [
                'error' => $e->getMessage(),
                'id' => $id,
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete container: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Hold container
     * POST /api/inventory/{id}/hold
     */
    public function holdContainer(Request $request, $id)
    {
        try {
            $request->validate([
                'notes' => 'required|string',
            ]);

            $prefix = DB::getTablePrefix();
            
            $inventory = DB::selectOne(
                "SELECT i_id, container_no FROM {$prefix}inventory WHERE i_id = ? AND complete = 0",
                [$id]
            );
            
            if (!$inventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            $existingHold = DB::selectOne(
                "SELECT * FROM {$prefix}hold_containers WHERE container_no = ?",
                [$inventory->container_no]
            );
            
            if ($existingHold) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container is already on hold',
                ], 422);
            }

            DB::insert(
                "INSERT INTO {$prefix}hold_containers (container_no, notes, date_added) 
                VALUES (?, ?, NOW())",
                [$inventory->container_no, $request->notes]
            );

            // Log audit - EDIT action for placing on hold
            DB::table('audit_logs')->insert([
                'action' => 'EDIT',
                'description' => '[INVENTORY] Placed container "' . $inventory->container_no . '" on hold with notes: ' . $request->notes,
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Container placed on hold',
            ]);

        } catch (\Exception $e) {
            Log::error('Hold container failed', [
                'error' => $e->getMessage(),
                'id' => $id,
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to hold container: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Release container from hold
     * POST /api/inventory/{id}/unhold
     */
    public function unholdContainer($id)
    {
        try {
            $prefix = DB::getTablePrefix();
            
            $inventory = DB::selectOne(
                "SELECT i_id, container_no FROM {$prefix}inventory WHERE i_id = ? AND complete = 0",
                [$id]
            );
            
            if (!$inventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            DB::delete(
                "DELETE FROM {$prefix}hold_containers WHERE container_no = ?",
                [$inventory->container_no]
            );

            // Log audit - EDIT action for removing from hold
            DB::table('audit_logs')->insert([
                'action' => 'EDIT',
                'description' => '[INVENTORY] Removed container "' . $inventory->container_no . '" from hold',
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => request()->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Container released from hold',
            ]);

        } catch (\Exception $e) {
            Log::error('Unhold container failed', [
                'error' => $e->getMessage(),
                'id' => $id,
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to release container: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Toggle container status between Repo (8) and Available (1)
     * POST /api/inventory/{id}/toggle-repo
     */
    public function toggleRepoStatus($id)
    {
        try {
            $prefix = DB::getTablePrefix();
            
            $inventory = DB::selectOne(
                "SELECT i_id, container_no, container_status FROM {$prefix}inventory WHERE i_id = ? AND complete = 0",
                [$id]
            );
            
            if (!$inventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            // Toggle: if status is 8 (Repo), change to 1 (Available), otherwise change to 8 (Repo)
            $newStatus = ($inventory->container_status == 8) ? 1 : 8;
            $oldStatusText = ($inventory->container_status == 8) ? 'Repo' : 'Available';
            $newStatusText = ($newStatus == 8) ? 'Repo' : 'Available';

            DB::update(
                "UPDATE {$prefix}inventory SET container_status = ? WHERE i_id = ?",
                [$newStatus, $id]
            );

            // Log audit - EDIT action for status change
            DB::table('audit_logs')->insert([
                'action' => 'EDIT',
                'description' => '[INVENTORY] Updated container "' . $inventory->container_no . '" status from "' . $oldStatusText . '" to "' . $newStatusText . '"',
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => request()->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => "Container updated to {$newStatusText}",
            ]);

        } catch (\Exception $e) {
            Log::error('Toggle repo status failed', [
                'error' => $e->getMessage(),
                'id' => $id,
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update container status: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Export inventory to CSV
     * POST /api/inventory/export
     */
    public function exportToExcel(Request $request)
    {
        try {
            $prefix = DB::getTablePrefix();
            $safeInDate = $this->sanitizeDateExpression('i.date_added');
            $safeOutDate = $this->sanitizeDateExpression('o.date_added');
            
            $query = "
                SELECT 
                    i.container_no,
                    c.client_code,
                    c.client_name,
                    CONCAT(st.size, st.type) as container_size,
                    i.class as condition,
                    i.booking,
                    i.shipper,
                    i.vessel,
                    i.voyage,
                    CASE WHEN {$safeInDate} IS NOT NULL THEN DATE({$safeInDate}) ELSE NULL END as date_in,
                    CASE WHEN {$safeInDate} IS NOT NULL THEN TIME({$safeInDate}) ELSE NULL END as time_in,
                    CASE WHEN {$safeOutDate} IS NOT NULL THEN DATE({$safeOutDate}) ELSE NULL END as date_out,
                    CASE WHEN {$safeOutDate} IS NOT NULL THEN TIME({$safeOutDate}) ELSE NULL END as time_out,
                    i.location,
                    i.gate_status,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM {$prefix}hold_containers h WHERE h.container_no = i.container_no) 
                        THEN 'HOLD' ELSE '' 
                    END as hold_status,
                    i.remarks
                FROM {$prefix}inventory i
                LEFT JOIN {$prefix}inventory o ON o.i_id = i.out_id
                LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
                WHERE 1=1
            ";

            $params = [];

            if ($request->search) {
                $query .= " AND i.container_no LIKE :search";
                $params[':search'] = "%{$request->search}%";
            }

            if ($request->status) {
                $query .= " AND i.gate_status = :status";
                $params[':status'] = $request->status;
            }

            if ($request->client_id) {
                $query .= " AND i.client_id = :client_id";
                $params[':client_id'] = $request->client_id;
            }

            $query .= " ORDER BY i.i_id DESC LIMIT 5000";

            $results = DB::select($query, $params);

            $csv = "Container No,Client Code,Client Name,Size,Condition,Booking,Shipper,Vessel,Voyage,Date In,Time In,Date Out,Time Out,Location,Status,Hold,Remarks\n";
            
            foreach ($results as $row) {
                $csv .= implode(',', [
                    '"' . $row->container_no . '"',
                    '"' . ($row->client_code ?? '') . '"',
                    '"' . ($row->client_name ?? '') . '"',
                    '"' . ($row->container_size ?? '') . '"',
                    '"' . ($row->condition ?? '') . '"',
                    '"' . ($row->booking ?? '') . '"',
                    '"' . ($row->shipper ?? '') . '"',
                    '"' . ($row->vessel ?? '') . '"',
                    '"' . ($row->voyage ?? '') . '"',
                    '"' . $row->date_in . '"',
                    '"' . $row->time_in . '"',
                    '"' . ($row->date_out ?? '---') . '"',
                    '"' . ($row->time_out ?? '---') . '"',
                    '"' . ($row->location ?? '') . '"',
                    '"' . $row->gate_status . '"',
                    '"' . $row->hold_status . '"',
                    '"' . str_replace('"', '""', $row->remarks ?? '') . '"',
                ]) . "\n";
            }

            return response($csv, 200)
                ->header('Content-Type', 'text/csv')
                ->header('Content-Disposition', 'attachment; filename="inventory_export_' . date('Y-m-d_His') . '.csv"');

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to export: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get clients for dropdown
     * GET /api/inventory/clients
     */
    public function getClients()
    {
        try {
            $clients = DB::select("
                SELECT c_id, client_code, client_name 
                FROM " . DB::getTablePrefix() . "clients 
                WHERE archived = 0 
                ORDER BY client_name ASC
            ");

            return response()->json(['success' => true, 'data' => $clients]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get sizes for dropdown
     * GET /api/inventory/sizes
     */
    public function getSizes()
    {
        try {
            $sizes = DB::select("
                SELECT DISTINCT size 
                FROM " . DB::getTablePrefix() . "container_size_type 
                WHERE archived IS NULL OR archived = 0
                ORDER BY size ASC
            ");

            return response()->json(['success' => true, 'data' => $sizes]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get types for dropdown
     * GET /api/inventory/types
     */
    public function getTypes()
    {
        try {
            $types = DB::select("
                SELECT DISTINCT type, description 
                FROM " . DB::getTablePrefix() . "container_size_type 
                WHERE archived IS NULL OR archived = 0
                ORDER BY type ASC
            ");

            return response()->json(['success' => true, 'data' => $types]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get size/type combinations
     * GET /api/inventory/size-types
     */
    public function getSizeTypes()
    {
        try {
            $sizeTypes = DB::select("
                SELECT s_id, size, type, description 
                FROM " . DB::getTablePrefix() . "container_size_type 
                WHERE archived IS NULL OR archived = 0
                ORDER BY size ASC, type ASC
            ");

            return response()->json(['success' => true, 'data' => $sizeTypes]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get container statuses
     * GET /api/inventory/statuses
     */
    public function getStatuses()
    {
        try {
            $statuses = DB::select("
                SELECT s_id, status 
                FROM " . DB::getTablePrefix() . "container_status 
                ORDER BY status ASC
            ");

            return response()->json(['success' => true, 'data' => $statuses]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get load types
     * GET /api/inventory/load-types
     */
    public function getLoadTypes()
    {
        try {
            $loadTypes = DB::select("
                SELECT l_id, type 
                FROM " . DB::getTablePrefix() . "load_type 
                ORDER BY type ASC
            ");

            return response()->json(['success' => true, 'data' => $loadTypes]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get sizes and types for dropdown
     * GET /api/inventory/sizes-types
     */
    public function getSizesAndTypes()
    {
        try {
            $sizes = DB::select("
                SELECT DISTINCT size 
                FROM " . DB::getTablePrefix() . "container_size_type 
                WHERE size IS NOT NULL AND size != ''
                ORDER BY size ASC
            ");

            $types = DB::select("
                SELECT DISTINCT CONCAT(type, ' - ', description) as label, CONCAT(type, ' - ', description) as value
                FROM " . DB::getTablePrefix() . "container_size_type 
                WHERE type IS NOT NULL AND type != ''
                ORDER BY type ASC
            ");

            return response()->json([
                'success' => true,
                'sizes' => array_map(fn($s) => $s->size, $sizes),
                'types' => $types
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get container statuses list
     * GET /api/inventory/statuses
     */
    public function getStatusesList()
    {
        try {
            $statuses = DB::select("
                SELECT DISTINCT status 
                FROM " . DB::getTablePrefix() . "container_status 
                WHERE status IS NOT NULL AND status != ''
                ORDER BY status ASC
            ");

            return response()->json([
                'success' => true,
                'statuses' => array_map(fn($s) => $s->status, $statuses)
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Search inventory with all filters
     * POST /api/inventory/search
     */
    public function search(Request $request)
    {
        try {
            $filters = $request->all();
            $prefix = DB::getTablePrefix();

            $safeInDate = $this->sanitizeDateExpression('i.date_added');
            $safeManufacturedDate = $this->sanitizeDateExpression('i.date_manufactured', '%Y-%m-%d');
            
            $query = "SELECT 
                        CONCAT(i.i_id, CASE WHEN i.gate_status='IN' THEN 'I' ELSE 'O' END) as eir_no,
                        i.container_no,
                        c.client_name as client,
                        c.client_code as client_code,
                        CONCAT(st.size, st.type) as size,
                        i.gate_status as gate,
                        CASE 
                            WHEN {$safeInDate} IS NOT NULL THEN DATE({$safeInDate})
                            ELSE NULL 
                        END as date,
                        CASE 
                            WHEN {$safeInDate} IS NOT NULL THEN TIME({$safeInDate})
                            ELSE NULL 
                        END as time,
                        CASE 
                            WHEN {$safeInDate} IS NOT NULL THEN DATEDIFF(NOW(), {$safeInDate})
                            ELSE 0 
                        END as days,
                        cs.status,
                        i.class,
                        CASE 
                            WHEN {$safeManufacturedDate} IS NOT NULL THEN DATE({$safeManufacturedDate})
                            ELSE 'N/A' 
                        END as dmf,
                        i.location,
                        COALESCE(i.remarks, '') as eir_notes,
                        COALESCE(i.approval_notes, '') as app_notes,
                        i.i_id,
                        i.container_status as container_status_id,
                        CASE 
                            WHEN EXISTS (SELECT 1 FROM {$prefix}hold_containers h WHERE h.container_no = i.container_no) 
                            THEN 1 ELSE 0 
                        END as is_hold
                    FROM {$prefix}inventory i
                    LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                    LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
                    LEFT JOIN {$prefix}container_status cs ON cs.s_id = i.container_status
                    WHERE c.archived = 0";
            
            $params = [];
            
            // Handle gate status filter (default to CURRENTLY for Real Time Inventory)
            $gateStatus = $filters['gate_status'] ?? 'CURRENTLY';
            if ($gateStatus === 'CURRENTLY') {
                // Real Time Inventory - only IN, not complete, and no out_id (matches legacy system)
                $query .= " AND i.gate_status = 'IN' AND i.complete = 0 AND (i.out_id IS NULL OR i.out_id = 0)";
            } elseif ($gateStatus === 'IN') {
                $query .= " AND i.gate_status = 'IN'";
            } elseif ($gateStatus === 'OUT') {
                $query .= " AND i.gate_status = 'OUT'";
            }
            // For 'BOTH', no additional gate status filter
            
            // Client filter
            if (!empty($filters['client']) && $filters['client'] !== 'all') {
                $query .= " AND i.client_id = :client_id";
                $params[':client_id'] = $filters['client'];
            }
            
            // Container number filter
            if (!empty($filters['container_no'])) {
                $query .= " AND i.container_no LIKE :container_no";
                $params[':container_no'] = '%' . strtoupper($filters['container_no']) . '%';
            }
            
            // ISO Code filter
            if (!empty($filters['iso_code'])) {
                $query .= " AND LOWER(i.iso_code) LIKE :iso_code";
                $params[':iso_code'] = '%' . strtolower($filters['iso_code']) . '%';
            }
            
            // Date filters
            if (!empty($filters['date_in_from']) && !empty($filters['date_in_to'])) {
                $query .= " AND {$safeInDate} BETWEEN :date_in_from AND :date_in_to AND i.gate_status = 'IN'";
                $params[':date_in_from'] = $filters['date_in_from'];
                $params[':date_in_to'] = $filters['date_in_to'];
            }
            
            if (!empty($filters['date_out_from']) && !empty($filters['date_out_to'])) {
                $query .= " AND {$safeInDate} BETWEEN :date_out_from AND :date_out_to AND i.gate_status = 'OUT'";
                $params[':date_out_from'] = $filters['date_out_from'];
                $params[':date_out_to'] = $filters['date_out_to'];
            }
            
            // Text filters
            if (!empty($filters['checker'])) {
                $query .= " AND LOWER(i.origin) LIKE :checker";
                $params[':checker'] = '%' . strtolower($filters['checker']) . '%';
            }
            
            if (!empty($filters['consignee'])) {
                $query .= " AND LOWER(i.ex_consignee) LIKE :consignee";
                $params[':consignee'] = '%' . strtolower($filters['consignee']) . '%';
            }
            
            if (!empty($filters['hauler_in'])) {
                $query .= " AND LOWER(i.hauler) LIKE :hauler_in";
                $params[':hauler_in'] = '%' . strtoupper($filters['hauler_in']) . '%';
            }
            
            if (!empty($filters['vessel_in'])) {
                $query .= " AND LOWER(i.vessel) LIKE :vessel_in";
                $params[':vessel_in'] = '%' . strtoupper($filters['vessel_in']) . '%';
            }
            
            if (!empty($filters['plate_no_in'])) {
                $query .= " AND LOWER(i.plate_no) LIKE :plate_no_in";
                $params[':plate_no_in'] = '%' . strtoupper($filters['plate_no_in']) . '%';
            }
            
            if (!empty($filters['hauler_out'])) {
                $query .= " AND LOWER(i.hauler) LIKE :hauler_out";
                $params[':hauler_out'] = '%' . strtoupper($filters['hauler_out']) . '%';
            }
            
            if (!empty($filters['vessel_out'])) {
                $query .= " AND LOWER(i.vessel) LIKE :vessel_out";
                $params[':vessel_out'] = '%' . strtoupper($filters['vessel_out']) . '%';
            }
            
            if (!empty($filters['shipper'])) {
                $query .= " AND LOWER(i.shipper) LIKE :shipper";
                $params[':shipper'] = '%' . strtoupper($filters['shipper']) . '%';
            }
            
            if (!empty($filters['destination'])) {
                $query .= " AND LOWER(i.location) LIKE :destination";
                $params[':destination'] = '%' . strtoupper($filters['destination']) . '%';
            }
            
            if (!empty($filters['booking_number'])) {
                $query .= " AND LOWER(i.booking) LIKE :booking_number";
                $params[':booking_number'] = '%' . strtoupper($filters['booking_number']) . '%';
            }
            
            if (!empty($filters['seal_no'])) {
                $query .= " AND LOWER(i.seal_no) LIKE :seal_no";
                $params[':seal_no'] = '%' . strtoupper($filters['seal_no']) . '%';
            }
            
            if (!empty($filters['contact_no'])) {
                $query .= " AND LOWER(i.contact_no) LIKE :contact_no";
                $params[':contact_no'] = '%' . strtoupper($filters['contact_no']) . '%';
            }
            
            if (!empty($filters['bill_of_lading'])) {
                $query .= " AND LOWER(i.bill_of_lading) LIKE :bill_of_lading";
                $params[':bill_of_lading'] = '%' . strtoupper($filters['bill_of_lading']) . '%';
            }
            
            // Status filters
            if (!empty($filters['status_in']) && $filters['status_in'] !== 'all') {
                $query .= " AND LOWER(cs.status) LIKE :status_in";
                $params[':status_in'] = '%' . strtolower($filters['status_in']) . '%';
            }
            
            if (!empty($filters['status_out']) && $filters['status_out'] !== 'all') {
                $query .= " AND LOWER(cs.status) LIKE :status_out";
                $params[':status_out'] = '%' . strtolower($filters['status_out']) . '%';
            }
            
            // Size/Type filter (combined)
            if (!empty($filters['size_type']) && $filters['size_type'] !== 'all') {
                $query .= " AND CONCAT(st.size, st.type) = :size_type";
                $params[':size_type'] = $filters['size_type'];
            }
            
            $query .= " ORDER BY st.size ASC, {$safeInDate} DESC";
            
            $results = DB::select($query, $params);
            
            // Build summary report data
            $summaryByClient = [];
            $sizeTypeList = [];
            
            foreach ($results as $item) {
                $clientDisplay = $item->client_code ?: $item->client;
                $sizeType = $item->size;
                
                if (!empty($sizeType) && !empty($clientDisplay)) {
                    // Track unique size types
                    if (!in_array($sizeType, $sizeTypeList)) {
                        $sizeTypeList[] = $sizeType;
                    }
                    
                    // Initialize client entry if not exists
                    if (!isset($summaryByClient[$clientDisplay])) {
                        $summaryByClient[$clientDisplay] = [];
                    }
                    
                    // Initialize size type count if not exists
                    if (!isset($summaryByClient[$clientDisplay][$sizeType])) {
                        $summaryByClient[$clientDisplay][$sizeType] = 0;
                    }
                    
                    // Increment count
                    $summaryByClient[$clientDisplay][$sizeType]++;
                }
            }
            
            return response()->json([
                'success' => true,
                'data' => $results,
                'summary' => [
                    'by_client' => $summaryByClient,
                    'size_types' => $sizeTypeList,
                ],
            ]);
            
        } catch (\Exception $e) {
            Log::error('Inventory search error:', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Export inventory search results
     * POST /api/inventory/export
     */
    public function export(Request $request)
    {
        try {
            // Reuse the search logic
            $searchResponse = $this->search($request);
            $data = json_decode($searchResponse->getContent(), true);
            
            if (!$data['success']) {
                return response()->json(['success' => false, 'message' => 'Failed to export'], 500);
            }
            
            $filename = 'inventory_export_' . now()->format('Y-m-d_H-i-s') . '.csv';
            $filePath = storage_path('app/public/exports/' . $filename);
            
            if (!file_exists(dirname($filePath))) {
                mkdir(dirname($filePath), 0755, true);
            }
            
            $file = fopen($filePath, 'w');
            fputcsv($file, ['EIR No.', 'Container No.', 'Client', 'Size', 'Gate', 'Date', 'Time', 'Days', 'Status', 'Class', 'DMF', 'Location', 'EIR Notes', 'App Notes']);
            
            foreach ($data['data'] as $row) {
                fputcsv($file, (array) $row);
            }
            
            fclose($file);
            
            // Log audit - REPORTS action for exporting report
            DB::table('audit_logs')->insert([
                'action' => 'REPORTS',
                'description' => '[INVENTORY] Exported ' . count($data['data']) . ' inventory record(s) to CSV file: ' . $filename,
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);
            
            return response()->download($filePath)->deleteFileAfterSend(true);
            
        } catch (\Exception $e) {
            Log::error('Inventory export error:', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Approve container with notes
     * POST /api/inventory/{id}/approve
     */
    public function approveContainer(Request $request, $id)
    {
        try {
            $request->validate([
                'approval_notes' => 'required|string|max:300',
            ]);

            $prefix = DB::getTablePrefix();
            
            // Find the inventory record
            $inventory = DB::selectOne(
                "SELECT i_id, container_no, gate_status, complete FROM {$prefix}inventory WHERE i_id = ?",
                [$id]
            );
            
            if (!$inventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            // Check if container is IN and not complete
            if ($inventory->gate_status !== 'IN' || $inventory->complete == 1) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container cannot be approved',
                ], 422);
            }

            // Update approval notes and date, set container_status to 1 (Available)
            $dateApprove = date('Y-m-d H:i:s');
            DB::update(
                "UPDATE {$prefix}inventory 
                SET approval_notes = ?, approval_date = ?, container_status = 1
                WHERE i_id = ? AND complete = 0",
                [$request->approval_notes, $dateApprove, $id]
            );

            // Log audit - APPROVE action
            DB::table('audit_logs')->insert([
                'action' => 'APPROVE',
                'description' => '[INVENTORY] Approved container "' . $inventory->container_no . '" with notes: ' . $request->approval_notes,
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Container approved successfully',
            ]);

        } catch (\Exception $e) {
            Log::error('Container approval failed', [
                'error' => $e->getMessage(),
                'id' => $id,
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to approve container: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Build a reusable SQL expression that normalizes legacy zero-date placeholders.
     */
    private function sanitizeDateExpression(string $column, string $format = '%Y-%m-%d %H:%i:%s'): string
    {
        $trimmed = "NULLIF(TRIM({$column}), '')";
        $withoutFraction = "SUBSTRING_INDEX({$trimmed}, '.', 1)";
        $noZero = "NULLIF(NULLIF({$withoutFraction}, '0000-00-00'), '0000-00-00 00:00:00')";

        return "STR_TO_DATE({$noZero}, '{$format}')";
    }
}





<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class InventoryController extends Controller
{
    public function getList(Request $request)
    {
        try {
            // Debug logging
            Log::info('InventoryController::getList called');
            Log::info('Request data:', $request->all());
            
            $search = $request->search;
            $status = $request->status;
            $clientId = $request->client_id;
            $start = $request->start ?? 0;
            $length = $request->length ?? 50;

            $prefix = DB::getTablePrefix();
            Log::info('DB Prefix:', ['prefix' => $prefix]);
            
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
                    DATE(i.date_added) as date_in,
                    TIME(i.date_added) as time_in,
                    i.gate_status,
                    i.complete,
                    i.out_id,
                    i.remarks,
                    i.plate_no,
                    i.hauler,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM {$prefix}hold_containers h WHERE h.container_no = i.container_no) 
                        THEN 1 ELSE 0 
                    END as is_hold,
                    o.date_added as date_out_full,
                    DATE(o.date_added) as date_out,
                    TIME(o.date_added) as time_out
                FROM {$prefix}inventory i
                LEFT JOIN {$prefix}inventory o ON o.i_id = i.out_id
                LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
                WHERE 1=1
            ";

            $params = [];

            if ($search) {
                $query .= " AND i.container_no LIKE :search";
                $params[':search'] = "%{$search}%";
            }

            if ($status) {
                $query .= " AND i.gate_status = :status";
                $params[':status'] = $status;
            }

            if ($clientId) {
                $query .= " AND i.client_id = :client_id";
                $params[':client_id'] = $clientId;
            }

            // Count query - need to handle multiline SELECT properly
            $countQuery = preg_replace('/SELECT\s+.*?\s+FROM/is', 'SELECT COUNT(DISTINCT i.i_id) as total FROM', $query);
            Log::info('Count Query:', ['query' => $countQuery, 'params' => $params]);
            
            try {
                $total = DB::select($countQuery, $params)[0]->total ?? 0;
                Log::info('Total records:', ['total' => $total]);
            } catch (\Exception $e) {
                Log::error('Count query failed:', ['error' => $e->getMessage()]);
                $total = 0;
            }

            $query .= " ORDER BY i.i_id DESC LIMIT " . (int)$start . ", " . (int)$length;
            Log::info('Final Query:', ['query' => $query, 'params' => $params]);

            $results = DB::select($query, $params);
            Log::info('Results count:', ['count' => count($results)]);

            $data = [];
            foreach ($results as $item) {
                $daysInYard = 0;
                if ($item->date_out_full) {
                    $dateIn = Carbon::parse($item->date_in);
                    $dateOut = Carbon::parse($item->date_out);
                    $daysInYard = $dateIn->diffInDays($dateOut) + 1;
                } elseif ($item->gate_status === 'IN') {
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
                    DATE(i.date_added) as date_in,
                    TIME(i.date_added) as time_in,
                    i.gate_status,
                    i.complete,
                    i.out_id,
                    i.remarks,
                    CASE 
                        WHEN EXISTS (SELECT 1 FROM {$prefix}hold_containers h WHERE h.container_no = i.container_no) 
                        THEN 1 ELSE 0 
                    END as is_hold,
                    o.date_added as date_out_full,
                    DATE(o.date_added) as date_out,
                    TIME(o.date_added) as time_out
                FROM {$prefix}inventory i
                LEFT JOIN {$prefix}inventory o ON o.i_id = i.out_id
                LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
                WHERE 1=1
            ";

            $params = [];

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

            if ($request->gate_status) {
                $query .= " AND i.gate_status = :gate_status";
                $params[':gate_status'] = $request->gate_status;
            }

            // Date range - Gate IN
            if ($request->date_in_from && $request->date_in_to) {
                $query .= " AND DATE(i.date_added) BETWEEN :date_in_from AND :date_in_to";
                $params[':date_in_from'] = $request->date_in_from;
                $params[':date_in_to'] = $request->date_in_to;
            }

            // Date range - Gate OUT
            if ($request->date_out_from && $request->date_out_to) {
                $query .= " AND DATE(o.date_added) BETWEEN :date_out_from AND :date_out_to";
                $params[':date_out_from'] = $request->date_out_from;
                $params[':date_out_to'] = $request->date_out_to;
            }

            // Hold status filter
            if ($request->is_hold === 'yes') {
                $query .= " AND EXISTS (SELECT 1 FROM {$prefix}hold_containers h WHERE h.container_no = i.container_no)";
            } elseif ($request->is_hold === 'no') {
                $query .= " AND NOT EXISTS (SELECT 1 FROM {$prefix}hold_containers h WHERE h.container_no = i.container_no)";
            }

            $query .= " ORDER BY i.i_id DESC LIMIT 2000";

            $results = DB::select($query, $params);

            $data = [];
            foreach ($results as $item) {
                $daysInYard = 0;
                if ($item->date_out_full) {
                    $dateIn = Carbon::parse($item->date_in);
                    $dateOut = Carbon::parse($item->date_out);
                    $daysInYard = $dateIn->diffInDays($dateOut) + 1;
                } elseif ($item->gate_status === 'IN') {
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
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $data,
                'total' => count($data),
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
                WHERE MD5(i.i_id) = ?
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
                    'container_status' => $inventory->container_status_name,
                    'condition' => $inventory->class,
                    'load_type' => $inventory->load_type_name,
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
            
            $inventory = DB::selectOne("SELECT i_id, container_no FROM {$prefix}inventory WHERE MD5(i_id) = ?", [$hashedId]);
            
            if (!$inventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            // Build update dynamically
            $updateFields = [];
            $params = [];

            $allowedFields = [
                'container_no', 'client_id', 'size_type', 'container_status', 'class',
                'booking', 'shipper', 'vessel', 'voyage', 'location', 'remarks',
                'plate_no', 'hauler', 'gate_status', 'origin', 'ex_consignee',
                'iso_code', 'hauler_driver', 'license_no', 'chasis', 'seal_no',
                'date_manufactured', 'approval_notes', 'contact_no', 'bill_of_lading'
            ];

            foreach ($allowedFields as $field) {
                if ($request->has($field)) {
                    $updateFields[] = "{$field} = :{$field}";
                    $params[":{$field}"] = $request->input($field);
                }
            }

            if (count($updateFields) === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'No fields to update',
                ], 422);
            }

            $params[':i_id'] = $inventory->i_id;

            $sql = "UPDATE {$prefix}inventory SET " . implode(', ', $updateFields) . " WHERE i_id = :i_id";
            
            DB::update($sql, $params);

            Log::info('Inventory updated', [
                'i_id' => $inventory->i_id,
                'container_no' => $inventory->container_no,
            ]);

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
            
            $inventory = DB::selectOne("SELECT * FROM {$prefix}inventory WHERE MD5(i_id) = ?", [$hashedId]);
            
            if (!$inventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            DB::delete("DELETE FROM {$prefix}inventory WHERE i_id = ?", [$inventory->i_id]);

            Log::info('Inventory deleted', [
                'i_id' => $inventory->i_id,
                'container_no' => $inventory->container_no,
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
     * Hold container
     * POST /api/inventory/{hashedId}/hold
     */
    public function holdContainer(Request $request, $hashedId)
    {
        try {
            $prefix = DB::getTablePrefix();
            
            $inventory = DB::selectOne("SELECT * FROM {$prefix}inventory WHERE MD5(i_id) = ?", [$hashedId]);
            
            if (!$inventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            $existingHold = DB::selectOne("SELECT * FROM {$prefix}hold_containers WHERE container_no = ?", [$inventory->container_no]);
            
            if ($existingHold) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container is already on hold',
                ], 422);
            }

            DB::insert("
                INSERT INTO {$prefix}hold_containers (container_no, notes, date_added) 
                VALUES (?, ?, NOW())
            ", [$inventory->container_no, $request->notes ?? 'Placed on hold']);

            Log::info('Container placed on hold', ['container_no' => $inventory->container_no]);

            return response()->json([
                'success' => true,
                'message' => 'Container placed on hold',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to hold container: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Release container from hold
     * POST /api/inventory/{hashedId}/unhold
     */
    public function unholdContainer($hashedId)
    {
        try {
            $prefix = DB::getTablePrefix();
            
            $inventory = DB::selectOne("SELECT * FROM {$prefix}inventory WHERE MD5(i_id) = ?", [$hashedId]);
            
            if (!$inventory) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found',
                ], 404);
            }

            DB::delete("DELETE FROM {$prefix}hold_containers WHERE container_no = ?", [$inventory->container_no]);

            Log::info('Container released from hold', ['container_no' => $inventory->container_no]);

            return response()->json([
                'success' => true,
                'message' => 'Container released from hold',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to release container: ' . $e->getMessage(),
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
                    DATE(i.date_added) as date_in,
                    TIME(i.date_added) as time_in,
                    DATE(o.date_added) as date_out,
                    TIME(o.date_added) as time_out,
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
}



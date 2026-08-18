<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Mobile Inventory Controller
 * Lightweight mobile endpoints for inventory search (no Sanctum)
 */
class MobileInventoryController extends Controller
{
    private $prefix;

    public function __construct()
    {
        $this->prefix = env('DB_PREFIX', 'fjp_');
    }

    /**
     * GET /mobile/inventory/search
     * Query params: username, search, gate_status (optional, defaults to CURRENTLY)
     */
    public function search(Request $request)
    {
        try {
            $search = $request->input('search', '');
            $gateStatus = $request->input('gate_status', 'CURRENTLY');


            // Use configured DB prefix (align with main controllers)
            $prefix = DB::getTablePrefix() ?: $this->prefix;

            // Base filter: exclude archived clients
            $where = "c.archived = 0";

            if ($gateStatus === 'CURRENTLY') {
                $where .= " AND i.gate_status = 'IN' AND i.complete = 0 AND (i.out_id IS NULL OR i.out_id = 0)";
            } elseif ($gateStatus === 'IN') {
                $where .= " AND i.gate_status = 'IN'";
            } elseif ($gateStatus === 'OUT') {
                $where .= " AND i.gate_status = 'OUT'";
            }

            $params = [];
            if (!empty($search)) {
                $where .= " AND i.container_no LIKE ?";
                $params[] = '%' . $search . '%';
            }

            // Select columns that exist in the main InventoryController::search to avoid unknown column errors
            $sql = "
                SELECT
                    CONCAT(i.i_id, CASE WHEN i.gate_status='IN' THEN 'I' ELSE 'O' END) as eir_no,
                    i.i_id,
                    MD5(i.i_id) as hashed_id,
                    i.container_no,
                    COALESCE(c.client_name, c.client_code, '-') as client_name,
                    CONCAT(IFNULL(st.size, ''), IFNULL(st.type, '')) as size_type,
                    i.iso_code,
                    i.class,
                    COALESCE(cs.status, '') as container_status,
                    COALESCE(i.approval_notes, '') as approval_notes,
                    COALESCE(i.remarks, '') as remarks,
                    (
                        SELECT pi.remarks FROM {$prefix}pre_inventory pi
                        WHERE pi.container_no = i.container_no AND pi.gate_status = 'IN'
                        ORDER BY pi.date_added DESC LIMIT 1
                    ) as gate_in_remarks
                FROM {$prefix}inventory i
                LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
                LEFT JOIN {$prefix}container_status cs ON cs.s_id = i.container_status
                WHERE {$where}
                ORDER BY i.i_id DESC
                LIMIT 200
            ";

            $results = DB::select($sql, $params);

            return response()->json([
                'success' => true,
                'data' => $results,
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile inventory search error', ['error' => $e->getMessage(), 'request' => $request->all()]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to search inventory: ' . $e->getMessage(),
            ], 500);
        }
    }
}

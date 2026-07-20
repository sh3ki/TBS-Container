<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Mobile Gate In & Out Controller
 * Separate from the main GateinoutController - uses simple mobile auth (no Sanctum required)
 * Mirrors functionality but works with plain text login system
 */
class MobileGateinoutController extends Controller
{
    private $prefix;

    public function __construct()
    {
        $this->prefix = env('DB_PREFIX', 'fjp_');
    }

    /**
     * Get Pre-Inventory List (pending records only)
     * Used by mobile for displaying containers to gate in/out
     */
    public function getPreInventoryList(Request $request)
    {
        try {
            // Get username from request for validation (optional but good for logging)
            $username = $request->input('username', 'mobile-user');

            $prefix = $this->prefix;
            
            $results = DB::select("
                SELECT
                    p.p_id,
                    COALESCE(c.client_name, '-') AS client_name,
                    COALESCE(c.client_code, '-') AS client_code,
                    COALESCE(NULLIF(p.hauler, ''), '-') AS hauler,
                    COALESCE(NULLIF(p.container_no, ''), '-') AS container_no,
                    COALESCE(NULLIF(p.plate_no, ''), '-') AS plate_no,
                    p.gate_status,
                    CASE WHEN p.status = 0 THEN 'pending' ELSE 'processed' END AS status,
                    p.date_added,
                    TIMESTAMPDIFF(MINUTE, p.date_added, COALESCE(p.date_completed, CONVERT_TZ(NOW(), @@session.time_zone, '+08:00'))) AS runtime,
                    p.client_id,
                    p.user_id
                FROM {$prefix}pre_inventory p
                LEFT JOIN {$prefix}clients c ON c.c_id = p.client_id
                WHERE p.status = 0
                ORDER BY p.date_added DESC
                LIMIT 1000
            ");
            
            // Add hashed_id and runtime_color
            foreach ($results as $result) {
                $result->hashed_id = md5($result->p_id);
                $runtime = (int)$result->runtime;
                $result->runtime_color = $runtime <= 30 ? 'green' : ($runtime <= 60 ? 'orange' : 'red');
            }
            
            return response()->json([
                'success' => true,
                'prelist' => $results,
                'records_count' => count($results)
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile gateinout list error', [
                'username' => $request->input('username', 'unknown'),
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch list: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check container for gate IN
     */
    public function checkContainerIn(Request $request)
    {
        try {
            $containerNo = strtoupper(trim($request->input('cno', '')));
            $clientId = $request->input('client');
            $username = $request->input('username', 'mobile-user');

            if (empty($containerNo) || strlen($containerNo) !== 11) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container number must be exactly 11 characters.'
                ], 400);
            }

            $prefix = $this->prefix;

            // Check for duplicates - container already in
            $exists = DB::selectOne("
                SELECT COUNT(*) as cnt FROM {$prefix}pre_inventory 
                WHERE container_no = ? AND gate_status = 'IN' AND status = 0
            ", [$containerNo]);

            if ($exists && $exists->cnt > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container already registered for gate IN.'
                ], 400);
            }

            // Check banned list
            $banned = DB::selectOne("
                SELECT * FROM {$prefix}banned_containers 
                WHERE container_no = ?
            ", [$containerNo]);

            if ($banned) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container is in the banned list.'
                ], 400);
            }

            // Insert pre-inventory record
            $user = DB::table('users')->where('username', $username)->first();
            $userId = $user ? $user->user_id : null;

            DB::table('pre_inventory')->insert([
                'container_no' => $containerNo,
                'client_id' => $clientId,
                'gate_status' => 'IN',
                'status' => 0,
                'date_added' => now(),
                'user_id' => $userId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Container successfully added for gate IN.'
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile checkContainerIn error', [
                'username' => $request->input('username', 'unknown'),
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error processing container: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check container for gate OUT
     */
    public function checkContainerOut(Request $request)
    {
        try {
            $plateNo = strtoupper(trim($request->input('pno', '')));
            $hauler = strtoupper(trim($request->input('hauler', '')));
            $username = $request->input('username', 'mobile-user');

            if (empty($plateNo) || empty($hauler)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Plate number and hauler are required.'
                ], 400);
            }

            $prefix = $this->prefix;

            // Check for duplicates - plate already out
            $exists = DB::selectOne("
                SELECT COUNT(*) as cnt FROM {$prefix}pre_inventory 
                WHERE plate_no = ? AND gate_status = 'OUT' AND status = 0
            ", [$plateNo]);

            if ($exists && $exists->cnt > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Plate number already registered for gate OUT.'
                ], 400);
            }

            // Insert pre-inventory record
            $user = DB::table('users')->where('username', $username)->first();
            $userId = $user ? $user->user_id : null;

            DB::table('pre_inventory')->insert([
                'plate_no' => $plateNo,
                'hauler' => $hauler,
                'gate_status' => 'OUT',
                'status' => 0,
                'date_added' => now(),
                'user_id' => $userId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Record successfully added for gate OUT.'
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile checkContainerOut error', [
                'username' => $request->input('username', 'unknown'),
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error processing record: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get Clients for dropdown
     */
    public function getClients(Request $request)
    {
        try {
            $prefix = $this->prefix;

            $clients = DB::select("
                SELECT c.c_id as id, c.client_name as name, c.client_code as code
                FROM {$prefix}clients c
                WHERE c.archived = 0
                ORDER BY c.client_name
            ");

            return response()->json([
                'success' => true,
                'data' => $clients
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile getClients error', [
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch clients'
            ], 500);
        }
    }

    /**
     * Get Status Options
     */
    public function getStatusOptions(Request $request)
    {
        try {
            $prefix = $this->prefix;

            $statuses = DB::select("
                SELECT s_id, status
                FROM {$prefix}container_status
                ORDER BY status ASC
            ");

            return response()->json([
                'success' => true,
                'data' => $statuses
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile getStatusOptions error', [
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch status options'
            ], 500);
        }
    }

    /**
     * Get Size Type Options
     */
    public function getSizeTypeOptions(Request $request)
    {
        try {
            $prefix = $this->prefix;

            $sizes = DB::select("
                SELECT s_id, size, type
                FROM {$prefix}container_size_type
                WHERE archived = 0
                ORDER BY size ASC, type ASC
            ");

            return response()->json([
                'success' => true,
                'data' => $sizes
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile getSizeTypeOptions error', [
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch size types'
            ], 500);
        }
    }

    /**
     * Get Load Options
     */
    public function getLoadOptions(Request $request)
    {
        try {
            $loads = [
                ['id' => 'Full', 'name' => 'Full'],
                ['id' => 'Empty', 'name' => 'Empty'],
            ];

            return response()->json([
                'success' => true,
                'data' => $loads
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile getLoadOptions error', [
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch load options'
            ], 500);
        }
    }

    /**
     * Search Available Containers for Gate OUT
     * Searches containers IN yard and not yet processed (complete=0)
     * Matches ProcessGateOutModal logic - excludes held containers and archived clients
     * Uses partial search on container_no
     */
    public function searchAvailableContainers(Request $request)
    {
        try {
            $searchTerm = $request->input('search', '');
            $username = $request->input('username', 'mobile-user');

            if (empty($searchTerm) || strlen($searchTerm) < 3) {
                return response()->json([
                    'success' => true,
                    'data' => []
                ]);
            }

            $prefix = $this->prefix;

            // Search inventory table for containers IN and not complete
            // Excludes held containers and archived clients
            $results = DB::select("
                SELECT 
                    i.i_id,
                    i.container_no,
                    COALESCE(c.client_code, c.client_name, '-') AS client_name,
                    c.c_id AS client_id,
                    CONCAT(st.size, st.type) AS size_type,
                    st.s_id AS sizetype_id,
                    i.iso_code,
                    i.location,
                    i.plate_no,
                    i.hauler,
                    COALESCE(i.shipper, '-') AS shipper
                FROM {$prefix}inventory i
                LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$prefix}container_size_type st ON i.size_type = st.s_id
                WHERE i.gate_status = 'IN' 
                  AND i.complete = 0
                  AND c.archived = 0
                  AND NOT EXISTS (
                      SELECT 1 FROM {$prefix}hold_containers hc 
                      WHERE hc.container_no = i.container_no
                  )
                  AND i.container_no LIKE ?
                ORDER BY i.date_added DESC
            ", [
                '%' . $searchTerm . '%'
            ]);

            return response()->json([
                'success' => true,
                'data' => $results
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile searchAvailableContainers error', [
                'username' => $request->input('username', 'unknown'),
                'search' => $request->input('search', ''),
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to search containers: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Process Gate IN - Complete the gate in transaction
     */
    public function processGateIn(Request $request)
    {
        try {
            $username = $request->input('username', 'mobile-user');
            $pId = $request->input('p_id');
            $containerNo = $request->input('container_no');
            
            if (!$pId || !$containerNo) {
                return response()->json([
                    'success' => false,
                    'message' => 'Record ID and container number are required.'
                ], 400);
            }

            $prefix = $this->prefix;

            // Get user ID
            $user = DB::table('users')->where('username', $username)->first();
            $userId = $user ? $user->user_id : null;

            // Prepare update data for pre_inventory
            $updateData = [
                'date_completed' => now(),
                'container_no' => $containerNo,
                'client_id' => $request->input('client_id'),
                'size_type' => $request->input('size_type'),
                'iso_code' => $request->input('iso_code'),
                'cnt_status' => $request->input('cnt_status'),
                'cnt_class' => $request->input('cnt_class'),
                'remarks' => $request->input('remarks'),
                'checker_id' => $userId,
            ];

            // Only add date if provided
            if ($request->input('date_mnfg')) {
                $updateData['date_mnfg'] = $request->input('date_mnfg');
            }

            // Update pre_inventory with container details
            DB::table('pre_inventory')
                ->where('p_id', $pId)
                ->update($updateData);

            // Log audit
            DB::table('audit_logs')->insert([
                'action' => 'GATE_IN',
                'description' => '[MOBILE] Gate IN processed: Container: ' . $containerNo . ' | Status: ' . $request->input('cnt_status') . ' | Class: ' . $request->input('cnt_class'),
                'user_id' => $userId,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Container successfully gated IN.'
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile processGateIn error', [
                'username' => $request->input('username', 'unknown'),
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error processing gate IN: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Process Gate OUT - Complete the gate out transaction
     */
    public function processGateOut(Request $request)
    {
        try {
            $username = $request->input('username', 'mobile-user');
            $pId = $request->input('p_id');
            $containerNo = $request->input('container_no');
            
            if (!$pId || !$containerNo) {
                return response()->json([
                    'success' => false,
                    'message' => 'Record ID and container number are required.'
                ], 400);
            }

            $prefix = $this->prefix;

            // Get user ID
            $user = DB::table('users')->where('username', $username)->first();
            $userId = $user ? $user->user_id : null;

            // Prepare update data for pre_inventory with container details
            $updateData = [
                'status' => 2,  // Mark as gate-out processed
                'date_completed' => now(),
                'container_no' => $containerNo,
                'client_id' => $request->input('client_id'),
                'size_type' => $request->input('size_type'),
                'iso_code' => $request->input('iso_code'),
                'cnt_status' => $request->input('container_status'),
                'cnt_class' => $request->input('class'),
                'remarks' => $request->input('remarks'),
            ];

            // Update pre_inventory with container details
            DB::table('pre_inventory')
                ->where('p_id', $pId)
                ->update($updateData);

            // Log to gate_inout table
            DB::table('gate_inout')->insert([
                'container_no' => $containerNo,
                'direction' => 'OUT',
                'date_time' => now(),
                'user_id' => $userId,
            ]);

            // Log audit
            DB::table('audit_logs')->insert([
                'action' => 'GATE_OUT',
                'description' => '[MOBILE] Gate OUT processed: Container: ' . $containerNo . ' | Status: ' . $request->input('container_status') . ' | Class: ' . $request->input('class'),
                'user_id' => $userId,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Container successfully gated OUT.'
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile processGateOut error', [
                'username' => $request->input('username', 'unknown'),
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error processing gate OUT: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get Container Details by Container Number from PRE-INVENTORY
     * Fetches container information from pre_inventory for GATE IN/OUT processing
     */
    public function getContainerDetails(Request $request)
    {
        try {
            $containerNo = strtoupper(trim($request->input('container_no', '')));
            $username = $request->input('username', 'mobile-user');

            if (empty($containerNo)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container number is required.'
                ], 400);
            }

            $prefix = $this->prefix;

            $result = DB::selectOne("
                SELECT
                    p.p_id,
                    p.container_no,
                    p.client_id,
                    c.client_name,
                    CAST(COALESCE(p.size_type, 0) AS UNSIGNED) as sizetype_id,
                    p.iso_code,
                    p.cnt_class as class,
                    p.cnt_status,
                    p.date_mnfg,
                    p.remarks,
                    p.checker_id,
                    u.full_name as checker_name
                FROM {$prefix}pre_inventory p
                LEFT JOIN {$prefix}clients c ON c.c_id = p.client_id
                LEFT JOIN {$prefix}users u ON u.user_id = p.checker_id
                WHERE p.container_no = ? AND p.status = 0
                LIMIT 1
            ", [$containerNo]);

            if (!$result) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found in pre-inventory or already processed.'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            Log::error('Mobile getContainerDetails error', [
                'username' => $request->input('username', 'unknown'),
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error fetching container details: ' . $e->getMessage()
            ], 500);
        }
    }
}

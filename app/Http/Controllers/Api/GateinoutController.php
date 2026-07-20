<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PreInventory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Gate In & Out Controller - LEGACY SYSTEM REBUILD
 * This controller replicates the EXACT functionality of the legacy PHP system
 * with modern Laravel structure but identical business logic
 */
class GateinoutController extends Controller
{
    private $prefix;

    public function __construct()
    {
        $this->prefix = env('DB_PREFIX', 'fjp_');
    }

    /**
     * Get Pre-Inventory List (Combined for both IN and OUT)
     * OPTIMIZED: Uses efficient JOINs, returns all pending records for client-side filtering
     * Returns list with runtime tracking, color coding, and permissions
     */
    public function getPreInventoryList(Request $request)
    {
        try {
            // Get only pending records (status = 0) - optimized for speed
            $prefix = env('DB_PREFIX', 'fjp_');
            
            $startTime = microtime(true);
            
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
            
            $queryTime = round((microtime(true) - $startTime) * 1000, 2);
            
            // Add hashed_id and runtime_color - minimal processing
            foreach ($results as $result) {
                $result->hashed_id = md5($result->p_id);
                $runtime = (int)$result->runtime;
                $result->runtime_color = $runtime <= 30 ? 'green' : ($runtime <= 60 ? 'orange' : 'red');
            }
            
            $totalTime = round((microtime(true) - $startTime) * 1000, 2);
            
            return response()->json([
                'success' => true,
                'prelist' => $results,
                'performance' => [
                    'query_time_ms' => $queryTime,
                    'total_time_ms' => $totalTime,
                    'records_count' => count($results)
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check if container can be gated IN
     * LEGACY: checkContainerInAction()
     * Validates: length (11 chars), duplicates, banned list
     */
    public function checkContainerIn(Request $request)
    {
        try {
            $containerNo = strtoupper(trim($request->input('cno')));
            $clientId = $request->input('client');
            
            // Validate container number length
            if (strlen($containerNo) !== 11) {
                return response()->json([
                    'message' => ['danger', '<strong>Alert!</strong> Container number should be 11 characters length!']
                ]);
            }
            
            // Check if client exists
            $client = DB::selectOne(
                "SELECT c_id FROM {$this->prefix}clients WHERE MD5(c_id) = :cid",
                ['cid' => $clientId]
            );
            
            if (!$client) {
                return response()->json([
                    'message' => ['danger', '<strong>Error!</strong> There\'s an error with your connection!']
                ]);
            }
            
            // Validate container can gate in
            $validation = PreInventory::checkContainerCanGateIn($containerNo, $client->c_id);
            
            if (!$validation['valid']) {
                return response()->json([
                    'message' => ['danger', $validation['message']]
                ]);
            }
            
            // Insert Pre-IN record
            DB::insert(
                "INSERT INTO {$this->prefix}pre_inventory 
                (container_no, client_id, plate_no, gate_status, user_id, status, inv_id, date_added, remarks, size_type, cnt_class, cnt_status, iso_code, date_mnfg, checker_id)
                VALUES (:cno, :cid, :pno, :gate, :uid, :stats, :iid, :date, :remarks, :size_type, :cnt_class, :cnt_status, :iso_code, :date_mnfg, :checker_id)",
                [
                    'cno' => $containerNo,
                    'cid' => $client->c_id,
                    'pno' => '',
                    'gate' => 'IN',
                    'uid' => Auth::check() ? Auth::user()->user_id : 0,
                    'stats' => 0,
                    'iid' => 0,
                    'date' => date('Y-m-d H:i:s'),
                    'remarks' => '',
                    'size_type' => 0,
                    'cnt_class' => '',
                    'cnt_status' => '',
                    'iso_code' => '',
                    'date_mnfg' => '0000-00-00',
                    'checker_id' => 0
                ]
            );
            
            // Log audit - ADD action for pre-in
            $clientName = DB::selectOne("SELECT client_name FROM {$this->prefix}clients WHERE c_id = :cid", ['cid' => $client->c_id])->client_name ?? 'Unknown';
            
            DB::table('audit_logs')->insert([
                'action' => 'ADD',
                'description' => '[GATE IN/OUT] Added Pre-In record for container "' . $containerNo . '", Client: "' . $clientName . '"',
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => request()->ip(),
            ]);
            
            return response()->json([
                'message' => ['success', '<strong>Success!</strong> Pre-In has been added!']
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'message' => ['danger', '<strong>Error!</strong> ' . $e->getMessage()]
            ]);
        }
    }

    /**
     * Check if container can be gated OUT
     * LEGACY: checkContainerOutAction()
     * Creates Pre-OUT with plate number and hauler
     */
    public function checkContainerOut(Request $request)
    {
        try {
            $plateNo = trim($request->input('pno'));
            $hauler = trim($request->input('hauler'));
            
            if (empty($plateNo) || empty($hauler)) {
                return response()->json([
                    'message' => ['danger', '<strong>Error!</strong> Invalid plate number input!']
                ]);
            }
            
            // Insert Pre-OUT record
            DB::insert(
                "INSERT INTO {$this->prefix}pre_inventory 
                (container_no, plate_no, hauler, gate_status, user_id, status, inv_id, date_added, remarks, size_type, cnt_class, cnt_status, iso_code, date_mnfg, checker_id)
                VALUES (:cno, :pno, :hau, :gate, :uid, :stats, :iid, :date, :remarks, :size_type, :cnt_class, :cnt_status, :iso_code, :date_mnfg, :checker_id)",
                [
                    'cno' => '',
                    'pno' => $plateNo,
                    'hau' => $hauler,
                    'gate' => 'OUT',
                    'uid' => Auth::check() ? Auth::user()->user_id : 0,
                    'stats' => 0,
                    'iid' => 0,
                    'date' => date('Y-m-d H:i:s'),
                    'remarks' => '',
                    'size_type' => 0,
                    'cnt_class' => '',
                    'cnt_status' => '',
                    'iso_code' => '',
                    'date_mnfg' => '0000-00-00',
                    'checker_id' => 0
                ]
            );
            
            // Log audit - ADD action for pre-out
            DB::table('audit_logs')->insert([
                'action' => 'ADD',
                'description' => '[GATE IN/OUT] Added Pre-Out record for Plate No: "' . $plateNo . '", Hauler: "' . $hauler . '"',
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => request()->ip(),
            ]);
            
            return response()->json([
                'message' => ['success', '<strong>Success!</strong> Pre-Out has been added!']
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'message' => ['danger', '<strong>Error!</strong> ' . $e->getMessage()]
            ]);
        }
    }

    /**
     * Get Pre-IN details for editing
     * Returns record data for edit modal
     */
    public function getPreInDetails(Request $request)
    {
        try {
            $hashedId = $request->input('id');
            
            // Find the real ID
            $all = DB::select("SELECT p_id, container_no, client_id FROM {$this->prefix}pre_inventory WHERE gate_status = 'IN' AND status = 0");
            $realId = null;
            
            foreach ($all as $p) {
                if (md5($p->p_id) === $hashedId) {
                    $realId = $p->p_id;
                    break;
                }
            }
            
            if (!$realId) {
                return response()->json(['success' => false, 'message' => 'Record not found'], 404);
            }
            
            $record = DB::selectOne("SELECT * FROM {$this->prefix}pre_inventory WHERE p_id = :id", ['id' => $realId]);
            
            return response()->json([
                'success' => true,
                'data' => [
                    'container_no' => $record->container_no,
                    'client_id' => md5($record->client_id),
                    'remarks' => $record->remarks
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Update Pre-IN record
     * LEGACY: updatePreInAction()
     */
    public function updatePreIn(Request $request)
    {
        try {
            $hashedId = $request->input('id');
            $containerNo = strtoupper(trim($request->input('cno')));
            $clientId = $request->input('cid');
            
            // Validate
            if (empty($containerNo) || empty($clientId)) {
                return response()->json([
                    'message' => ['danger', '<strong>Error!</strong> Please fill out required fields.']
                ]);
            }
            
            if (strlen($containerNo) !== 11) {
                return response()->json([
                    'message' => ['danger', '<strong>Alert!</strong> Container number should be 11 characters length!']
                ]);
            }
            
            // Get real client ID
            $client = DB::selectOne("SELECT c_id FROM {$this->prefix}clients WHERE MD5(c_id) = :cid", ['cid' => $clientId]);
            if (!$client) {
                return response()->json([
                    'message' => ['danger', '<strong>Error!</strong> Invalid client!']
                ]);
            }
            
            // Find real record ID
            $all = DB::select("SELECT p_id FROM {$this->prefix}pre_inventory WHERE gate_status = 'IN' AND status = 0");
            $realId = null;
            foreach ($all as $p) {
                if (md5($p->p_id) === $hashedId) {
                    $realId = $p->p_id;
                    break;
                }
            }
            
            if (!$realId) {
                return response()->json([
                    'message' => ['danger', '<strong>Error!</strong> Record not found!']
                ]);
            }
            
            // Get old values for audit log
            $oldRecord = DB::selectOne("SELECT * FROM {$this->prefix}pre_inventory WHERE p_id = :id", ['id' => $realId]);
            $oldClientName = DB::selectOne("SELECT client_name FROM {$this->prefix}clients WHERE c_id = :cid", ['cid' => $oldRecord->client_id])->client_name ?? 'Unknown';
            $newClientName = DB::selectOne("SELECT client_name FROM {$this->prefix}clients WHERE c_id = :cid", ['cid' => $client->c_id])->client_name ?? 'Unknown';
            
            // Track changes
            $changes = [];
            if ($oldRecord->container_no !== $containerNo) {
                $changes[] = 'Container No: "' . $oldRecord->container_no . '" -> "' . $containerNo . '"';
            }
            if ($oldRecord->client_id != $client->c_id) {
                $changes[] = 'Client: "' . $oldClientName . '" -> "' . $newClientName . '"';
            }
            
            // Update
            DB::update(
                "UPDATE {$this->prefix}pre_inventory 
                 SET container_no = :cno, client_id = :cid 
                 WHERE p_id = :id",
                ['cno' => $containerNo, 'cid' => $client->c_id, 'id' => $realId]
            );
            
            // Log audit - EDIT action with changes
            if (count($changes) > 0) {
                $description = '[GATE IN/OUT] Edited Pre-In record for "' . $containerNo . '": ' . implode(', ', $changes);
                
                DB::table('audit_logs')->insert([
                    'action' => 'EDIT',
                    'description' => $description,
                    'user_id' => auth()->user()->user_id ?? null,
                    'date_added' => now(),
                    'ip_address' => request()->ip(),
                ]);
            }
            
            return response()->json([
                'message' => ['success', '<strong>Success!</strong> Pre-In has been updated!']
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'message' => ['danger', '<strong>Error!</strong> ' . $e->getMessage()]
            ]);
        }
    }

    /**
     * Get Pre-OUT details for editing
     */
    public function getPreOutDetails(Request $request)
    {
        try {
            $hashedId = $request->input('id');
            
            // Find the real ID
            $all = DB::select("SELECT p_id FROM {$this->prefix}pre_inventory WHERE gate_status = 'OUT' AND status = 0");
            $realId = null;
            
            foreach ($all as $p) {
                if (md5($p->p_id) === $hashedId) {
                    $realId = $p->p_id;
                    break;
                }
            }
            
            if (!$realId) {
                return response()->json(['success' => false, 'message' => 'Record not found'], 404);
            }
            
            $record = DB::selectOne("SELECT * FROM {$this->prefix}pre_inventory WHERE p_id = :id", ['id' => $realId]);
            
            return response()->json([
                'success' => true,
                'data' => [
                    'plate_no' => $record->plate_no,
                    'hauler' => $record->hauler,
                    'remarks' => $record->remarks
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Update Pre-OUT record
     * LEGACY: updatePreOutAction()
     */
    public function updatePreOut(Request $request)
    {
        try {
            $hashedId = $request->input('id');
            $plateNo = trim($request->input('pno'));
            $hauler = trim($request->input('hauler'));
            
            if (empty($plateNo) || empty($hauler)) {
                return response()->json([
                    'message' => ['danger', '<strong>Error!</strong> Please fill out required fields.']
                ]);
            }
            
            // Find real record ID
            $all = DB::select("SELECT p_id FROM {$this->prefix}pre_inventory WHERE gate_status = 'OUT' AND status = 0");
            $realId = null;
            foreach ($all as $p) {
                if (md5($p->p_id) === $hashedId) {
                    $realId = $p->p_id;
                    break;
                }
            }
            
            if (!$realId) {
                return response()->json([
                    'message' => ['danger', '<strong>Error!</strong> Record not found!']
                ]);
            }
            
            // Get old values for audit log
            $oldRecord = DB::selectOne("SELECT * FROM {$this->prefix}pre_inventory WHERE p_id = :id", ['id' => $realId]);
            
            // Track changes
            $changes = [];
            if ($oldRecord->plate_no !== $plateNo) {
                $changes[] = 'Plate No: "' . $oldRecord->plate_no . '" -> "' . $plateNo . '"';
            }
            if ($oldRecord->hauler !== $hauler) {
                $changes[] = 'Hauler: "' . $oldRecord->hauler . '" -> "' . $hauler . '"';
            }
            
            // Update
            DB::update(
                "UPDATE {$this->prefix}pre_inventory 
                 SET plate_no = :pno, hauler = :hau 
                 WHERE p_id = :id",
                ['pno' => $plateNo, 'hau' => $hauler, 'id' => $realId]
            );
            
            // Log audit - EDIT action with changes
            if (count($changes) > 0) {
                $description = '[GATE IN/OUT] Edited Pre-Out record for Plate No "' . $plateNo . '": ' . implode(', ', $changes);
                
                DB::table('audit_logs')->insert([
                    'action' => 'EDIT',
                    'description' => $description,
                    'user_id' => auth()->user()->user_id ?? null,
                    'date_added' => now(),
                    'ip_address' => request()->ip(),
                ]);
            }
            
            return response()->json([
                'message' => ['success', '<strong>Success!</strong> Pre-Out has been updated!']
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'message' => ['danger', '<strong>Error!</strong> ' . $e->getMessage()]
            ]);
        }
    }

    /**
     * Delete Pre-Gate record (IN or OUT)
     * LEGACY: deletePreAction()
     * Can only delete Pending status records
     */
    public function deletePre(Request $request)
    {
        try {
            $hashedId = $request->input('id');
            
            // Find the real ID from both IN and OUT records
            $all = DB::select("SELECT p_id, container_no, plate_no, gate_status FROM {$this->prefix}pre_inventory WHERE status = 0");
            $realId = null;
            $identifier = '';
            $gateStatus = '';
            
            foreach ($all as $p) {
                if (md5($p->p_id) === $hashedId) {
                    $realId = $p->p_id;
                    $identifier = $p->container_no ?: "Plate: {$p->plate_no}";
                    $gateStatus = $p->gate_status;
                    break;
                }
            }
            
            if (!$realId) {
                return response()->json([
                    'message' => ['danger', '<strong>Error!</strong> Record not found!']
                ]);
            }
            
            // Delete the record (only pending can be deleted)
            DB::delete("DELETE FROM {$this->prefix}pre_inventory WHERE p_id = :id AND status = 0", ['id' => $realId]);
            
            // Log audit - DELETE action
            DB::table('audit_logs')->insert([
                'action' => 'DELETE',
                'description' => '[GATE IN/OUT] Deleted Pre-' . $gateStatus . ' record: "' . $identifier . '"',
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => request()->ip(),
            ]);
            
            return response()->json([
                'message' => ['success', '<strong>Success!</strong> Record has been deleted!']
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'message' => ['danger', '<strong>Error!</strong> ' . $e->getMessage()]
            ]);
        }
    }

    /**
     * Get clients list (for dropdown)
     */
    public function getClients()
    {
        try {
            $clients = DB::select(
                "SELECT c_id, client_name, client_code 
                 FROM {$this->prefix}clients 
                 WHERE archived = 0 
                 ORDER BY client_name ASC"
            );
            
            // Add hashed ID for security
            foreach ($clients as $client) {
                $client->hashed_c_id = md5($client->c_id);
            }
            
            return response()->json(['success' => true, 'data' => $clients]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get containers currently in yard (for Pre-OUT selection)
     */
    public function getContainersInYard()
    {
        try {
            $containers = DB::select(
                "SELECT i.container_no, c.client_name, c.client_code, st.size, st.type 
                 FROM {$this->prefix}inventory i 
                 LEFT JOIN {$this->prefix}clients c ON c.c_id = i.client_id 
                 LEFT JOIN {$this->prefix}container_size_type st ON st.s_id = i.size_type 
                 WHERE i.complete = 0 AND i.gate_status = 'IN'
                 ORDER BY i.container_no ASC"
            );
            
            return response()->json(['success' => true, 'data' => $containers]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get size types (for dropdown)
     */
    public function getSizeTypes()
    {
        try {
            $sizeTypes = DB::select(
                "SELECT s_id, size, type, description, iso_code 
                 FROM {$this->prefix}container_size_type 
                 WHERE archived = 0 
                 ORDER BY size ASC, type ASC"
            );
            
            return response()->json(['success' => true, 'data' => $sizeTypes]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Get user's page record access permissions
     * Returns: [edit_permission, delete_permission]
     * LEGACY: getPageRecordAccess()
     */
    public function getPageRecordAccess()
    {
        try {
            $user = Auth::user();
            $privId = $user->priv_id ?? 0;
            
            // Admin (priv_id = 1) has all permissions
            if ($privId == 1) {
                return response()->json([
                    'success' => true,
                    'module_edit' => true,
                    'module_delete' => true
                ]);
            }
            
            // Get page ID for gateinout
            $page = DB::selectOne(
                "SELECT p_id FROM {$this->prefix}pages WHERE page = 'gateinout' LIMIT 1"
            );
            
            if (!$page) {
                return response()->json([
                    'success' => true,
                    'module_edit' => false,
                    'module_delete' => false
                ]);
            }
            
            // Get page access permissions
            $access = DB::selectOne(
                "SELECT acs_edit, acs_delete 
                 FROM {$this->prefix}pages_access 
                 WHERE privilege = :priv AND page_id = :page",
                ['priv' => $privId, 'page' => $page->p_id]
            );
            
            if (!$access) {
                return response()->json([
                    'success' => true,
                    'module_edit' => false,
                    'module_delete' => false
                ]);
            }
            
            return response()->json([
                'success' => true,
                'module_edit' => (bool)($access->acs_edit ?? 0),
                'module_delete' => (bool)($access->acs_delete ?? 0)
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'module_edit' => false,
                'module_delete' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Log audit trail
     * LEGACY: Audit logging for all gate operations
     */
    private function logAudit($action, $description, $userId)
    {
        try {
            DB::insert(
                "INSERT INTO {$this->prefix}audit_logs 
                 (action, description, user_id, date_added, ip_address) 
                 VALUES (:act, :desc, :user, :date, :ip)",
                [
                    'act' => $action,
                    'desc' => $description,
                    'user' => $userId,
                    'date' => now(),
                    'ip' => request()->ip()
                ]
            );
        } catch (\Exception $e) {
            // Silent fail on audit log
            Log::error("Audit log failed: " . $e->getMessage());
        }
    }

    /**
     * Get current authenticated user info
     */
    public function getCurrentUser()
    {
        try {
            $user = Auth::user();
            
            return response()->json([
                'success' => true,
                'user_id' => $user ? $user->user_id : null,
                'username' => $user ? $user->username : null,
                'full_name' => $user ? $user->full_name : null
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get container status options for dropdowns
     */
    public function getStatusOptions()
    {
        try {
            $statuses = DB::select("SELECT s_id, status FROM {$this->prefix}container_status ORDER BY status ASC");
            
            return response()->json([
                'success' => true,
                'data' => $statuses
            ]);
        } catch (\Exception $e) {
            Log::error('Get Status Options Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to load status options'
            ], 500);
        }
    }

    /**
     * Get size/type options for dropdowns
     */
    public function getSizeTypeOptions()
    {
        try {
            $sizeTypes = DB::select("SELECT s_id, size, type FROM {$this->prefix}container_size_type WHERE archived = 0 ORDER BY size ASC, type ASC");
            
            return response()->json([
                'success' => true,
                'data' => $sizeTypes
            ]);
        } catch (\Exception $e) {
            Log::error('Get Size/Type Options Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to load size/type options'
            ], 500);
        }
    }

    /**
     * Get load type options for dropdowns
     */
    public function getLoadOptions()
    {
        try {
            $loads = DB::select("SELECT l_id, type FROM {$this->prefix}load_type ORDER BY type ASC");
            
            return response()->json([
                'success' => true,
                'data' => $loads
            ]);
        } catch (\Exception $e) {
            Log::error('Get Load Options Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to load load options'
            ], 500);
        }
    }

    /**
     * Process Gate IN - Move from pre_inventory to inventory
     */
    public function processGateIn(Request $request)
    {
        try {
            $validated = $request->validate([
                'p_id' => 'required|integer',
                'container_no' => 'required|string|size:11',
                'date_mnfg' => 'required|string',
                'cnt_status' => 'required|integer',
                'size_type' => 'required|integer',
                'iso_code' => 'required|string',
                'cnt_class' => 'required|string|in:A,B,C',
                'vessel' => 'required|string',
                'voyage' => 'required|string',
                'checker' => 'required|string',
                'ex_consignee' => 'required|string',
                'load_type' => 'required|integer',
                'plate_no' => 'required|string',
                'hauler' => 'required|string',
                'hauler_driver' => 'required|string',
                'license_no' => 'required|string',
                'location' => 'required|string',
                'chasis' => 'required|string',
                'contact_no' => 'required|string',
                'bol' => 'required|string',
                'remarks' => 'required|string'
            ]);

            // Validate container number is exactly 11 characters
            if (strlen($validated['container_no']) !== 11) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container number must be exactly 11 characters'
                ], 422);
            }

            // Check if container is banned
            $bannedCheck = DB::select(
                "SELECT COUNT(*) as count FROM {$this->prefix}ban_containers WHERE container_no = ?",
                [$validated['container_no']]
            );
            
            if ($bannedCheck[0]->count > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'This container is BANNED and cannot be gated in'
                ], 422);
            }

            // Check if container is on hold
            $holdCheck = DB::select(
                "SELECT COUNT(*) as count FROM {$this->prefix}hold_containers WHERE container_no = ?",
                [$validated['container_no']]
            );
            
            if ($holdCheck[0]->count > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'This container is ON HOLD and cannot be gated in'
                ], 422);
            }

            DB::beginTransaction();

            try {
                // Insert into inventory table
                DB::insert(
                    "INSERT INTO {$this->prefix}inventory 
                    (container_no, client_id, date_manufactured, container_status, size_type, iso_code, class, 
                     vessel, voyage, origin, ex_consignee, load_type, plate_no, hauler, hauler_driver, 
                     license_no, location, chasis, contact_no, bill_of_lading, remarks, date_added, complete, gate_status, user_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        $validated['container_no'],
                        $request->input('client_id'),
                        $validated['date_mnfg'],
                        $validated['cnt_status'],
                        $validated['size_type'],
                        $validated['iso_code'],
                        $validated['cnt_class'],
                        $validated['vessel'],
                        $validated['voyage'],
                        $validated['checker'],
                        $validated['ex_consignee'],
                        $validated['load_type'],
                        $validated['plate_no'],
                        $validated['hauler'],
                        $validated['hauler_driver'],
                        $validated['license_no'],
                        $validated['location'],
                        $validated['chasis'],
                        $validated['contact_no'],
                        $validated['bol'],
                        $validated['remarks'],
                        now(),
                        0, // complete - Not yet gated out
                        'IN', // gate_status
                        Auth::check() ? Auth::user()->user_id : 0 // user_id
                    ]
                );

                // Get the last inserted inventory ID
                $inventoryId = DB::getPdo()->lastInsertId();

                // Update pre_inventory status to finished
                DB::update(
                    "UPDATE {$this->prefix}pre_inventory SET status = 1, inv_id = ?, date_completed = ? WHERE p_id = ?",
                    [$inventoryId, now(), $validated['p_id']]
                );

                // Log audit - APPROVE action with ALL fields
                $clientName = DB::selectOne("SELECT client_name FROM {$this->prefix}clients WHERE c_id = :cid", ['cid' => $request->input('client_id')])->client_name ?? 'Unknown';
                $sizeType = DB::selectOne("SELECT CONCAT(size, '/', type) as size_type FROM {$this->prefix}container_size_type WHERE s_id = :sid", ['sid' => $validated['size_type']])->size_type ?? 'Unknown';
                $status = DB::selectOne("SELECT status FROM {$this->prefix}container_status WHERE s_id = :sid", ['sid' => $validated['cnt_status']])->status ?? 'Unknown';
                $loadType = DB::selectOne("SELECT type FROM {$this->prefix}load_type WHERE l_id = :lid", ['lid' => $validated['load_type']])->type ?? 'Unknown';
                
                $description = '[GATE IN/OUT] Processed Gate IN: Container "' . $validated['container_no'] . '", ' .
                    'Client: "' . $clientName . '", ' .
                    'Size/Type: "' . $sizeType . '", ' .
                    'Status: "' . $status . '", ' .
                    'ISO Code: "' . $validated['iso_code'] . '", ' .
                    'Class: "' . $validated['cnt_class'] . '", ' .
                    'Date Manufactured: "' . $validated['date_mnfg'] . '", ' .
                    'Vessel: "' . $validated['vessel'] . '", ' .
                    'Voyage: "' . $validated['voyage'] . '", ' .
                    'Checker: "' . $validated['checker'] . '", ' .
                    'Ex-Consignee: "' . $validated['ex_consignee'] . '", ' .
                    'Load: "' . $loadType . '", ' .
                    'Plate No: "' . $validated['plate_no'] . '", ' .
                    'Hauler: "' . $validated['hauler'] . '", ' .
                    'Driver: "' . $validated['hauler_driver'] . '", ' .
                    'License: "' . $validated['license_no'] . '", ' .
                    'Location: "' . $validated['location'] . '", ' .
                    'Chasis: "' . $validated['chasis'] . '", ' .
                    'Contact: "' . $validated['contact_no'] . '", ' .
                    'BOL: "' . $validated['bol'] . '"';
                
                DB::table('audit_logs')->insert([
                    'action' => 'APPROVE',
                    'description' => $description,
                    'user_id' => auth()->user()->user_id ?? null,
                    'date_added' => now(),
                    'ip_address' => request()->ip(),
                ]);

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Container successfully gated IN',
                    'inventory_id' => $inventoryId
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Process Gate IN Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to process Gate IN: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Process Gate OUT - Update inventory record
     */
    public function processGateOut(Request $request)
    {
        try {
            $validated = $request->validate([
                'p_id' => 'required|integer',
                'container_no' => 'required|string|size:11',
                'client_id' => 'required|integer',
                'container_status' => 'required|integer',
                'size_type' => 'required|integer',
                'iso_code' => 'required|string',
                'vessel' => 'required|string',
                'voyage' => 'required|string',
                'plate_no' => 'required|string',
                'hauler' => 'required|string',
                'hauler_driver' => 'required|string',
                'license_no' => 'required|string',
                'checker' => 'required|string',
                'location' => 'required|string',
                'load_type' => 'required|integer',
                'chasis' => 'required|string',
                'contact_no' => 'required|string',
                'shipper' => 'required|string',
                'booking_no' => 'required|string',
                'seal_no' => 'required|string',
                'remarks' => 'required|string',
                'save_and_book' => 'required|string|in:YES,NO'
            ]);

            // Validate container number is exactly 11 characters
            if (strlen($validated['container_no']) !== 11) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container number must be exactly 11 characters'
                ], 422);
            }

            // Check if container exists in inventory
            $containerCheck = DB::select(
                "SELECT i_id FROM {$this->prefix}inventory WHERE container_no = ? AND complete = 0",
                [$validated['container_no']]
            );
            
            if (empty($containerCheck)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found in yard or already gated out'
                ], 422);
            }

            $inventoryId = $containerCheck[0]->i_id;

            DB::beginTransaction();

            try {
                // Update inventory record - mark as complete and update all Gate OUT fields
                DB::update(
                    "UPDATE {$this->prefix}inventory 
                     SET complete = 1, 
                         container_status = ?,
                         vessel = ?,
                         voyage = ?,
                         plate_no = ?,
                         hauler = ?,
                         hauler_driver = ?,
                         license_no = ?,
                         origin = ?,
                         location = ?,
                         load_type = ?,
                         chasis = ?,
                         contact_no = ?,
                         shipper = ?,
                         booking = ?,
                         seal_no = ?,
                         remarks = ?
                     WHERE container_no = ? AND complete = 0",
                    [
                        $validated['container_status'],
                        $validated['vessel'],
                        $validated['voyage'],
                        $validated['plate_no'],
                        $validated['hauler'],
                        $validated['hauler_driver'],
                        $validated['license_no'],
                        $validated['checker'],
                        $validated['location'],
                        $validated['load_type'],
                        $validated['chasis'],
                        $validated['contact_no'],
                        $validated['shipper'],
                        $validated['booking_no'],
                        $validated['seal_no'],
                        $validated['remarks'],
                        $validated['container_no']
                    ]
                );

                // Update pre_inventory status to finished with inventory ID
                DB::update(
                    "UPDATE {$this->prefix}pre_inventory SET status = 1, date_completed = ? WHERE p_id = ?",
                    [now(), $validated['p_id']]
                );

                // BOOKING SLOT DEDUCTION - Decrement booking slots based on container size
                // Get container size type
                $sizeInfo = DB::selectOne(
                    "SELECT st.size FROM {$this->prefix}container_size_type st
                     WHERE st.s_id = ?",
                    [$validated['size_type']]
                );

                if ($sizeInfo) {
                    $containerSize = $sizeInfo->size;
                    
                    // Verify booking belongs to same client
                    $bookingInfo = DB::selectOne(
                        "SELECT b.b_id, b.client_id FROM {$this->prefix}bookings b
                         WHERE b.book_no = ? AND b.client_id = ?",
                        [$validated['booking_no'], $validated['client_id']]
                    );

                    if ($bookingInfo) {
                        // Decrement slots based on container size
                        if ($containerSize == 20 || $containerSize == 22) {
                            DB::update(
                                "UPDATE {$this->prefix}bookings SET twenty_rem = (twenty_rem - 1) WHERE b_id = ? AND twenty_rem > 0",
                                [$bookingInfo->b_id]
                            );
                        } elseif ($containerSize == 40 || $containerSize == 42) {
                            DB::update(
                                "UPDATE {$this->prefix}bookings SET fourty_rem = (fourty_rem - 1) WHERE b_id = ? AND fourty_rem > 0",
                                [$bookingInfo->b_id]
                            );
                        } elseif ($containerSize == 45) {
                            DB::update(
                                "UPDATE {$this->prefix}bookings SET fourty_five_rem = (fourty_five_rem - 1) WHERE b_id = ? AND fourty_five_rem > 0",
                                [$bookingInfo->b_id]
                            );
                        }
                    }
                }

                // Log audit - APPROVE action with ALL fields
                $clientName = DB::selectOne("SELECT client_name FROM {$this->prefix}clients WHERE c_id = :cid", ['cid' => $validated['client_id']])->client_name ?? 'Unknown';
                $sizeType = DB::selectOne("SELECT CONCAT(size, '/', type) as size_type FROM {$this->prefix}container_size_type WHERE s_id = :sid", ['sid' => $validated['size_type']])->size_type ?? 'Unknown';
                $status = DB::selectOne("SELECT status FROM {$this->prefix}container_status WHERE s_id = :sid", ['sid' => $validated['container_status']])->status ?? 'Unknown';
                $loadType = DB::selectOne("SELECT type FROM {$this->prefix}load_type WHERE l_id = :lid", ['lid' => $validated['load_type']])->type ?? 'Unknown';
                
                $description = '[GATE IN/OUT] Processed Gate OUT: Container "' . $validated['container_no'] . '", ' .
                    'Client: "' . $clientName . '", ' .
                    'Size/Type: "' . $sizeType . '", ' .
                    'Status: "' . $status . '", ' .
                    'ISO Code: "' . $validated['iso_code'] . '", ' .
                    'Vessel: "' . $validated['vessel'] . '", ' .
                    'Voyage: "' . $validated['voyage'] . '", ' .
                    'Shipper: "' . $validated['shipper'] . '", ' .
                    'Booking No: "' . $validated['booking_no'] . '", ' .
                    'Seal No: "' . $validated['seal_no'] . '", ' .
                    'Load: "' . $loadType . '", ' .
                    'Plate No: "' . $validated['plate_no'] . '", ' .
                    'Hauler: "' . $validated['hauler'] . '", ' .
                    'Driver: "' . $validated['hauler_driver'] . '", ' .
                    'License: "' . $validated['license_no'] . '", ' .
                    'Checker: "' . $validated['checker'] . '", ' .
                    'Location: "' . $validated['location'] . '", ' .
                    'Chasis: "' . $validated['chasis'] . '", ' .
                    'Contact: "' . $validated['contact_no'] . '"';
                
                DB::table('audit_logs')->insert([
                    'action' => 'APPROVE',
                    'description' => $description,
                    'user_id' => auth()->user()->user_id ?? null,
                    'date_added' => now(),
                    'ip_address' => request()->ip(),
                ]);

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Container successfully gated OUT',
                    'inventory_id' => $inventoryId
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            Log::error('Process Gate OUT Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to process Gate OUT: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Print Gate Pass (EXACT LEGACY FORMAT)
     * Generates HTML print document matching legacy system exactly
     */
    public function printGatePass($id, Request $request)
    {
        try {
            // Get status from query parameter (IN or OUT)
            $status = strtoupper($request->query('status', 'IN'));
            
            // Get inventory record with all related data
            $record = DB::selectOne("
                SELECT 
                    i.i_id,
                    CASE 
                        WHEN i.gate_status='IN' THEN CONCAT(i.i_id,'I')
                        ELSE CONCAT(i.i_id,'O')
                    END as eirno,
                    i.container_no,
                    c.client_name,
                    c.client_code,
                    CONCAT(st.size, st.type) as size_type,
                    DATE_FORMAT(DATE(i.date_added),'%m/%d/%Y') as date,
                    DATE_FORMAT(i.date_added, '%H:%i') as time,
                    cs.status as container_status,
                    i.class,
                    DATE_FORMAT(i.date_manufactured,'%Y-%m') as date_manufactured,
                    i.location,
                    i.remarks,
                    i.gate_status,
                    i.seal_no,
                    i.booking,
                    i.ex_consignee,
                    i.vessel,
                    i.voyage,
                    lt.type as load_type,
                    i.hauler,
                    i.plate_no,
                    i.iso_code,
                    i.hauler_driver,
                    i.license_no,
                    u.full_name as user_full_name,
                    i.origin as checker,
                    i.chasis,
                    i.shipper,
                    COALESCE(i.gate_status, 'IN') as gate_status_final
                FROM {$this->prefix}inventory i
                LEFT JOIN {$this->prefix}container_status cs ON i.container_status=cs.s_id
                LEFT JOIN {$this->prefix}container_size_type st ON i.size_type=st.s_id
                LEFT JOIN {$this->prefix}clients c ON c.c_id=i.client_id
                LEFT JOIN {$this->prefix}load_type lt ON lt.l_id=i.load_type
                LEFT JOIN {$this->prefix}users u ON u.user_id=i.user_id
                WHERE i.i_id = ? AND c.archived=0
            ", [$id]);

            if (!$record) {
                abort(404, 'Record not found');
            }

            // Convert stdClass to array for view
            $data = (array) $record;
            
            // Override gate_status_final with the parameter from the request
            $data['gate_status_final'] = $status;
            
            // Add currently logged-in user's full name for printing
            $data['logged_in_user_fullname'] = auth()->user()->full_name ?? auth()->user()->name ?? 'Unknown';

            // Return HTML view for printing (auto-print via JavaScript) - using unified template
            return view('pdfs.gate-pass-unified', compact('data'));

        } catch (\Exception $e) {
            Log::error('Print Gate Pass Error: ' . $e->getMessage());
            abort(500, 'Failed to generate print document');
        }
    }

    /**
     * Get Available Containers for Gate OUT
     * Returns containers that are IN yard (gate_status='IN', iscomplete=0)
     * and NOT on hold (not in hold_containers table)
     */
    public function getAvailableContainers(Request $request)
    {
        try {
            $search = $request->query('search', '');
            
            $query = "
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
                    COALESCE(i.shipper, '-') AS shipper,
                    DATEDIFF(NOW(), i.date_added) AS days_in_yard
                FROM {$this->prefix}inventory i
                LEFT JOIN {$this->prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$this->prefix}container_size_type st ON i.size_type = st.s_id
                WHERE i.gate_status = 'IN' 
                  AND i.complete = 0
                  AND c.archived = 0
                  AND NOT EXISTS (
                      SELECT 1 FROM {$this->prefix}hold_containers hc 
                      WHERE hc.container_no = i.container_no
                  )
            ";

            if (!empty($search)) {
                $query .= " AND i.container_no LIKE ?";
                $containers = DB::select($query, ['%' . $search . '%']);
            } else {
                $containers = DB::select($query);
            }

            return response()->json([
                'success' => true,
                'data' => $containers
            ]);

        } catch (\Exception $e) {
            Log::error('Get Available Containers Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch available containers'
            ], 500);
        }
    }

    /**
     * Validate Container for Gate OUT
     * Checks if container is IN yard, not on hold, and returns full details
     */
    public function validateContainer(Request $request)
    {
        try {
            $containerNo = $request->input('container_no');

            if (empty($containerNo)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container number is required'
                ], 422);
            }

            // Check if container is IN yard
            $container = DB::select("
                SELECT 
                    i.i_id,
                    i.container_no,
                    i.client_id,
                    COALESCE(c.client_code, c.client_name, '-') AS client_name,
                    i.size_type,
                    CONCAT(st.size, st.type) AS size_type_display,
                    i.iso_code,
                    i.container_status AS cnt_status,
                    cs.status AS status_name,
                    i.vessel,
                    i.voyage,
                    i.plate_no,
                    i.hauler,
                    i.hauler_driver,
                    i.license_no,
                    i.location,
                    i.load_type,
                    lt.type AS load_type_name,
                    i.chasis,
                    i.contact_no,
                    COALESCE(i.shipper, '-') AS shipper,
                    i.remarks,
                    i.origin,
                    DATEDIFF(NOW(), i.date_added) AS days_in_yard
                FROM {$this->prefix}inventory i
                LEFT JOIN {$this->prefix}clients c ON c.c_id = i.client_id
                LEFT JOIN {$this->prefix}container_size_type st ON i.size_type = st.s_id
                LEFT JOIN {$this->prefix}container_status cs ON i.container_status = cs.s_id
                LEFT JOIN {$this->prefix}load_type lt ON i.load_type = lt.l_id
                WHERE i.container_no = ? 
                  AND i.gate_status = 'IN' 
                  AND i.complete = 0
                  AND c.archived = 0
            ", [$containerNo]);

            if (empty($container)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container is not in yard or already gated out'
                ], 404);
            }

            // Check if container is on hold
            $holdCheck = DB::select(
                "SELECT notes FROM {$this->prefix}hold_containers WHERE container_no = ?",
                [$containerNo]
            );

            if (!empty($holdCheck)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container is currently on HOLD',
                    'hold_notes' => $holdCheck[0]->notes
                ], 422);
            }

            return response()->json([
                'success' => true,
                'data' => $container[0]
            ]);

        } catch (\Exception $e) {
            Log::error('Validate Container Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to validate container'
            ], 500);
        }
    }

    /**
     * Get Bookings List for autocomplete in Process Gate Out modal
     * Searches active bookings by booking number for a specific client
     * Only returns bookings that match the client AND have available slots for container size
     * Returns list of matching bookings with available slot info
     */
    public function getBookingsList(Request $request)
    {
        try {
            $key = $request->input('key', '');
            $clientId = $request->input('client_id');

            if (empty($clientId)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Client ID is required'
                ], 422);
            }

            // Search bookings by book_no, filter by client_id ONLY
            // This ensures cross-client booking pollution is prevented
            // OLD SYSTEM LOGIC: Only show ACTIVE bookings
            // ACTIVE = expiration_date > TODAY AND has available slots (any of twenty_rem, fourty_rem, fourty_five_rem > 0)
            $query = "
                SELECT 
                    b.b_id,
                    b.book_no,
                    b.shipper,
                    b.client_id,
                    COALESCE(b.twenty, 0) - COALESCE(b.twenty_rem, 0) AS booked_20,
                    COALESCE(b.twenty_rem, 0) AS available_20,
                    COALESCE(b.fourty, 0) - COALESCE(b.fourty_rem, 0) AS booked_40,
                    COALESCE(b.fourty_rem, 0) AS available_40,
                    COALESCE(b.fourty_five, 0) - COALESCE(b.fourty_five_rem, 0) AS booked_45,
                    COALESCE(b.fourty_five_rem, 0) AS available_45,
                    b.expiration_date
                FROM {$this->prefix}bookings b
                WHERE b.client_id = ?
                  AND b.expiration_date > CURDATE()
                  AND (b.twenty_rem > 0 OR b.fourty_rem > 0 OR b.fourty_five_rem > 0)
            ";

            $params = [$clientId];

            if (!empty($key)) {
                $query .= " AND b.book_no LIKE ?";
                $params[] = '%' . $key . '%';
            }

            $query .= " ORDER BY b.book_no DESC LIMIT 50";

            $bookings = DB::select($query, $params);

            return response()->json([
                'success' => true,
                'bookings' => $bookings
            ]);

        } catch (\Exception $e) {
            Log::error('Get Bookings List Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch bookings list'
            ], 500);
        }
    }

    /**
     * Get Shipper for selected booking in Process Gate Out modal
     * Validates: 1) Booking belongs to correct client, 2) Booking is active/not expired, 3) Container is in yard
     * Critical: Prevents using booking from different client
     * Returns shipper information to populate the field
     */
    public function getShipper(Request $request)
    {
        try {
            $bookingNo = $request->input('booking_no');
            $containerNo = $request->input('container_no');
            $clientId = $request->input('client_id');

            if (empty($bookingNo) || empty($containerNo) || empty($clientId)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Booking No, Container No, and Client ID are required'
                ], 422);
            }

            // Get booking and verify it belongs to the client (CRITICAL SECURITY CHECK)
            // OLD SYSTEM LOGIC: Only check if booking exists and expiration_date >= today
            $booking = DB::selectOne("
                SELECT 
                    b.book_no,
                    b.shipper,
                    b.client_id,
                    c.client_name,
                    b.expiration_date,
                    COALESCE(b.twenty_rem, 0) AS available_20,
                    COALESCE(b.fourty_rem, 0) AS available_40,
                    COALESCE(b.fourty_five_rem, 0) AS available_45
                FROM {$this->prefix}bookings b
                LEFT JOIN {$this->prefix}clients c ON c.c_id = b.client_id
                WHERE b.book_no = ? AND b.client_id = ?
            ", [$bookingNo, $clientId]);

            if (!$booking) {
                return response()->json([
                    'success' => false,
                    'message' => 'Booking not found or CLIENT MISMATCH - you can only use bookings for the selected client'
                ], 404);
            }

            // Check if booking is expired
            $today = date('Y-m-d');
            if ($booking->expiration_date && strtotime($booking->expiration_date) < strtotime($today)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Booking has expired on ' . $booking->expiration_date
                ], 422);
            }

            // Verify container exists in yard and belongs to same client
            $containerCheck = DB::selectOne("
                SELECT i.i_id, i.client_id
                FROM {$this->prefix}inventory i
                WHERE i.container_no = ? AND i.client_id = ? AND i.gate_status = 'IN' AND i.complete = 0
                LIMIT 1
            ", [$containerNo, $clientId]);

            if (!$containerCheck) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found in yard or CLIENT MISMATCH'
                ], 404);
            }

            // Double-check booking and container have same client (final validation)
            if ($booking->client_id != $clientId || $containerCheck->client_id != $clientId) {
                return response()->json([
                    'success' => false,
                    'message' => 'CLIENT MISMATCH - Booking and Container must belong to the same client'
                ], 422);
            }

            return response()->json([
                'success' => true,
                'shipper' => $booking->shipper,
                'client_name' => $booking->client_name,
                'available_slots' => [
                    '20' => $booking->available_20,
                    '40' => $booking->available_40,
                    '45' => $booking->available_45
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Get Shipper Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get shipper information'
            ], 500);
        }
    }

    /**
     * Get Pre-Inventory Data by Container Number
     * Used by React components (ProcessGateInModal) to load saved data
     */
    public function getPreInventoryData($containerNo)
    {
        try {
            $prefix = $this->prefix;
            
            $result = DB::selectOne("
                SELECT
                    p.p_id,
                    p.container_no,
                    p.client_id,
                    c.client_name,
                    CAST(COALESCE(p.size_type, 0) AS UNSIGNED) as sizetype_id,
                    p.iso_code,
                    p.cnt_class as cnt_class,
                    CAST(COALESCE(p.cnt_status, 0) AS UNSIGNED) as cnt_status,
                    p.date_mnfg,
                    p.remarks,
                    p.checker_id,
                    u.full_name as checker_name
                FROM {$prefix}pre_inventory p
                LEFT JOIN {$prefix}clients c ON c.c_id = p.client_id
                LEFT JOIN {$prefix}users u ON u.user_id = CAST(p.checker_id AS UNSIGNED)
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
            Log::error('Get Pre-Inventory Data Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching pre-inventory data: ' . $e->getMessage()
            ], 500);
        }
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PreInventory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

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
                    TIMESTAMPDIFF(MINUTE, p.date_added, COALESCE(p.date_completed, NOW())) AS runtime,
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
            
            $this->logAudit('Add Pre-In', "Created pre-in record: {$containerNo}", Auth::check() ? Auth::user()->user_id : 0);
            
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
            
            $this->logAudit('Add Pre-Out', "Created pre-out record: Plate {$plateNo}", Auth::check() ? Auth::user()->user_id : 0);
            
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
            
            // Update
            DB::update(
                "UPDATE {$this->prefix}pre_inventory 
                 SET container_no = :cno, client_id = :cid 
                 WHERE p_id = :id",
                ['cno' => $containerNo, 'cid' => $client->c_id, 'id' => $realId]
            );
            
            $this->logAudit('Update Pre-In', "Updated pre-in: {$containerNo}", Auth::check() ? Auth::user()->user_id : 0);
            
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
            
            // Update
            DB::update(
                "UPDATE {$this->prefix}pre_inventory 
                 SET plate_no = :pno, hauler = :hau 
                 WHERE p_id = :id",
                ['pno' => $plateNo, 'hau' => $hauler, 'id' => $realId]
            );
            
            $this->logAudit('Update Pre-Out', "Updated pre-out: Plate {$plateNo}", Auth::check() ? Auth::user()->user_id : 0);
            
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
            
            $this->logAudit("Delete Pre-{$gateStatus}", "Deleted pre-{$gateStatus}: {$identifier}", Auth::check() ? Auth::user()->user_id : 0);
            
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
            \Log::error("Audit log failed: " . $e->getMessage());
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
}

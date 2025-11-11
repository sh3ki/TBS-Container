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
                'checker_id' => 'required|string',
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
                "SELECT COUNT(*) as count FROM {$this->prefix}container_banned WHERE container_no = ?",
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
                "SELECT COUNT(*) as count FROM {$this->prefix}container_hold WHERE container_no = ?",
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
                    (container_no, client_id, date_mnfg, cnt_status, size_type, iso_code, cnt_class, 
                     vessel, voyage, checker_id, ex_consignee, load_type, plate_no, hauler, hauler_driver, 
                     license_no, location, chasis, contact_no, bol, remarks, date_added, complete)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
                        $validated['checker_id'],
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
                        0 // Not yet gated out
                    ]
                );

                // Get the last inserted inventory ID
                $inventoryId = DB::getPdo()->lastInsertId();

                // Update pre_inventory status to finished
                DB::update(
                    "UPDATE {$this->prefix}pre_inventory SET status = 1, inv_id = ?, date_completed = ? WHERE p_id = ?",
                    [$inventoryId, now(), $validated['p_id']]
                );

                // Log audit
                $user = Auth::user();
                $this->logAudit(
                    'PROCESS_GATE_IN',
                    "Processed Gate IN for container: {$validated['container_no']}",
                    $user ? $user->user_id : null
                );

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
                'cnt_status' => 'required|integer',
                'size_type' => 'required|integer',
                'load_type' => 'required|integer',
                'booking_no' => 'required|string',
                'shipper' => 'required|string',
                'seal_no' => 'required|string',
                'checker_id' => 'required|string',
                'contact_no' => 'required|string',
                'plate_no' => 'required|string',
                'hauler' => 'required|string',
                'save_and_book' => 'required|string|in:YES,NO',
                'remarks' => 'nullable|string'
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
                "SELECT inv_id FROM {$this->prefix}inventory WHERE container_no = ? AND complete = 0",
                [$validated['container_no']]
            );
            
            if (empty($containerCheck)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container not found in yard or already gated out'
                ], 422);
            }

            $inventoryId = $containerCheck[0]->inv_id;

            DB::beginTransaction();

            try {
                // Update inventory record
                DB::update(
                    "UPDATE {$this->prefix}inventory 
                     SET complete = 1, date_out = ?, cnt_status = ?, size_type = ?, load_type = ?,
                         booking_no = ?, shipper = ?, seal_no = ?, checker_id = ?, contact_no = ?,
                         plate_no_out = ?, hauler_out = ?, remarks_out = ?, save_and_book = ?
                     WHERE container_no = ? AND complete = 0",
                    [
                        now(),
                        $validated['cnt_status'],
                        $validated['size_type'],
                        $validated['load_type'],
                        $validated['booking_no'],
                        $validated['shipper'],
                        $validated['seal_no'],
                        $validated['checker_id'],
                        $validated['contact_no'],
                        $validated['plate_no'],
                        $validated['hauler'],
                        $validated['remarks'] ?? '',
                        $validated['save_and_book'],
                        $validated['container_no']
                    ]
                );

                // Update pre_inventory status to finished
                DB::update(
                    "UPDATE {$this->prefix}pre_inventory SET status = 1 WHERE p_id = ?",
                    [$validated['p_id']]
                );

                // Log audit
                $user = Auth::user();
                $this->logAudit(
                    'PROCESS_GATE_OUT',
                    "Processed Gate OUT for container: {$validated['container_no']}",
                    $user ? $user->user_id : null
                );

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
    public function printGatePass($id)
    {
        try {
            // Get inventory record with all related data
            $record = DB::selectOne("
                SELECT 
                    i.inv_id,
                    CASE 
                        WHEN i.gate_status='IN' THEN CONCAT(i.inv_id,'I')
                        ELSE CONCAT(i.inv_id,'O')
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
                    i.shipper
                FROM {$this->prefix}inventory i
                LEFT JOIN {$this->prefix}container_status cs ON i.container_status=cs.s_id
                LEFT JOIN {$this->prefix}container_size_type st ON i.size_type=st.s_id
                LEFT JOIN {$this->prefix}clients c ON c.c_id=i.client_id
                LEFT JOIN {$this->prefix}load_type lt ON lt.l_id=i.load_type
                LEFT JOIN {$this->prefix}users u ON u.user_id=i.user_id
                WHERE i.inv_id = ? AND c.archived=0
            ", [$id]);

            if (!$record) {
                abort(404, 'Record not found');
            }

            // Convert stdClass to array for view
            $data = (array) $record;

            // Return HTML view for printing (auto-print via JavaScript)
            return view('pdfs.gate-pass', compact('data'));

        } catch (\Exception $e) {
            Log::error('Print Gate Pass Error: ' . $e->getMessage());
            abort(500, 'Failed to generate print document');
        }
    }
}

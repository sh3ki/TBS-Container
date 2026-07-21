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
     * Detects changes and logs as EDIT if data already exists, otherwise logs as GATE_IN
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

            // Fetch existing record to check if it's an update or new submission
            $existingRecord = DB::selectOne("
                SELECT p_id, date_completed, container_no, client_id, size_type, iso_code, cnt_status, cnt_class, remarks, date_mnfg
                FROM {$prefix}pre_inventory WHERE p_id = ?
            ", [$pId]);

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

            // Fetch lookup data for display names
            $clientId = $request->input('client_id');
            $sizeTypeId = $request->input('size_type');
            $statusId = $request->input('cnt_status');
            $classValue = $request->input('cnt_class');
            
            $client = DB::selectOne("SELECT client_name FROM {$prefix}clients WHERE c_id = ?", [$clientId]);
            $sizeType = DB::selectOne("SELECT size, type FROM {$prefix}container_size_type WHERE s_id = ?", [$sizeTypeId]);
            $status = DB::selectOne("SELECT status FROM {$prefix}container_status WHERE s_id = ?", [$statusId]);
            $checkerName = $user ? $user->full_name : 'Unknown';

            // Determine if this is an edit (already has date_completed) or new submission
            $isEdit = $existingRecord && $existingRecord->date_completed !== null;

            if ($isEdit) {
                // Build EDIT audit log with before/after changes
                $changes = $this->getGateInChanges($existingRecord, $request->all(), $prefix);
                
                if (!empty($changes)) {
                    $auditDescription = '[MOBILE] Edited Pre-In record for Container "' . $containerNo . '": ' . implode(' | ', $changes);
                    $auditAction = 'EDIT';
                } else {
                    // No changes detected, still log as GATE_IN
                    $auditDescription = '[MOBILE] GATE IN processed - ' .
                        'Container: ' . $containerNo . ' | ' .
                        'Client: ' . ($client->client_name ?? 'N/A') . ' | ' .
                        'Checker: ' . $checkerName . ' | ' .
                        'Size/Type: ' . (($sizeType->size ?? '') . ($sizeType->type ?? '')) . ' | ' .
                        'ISO Code: ' . ($request->input('iso_code') ?? 'N/A') . ' | ' .
                        'Manufactured Date: ' . ($request->input('date_mnfg') ?? 'N/A') . ' | ' .
                        'Class: ' . ($classValue ?? 'N/A') . ' | ' .
                        'Container Status: ' . ($status->status ?? 'N/A') . ' | ' .
                        'Remarks: ' . ($request->input('remarks') ?? 'N/A');
                    $auditAction = 'GATE_IN';
                }
            } else {
                // New submission
                $auditDescription = '[MOBILE] GATE IN processed - ' .
                    'Container: ' . $containerNo . ' | ' .
                    'Client: ' . ($client->client_name ?? 'N/A') . ' | ' .
                    'Checker: ' . $checkerName . ' | ' .
                    'Size/Type: ' . (($sizeType->size ?? '') . ($sizeType->type ?? '')) . ' | ' .
                    'ISO Code: ' . ($request->input('iso_code') ?? 'N/A') . ' | ' .
                    'Manufactured Date: ' . ($request->input('date_mnfg') ?? 'N/A') . ' | ' .
                    'Class: ' . ($classValue ?? 'N/A') . ' | ' .
                    'Container Status: ' . ($status->status ?? 'N/A') . ' | ' .
                    'Remarks: ' . ($request->input('remarks') ?? 'N/A');
                $auditAction = 'GATE_IN';
            }

            // Log audit
            DB::table('audit_logs')->insert([
                'action' => $auditAction,
                'description' => $auditDescription,
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
     * Compare Gate IN changes and return formatted audit description
     */
    private function getGateInChanges($oldRecord, $newData, $prefix)
    {
        $changes = [];

        // Container No
        $oldCno = $oldRecord->container_no ?? '';
        $newCno = $newData['container_no'] ?? '';
        if ($oldCno !== $newCno) {
            $changes[] = 'Container: "' . $oldCno . '" -> "' . $newCno . '"';
        }

        // Client
        $oldClientId = $oldRecord->client_id ?? 0;
        $newClientId = $newData['client_id'] ?? 0;
        if ($oldClientId != $newClientId) {
            $oldClient = DB::selectOne("SELECT client_name FROM {$prefix}clients WHERE c_id = ?", [$oldClientId]);
            $newClient = DB::selectOne("SELECT client_name FROM {$prefix}clients WHERE c_id = ?", [$newClientId]);
            $changes[] = 'Client: "' . ($oldClient->client_name ?? 'N/A') . '" -> "' . ($newClient->client_name ?? 'N/A') . '"';
        }

        // Size/Type
        $oldSizeId = $oldRecord->size_type ?? 0;
        $newSizeId = $newData['size_type'] ?? 0;
        if ($oldSizeId != $newSizeId) {
            $oldSize = DB::selectOne("SELECT size, type FROM {$prefix}container_size_type WHERE s_id = ?", [$oldSizeId]);
            $newSize = DB::selectOne("SELECT size, type FROM {$prefix}container_size_type WHERE s_id = ?", [$newSizeId]);
            $oldSizeStr = ($oldSize->size ?? '') . ($oldSize->type ?? '');
            $newSizeStr = ($newSize->size ?? '') . ($newSize->type ?? '');
            $changes[] = 'Size/Type: "' . $oldSizeStr . '" -> "' . $newSizeStr . '"';
        }

        // ISO Code
        $oldIso = ($oldRecord->iso_code ?? '') ? trim($oldRecord->iso_code) : '';
        $newIso = ($newData['iso_code'] ?? '') ? trim($newData['iso_code']) : '';
        if ($oldIso !== $newIso) {
            $changes[] = 'ISO Code: "' . $oldIso . '" -> "' . $newIso . '"';
        }

        // Manufactured Date
        $oldDate = $oldRecord->date_mnfg ?? '';
        $newDate = $newData['date_mnfg'] ?? '';
        if ($oldDate !== $newDate) {
            $changes[] = 'Manufactured Date: "' . $oldDate . '" -> "' . $newDate . '"';
        }

        // Class
        $oldClass = $oldRecord->cnt_class ?? '';
        $newClass = $newData['cnt_class'] ?? '';
        if ($oldClass !== $newClass) {
            $changes[] = 'Class: "' . $oldClass . '" -> "' . $newClass . '"';
        }

        // Container Status
        $oldStatusId = $oldRecord->cnt_status ?? 0;
        $newStatusId = $newData['cnt_status'] ?? 0;
        if ($oldStatusId != $newStatusId) {
            $oldStatus = DB::selectOne("SELECT status FROM {$prefix}container_status WHERE s_id = ?", [$oldStatusId]);
            $newStatus = DB::selectOne("SELECT status FROM {$prefix}container_status WHERE s_id = ?", [$newStatusId]);
            $changes[] = 'Container Status: "' . ($oldStatus->status ?? 'N/A') . '" -> "' . ($newStatus->status ?? 'N/A') . '"';
        }

        // Remarks
        $oldRemarks = $oldRecord->remarks ?? '';
        $newRemarks = $newData['remarks'] ?? '';
        if ($oldRemarks !== $newRemarks) {
            $changes[] = 'Remarks: "' . $oldRemarks . '" -> "' . $newRemarks . '"';
        }

        return $changes;
    }

    /**
     * Process Gate OUT - Complete the gate out transaction
     * Detects changes and logs as EDIT if data already exists, otherwise logs as GATE_OUT
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

            // Fetch existing record to check if it's an update or new submission
            $existingRecord = DB::selectOne("
                SELECT p_id, date_completed, plate_no, hauler, container_no, client_id, size_type, iso_code, cnt_status, cnt_class, remarks
                FROM {$prefix}pre_inventory WHERE p_id = ?
            ", [$pId]);

            // Prepare update data for pre_inventory with container details
            $updateData = [
                'container_no' => $containerNo,
                'client_id' => $request->input('client_id'),
                'size_type' => $request->input('size_type'),
                'iso_code' => $request->input('iso_code'),
                'cnt_class' => $request->input('class'),
                'cnt_status' => $request->input('container_status'),
                'remarks' => $request->input('remarks'),
                'checker_id' => $request->input('checker_id') ?? $userId,
            ];

            // Update pre_inventory with container details
            DB::table('pre_inventory')
                ->where('p_id', $pId)
                ->update($updateData);

            // Get plate_no and hauler from pre_inventory record for display
            $plateNo = $existingRecord->plate_no ?? 'N/A';
            $hauler = $existingRecord->hauler ?? 'N/A';

            // Determine if this is an edit (already has date_completed) or new submission
            $isEdit = $existingRecord && $existingRecord->date_completed !== null;

            if ($isEdit) {
                // Build EDIT audit log with before/after changes
                $changes = $this->getGateOutChanges($existingRecord, $request->all(), $prefix);
                
                if (!empty($changes)) {
                    $auditDescription = '[MOBILE] Edited Pre-Out record for Plate No "' . $plateNo . '": ' . implode(' | ', $changes);
                    $auditAction = 'EDIT';
                } else {
                    // No changes detected, still log as GATE_OUT
                    $auditDescription = '[MOBILE] GATE OUT processed - ' .
                        'Plate No: ' . $plateNo . ' | ' .
                        'Hauler: ' . $hauler . ' | ' .
                        'Container No: ' . $containerNo;
                    $auditAction = 'GATE_OUT';
                }
            } else {
                // New submission
                // Fetch lookup data for display names
                $clientId = $request->input('client_id');
                $sizeTypeId = $request->input('size_type');
                $statusId = $request->input('container_status');
                $classValue = $request->input('class');
                
                $client = DB::selectOne("SELECT client_name FROM {$prefix}clients WHERE c_id = ?", [$clientId]);
                $sizeType = DB::selectOne("SELECT size, type FROM {$prefix}container_size_type WHERE s_id = ?", [$sizeTypeId]);
                $status = DB::selectOne("SELECT status FROM {$prefix}container_status WHERE s_id = ?", [$statusId]);

                $auditDescription = '[MOBILE] GATE OUT processed - ' .
                    'Plate No: ' . $plateNo . ' | ' .
                    'Hauler: ' . $hauler . ' | ' .
                    'Container No: ' . $containerNo . ' | ' .
                    'Client: ' . ($client->client_name ?? 'N/A') . ' | ' .
                    'Size/Type: ' . (($sizeType->size ?? '') . ($sizeType->type ?? '')) . ' | ' .
                    'ISO Code: ' . ($request->input('iso_code') ?? 'N/A') . ' | ' .
                    'Class: ' . ($classValue ?? 'N/A') . ' | ' .
                    'Container Status: ' . ($status->status ?? 'N/A') . ' | ' .
                    'Remarks: ' . ($request->input('remarks') ?? 'N/A');
                $auditAction = 'GATE_OUT';
            }

            // Log audit
            DB::table('audit_logs')->insert([
                'action' => $auditAction,
                'description' => $auditDescription,
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
     * Compare Gate OUT changes and return formatted audit description
     */
    private function getGateOutChanges($oldRecord, $newData, $prefix)
    {
        $changes = [];

        // Plate No
        $oldPlate = $oldRecord->plate_no ?? '';
        $newPlate = $newData['plate_no'] ?? '';
        if ($oldPlate !== $newPlate) {
            $changes[] = 'Plate No: "' . $oldPlate . '" -> "' . $newPlate . '"';
        }

        // Hauler
        $oldHauler = $oldRecord->hauler ?? '';
        $newHauler = $newData['hauler'] ?? '';
        if ($oldHauler !== $newHauler) {
            $changes[] = 'Hauler: "' . $oldHauler . '" -> "' . $newHauler . '"';
        }

        // Container No
        $oldCno = $oldRecord->container_no ?? '';
        $newCno = $newData['container_no'] ?? '';
        if ($oldCno !== $newCno) {
            $changes[] = 'Container: "' . $oldCno . '" -> "' . $newCno . '"';
        }

        // Client
        $oldClientId = $oldRecord->client_id ?? 0;
        $newClientId = $newData['client_id'] ?? 0;
        if ($oldClientId != $newClientId) {
            $oldClient = DB::selectOne("SELECT client_name FROM {$prefix}clients WHERE c_id = ?", [$oldClientId]);
            $newClient = DB::selectOne("SELECT client_name FROM {$prefix}clients WHERE c_id = ?", [$newClientId]);
            $changes[] = 'Client: "' . ($oldClient->client_name ?? 'N/A') . '" -> "' . ($newClient->client_name ?? 'N/A') . '"';
        }

        // Size/Type
        $oldSizeId = $oldRecord->size_type ?? 0;
        $newSizeId = $newData['size_type'] ?? 0;
        if ($oldSizeId != $newSizeId) {
            $oldSize = DB::selectOne("SELECT size, type FROM {$prefix}container_size_type WHERE s_id = ?", [$oldSizeId]);
            $newSize = DB::selectOne("SELECT size, type FROM {$prefix}container_size_type WHERE s_id = ?", [$newSizeId]);
            $oldSizeStr = ($oldSize->size ?? '') . ($oldSize->type ?? '');
            $newSizeStr = ($newSize->size ?? '') . ($newSize->type ?? '');
            $changes[] = 'Size/Type: "' . $oldSizeStr . '" -> "' . $newSizeStr . '"';
        }

        // ISO Code
        $oldIso = ($oldRecord->iso_code ?? '') ? trim($oldRecord->iso_code) : '';
        $newIso = ($newData['iso_code'] ?? '') ? trim($newData['iso_code']) : '';
        if ($oldIso !== $newIso) {
            $changes[] = 'ISO Code: "' . $oldIso . '" -> "' . $newIso . '"';
        }

        // Class
        $oldClass = $oldRecord->cnt_class ?? '';
        $newClass = $newData['class'] ?? '';
        if ($oldClass !== $newClass) {
            $changes[] = 'Class: "' . $oldClass . '" -> "' . $newClass . '"';
        }

        // Container Status
        $oldStatusId = $oldRecord->cnt_status ?? 0;
        $newStatusId = $newData['container_status'] ?? 0;
        if ($oldStatusId != $newStatusId) {
            $oldStatus = DB::selectOne("SELECT status FROM {$prefix}container_status WHERE s_id = ?", [$oldStatusId]);
            $newStatus = DB::selectOne("SELECT status FROM {$prefix}container_status WHERE s_id = ?", [$newStatusId]);
            $changes[] = 'Container Status: "' . ($oldStatus->status ?? 'N/A') . '" -> "' . ($newStatus->status ?? 'N/A') . '"';
        }

        // Remarks
        $oldRemarks = $oldRecord->remarks ?? '';
        $newRemarks = $newData['remarks'] ?? '';
        if ($oldRemarks !== $newRemarks) {
            $changes[] = 'Remarks: "' . $oldRemarks . '" -> "' . $newRemarks . '"';
        }

        return $changes;
    }

    /**
     * Get Container Details by Container Number
     * For Gate IN: Fetches from PRE-INVENTORY 
     * For Gate OUT: Fetches from INVENTORY to get approval_notes and remarks
     */
    public function getContainerDetails(Request $request)
    {
        try {
            $containerNo = strtoupper(trim($request->input('container_no', '')));
            $username = $request->input('username', 'mobile-user');
            $gateStatus = $request->input('gate_status', 'IN');

            if (empty($containerNo)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container number is required.'
                ], 400);
            }

            $prefix = $this->prefix;

            // For Gate OUT - fetch from inventory table to get approval_notes and remarks
            if ($gateStatus === 'OUT') {
                $result = DB::selectOne("
                    SELECT
                        i.i_id,
                        i.container_no,
                        i.client_id,
                        c.client_name,
                        CAST(COALESCE(i.size_type, 0) AS UNSIGNED) as sizetype_id,
                        i.iso_code,
                        i.class,
                        i.container_status,
                        i.approval_notes,
                        i.remarks,
                        p.remarks as pre_inventory_remarks,
                        i.shipper,
                        p.checker_id,
                        u.full_name as checker_name
                    FROM {$prefix}inventory i
                    LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                    LEFT JOIN {$prefix}pre_inventory p ON p.container_no = i.container_no AND p.status = 0
                    LEFT JOIN {$prefix}users u ON u.user_id = CAST(p.checker_id AS UNSIGNED)
                    WHERE i.container_no = ? AND i.gate_status = 'IN' AND i.complete = 0
                    ORDER BY i.date_added DESC
                    LIMIT 1
                ", [$containerNo]);

                if (!$result) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Container not found in inventory or already processed.'
                    ], 404);
                }
            } else {
                // For Gate IN - fetch from pre_inventory table
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

    /**
     * Upload container pictures from mobile
     * Path: /var/www/tbscontainermnl/container_pics/{date (mm-dd-yyyy)}/{'in' or 'out'}/{container_no.(imagenumber)}.jpg
     */
    public function uploadContainerPictures(Request $request)
    {
        try {
            $containerNo = strtoupper(trim($request->input('container_no', '')));
            $gateStatus = strtolower(trim($request->input('gate_status', 'in')));
            
            if (empty($containerNo)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container number is required'
                ], 400);
            }

            if (!$request->hasFile('pictures')) {
                return response()->json([
                    'success' => false,
                    'message' => 'No pictures provided'
                ], 400);
            }

            // Get current date in mm-dd-yyyy format
            $dateFolder = date('m-d-Y');
            $statusFolder = ($gateStatus === 'out') ? 'out' : 'in';
            
            // Base directory path
            $baseDir = '/var/www/tbscontainermnl/container_pics';
            $targetDir = $baseDir . '/' . $dateFolder . '/' . $statusFolder;
            
            // Create directory if it doesn't exist
            if (!is_dir($targetDir)) {
                if (!mkdir($targetDir, 0755, true)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Failed to create directory structure'
                    ], 500);
                }
            }

            $pictures = $request->file('pictures');
            if (!is_array($pictures)) {
                $pictures = [$pictures];
            }

            $uploadedFiles = [];
            $imageNumber = 1;

            foreach ($pictures as $picture) {
                if ($picture && $picture->isValid()) {
                    // File name format: {containerNo}({imageNumber}).jpg
                    $fileName = $containerNo . '(' . $imageNumber . ').jpg';
                    $filePath = $targetDir . '/' . $fileName;
                    
                    // Move the uploaded file to the target directory
                    $picture->move($targetDir, $fileName);
                    
                    $uploadedFiles[] = [
                        'name' => $fileName,
                        'path' => 'container_pics/' . $dateFolder . '/' . $statusFolder . '/' . $fileName,
                        'image_number' => $imageNumber
                    ];
                    
                    $imageNumber++;
                }
            }

            if (empty($uploadedFiles)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No valid pictures were uploaded'
                ], 400);
            }

            Log::info('Mobile container pictures uploaded', [
                'container_no' => $containerNo,
                'gate_status' => $gateStatus,
                'count' => count($uploadedFiles),
                'files' => $uploadedFiles
            ]);

            return response()->json([
                'success' => true,
                'message' => count($uploadedFiles) . ' picture(s) uploaded successfully',
                'data' => [
                    'container_no' => $containerNo,
                    'gate_status' => $gateStatus,
                    'uploaded_count' => count($uploadedFiles),
                    'files' => $uploadedFiles
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Mobile upload container pictures error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error uploading pictures: ' . $e->getMessage()
            ], 500);
        }
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PreInventory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;

class GateinoutController extends Controller
{
    private $prefix;

    public function __construct()
    {
        $this->prefix = env('DB_PREFIX', 'fjp_');
    }

    /**
     * Get Pre-Inventory List (Combined for both IN and OUT)
     * Exact replica of legacy getPreInventoryListAction()
     */
    public function getPreInventoryList(Request $request)
    {
        try {
            $start = $request->input('start', 0);
            $length = $request->input('length', 500);
            $search = $request->input('key', '');
            
            $results = PreInventory::getListWithDetails('', $search, $start, $length);
            
            // Get user permissions for edit/delete buttons
            $pageRecordAccess = $this->getPageRecordAccess();
            
            return response()->json([
                'success' => true,
                'prelist' => $results,
                'mr' => $pageRecordAccess, // [0] = edit permission, [1] = delete permission
                'limit' => [
                    'pages' => ceil(count($results) / 15)
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
     * Get Pre-In list (Guards - Create Pre-IN)
     */
    public function getPreInList(Request $request)
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            $start = $request->input('start', 0);
            $length = $request->input('length', 25);
            $search = $request->input('search', null);
            
            $query = "SELECT p.*, c.client_name, st.size, st.type, st.description as size_desc, u.full_name as created_by
                     FROM {$prefix}pre_inventory p
                     LEFT JOIN {$prefix}clients c ON c.c_id = p.client_id
                     LEFT JOIN {$prefix}container_size_type st ON st.s_id = p.size_type
                     LEFT JOIN {$prefix}users u ON u.user_id = p.user_id
                     WHERE p.gate_status = 'IN' AND p.status = 0";
            
            $params = [];
            if ($search) {
                $query .= " AND (p.container_no LIKE :search OR c.client_name LIKE :search)";
                $params['search'] = "%{$search}%";
            }
            
            $totalQuery = "SELECT COUNT(*) as total FROM ({$query}) as t";
            $total = DB::select($totalQuery, $params)[0]->total ?? 0;
            
            $query .= " ORDER BY p.date_added DESC LIMIT :start, :length";
            $params['start'] = (int)$start;
            $params['length'] = (int)$length;
            
            $results = DB::select($query, $params);
            foreach ($results as $row) { $row->hashed_id = md5($row->p_id); }
            
            return response()->json(['success' => true, 'data' => $results, 'total' => $total]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    // Store Pre-In
    public function storePreIn(Request $request)
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            $validator = Validator::make($request->all(), [
                'container_no' => 'required|size:11',
                'client_id' => 'required|integer',
                'size_type' => 'required|integer',
                'cnt_class' => 'required|in:E,F'
            ]);
            if ($validator->fails()) { return response()->json(['success' => false, 'errors' => $validator->errors()], 422); }
            
            $containerNo = strtoupper(trim($request->container_no));
            $existing = DB::select("SELECT i_id FROM {$prefix}inventory WHERE container_no = :c AND complete = 0", ['c' => $containerNo]);
            if (count($existing) > 0) { return response()->json(['success' => false, 'message' => 'Container already in inventory!'], 422); }
            
            $banned = DB::select("SELECT b_id FROM {$prefix}ban_containers WHERE container_no = :c", ['c' => $containerNo]);
            $banWarn = count($banned) > 0 ? 'WARNING: Container is BANNED!' : null;
            
            DB::insert("INSERT INTO {$prefix}pre_inventory 
                (container_no, client_id, plate_no, hauler, gate_status, user_id, status, date_added, remarks, size_type, cnt_class, cnt_status, iso_code, checker_id)
                VALUES (:container_no, :client_id, :plate, :hauler, 'IN', :user, 0, NOW(), :remarks, :size, :class, '', '', '')",
                ['container_no' => $containerNo, 'client_id' => $request->client_id, 'plate' => $request->plate_no ?? '',
                 'hauler' => $request->hauler ?? '', 'user' => auth()->id(), 'remarks' => $request->remarks ?? '',
                 'size' => $request->size_type, 'class' => $request->cnt_class]);
            
            $this->logAudit('Add Pre-In', "Created pre-in: {$containerNo}", auth()->id());
            return response()->json(['success' => true, 'message' => 'Pre-In created!', 'warning' => $banWarn]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    // Delete Pre-In
    public function deletePreIn($hashedId)
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            $all = DB::select("SELECT p_id, container_no FROM {$prefix}pre_inventory WHERE gate_status = 'IN' AND status = 0");
            $realId = null; $containerNo = null;
            foreach ($all as $p) { if (md5($p->p_id) === $hashedId) { $realId = $p->p_id; $containerNo = $p->container_no; break; } }
            if (!$realId) { return response()->json(['success' => false, 'message' => 'Not found'], 404); }
            
            DB::delete("DELETE FROM {$prefix}pre_inventory WHERE p_id = :id", ['id' => $realId]);
            $this->logAudit('Delete Pre-In', "Deleted pre-in: {$containerNo}", auth()->id());
            return response()->json(['success' => true, 'message' => 'Pre-In deleted!']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    // Approve Gate-In
    public function approveGateIn($hashedId)
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            $all = DB::select("SELECT p_id FROM {$prefix}pre_inventory WHERE gate_status = 'IN' AND status = 0");
            $realId = null;
            foreach ($all as $p) { if (md5($p->p_id) === $hashedId) { $realId = $p->p_id; break; } }
            if (!$realId) { return response()->json(['success' => false, 'message' => 'Not found'], 404); }
            
            $preIn = DB::select("SELECT * FROM {$prefix}pre_inventory WHERE p_id = :id", ['id' => $realId])[0];
            $existing = DB::select("SELECT i_id FROM {$prefix}inventory WHERE container_no = :c AND complete = 0", ['c' => $preIn->container_no]);
            if (count($existing) > 0) { return response()->json(['success' => false, 'message' => 'Already in inventory!'], 422); }
            
            $banned = DB::select("SELECT notes FROM {$prefix}ban_containers WHERE container_no = :c", ['c' => $preIn->container_no]);
            if (count($banned) > 0) { return response()->json(['success' => false, 'message' => "BANNED! {$banned[0]->notes}"], 422); }
            
            DB::insert("INSERT INTO {$prefix}inventory 
                (container_no, client_id, container_status, size_type, iso_code, class, vessel, voyage, origin, ex_consignee, load_type, plate_no, hauler, hauler_driver, license_no, location, chasis, booking, shipper, seal_no, remarks, gate_status, date_manufactured, date_added, user_id, complete, out_id, approval_notes, approval_date, contact_no, bill_of_lading)
                VALUES (:c, :client, 1, :size, :iso, :class, '', '', '', '', 1, :plate, :hauler, '', '', '', '', '', '', '', :remarks, 'IN', NULL, NOW(), :user, 0, NULL, NULL, NULL, '', '')",
                ['c' => $preIn->container_no, 'client' => $preIn->client_id, 'size' => $preIn->size_type,
                 'iso' => $preIn->iso_code ?? '', 'class' => $preIn->cnt_class, 'plate' => $preIn->plate_no ?? '',
                 'hauler' => $preIn->hauler ?? '', 'remarks' => $preIn->remarks ?? '', 'user' => auth()->id()]);
            
            DB::delete("DELETE FROM {$prefix}pre_inventory WHERE p_id = :id", ['id' => $realId]);
            $this->logAudit('Gate In', "Approved: {$preIn->container_no}", auth()->id());
            return response()->json(['success' => true, 'message' => 'Container gated in!']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    // Get Pre-Out list
    public function getPreOutList(Request $request)
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            $start = $request->input('start', 0);
            $length = $request->input('length', 25);
            
            $query = "SELECT p.*, i.client_id, c.client_name, st.size, st.type, u.full_name as created_by
                     FROM {$prefix}pre_inventory p
                     LEFT JOIN {$prefix}inventory i ON i.container_no = p.container_no
                     LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id
                     LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type
                     LEFT JOIN {$prefix}users u ON u.user_id = p.user_id
                     WHERE p.gate_status = 'OUT' AND p.status = 0
                     ORDER BY p.date_added DESC LIMIT :start, :length";
            
            $results = DB::select($query, ['start' => (int)$start, 'length' => (int)$length]);
            foreach ($results as $row) {
                $row->hashed_id = md5($row->p_id);
                $hold = DB::select("SELECT h_id FROM {$prefix}hold_containers WHERE container_no = :c", ['c' => $row->container_no]);
                $row->is_on_hold = count($hold) > 0;
            }
            return response()->json(['success' => true, 'data' => $results]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    // Store Pre-Out
    public function storePreOut(Request $request)
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            $validator = Validator::make($request->all(), [
                'container_no' => 'required|size:11',
                'plate_no' => 'required|string|max:20'
            ]);
            if ($validator->fails()) { return response()->json(['success' => false, 'errors' => $validator->errors()], 422); }
            
            $containerNo = strtoupper(trim($request->container_no));
            $inv = DB::select("SELECT i_id, client_id FROM {$prefix}inventory WHERE container_no = :c AND complete = 0", ['c' => $containerNo]);
            if (empty($inv)) { return response()->json(['success' => false, 'message' => 'Container not in yard!'], 422); }
            
            $hold = DB::select("SELECT h_id FROM {$prefix}hold_containers WHERE container_no = :c", ['c' => $containerNo]);
            $holdWarn = count($hold) > 0 ? 'WARNING: Container is ON HOLD!' : null;
            
            DB::insert("INSERT INTO {$prefix}pre_inventory 
                (container_no, client_id, plate_no, hauler, gate_status, user_id, status, date_added, remarks, size_type, cnt_class, cnt_status, iso_code, checker_id)
                VALUES (:c, :client, :plate, '', 'OUT', :user, 0, NOW(), :remarks, 0, '', '', '', '')",
                ['c' => $containerNo, 'client' => $inv[0]->client_id, 'plate' => $request->plate_no,
                 'user' => auth()->id(), 'remarks' => $request->remarks ?? '']);
            
            $this->logAudit('Add Pre-Out', "Created pre-out: {$containerNo}", auth()->id());
            return response()->json(['success' => true, 'message' => 'Pre-Out created!', 'warning' => $holdWarn]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    // Delete Pre-Out
    public function deletePreOut($hashedId)
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            $all = DB::select("SELECT p_id, container_no FROM {$prefix}pre_inventory WHERE gate_status = 'OUT' AND status = 0");
            $realId = null; $containerNo = null;
            foreach ($all as $p) { if (md5($p->p_id) === $hashedId) { $realId = $p->p_id; $containerNo = $p->container_no; break; } }
            if (!$realId) { return response()->json(['success' => false, 'message' => 'Not found'], 404); }
            
            DB::delete("DELETE FROM {$prefix}pre_inventory WHERE p_id = :id", ['id' => $realId]);
            $this->logAudit('Delete Pre-Out', "Deleted pre-out: {$containerNo}", auth()->id());
            return response()->json(['success' => true, 'message' => 'Pre-Out deleted!']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    // Approve Gate-Out
    public function approveGateOut($hashedId)
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            $all = DB::select("SELECT p_id FROM {$prefix}pre_inventory WHERE gate_status = 'OUT' AND status = 0");
            $realId = null;
            foreach ($all as $p) { if (md5($p->p_id) === $hashedId) { $realId = $p->p_id; break; } }
            if (!$realId) { return response()->json(['success' => false, 'message' => 'Not found'], 404); }
            
            $preOut = DB::select("SELECT * FROM {$prefix}pre_inventory WHERE p_id = :id", ['id' => $realId])[0];
            $inv = DB::select("SELECT * FROM {$prefix}inventory WHERE container_no = :c AND complete = 0", ['c' => $preOut->container_no]);
            if (empty($inv)) { return response()->json(['success' => false, 'message' => 'Not in yard!'], 422); }
            $inv = $inv[0];
            
            $hold = DB::select("SELECT notes FROM {$prefix}hold_containers WHERE container_no = :c", ['c' => $preOut->container_no]);
            if (count($hold) > 0) { return response()->json(['success' => false, 'message' => "ON HOLD! {$hold[0]->notes}"], 422); }
            
            DB::update("UPDATE {$prefix}inventory SET complete = 1, gate_status = 'OUT', approval_date = NOW(), approval_notes = :notes, out_id = :user WHERE i_id = :id",
                ['notes' => $preOut->remarks ?? '', 'user' => auth()->id(), 'id' => $inv->i_id]);
            
            DB::delete("DELETE FROM {$prefix}pre_inventory WHERE p_id = :id", ['id' => $realId]);
            $this->logAudit('Gate Out', "Approved: {$preOut->container_no}", auth()->id());
            return response()->json(['success' => true, 'message' => 'Container gated out!']);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    // Get containers in yard
    public function getContainersInYard()
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            $containers = DB::select("SELECT i.container_no, c.client_name, st.size, st.type 
                FROM {$prefix}inventory i 
                LEFT JOIN {$prefix}clients c ON c.c_id = i.client_id 
                LEFT JOIN {$prefix}container_size_type st ON st.s_id = i.size_type 
                WHERE i.complete = 0 ORDER BY i.container_no ASC");
            return response()->json(['success' => true, 'data' => $containers]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    // Get clients
    public function getClients()
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            $clients = DB::select("SELECT c_id, client_name, client_code FROM {$prefix}clients WHERE archived = 0 ORDER BY client_name ASC");
            return response()->json(['success' => true, 'data' => $clients]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    // Get size types
    public function getSizeTypes()
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            $sizeTypes = DB::select("SELECT s_id, size, type, description FROM {$prefix}container_size_type WHERE archived = 0 ORDER BY size ASC, type ASC");
            return response()->json(['success' => true, 'data' => $sizeTypes]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }
    
    // Log audit
    private function logAudit($action, $description, $userId)
    {
        try {
            $prefix = env('DB_PREFIX', 'fjp_');
            DB::insert("INSERT INTO {$prefix}audit_logs (action, description, user_id, date_added, ip_address) VALUES (:act, :desc, :user, NOW(), :ip)",
                ['act' => $action, 'desc' => $description, 'user' => $userId, 'ip' => request()->ip()]);
        } catch (\Exception $e) {}
    }
}

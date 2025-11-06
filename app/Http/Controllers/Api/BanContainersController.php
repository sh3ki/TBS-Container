<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class BanContainersController extends Controller
{
    /**
     * Get all banned containers with optional filters
     */
    public function index(Request $request)
    {
        $query = DB::table('ban_containers')
            ->select(
                'b_id',
                'container_no',
                'notes',
                'date_added'
            )
            ->orderBy('date_added', 'desc');

        // Filter by container number search
        if ($request->has('search') && $request->search) {
            $query->where('container_no', 'like', '%' . $request->search . '%');
        }

        $banContainers = $query->get();

        // Add computed fields
        foreach ($banContainers as $ban) {
            // Check if container is currently in inventory (determines if ban is "active")
            $inInventory = DB::table('inventory')
                ->where('container_no', $ban->container_no)
                ->where('complete', 0)
                ->exists();
            
            $ban->is_active = !$inInventory; // Active if NOT in inventory
            $ban->status = !$inInventory ? 'active' : 'blocked';
            $ban->banned_by = null; // No user_id in table, set to null
        }

        return response()->json([
            'success' => true,
            'data' => $banContainers
        ]);
    }

    /**
     * Add new ban container
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'container_no' => 'required|string|size:11',
            'notes' => 'required|string|max:250',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check if container already banned
        $exists = DB::table('ban_containers')
            ->where('container_no', strtoupper($request->container_no))
            ->first();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'This container is already on the ban list'
            ], 422);
        }

        DB::beginTransaction();
        try {
            $banId = DB::table('ban_containers')->insertGetId([
                'container_no' => strtoupper($request->container_no),
                'notes' => $request->notes,
                'date_added' => now(),
            ]);

            // Log to audit
            DB::table('audit_logs')->insert([
                'action' => 'CREATE',
                'description' => 'Banned container: ' . strtoupper($request->container_no),
                'user_id' => auth()->id(),
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Container added to ban list successfully',
                'data' => ['id' => $banId]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to add container to ban list: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get single ban record
     */
    public function show($id)
    {
        $ban = DB::table('ban_containers')
            ->select(
                'b_id',
                'container_no',
                'notes',
                'date_added'
            )
            ->where('b_id', $id)
            ->first();

        if (!$ban) {
            return response()->json([
                'success' => false,
                'message' => 'Ban record not found'
            ], 404);
        }

        // Add computed fields
        $inInventory = DB::table('inventory')
            ->where('container_no', $ban->container_no)
            ->where('complete', 0)
            ->exists();
        
        $ban->is_active = !$inInventory;
        $ban->status = !$inInventory ? 'active' : 'blocked';
        $ban->banned_by = null; // No user_id in table

        // Get gate-in attempts from audit logs
        $attempts = DB::table('audit_logs')
            ->where('description', 'like', '%' . $ban->container_no . '%')
            ->where('action', 'like', '%GATE%')
            ->orderBy('date_added', 'desc')
            ->limit(10)
            ->get();

        $ban->attempts = $attempts;

        return response()->json([
            'success' => true,
            'data' => $ban
        ]);
    }

    /**
     * Update ban record
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'notes' => 'required|string|max:250',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $ban = DB::table('ban_containers')
            ->where('b_id', $id)
            ->first();

        if (!$ban) {
            return response()->json([
                'success' => false,
                'message' => 'Ban record not found'
            ], 404);
        }

        DB::beginTransaction();
        try {
            DB::table('ban_containers')
                ->where('b_id', $id)
                ->update([
                    'notes' => $request->notes,
                ]);

            // Log to audit
            DB::table('audit_logs')->insert([
                'action' => 'UPDATE',
                'description' => 'Updated ban record for container: ' . $ban->container_no,
                'user_id' => auth()->id(),
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Ban record updated successfully'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to update ban record: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove ban (unban container)
     */
    public function destroy(Request $request, $id)
    {
        $ban = DB::table('ban_containers')
            ->where('b_id', $id)
            ->first();

        if (!$ban) {
            return response()->json([
                'success' => false,
                'message' => 'Ban record not found'
            ], 404);
        }

        DB::beginTransaction();
        try {
            DB::table('ban_containers')
                ->where('b_id', $id)
                ->delete();

            // Log to audit
            DB::table('audit_logs')->insert([
                'action' => 'DELETE',
                'description' => 'Removed ban for container: ' . $ban->container_no,
                'user_id' => auth()->id(),
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Container removed from ban list successfully'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to remove ban: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check if container is banned (used by gate-in validation)
     */
    public function checkBanStatus(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'container_no' => 'required|string|size:11',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $ban = DB::table('ban_containers')
            ->where('container_no', strtoupper($request->container_no))
            ->first();

        $isBanned = $ban !== null;

        return response()->json([
            'success' => true,
            'data' => [
                'is_banned' => $isBanned,
                'ban_details' => $ban,
                'message' => $isBanned ? 'Container is BANNED - Cannot gate in' : 'Container is clear'
            ]
        ]);
    }

    /**
     * Search banned containers
     */
    public function search(Request $request)
    {
        $searchTerm = $request->input('search', '');

        $query = DB::table('ban_containers')
            ->select(
                'b_id',
                'container_no',
                'notes',
                'date_added'
            );

        if ($searchTerm) {
            $query->where(function($q) use ($searchTerm) {
                $q->where('container_no', 'like', '%' . $searchTerm . '%')
                  ->orWhere('notes', 'like', '%' . $searchTerm . '%');
            });
        }

        $results = $query->orderBy('date_added', 'desc')->get();

        // Add computed fields
        foreach ($results as $ban) {
            $inInventory = DB::table('inventory')
                ->where('container_no', $ban->container_no)
                ->where('complete', 0)
                ->exists();
            
            $ban->is_active = !$inInventory;
            $ban->status = !$inInventory ? 'active' : 'blocked';
            $ban->banned_by = null;
        }

        return response()->json([
            'success' => true,
            'data' => $results
        ]);
    }

    /**
     * Bulk add banned containers
     */
    public function bulkAdd(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'container_numbers' => 'required|array|min:1',
            'container_numbers.*' => 'required|string|size:11',
            'notes' => 'required|string|max:250',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $succeeded = [];
        $failed = [];

        DB::beginTransaction();
        try {
            foreach ($request->container_numbers as $containerNo) {
                $containerNo = strtoupper(trim($containerNo));

                // Check if already banned
                $exists = DB::table('ban_containers')
                    ->where('container_no', $containerNo)
                    ->exists();

                if ($exists) {
                    $failed[] = $containerNo . ' (already banned)';
                    continue;
                }

                DB::table('ban_containers')->insert([
                    'container_no' => $containerNo,
                    'notes' => $request->notes,
                    'date_added' => now(),
                ]);

                $succeeded[] = $containerNo;
            }

            // Log to audit
            DB::table('audit_logs')->insert([
                'action' => 'CREATE',
                'description' => 'Bulk added ' . count($succeeded) . ' containers to ban list',
                'user_id' => auth()->id(),
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => count($succeeded) . ' containers added, ' . count($failed) . ' failed',
                'data' => [
                    'succeeded' => $succeeded,
                    'failed' => $failed
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Bulk add failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get statistics
     */
    public function getStats(Request $request)
    {
        $totalBanned = DB::table('ban_containers')->count();
        
        // Get all banned container numbers
        $bannedContainerNos = DB::table('ban_containers')
            ->pluck('container_no')
            ->toArray();

        // Active bans (containers NOT in inventory)
        $activeBans = 0;
        $blockedInInventory = 0;

        foreach ($bannedContainerNos as $containerNo) {
            $inInventory = DB::table('inventory')
                ->where('container_no', $containerNo)
                ->where('complete', 0)
                ->exists();

            if ($inInventory) {
                $blockedInInventory++;
            } else {
                $activeBans++;
            }
        }

        $stats = [
            'total_banned' => $totalBanned,
            'active_bans' => $activeBans,
            'blocked_in_inventory' => $blockedInInventory,
        ];

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }
}

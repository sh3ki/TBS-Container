<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SizeTypeController extends Controller
{
    /**
     * Get all size/type combinations
     */
    public function index(Request $request)
    {
        $query = DB::table('container_size_type')
            ->select(
                's_id',
                'size',
                'type',
                'description',
                'archived',
                'date_added',
                'iso_code'
            )
            ->orderBy('size', 'asc')
            ->orderBy('type', 'asc');

        $sizeTypes = $query->get();

        return response()->json([
            'success' => true,
            'data' => $sizeTypes
        ]);
    }

    /**
     * Get unique sizes with aggregated data
     */
    public function getSizes(Request $request)
    {
        $prefix = config('database.connections.mysql.prefix');
        
        // Get distinct sizes with their usage counts
        $sizes = DB::table('container_size_type')
            ->select(
                'size',
                DB::raw('MAX(archived) as archived'),
                DB::raw('MIN(date_added) as date_added'),
                DB::raw('COUNT(*) as type_count'),
                DB::raw('(SELECT COUNT(*) FROM ' . $prefix . 'inventory WHERE size_type IN (SELECT s_id FROM ' . $prefix . 'container_size_type AS cst WHERE cst.size = ' . $prefix . 'container_size_type.size)) as usage_count')
            )
            ->groupBy('size')
            ->orderBy('size', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $sizes
        ]);
    }

    /**
     * Get unique types with aggregated data
     */
    public function getTypes(Request $request)
    {
        $prefix = config('database.connections.mysql.prefix');
        
        // Get distinct types with their usage counts
        $types = DB::table('container_size_type')
            ->select(
                'type',
                DB::raw('MAX(description) as description'),
                DB::raw('MAX(archived) as archived'),
                DB::raw('MIN(date_added) as date_added'),
                DB::raw('COUNT(*) as size_count'),
                DB::raw('(SELECT COUNT(*) FROM ' . $prefix . 'inventory WHERE size_type IN (SELECT s_id FROM ' . $prefix . 'container_size_type AS cst WHERE cst.type = ' . $prefix . 'container_size_type.type)) as usage_count')
            )
            ->groupBy('type')
            ->orderBy('type', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $types
        ]);
    }

    /**
     * Get active sizes for dropdown
     */
    public function getActiveSizes(Request $request)
    {
        $sizes = DB::table('container_size_type')
            ->select('size')
            ->where('archived', 0)
            ->groupBy('size')
            ->orderBy('size', 'asc')
            ->pluck('size');

        return response()->json([
            'success' => true,
            'data' => $sizes
        ]);
    }

    /**
     * Get active types for dropdown
     */
    public function getActiveTypes(Request $request)
    {
        $types = DB::table('container_size_type')
            ->select('type', 'description')
            ->where('archived', 0)
            ->groupBy('type', 'description')
            ->orderBy('type', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $types
        ]);
    }

    /**
     * Get active size/type combinations for dropdown
     */
    public function getActiveSizeTypes(Request $request)
    {
        $sizeTypes = DB::table('container_size_type')
            ->select('s_id', 'size', 'type', 'description', 'iso_code')
            ->where('archived', 0)
            ->orderBy('size', 'asc')
            ->orderBy('type', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $sizeTypes
        ]);
    }

    /**
     * Add new size/type combination
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'size' => 'required|string|max:2',
            'type' => 'required|string|max:3',
            'description' => 'nullable|string|max:45',
            'iso_code' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check if combination already exists
        $exists = DB::table('container_size_type')
            ->where('size', $request->size)
            ->where('type', strtoupper($request->type))
            ->first();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'This size/type combination already exists'
            ], 422);
        }

        DB::beginTransaction();
        try {
            $sizeTypeId = DB::table('container_size_type')->insertGetId([
                'size' => $request->size,
                'type' => strtoupper($request->type),
                'description' => $request->description,
                'iso_code' => $request->iso_code ?? '',
                'archived' => 0,
                'date_added' => now(),
            ]);

            // Log to audit - ADD action
            DB::table('audit_logs')->insert([
                'action' => 'ADD',
                'description' => '[SIZE/TYPE] Added new size/type: "' . $request->size . '/' . strtoupper($request->type) . '", Description: "' . ($request->description ?? 'N/A') . '", ISO Code: "' . ($request->iso_code ?? 'N/A') . '"',
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Size/Type added successfully',
                'data' => ['id' => $sizeTypeId]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to add size/type: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get single size/type combination
     */
    public function show($id)
    {
        $sizeType = DB::table('container_size_type')
            ->where('s_id', $id)
            ->first();

        if (!$sizeType) {
            return response()->json([
                'success' => false,
                'message' => 'Size/Type not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $sizeType
        ]);
    }

    /**
     * Update size/type combination
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'size' => 'required|string|max:2',
            'type' => 'required|string|max:3',
            'description' => 'nullable|string|max:45',
            'iso_code' => 'nullable|string|max:100',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $sizeType = DB::table('container_size_type')
            ->where('s_id', $id)
            ->first();

        if (!$sizeType) {
            return response()->json([
                'success' => false,
                'message' => 'Size/Type not found'
            ], 404);
        }

        // Check if new combination already exists (different record)
        $exists = DB::table('container_size_type')
            ->where('size', $request->size)
            ->where('type', strtoupper($request->type))
            ->where('s_id', '!=', $id)
            ->first();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'This size/type combination already exists'
            ], 422);
        }

        DB::beginTransaction();
        try {
            DB::table('container_size_type')
                ->where('s_id', $id)
                ->update([
                    'size' => $request->size,
                    'type' => strtoupper($request->type),
                    'description' => $request->description,
                    'iso_code' => $request->iso_code ?? '',
                ]);

            // Log to audit - EDIT action with old->new tracking
            $changes = [];
            if ($sizeType->size !== $request->size || $sizeType->type !== strtoupper($request->type)) {
                $changes[] = 'Size/Type: "' . $sizeType->size . '/' . $sizeType->type . '" -> "' . $request->size . '/' . strtoupper($request->type) . '"';
            }
            if ($sizeType->description !== $request->description) {
                $changes[] = 'Description: "' . ($sizeType->description ?? 'N/A') . '" -> "' . ($request->description ?? 'N/A') . '"';
            }
            if (($sizeType->iso_code ?? '') !== ($request->iso_code ?? '')) {
                $changes[] = 'ISO Code: "' . ($sizeType->iso_code ?? 'N/A') . '" -> "' . ($request->iso_code ?? 'N/A') . '"';
            }
            
            if (count($changes) > 0) {
                DB::table('audit_logs')->insert([
                    'action' => 'EDIT',
                    'description' => '[SIZE/TYPE] Edited size/type "' . $request->size . '/' . strtoupper($request->type) . '": ' . implode(', ', $changes),
                    'user_id' => auth()->user()->user_id ?? null,
                    'date_added' => now(),
                    'ip_address' => $request->ip(),
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Size/Type updated successfully'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to update size/type: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete size/type combination
     */
    public function destroy(Request $request, $id)
    {
        $sizeType = DB::table('container_size_type')
            ->where('s_id', $id)
            ->first();

        if (!$sizeType) {
            return response()->json([
                'success' => false,
                'message' => 'Size/Type not found'
            ], 404);
        }

        // Check if in use
        $usageCount = DB::table('inventory')
            ->where('size_type', $id)
            ->count();

        if ($usageCount > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete size/type that is in use by ' . $usageCount . ' container(s)'
            ], 422);
        }

        DB::beginTransaction();
        try {
            DB::table('container_size_type')
                ->where('s_id', $id)
                ->delete();

            // Log to audit - DELETE action
            DB::table('audit_logs')->insert([
                'action' => 'DELETE',
                'description' => '[SIZE/TYPE] Deleted size/type: "' . $sizeType->size . '/' . $sizeType->type . '", Description: "' . ($sizeType->description ?? 'N/A') . '"',
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Size/Type deleted successfully'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete size/type: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle status of a single size/type combination
     */
    public function toggleStatus(Request $request, $id)
    {
        $sizeType = DB::table('container_size_type')
            ->where('s_id', $id)
            ->first();

        if (!$sizeType) {
            return response()->json([
                'success' => false,
                'message' => 'Size/Type not found'
            ], 404);
        }

        $newStatus = $sizeType->archived == 0 ? 1 : 0;

        DB::beginTransaction();
        try {
            DB::table('container_size_type')
                ->where('s_id', $id)
                ->update(['archived' => $newStatus]);

            // Log to audit - EDIT action for status toggle
            $statusChange = 'Status: "' . ($sizeType->archived == 0 ? 'Active' : 'Inactive') . '" -> "' . ($newStatus == 0 ? 'Active' : 'Inactive') . '"';
            
            DB::table('audit_logs')->insert([
                'action' => 'EDIT',
                'description' => '[SIZE/TYPE] ' . ($newStatus == 1 ? 'Deactivated' : 'Activated') . ' size/type "' . $sizeType->size . '/' . $sizeType->type . '": ' . $statusChange,
                'user_id' => auth()->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Size/Type ' . ($newStatus == 1 ? 'deactivated' : 'activated') . ' successfully',
                'new_status' => $newStatus == 0 ? 'Active' : 'Inactive'
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to toggle status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle archived status for all records of a size
     */
    public function toggleSizeStatus(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'size' => 'required|string|max:2',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $size = $request->size;

        // Get current status
        $current = DB::table('container_size_type')
            ->where('size', $size)
            ->first();

        if (!$current) {
            return response()->json([
                'success' => false,
                'message' => 'Size not found'
            ], 404);
        }

        $newStatus = $current->archived == 0 ? 1 : 0;

        DB::beginTransaction();
        try {
            DB::table('container_size_type')
                ->where('size', $size)
                ->update(['archived' => $newStatus]);

            // Log to audit
            DB::table('audit_logs')->insert([
                'action' => 'UPDATE',
                'description' => ($newStatus == 0 ? 'Activated' : 'Deactivated') . ' size: ' . $size,
                'user_id' => session('user_id') ?? 0,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Size status updated successfully',
                'data' => ['archived' => $newStatus]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to update size status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle archived status for all records of a type
     */
    public function toggleTypeStatus(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|string|max:3',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $type = strtoupper($request->type);

        // Get current status
        $current = DB::table('container_size_type')
            ->where('type', $type)
            ->first();

        if (!$current) {
            return response()->json([
                'success' => false,
                'message' => 'Type not found'
            ], 404);
        }

        $newStatus = $current->archived == 0 ? 1 : 0;

        DB::beginTransaction();
        try {
            DB::table('container_size_type')
                ->where('type', $type)
                ->update(['archived' => $newStatus]);

            // Log to audit
            DB::table('audit_logs')->insert([
                'action' => 'UPDATE',
                'description' => ($newStatus == 0 ? 'Activated' : 'Deactivated') . ' type: ' . $type,
                'user_id' => session('user_id') ?? 0,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Type status updated successfully',
                'data' => ['archived' => $newStatus]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to update type status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get usage statistics
     */
    public function getUsageStats(Request $request)
    {
        $stats = [
            'total_combinations' => DB::table('container_size_type')->count(),
            'active_combinations' => DB::table('container_size_type')->where('archived', 0)->count(),
            'total_sizes' => DB::table('container_size_type')->distinct('size')->count('size'),
            'total_types' => DB::table('container_size_type')->distinct('type')->count('type'),
            'total_containers' => DB::table('inventory')->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }
}



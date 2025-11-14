<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    /**
     * Display a listing of audit logs with advanced filters
     */
    public function index(Request $request)
    {
        $query = AuditLog::with('user');

        // Search across multiple fields
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                  ->orWhere('action', 'like', "%{$search}%")
                  ->orWhere('ip_address', 'like', "%{$search}%")
                  ->orWhereHas('user', function($q2) use ($search) {
                      $q2->where('username', 'like', "%{$search}%")
                         ->orWhere('full_name', 'like', "%{$search}%");
                  });
            });
        }

        // Filter by action
        if ($request->has('action') && !empty($request->action)) {
            $query->where('action', 'like', "%{$request->action}%");
        }

        // Filter by module (search in description)
        if ($request->has('module') && !empty($request->module)) {
            $query->where('description', 'like', "%{$request->module}%");
        }

        // Filter by user
        if ($request->has('user_id') && !empty($request->user_id)) {
            $query->where('user_id', $request->user_id);
        }

        // Filter by date range
        if ($request->has('date_from') && $request->has('date_to')) {
            $query->whereBetween('date_added', [
                $request->date_from . ' 00:00:00',
                $request->date_to . ' 23:59:59'
            ]);
        } elseif ($request->has('date_from')) {
            $query->where('date_added', '>=', $request->date_from . ' 00:00:00');
        } elseif ($request->has('date_to')) {
            $query->where('date_added', '<=', $request->date_to . ' 23:59:59');
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'date_added');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Get ALL results without pagination
        $logs = $query->get();

        // Add hashed IDs and extracted module/action type
        $formattedLogs = $logs->map(function ($log) {
            return [
                'a_id' => $log->a_id,
                'hashed_id' => md5($log->a_id),
                'action' => $log->action,
                'description' => $log->description,
                'user_id' => $log->user_id,
                'username' => $log->user->username ?? 'System',
                'full_name' => $log->user->full_name ?? 'System',
                'date_added' => $log->date_added,
                'ip_address' => $log->ip_address,
                'module' => $this->extractModule($log->description),
                'action_type' => $this->getActionType($log->action),
                'user' => $log->user,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $formattedLogs->toArray(),
        ]);
    }

    /**
     * Display the specified audit log details
     */
    public function show($hashedId)
    {
        // Find real a_id by hash
        $allLogs = AuditLog::select('a_id')->get();
        $realId = null;

        foreach ($allLogs as $log) {
            if (md5($log->a_id) === $hashedId) {
                $realId = $log->a_id;
                break;
            }
        }

        if (!$realId) {
            return response()->json([
                'success' => false,
                'message' => 'Audit log not found',
            ], 404);
        }

        $log = AuditLog::with('user')->find($realId);

        if (!$log) {
            return response()->json([
                'success' => false,
                'message' => 'Audit log not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'a_id' => $log->a_id,
                'action' => $log->action,
                'description' => $log->description,
                'user_id' => $log->user_id,
                'username' => $log->user->username ?? 'System',
                'full_name' => $log->user->full_name ?? 'System',
                'email' => $log->user->email ?? 'N/A',
                'date_added' => $log->date_added,
                'ip_address' => $log->ip_address,
                'module' => $this->extractModule($log->description),
                'action_type' => $this->getActionType($log->action),
            ],
        ]);
    }

    /**
     * Get all users for filter dropdown
     */
    public function getUsers()
    {
        $users = User::select('user_id', 'full_name', 'username')
            ->where('archived', 0)
            ->orderBy('full_name', 'ASC')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    /**
     * Export audit logs to Excel format (returns data for frontend processing)
     */
    public function export(Request $request)
    {
        $query = AuditLog::with('user');

        // Apply same filters as index
        if ($request->has('action') && !empty($request->action)) {
            $query->where('action', 'like', "%{$request->action}%");
        }

        if ($request->has('module') && !empty($request->module)) {
            $query->where('description', 'like', "%{$request->module}%");
        }

        if ($request->has('user_id') && !empty($request->user_id)) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->has('date_from') && $request->has('date_to')) {
            $query->whereBetween('date_added', [
                $request->date_from . ' 00:00:00',
                $request->date_to . ' 23:59:59'
            ]);
        }

        $logs = $query->orderBy('date_added', 'DESC')->get();

        // Transform for export
        $exportData = $logs->map(function ($log) {
            return [
                'ID' => $log->a_id,
                'Date/Time' => $log->date_added,
                'User' => $log->user->full_name ?? 'System',
                'Username' => $log->user->username ?? 'System',
                'Action' => $log->action,
                'Description' => $log->description,
                'IP Address' => $log->ip_address,
                'Module' => $this->extractModule($log->description),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $exportData,
            'filename' => 'Audit_Log_' . date('Y-m-d_H-i-s') . '.xlsx',
        ]);
    }

    /**
     * Get audit statistics
     */
    public function statistics(Request $request)
    {
        $dateFrom = $request->get('date_from', now()->subDays(30)->format('Y-m-d'));
        $dateTo = $request->get('date_to', now()->format('Y-m-d'));

        // Total actions
        $totalActions = AuditLog::whereBetween('date_added', [
            $dateFrom . ' 00:00:00',
            $dateTo . ' 23:59:59'
        ])->count();
        
        // Actions by type (grouped by action field)
        $actionsByType = AuditLog::whereBetween('date_added', [
                $dateFrom . ' 00:00:00',
                $dateTo . ' 23:59:59'
            ])
            ->selectRaw('action, COUNT(*) as count')
            ->groupBy('action')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        // Top users
        $topUsers = AuditLog::with('user')
            ->whereBetween('date_added', [
                $dateFrom . ' 00:00:00',
                $dateTo . ' 23:59:59'
            ])
            ->selectRaw('user_id, COUNT(*) as count')
            ->groupBy('user_id')
            ->orderByDesc('count')
            ->limit(10)
            ->get()
            ->map(function ($item) {
                return [
                    'user_id' => $item->user_id,
                    'username' => $item->user->username ?? 'System',
                    'full_name' => $item->user->full_name ?? 'System',
                    'count' => $item->count,
                ];
            });

        // Activity timeline (daily)
        $timeline = AuditLog::whereBetween('date_added', [
                $dateFrom . ' 00:00:00',
                $dateTo . ' 23:59:59'
            ])
            ->selectRaw('DATE(date_added) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date', 'ASC')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'total_actions' => $totalActions,
                'by_type' => $actionsByType,
                'top_users' => $topUsers,
                'timeline' => $timeline,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
        ]);
    }

    /**
     * Get user activity
     */
    public function getUserActivity(Request $request)
    {
        $userId = $request->input('user_id');
        $limit = $request->input('limit', 100);

        $activities = AuditLog::where('user_id', $userId)
            ->orderBy('date_added', 'DESC')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $activities,
        ]);
    }

    /**
     * Get module activity
     */
    public function getModuleActivity(Request $request)
    {
        $module = $request->input('module');
        $limit = $request->input('limit', 100);

        $activities = AuditLog::where('description', 'like', "%$module%")
            ->orderBy('date_added', 'DESC')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $activities,
        ]);
    }

    /**
     * Extract module name from description
     */
    private function extractModule($description)
    {
        $modules = [
            'clients', 'booking', 'billing', 'inventory', 'gateinout', 
            'users', 'audit', 'reports', 'sizetype', 'bancon'
        ];
        
        $description = strtolower($description);
        
        foreach ($modules as $module) {
            if (stripos($description, $module) !== false) {
                return $module;
            }
        }

        // Check for common variations
        if (stripos($description, 'gate in') !== false || stripos($description, 'gate out') !== false) {
            return 'gateinout';
        }

        return 'system';
    }

    /**
     * Get action type for color coding
     */
    private function getActionType($action)
    {
        $action = strtolower($action);
        
        if (stripos($action, 'add') !== false || stripos($action, 'create') !== false) {
            return 'CREATE';
        }
        if (stripos($action, 'update') !== false || stripos($action, 'edit') !== false || stripos($action, 'modify') !== false) {
            return 'UPDATE';
        }
        if (stripos($action, 'delete') !== false || stripos($action, 'remove') !== false) {
            return 'DELETE';
        }
        if (stripos($action, 'login') !== false) {
            return 'LOGIN';
        }
        if (stripos($action, 'logout') !== false) {
            return 'LOGOUT';
        }
        if (stripos($action, 'gate in') !== false) {
            return 'GATE_IN';
        }
        if (stripos($action, 'gate out') !== false) {
            return 'GATE_OUT';
        }
        if (stripos($action, 'view') !== false) {
            return 'VIEW';
        }
        if (stripos($action, 'export') !== false) {
            return 'EXPORT';
        }
        if (stripos($action, 'print') !== false) {
            return 'PRINT';
        }

        return 'OTHER';
    }
}


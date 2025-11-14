<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AuditLogsController extends Controller
{
    public function index(Request $request)
    {
        // PERFORMANCE FIX: Add default date range to limit initial query scope
        // This prevents scanning all 600k+ records on initial load
        $dateFrom = $request->date_from;
        $dateTo = $request->date_to;
        
        // If no date range provided, default to last 7 days
        if (!$dateFrom && !$dateTo) {
            $dateTo = date('Y-m-d');
            $dateFrom = date('Y-m-d', strtotime('-7 days'));
        }

        $query = DB::table('audit_logs as a')
            ->select(
                'a.a_id',
                'a.action',
                'a.description',
                'a.user_id',
                'a.date_added',
                'a.ip_address',
                'u.username',
                DB::raw("CONCAT(COALESCE(u.fname, ''), ' ', COALESCE(u.lname, '')) as full_name")
            )
            ->leftJoin('users as u', 'a.user_id', '=', 'u.u_id');

        // CRITICAL: Apply date filter FIRST before any other operations
        // This allows MySQL to use the date_added index efficiently
        if ($dateFrom) {
            $query->where('a.date_added', '>=', $dateFrom . ' 00:00:00');
        }

        if ($dateTo) {
            $query->where('a.date_added', '<=', $dateTo . ' 23:59:59');
        }

        // Apply other filters
        if ($request->user_id && $request->user_id !== 'all') {
            $query->where('a.user_id', $request->user_id);
        }

        if ($request->action && $request->action !== 'all') {
            $query->where('a.action', 'like', '%' . $request->action . '%');
        }

        // Search functionality
        if ($request->search) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('a.description', 'like', "%{$search}%")
                  ->orWhere('a.action', 'like', "%{$search}%")
                  ->orWhere('a.ip_address', 'like', "%{$search}%")
                  ->orWhere('u.username', 'like', "%{$search}%")
                  ->orWhere('u.fname', 'like', "%{$search}%")
                  ->orWhere('u.lname', 'like', "%{$search}%");
            });
        }

        // Order by date descending (most recent first)
        $query->orderBy('a.date_added', 'desc');

        // Get all results without pagination
        $logs = $query->get();

        // Format response with hashed IDs for security
        $formattedLogs = $logs->map(function($log) {
            return [
                'a_id' => $log->a_id,
                'hashed_id' => md5($log->a_id),
                'action' => $log->action,
                'description' => $log->description,
                'user_id' => $log->user_id,
                'username' => $log->username ?? 'System',
                'full_name' => trim($log->full_name ?? 'System'),
                'date_added' => $log->date_added,
                'ip_address' => $log->ip_address,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $formattedLogs->toArray(),
            'total_count' => $logs->count(),
            'debug' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'sql' => $query->toSql(),
            ],
        ]);
    }

    public function getUsers()
    {
        $users = DB::table('users')
            ->select('u_id as user_id', 'username', DB::raw("CONCAT(COALESCE(fname, ''), ' ', COALESCE(lname, '')) as full_name"))
            ->where('archived', 0)
            ->orderBy('fname', 'asc')
            ->get();
            
        return response()->json([
            'success' => true,
            'data' => $users
        ]);
    }
}



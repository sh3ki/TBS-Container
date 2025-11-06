<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuditLogsController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('audit_logs as a')
            ->select('a.*', 'u.username', 'u.fname', 'u.lname')
            ->leftJoin('users as u', 'a.user_id', '=', 'u.u_id')
            ->orderBy('a.date_added', 'desc');

        if ($request->user_id) {
            $query->where('a.user_id', $request->user_id);
        }

        if ($request->action) {
            $query->where('a.action', $request->action);
        }

        if ($request->date_from) {
            $query->whereDate('a.date_added', '>=', $request->date_from);
        }

        if ($request->date_to) {
            $query->whereDate('a.date_added', '<=', $request->date_to);
        }

        $logs = $query->limit(500)->get();

        return response()->json(['success' => true, 'logs' => $logs]);
    }

    public function getUsers()
    {
        $users = DB::table('users')->where('archived', 0)->get(['u_id', 'username', 'fname', 'lname']);
        return response()->json(['success' => true, 'users' => $users]);
    }
}



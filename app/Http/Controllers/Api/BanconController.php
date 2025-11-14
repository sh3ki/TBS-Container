<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BanconController extends Controller
{
    public function index()
    {
        $banned = DB::table('ban_containers as b')
            ->select('b.*', 'c.client_name')
            ->leftJoin('clients as c', 'b.client_id', '=', 'c.c_id')
            ->orderBy('b.date_added', 'desc')
            ->get();

        return response()->json(['success' => true, 'banned' => $banned]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'container_no' => 'required|string|max:45',
            'client_id' => 'required|integer',
            'reason' => 'required|string'
        ]);

        $id = DB::table('ban_containers')->insertGetId([
            ...$validated,
            'date_added' => now(),
            'user_id' => $request->user()->u_id ?? 0
        ]);

        return response()->json(['success' => true, 'message' => 'Container banned successfully', 'id' => $id]);
    }

    public function destroy($id)
    {
        DB::table('ban_containers')->where('bc_id', $id)->delete();
        return response()->json(['success' => true, 'message' => 'Ban removed successfully']);
    }
}



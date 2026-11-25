<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

class QueueInternalController extends Controller
{
    private const COOKIE = 'queue_internal_token';

    public function session(Request $request)
    {
        $session = $this->findSession($request);
        if (!$session) return response()->json(['authenticated' => false]);

        DB::table('queue_internal_sessions')->where('id', $session->id)->update([
            'last_used_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['authenticated' => true]);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'max:5000'],
            'remember' => ['sometimes', 'boolean'],
        ]);
        $storedPassword = DB::table('app_settings')->where('setting_id', 1)->value('queue_internal_password');
        $valid = false;
        if ($storedPassword) {
            try {
                $valid = hash_equals(strtoupper((string) decrypt($storedPassword)), strtoupper($validated['password']));
            } catch (\Throwable) {
                // Existing installations may still contain the old one-way hash.
                $valid = Hash::check($validated['password'], $storedPassword) || Hash::check(strtolower($validated['password']), $storedPassword);
            }
        }
        if (!$valid) {
            return response()->json(['message' => 'Invalid password.'], 422);
        }

        $rawToken = Str::random(64);
        $now = Carbon::now();
        DB::table('queue_internal_sessions')->insert([
            'token_hash' => hash('sha256', $rawToken),
            'expires_at' => $now->copy()->addHours(2),
            'last_used_at' => $now,
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        // Remember Me controls browser password autofill on the client. The
        // authentication cookie itself remains a browser-session cookie, while
        // the server-side session always expires after two hours.
        $cookie = new Cookie(
            self::COOKIE,
            $rawToken,
            0,
            '/',
            null,
            $request->isSecure(),
            true,
            false,
            'lax'
        );

        return response()->json(['authenticated' => true])->cookie($cookie);
    }

    public function logout(Request $request)
    {
        $token = (string) $request->cookie(self::COOKIE, '');
        if ($token !== '') {
            DB::table('queue_internal_sessions')->where('token_hash', hash('sha256', $token))->delete();
        }

        return response()->json(['authenticated' => false])->withoutCookie(self::COOKIE);
    }

    public function entryDetails(Request $request, int $entryId)
    {
        if (!$this->findSession($request)) {
            return response()->json(['message' => 'Queue Internal session expired.'], 401);
        }

        $entry = DB::table('queue_entries')->where('id', $entryId)->first(['plate_no', 'pre_inventory_id']);
        if (!$entry) {
            return response()->json(['message' => 'Queue entry not found.'], 404);
        }

        $query = DB::table('pre_inventory as p')
            ->leftJoin('clients as c', 'c.c_id', '=', 'p.client_id')
            ->leftJoin('container_size_type as st', 'st.s_id', '=', 'p.size_type')
            ->where('p.status', 0)
            ->select([
                'p.plate_no',
                DB::raw("COALESCE(c.client_name, c.client_code, '-') as client"),
                DB::raw("COALESCE(CONCAT(st.size, st.type), '-') as size_type"),
                DB::raw("COALESCE(p.iso_code, '') as iso_code"),
                DB::raw("COALESCE(NULLIF(p.hauler, ''), '-') as hauler"),
            ]);

        $record = $entry->pre_inventory_id
            ? $query->where('p.p_id', $entry->pre_inventory_id)->first()
            : $query->whereRaw("REPLACE(REPLACE(UPPER(p.plate_no), '-', ''), ' ', '') = ?", [strtoupper(preg_replace('/[\\s-]+/', '', (string) $entry->plate_no) ?? '')])->first();

        if (!$record) {
            return response()->json(['message' => 'Pre-inventory record not found.'], 404);
        }

        return response()->json(['success' => true, 'data' => $record]);
    }

    private function findSession(Request $request): ?object
    {
        $token = (string) $request->cookie(self::COOKIE, '');
        if ($token === '') return null;

        $session = DB::table('queue_internal_sessions')->where('token_hash', hash('sha256', $token))->first();
        if (!$session || Carbon::parse($session->expires_at)->isPast()) {
            if ($session) DB::table('queue_internal_sessions')->where('id', $session->id)->delete();
            return null;
        }

        return $session;
    }
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

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
        $storedHash = DB::table('app_settings')->where('setting_id', 1)->value('queue_internal_password');
        if (!$storedHash || !Hash::check($validated['password'], $storedHash)) {
            return response()->json(['message' => 'Invalid password.'], 422);
        }

        $rawToken = Str::random(64);
        $now = Carbon::now();
        $remember = (bool) ($validated['remember'] ?? false);
        DB::table('queue_internal_sessions')->insert([
            'token_hash' => hash('sha256', $rawToken),
            'expires_at' => $now->copy()->addDays($remember ? 30 : 1),
            'last_used_at' => $now,
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $cookie = cookie(
            self::COOKIE,
            $rawToken,
            $remember ? 60 * 24 * 30 : 0,
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

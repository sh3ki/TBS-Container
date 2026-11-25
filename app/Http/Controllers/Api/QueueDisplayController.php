<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

class QueueDisplayController extends Controller
{
    private const COOKIE = 'queue_display_token';

    public function session(Request $request)
    {
        $session = $this->findSession($request);
        if (!$session) return response()->json(['authenticated' => false]);

        DB::table('queue_display_sessions')->where('id', $session->id)->update([
            'last_used_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['authenticated' => true, 'plate_no' => $session->plate_no]);
    }

    public function login(Request $request)
    {
        $validated = $request->validate(['plate_no' => ['required', 'string', 'max:30']]);
        $plateNo = strtoupper(preg_replace('/[\s-]+/', '', trim((string) $validated['plate_no'])) ?? '');
        $entry = DB::table('queue_entries')
            ->whereRaw('UPPER(plate_no) = ?', [$plateNo])
            ->whereIn('status', ['waiting', 'calling', 'floating', 'serving'])
            ->whereNull('completed_at')
            ->orderByDesc('updated_at')
            ->first(['id', 'plate_no']);

        if (!$entry) return response()->json(['message' => 'Plate number is not active in the queue.'], 422);

        $rawToken = Str::random(64);
        $now = Carbon::now();
        DB::table('queue_display_sessions')->insert([
            'token_hash' => hash('sha256', $rawToken),
            'plate_no' => strtoupper(preg_replace('/[\s-]+/', '', (string) $entry->plate_no) ?? ''),
            'expires_at' => $now->copy()->addHours(2),
            'last_used_at' => $now,
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $cookie = new Cookie(self::COOKIE, $rawToken, 0, '/', null, $request->isSecure(), true, false, 'lax');

        return response()->json(['authenticated' => true, 'plate_no' => $plateNo])->cookie($cookie);
    }

    public function logout(Request $request)
    {
        $token = (string) $request->cookie(self::COOKIE, '');
        if ($token !== '') {
            DB::table('queue_display_sessions')->where('token_hash', hash('sha256', $token))->delete();
        }

        return response()->json(['authenticated' => false])->withoutCookie(self::COOKIE);
    }

    private function findSession(Request $request): ?object
    {
        $token = (string) $request->cookie(self::COOKIE, '');
        if ($token === '') return null;

        $session = DB::table('queue_display_sessions')->where('token_hash', hash('sha256', $token))->first();
        if (!$session || Carbon::parse($session->expires_at)->isPast()) {
            if ($session) DB::table('queue_display_sessions')->where('id', $session->id)->delete();
            return null;
        }

        return $session;
    }
}

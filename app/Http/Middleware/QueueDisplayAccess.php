<?php

namespace App\Http\Middleware;

use Carbon\Carbon;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class QueueDisplayAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->validSession($request, 'queue_display_token', 'queue_display_sessions')
            || $this->validSession($request, 'queue_internal_token', 'queue_internal_sessions')) {
            return $next($request);
        }

        return response()->json(['message' => 'Queue access session expired.'], 401);
    }

    private function validSession(Request $request, string $cookieName, string $table): bool
    {
        $token = (string) $request->cookie($cookieName, '');
        if ($token === '') return false;

        $session = DB::table($table)->where('token_hash', hash('sha256', $token))->first();
        if (!$session || Carbon::parse($session->expires_at)->isPast()) {
            if ($session) DB::table($table)->where('id', $session->id)->delete();
            return false;
        }

        return true;
    }
}

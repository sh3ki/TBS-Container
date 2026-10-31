<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class EnsurePageAccess
{
    /**
     * Require a page permission for the authenticated user's privilege.
     *
     * An optional user ID can be supplied while a page is being rolled out
     * to a specific account (for example: page.access:dashboard,1).
     */
    public function handle(Request $request, Closure $next, string $page, ?int $allowedUserId = null): Response
    {
        $user = $request->user();

        if (!$user || ($allowedUserId !== null && (int) $user->user_id !== $allowedUserId)) {
            abort(403);
        }

        $hasAccess = DB::table('pages_access')
            ->join('pages', 'pages_access.page_id', '=', 'pages.p_id')
            ->where('pages.page', $page)
            ->where('pages_access.privilege', $user->priv_id)
            ->exists();

        abort_unless($hasAccess, 403);

        return $next($request);
    }
}

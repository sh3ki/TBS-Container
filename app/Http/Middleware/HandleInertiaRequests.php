<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        // Get user permissions if authenticated
        $permissions = [];
        if ($request->user()) {
            $permissions = DB::select('
                SELECT 
                    fjp_pages.p_id,
                    fjp_pages.page,
                    fjp_pages.page_name,
                    fjp_pages.page_icon,
                    fjp_pages_access.acs_edit,
                    fjp_pages_access.acs_delete
                FROM fjp_pages_access
                JOIN fjp_pages ON fjp_pages_access.page_id = fjp_pages.p_id
                WHERE fjp_pages_access.privilege = ?
                ORDER BY fjp_pages.arrange_no
            ', [$request->user()->priv_id]);
        }

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $request->user(),
                'permissions' => $permissions,
            ],
            'csrf_token' => csrf_token(),
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}

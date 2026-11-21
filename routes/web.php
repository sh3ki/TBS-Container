<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use App\Services\AuditService;
use Inertia\Inertia;

// Redirect root to login or dashboard
Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }
    return redirect()->route('login');
});

// Login route - Render React login page via Inertia
Route::get('/login', function () {
    return Inertia::render('auth/login', [
        'canResetPassword' => false, // Can be enabled later
        'status' => session('status'),
    ]);
})->name('login');

// Public live queue display for yard monitors and drivers.
Route::get('/queue', function () {
    return Inertia::render('Queue/Display');
})->name('queue.display');

// Protected routes - Use 'auth' for web (session-based), not 'auth:sanctum'
Route::middleware(['auth'])->group(function () {
    // Dashboard
    Route::get('/dashboard', function () {
        return Inertia::render('Dashboard/Index');
    })->middleware('page.access:dashboard,1,first-accessible')->name('dashboard');

    Route::get('/dashboard/email-automation', function () {
        return Inertia::render('Dashboard/EmailAutomationStatus');
    })->middleware('page.access:dashboard,1,first-accessible')->name('dashboard.email-automation');

    // Clients
    Route::get('/clients', function () {
        return Inertia::render('Clients/Index');
    })->name('clients.index');

    Route::get('/clients/create', function () {
        return Inertia::render('Clients/Create');
    })->name('clients.create');

    Route::get('/clients/{id}', function ($id) {
        return Inertia::render('Clients/Show', ['id' => $id]);
    })->name('clients.show');

    Route::get('/clients/{id}/edit', function ($id) {
        return Inertia::render('Clients/EditClient', ['clientId' => (int)$id]);
    })->name('clients.edit');

    // EDI is currently available only to the primary administrator (user 1).
    Route::get('/edi', function () {
        abort_unless((int) auth()->id() === 1, 403);

        return Inertia::render('EDI/Index');
    })->name('edi.index');

    // Inventory
    Route::get('/inventory', function () {
        return Inertia::render('Inventory/Index');
    })->name('inventory.index');

    // Billing
    Route::get('/billing', function () {
        return Inertia::render('Billing/Index');
    })->name('billing.index');

    // Reports
    Route::get('/reports', function () {
        return Inertia::render('Reports/Index');
    })->name('reports.index');

    // Gate In & Out
    Route::get('/gateinout', function () {
        $settings = DB::table('app_settings')->where('setting_id', 1)->first();

        return Inertia::render('Gateinout/Index', [
            'preInHaulerExceptions' => (string) ($settings?->prein_hauler_exceptions ?? ''),
        ]);
    })->name('gateinout.index');

    // Authenticated queue management page.
    Route::get('/queuelist', function () {
        $settings = DB::table('app_settings')->where('setting_id', 1)->first();

        return Inertia::render('Queue/Index', [
            'servingCapacity' => (int) ($settings?->serving_capacity ?? 0),
        ]);
    })->middleware('page.access:queuelist')->name('queue.index');

    // Size & Type
    Route::get('/sizetype', function () {
        return Inertia::render('Sizetype/Index');
    })->name('sizetype.index');

    // Ban Containers
    Route::get('/bancon', function () {
        return Inertia::render('Bancontainers/Index');
    })->name('bancon.index');

    // Container Images
    Route::get('/containerimages', function () {
        return Inertia::render('ContainerImages/Index');
    })->name('containerimages.index');

    // Users
    Route::get('/users', function () {
        return Inertia::render('Users/Index');
    })->name('users.index');

    // Audit Logs
    Route::get('/audit', function () {
        return Inertia::render('Audit/Index');
    })->name('audit.index');

    // Booking
    Route::get('/booking', function () {
        return Inertia::render('Bookings/Index');
    })->name('booking.index');

    // Profile
    Route::get('/profile', function () {
        return Inertia::render('Profile/Edit');
    })->name('profile.edit');

    // Mobile Settings
    Route::get('/mobile-settings', function () {
        $settings = DB::table('mobile_settings')->orderBy('setting_id')->get()->keyBy('app_code');

        return Inertia::render('MobileSettings/Index', [
            'settings' => $settings->map(fn ($item) => [
                'app_version' => $item->app_version ?? '',
                'apk_url' => $item->apk_url ?? '',
                'update_app_modal' => (bool) ($item->update_app_modal ?? false),
            ])->all(),
        ]);
    })->middleware('page.access:mobile-settings')->name('mobile-settings.index');

    // App Settings
    Route::get('/app-settings', function () {
        $settings = DB::table('app_settings')->where('setting_id', 1)->first();

        return Inertia::render('AppSettings/Index', [
            'settings' => [
                'incoming_rate' => (float) ($settings?->incoming_rate ?? 0),
                'outgoing_rate' => (float) ($settings?->outgoing_rate ?? 0),
                'hauler_exceptions' => (string) ($settings?->hauler_exceptions ?? ''),
                'preout_hauler_exceptions' => (string) ($settings?->preout_hauler_exceptions ?? ''),
                'prein_hauler_exceptions' => (string) ($settings?->prein_hauler_exceptions ?? ''),
                'booking_scraping_enabled' => (bool) ($settings?->booking_scraping_enabled ?? true),
            ],
        ]);
    })->middleware('page.access:app-settings')->name('app-settings.index');

    Route::put('/app-settings', function (Request $request, AuditService $auditService) {
        $rules = [
            'section' => ['required', 'string', 'in:docs_fee,queue'],
            'hauler_exceptions' => ['nullable', 'string', 'max:5000'],
            'preout_hauler_exceptions' => ['nullable', 'string', 'max:5000'],
            'prein_hauler_exceptions' => ['nullable', 'string', 'max:5000'],
            'booking_scraping_enabled' => ['sometimes', 'boolean'],
            'serving_capacity' => ['sometimes', 'integer', 'min:0'],
        ];
        if ($request->input('section') === 'docs_fee') {
            $rules['incoming_rate'] = ['required', 'numeric', 'gt:0'];
            $rules['outgoing_rate'] = ['required', 'numeric', 'gt:0'];
        }
        $validated = $request->validate($rules);

        if ($validated['section'] === 'queue') {
            $updates = ['updated_at' => now()];
            if (array_key_exists('booking_scraping_enabled', $validated)) {
                $updates['booking_scraping_enabled'] = (bool) $validated['booking_scraping_enabled'];
            }
            if (array_key_exists('serving_capacity', $validated)) {
                $updates['serving_capacity'] = (int) $validated['serving_capacity'];
            }
            if (array_key_exists('preout_hauler_exceptions', $validated)) {
                $updates['preout_hauler_exceptions'] = collect(explode(',', (string) $validated['preout_hauler_exceptions']))
                    ->map(fn (string $hauler): string => strtoupper(trim($hauler)))
                    ->filter()->unique()->implode(', ');
            }
            if (array_key_exists('prein_hauler_exceptions', $validated)) {
                $updates['prein_hauler_exceptions'] = collect(explode(',', (string) $validated['prein_hauler_exceptions']))
                    ->map(fn (string $hauler): string => strtoupper(trim($hauler)))
                    ->filter()->unique()->implode(', ');
            }
            DB::table('app_settings')->where('setting_id', 1)->update($updates);

            return response()->json(['message' => 'Queue settings updated successfully.']);
        }

        $currentSettings = DB::table('app_settings')->where('setting_id', 1)->first();
        $incomingRate = (float) $validated['incoming_rate'];
        $outgoingRate = (float) $validated['outgoing_rate'];
        $haulerExceptions = collect(explode(',', (string) ($validated['hauler_exceptions'] ?? '')))
            ->map(fn (string $hauler): string => strtoupper(trim($hauler)))
            ->filter()
            ->unique()
            ->implode(', ');

        DB::table('app_settings')->updateOrInsert(
            ['setting_id' => 1],
            [
                'incoming_rate' => $incomingRate,
                'outgoing_rate' => $outgoingRate,
                'hauler_exceptions' => $haulerExceptions !== '' ? $haulerExceptions : null,
                'updated_at' => now(),
                'created_at' => $currentSettings?->created_at ?? now(),
            ],
        );

        try {
            if ((float) ($currentSettings?->incoming_rate ?? 0) !== $incomingRate) {
                $auditService->log('UPDATE', "Updated incoming Docs Fee rate to {$incomingRate}", 'APP SETTINGS');
            }
            if ((float) ($currentSettings?->outgoing_rate ?? 0) !== $outgoingRate) {
                $auditService->log('UPDATE', "Updated outgoing Docs Fee rate to {$outgoingRate}", 'APP SETTINGS');
            }
            if ((string) ($currentSettings?->hauler_exceptions ?? '') !== $haulerExceptions) {
                $auditService->log('UPDATE', 'Updated Docs Fee hauler exceptions', 'APP SETTINGS');
            }
        } catch (\Throwable $exception) {
            report($exception);
        }

        return response()->json(['message' => 'Docs Fee settings updated successfully.']);
    })->middleware('page.access:app-settings')->name('app-settings.update');

    Route::put('/queuelist/settings', function (Request $request) {
        $validated = $request->validate([
            'serving_capacity' => ['required', 'integer', 'min:0'],
        ]);

        DB::table('app_settings')->where('setting_id', 1)->update([
            'serving_capacity' => (int) $validated['serving_capacity'],
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Queue settings updated successfully.']);
    })->middleware('page.access:queuelist')->name('queuelist.settings.update');

    Route::put('/mobile-settings', function (Request $request, AuditService $auditService) {
        $validated = $request->validate([
            'app_code' => ['required', 'string', 'in:CHECKER,GUARD'],
            'app_version' => ['required', 'string', 'max:50'],
            'apk_url' => ['required_if:update_app_modal,1', 'nullable', 'url', 'max:2048'],
            'update_app_modal' => ['required', 'boolean'],
        ]);

        $appCode = strtoupper($validated['app_code']);
        $currentSettings = DB::table('mobile_settings')->where('app_code', $appCode)->first();
        $oldAppVersion = (string) ($currentSettings?->app_version ?? '');
        $oldApkUrl = (string) ($currentSettings?->apk_url ?? '');
        $oldUpdateAppModal = (bool) ($currentSettings?->update_app_modal ?? false);
        $newAppVersion = $validated['app_version'];
        $newApkUrl = (string) ($validated['apk_url'] ?? '');
        $newUpdateAppModal = (bool) $validated['update_app_modal'];

        DB::table('mobile_settings')->updateOrInsert(
            ['app_code' => $appCode],
            [
                'app_version' => $newAppVersion,
                'apk_url' => $newApkUrl !== '' ? $newApkUrl : null,
                'update_app_modal' => $newUpdateAppModal,
                'updated_at' => now(),
            ],
        );

        try {
            if ($oldAppVersion !== $newAppVersion) {
                $auditService->log(
                    'UPDATE',
                    "Updated app version from '{$oldAppVersion}' to '{$newAppVersion}'",
                    'MOBILE SETTINGS',
                );
            }

            if ($oldApkUrl !== $newApkUrl) {
                $auditService->log(
                    'UPDATE',
                    'Updated APK URL',
                    'MOBILE SETTINGS',
                );
            }

            if ($oldUpdateAppModal !== $newUpdateAppModal) {
                $auditService->log(
                    'UPDATE',
                    'Turned Update App Modal ' . ($newUpdateAppModal ? 'ON' : 'OFF'),
                    'MOBILE SETTINGS',
                );
            }
        } catch (\Throwable $exception) {
            report($exception);
        }

        return response()->json([
            'success' => true,
            'message' => 'Mobile settings updated successfully.',
        ]);
    })->middleware('page.access:mobile-settings')->name('mobile-settings.update');
});

// Debug endpoint to check session state
Route::get('/debug-session', function () {
    $sessionId = session()->getId();
    $userId = Auth::id();
    $authCheck = Auth::check();
    
    $sessionData = DB::table('sessions')
        ->where('id', $sessionId)
        ->first();
    
    return response()->json([
        'session_id' => $sessionId,
        'auth_check' => $authCheck,
        'auth_user_id' => $userId,
        'session_record' => $sessionData,
        'cookies' => request()->cookies->all(),
    ]);
})->middleware('web');

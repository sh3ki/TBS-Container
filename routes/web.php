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
        return Inertia::render('Gateinout/Index');
    })->name('gateinout.index');

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
        $settings = DB::table('mobile_settings')->first();

        return Inertia::render('MobileSettings/Index', [
            'settings' => [
                'app_version' => $settings?->app_version ?? '',
                'apk_url' => $settings?->apk_url ?? '',
                'update_app_modal' => (bool) ($settings?->update_app_modal ?? false),
            ],
        ]);
    })->middleware('page.access:mobile-settings')->name('mobile-settings.index');

    // App Settings
    Route::get('/app-settings', function () {
        return Inertia::render('AppSettings/Index');
    })->middleware('page.access:app-settings')->name('app-settings.index');

    Route::put('/mobile-settings', function (Request $request, AuditService $auditService) {
        $validated = $request->validate([
            'app_version' => ['required', 'string', 'max:50'],
            'apk_url' => ['required_if:update_app_modal,1', 'nullable', 'url', 'max:2048'],
            'update_app_modal' => ['required', 'boolean'],
        ]);

        $currentSettings = DB::table('mobile_settings')->where('setting_id', 1)->first();
        $oldAppVersion = (string) ($currentSettings?->app_version ?? '');
        $oldApkUrl = (string) ($currentSettings?->apk_url ?? '');
        $oldUpdateAppModal = (bool) ($currentSettings?->update_app_modal ?? false);
        $newAppVersion = $validated['app_version'];
        $newApkUrl = (string) ($validated['apk_url'] ?? '');
        $newUpdateAppModal = (bool) $validated['update_app_modal'];

        DB::table('mobile_settings')->updateOrInsert(
            ['setting_id' => 1],
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

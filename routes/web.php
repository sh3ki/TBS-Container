<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
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
    })->name('dashboard');

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
});

// Debug endpoint to check session state
Route::get('/debug-session', function () {
    $sessionId = session()->getId();
    $userId = Auth::id();
    $authCheck = Auth::check();
    
    $sessionData = DB::table('fjp_sessions')
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

<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientsController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\GateinoutController;
use App\Http\Controllers\Api\SizeTypeController;
use App\Http\Controllers\Api\BanconController;
use App\Http\Controllers\Api\BanContainersController;
use App\Http\Controllers\Api\UsersController;
use App\Http\Controllers\Api\AuditLogsController;
use App\Http\Controllers\Api\ReportsController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\GateController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\DashboardController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public routes
Route::post('/login', [AuthController::class, 'login']);

// CSRF Token endpoint (accessible without authentication for token refresh)
Route::get('/csrf-token', function () {
    return response()->json([
        'csrf_token' => csrf_token()
    ]);
});

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Authentication
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/refresh', [AuthController::class, 'refresh']);

    // Dashboard
    Route::get('/dashboard/statistics', [DashboardController::class, 'statistics']);
    Route::get('/dashboard/recent-activities', [DashboardController::class, 'recentActivities']);

    // Clients - Full API with all 18 actions
    Route::prefix('clients')->group(function () {
        // Helper endpoints
        Route::get('/container-sizes', [ClientsController::class, 'getContainerSizes']);
        
        // Basic CRUD (5 routes)
        Route::get('/', [ClientsController::class, 'index']);
        Route::post('/', [ClientsController::class, 'store']);
        Route::get('/{id}', [ClientsController::class, 'show']);
        Route::put('/{id}', [ClientsController::class, 'update']);
        Route::delete('/{id}', [ClientsController::class, 'destroy']);
        Route::post('/{id}/toggle-status', [ClientsController::class, 'toggleStatus']);
        
        // Storage Rates (3 routes)
        Route::get('/{id}/storage-rates', [ClientsController::class, 'getStorageRates']);
        Route::post('/{id}/storage-rates', [ClientsController::class, 'addStorageRate']);
        Route::delete('/{clientId}/storage-rates/{rateId}', [ClientsController::class, 'deleteStorageRate']);
        
        // Handling Rates (3 routes)
        Route::get('/{id}/handling-rates', [ClientsController::class, 'getHandlingRates']);
        Route::post('/{id}/handling-rates', [ClientsController::class, 'addHandlingRate']);
        Route::delete('/{clientId}/handling-rates/{rateId}', [ClientsController::class, 'deleteHandlingRate']);
        
        // Regular Hours - Legacy endpoints (Incoming/Withdrawal)
        Route::post('/{id}/regular-hours/incoming', [ClientsController::class, 'addIncomingHours']);
        Route::get('/{id}/regular-hours/incoming', [ClientsController::class, 'getIncomingHours']);
        Route::delete('/{id}/regular-hours/incoming', [ClientsController::class, 'deleteIncomingHours']);
        Route::post('/{id}/regular-hours/withdrawal', [ClientsController::class, 'addWithdrawalHours']);
        Route::get('/{id}/regular-hours/withdrawal', [ClientsController::class, 'getWithdrawalHours']);
        Route::delete('/{id}/regular-hours/withdrawal', [ClientsController::class, 'deleteWithdrawalHours']);
        
        // Regular Hours - Generic (backward compatibility)
        Route::get('/{id}/regular-hours', [ClientsController::class, 'getRegularHours']);
        Route::post('/{id}/regular-hours', [ClientsController::class, 'updateRegularHours']);
        Route::delete('/{id}/regular-hours', [ClientsController::class, 'deleteRegularHours']);
    });

    // Old API routes (keeping for backward compatibility)
    Route::apiResource('clients-old', ClientController::class);
    Route::post('/clients/{id}/restore', [ClientController::class, 'restore']);
    Route::get('/clients-archived', [ClientController::class, 'archived']);
    Route::get('/clients-export', [ClientController::class, 'export']);

    // Inventory - Full API with all functionality
    Route::prefix('inventory')->group(function () {
        // List & Search
        Route::post('/list', [InventoryController::class, 'getList']);
        Route::post('/search', [InventoryController::class, 'search']);
        
        // Dropdown data
        Route::get('/clients', [InventoryController::class, 'getClients']);
        Route::get('/sizes', [InventoryController::class, 'getSizes']);
        Route::get('/types', [InventoryController::class, 'getTypes']);
        Route::get('/size-types', [InventoryController::class, 'getSizeTypes']);
        Route::get('/sizes-types', [InventoryController::class, 'getSizesAndTypes']);
        Route::get('/statuses', [InventoryController::class, 'getStatusesList']);
        Route::get('/load-types', [InventoryController::class, 'getLoadTypes']);
        
        // Export
        Route::post('/export', [InventoryController::class, 'export']);
        
        // CRUD operations (hashed ID)
        Route::get('/{hashedId}', [InventoryController::class, 'getDetails']);
        Route::put('/{hashedId}', [InventoryController::class, 'update']);
        Route::delete('/{hashedId}', [InventoryController::class, 'delete']);
        Route::delete('/{id}', [InventoryController::class, 'deleteById'])->where('id', '[0-9]+');
        
        // Hold/Unhold
        Route::post('/{hashedId}/hold', [InventoryController::class, 'holdContainer']);
        Route::post('/{hashedId}/unhold', [InventoryController::class, 'unholdContainer']);
        Route::post('/{id}/hold', [InventoryController::class, 'holdContainer']);
        Route::post('/{id}/unhold', [InventoryController::class, 'unholdContainer']);
        
        // Approve container
        Route::post('/{id}/approve', [InventoryController::class, 'approveContainer']);
        
        // Toggle Repo/Available status
        Route::post('/{id}/toggle-repo', [InventoryController::class, 'toggleRepoStatus']);
    });

    // Billing - Full API with all 9 actions
    Route::prefix('billing')->group(function () {
        // Generate billing
        Route::post('/generate', [BillingController::class, 'generate']);
        
        // Get billing list
        Route::post('/list', [BillingController::class, 'getBillingList']);
        
        // Export to Excel
        Route::post('/export', [BillingController::class, 'exportToExcel']);
        
        // Get clients for dropdown
        Route::get('/clients', [BillingController::class, 'getClientList']);
        
        // Get rates
        Route::get('/storage-rate/{clientId}/{size}', [BillingController::class, 'getStorageRate']);
        Route::get('/handling-rate/{clientId}/{size}', [BillingController::class, 'getHandlingRate']);
        
        // Update handling count
        Route::put('/handling-count/{id}', [BillingController::class, 'updateHandlingCount']);
        
        // Delete billing record (admin)
        Route::delete('/{id}', [BillingController::class, 'destroy']);
    });

    // Gate In/Out - Complete API with two-step approval workflow
    Route::prefix('gateinout')->group(function () {
        // Pre-Inventory List (Combined Pre-IN and Pre-OUT)
        Route::post('/list', [GateinoutController::class, 'getPreInventoryList']);
        
        // Add Pre-IN (Guards)
        Route::post('/check-container-in', [GateinoutController::class, 'checkContainerIn']);
        
        // Add Pre-OUT (Guards)
        Route::post('/check-container-out', [GateinoutController::class, 'checkContainerOut']);
        
        // Get Pre-IN Details for Editing
        Route::post('/get-prein-details', [GateinoutController::class, 'getPreInDetails']);
        
        // Update Pre-IN
        Route::post('/update-prein', [GateinoutController::class, 'updatePreIn']);
        
        // Get Pre-OUT Details for Editing
        Route::post('/get-preout-details', [GateinoutController::class, 'getPreOutDetails']);
        
        // Update Pre-OUT
        Route::post('/update-preout', [GateinoutController::class, 'updatePreOut']);
        
        // Delete Pre-Inventory (IN or OUT)
        Route::post('/delete-pre', [GateinoutController::class, 'deletePre']);
        
        // Process Pre-IN → Gate-IN (Checkers)
        Route::post('/process-prein', [GateinoutController::class, 'processPreIn']);
        
        // Process Pre-OUT → Gate-OUT (Checkers)
        Route::post('/process-preout', [GateinoutController::class, 'processPreOut']);
        
        // Helper endpoints
        Route::get('/clients', [GateinoutController::class, 'getClients']);
        Route::get('/page-record-access', [GateinoutController::class, 'getPageRecordAccess']);
        Route::get('/current-user', [GateinoutController::class, 'getCurrentUser']);
        
        // Dropdown options for Process modals
        Route::get('/status-options', [GateinoutController::class, 'getStatusOptions']);
        Route::get('/sizetype-options', [GateinoutController::class, 'getSizeTypeOptions']);
        Route::get('/load-options', [GateinoutController::class, 'getLoadOptions']);
        
        // Available containers for Gate OUT (IN yard, not on hold)
        Route::get('/available-containers', [GateinoutController::class, 'getAvailableContainers']);
        Route::post('/validate-container', [GateinoutController::class, 'validateContainer']);
        
        // Process Gate IN/OUT (final processing)
        Route::post('/process-in', [GateinoutController::class, 'processGateIn']);
        Route::post('/process-out', [GateinoutController::class, 'processGateOut']);
        
        // Print Gate Pass (EXACT LEGACY FORMAT)
        Route::get('/print-gate-pass/{id}', [GateinoutController::class, 'printGatePass']);
    });

    // Size/Type - Complete API with all legacy actions
    Route::prefix('sizetype')->group(function () {
        // Get all combinations
        Route::get('/', [SizeTypeController::class, 'index']);
        
        // Size-specific operations
        Route::get('/sizes', [SizeTypeController::class, 'getSizes']);
        Route::get('/sizes/active', [SizeTypeController::class, 'getActiveSizes']);
        Route::post('/sizes/toggle-status', [SizeTypeController::class, 'toggleSizeStatus']);
        
        // Type-specific operations
        Route::get('/types', [SizeTypeController::class, 'getTypes']);
        Route::get('/types/active', [SizeTypeController::class, 'getActiveTypes']);
        Route::post('/types/toggle-status', [SizeTypeController::class, 'toggleTypeStatus']);
        
        // Active combinations for dropdown
        Route::get('/active', [SizeTypeController::class, 'getActiveSizeTypes']);
        
        // Statistics
        Route::get('/stats', [SizeTypeController::class, 'getUsageStats']);
        
        // CRUD operations
        Route::post('/', [SizeTypeController::class, 'store']);
        Route::get('/{id}', [SizeTypeController::class, 'show']);
        Route::put('/{id}', [SizeTypeController::class, 'update']);
        Route::delete('/{id}', [SizeTypeController::class, 'destroy']);
        Route::post('/{id}/toggle-status', [SizeTypeController::class, 'toggleStatus']);
    });

    // Ban Containers - Complete ban management
    Route::prefix('bancontainers')->group(function () {
        // List and search
        Route::get('/', [BanContainersController::class, 'index']);
        Route::get('/search', [BanContainersController::class, 'search']);
        Route::post('/check-status', [BanContainersController::class, 'checkBanStatus']);
        
        // Statistics
        Route::get('/stats', [BanContainersController::class, 'getStats']);
        
        // Bulk operations
        Route::post('/bulk-add', [BanContainersController::class, 'bulkAdd']);
        
        // CRUD operations
        Route::post('/', [BanContainersController::class, 'store']);
        Route::get('/{id}', [BanContainersController::class, 'show']);
        Route::put('/{id}', [BanContainersController::class, 'update']);
        Route::delete('/{id}', [BanContainersController::class, 'destroy']);
    });

    // Audit Logs
    Route::get('/audit', [AuditLogsController::class, 'index']);
    Route::get('/audit/users', [AuditLogsController::class, 'getUsers']);

    // Reports - Complete 9 report types
    Route::prefix('reports')->group(function () {
        // Helper endpoints
        Route::get('/clients', [ReportsController::class, 'getClients']);
        
        // New Report Types (Incoming, Outgoing, DMR, DCR)
        Route::get('/incoming', [ReportsController::class, 'incomingReport']);
        Route::post('/incoming/export', [ReportsController::class, 'exportIncomingReport']);
        Route::get('/outgoing', [ReportsController::class, 'outgoingReport']);
        Route::post('/outgoing/export', [ReportsController::class, 'exportOutgoingReport']);
        Route::get('/dmr', [ReportsController::class, 'dmrReport']);
        Route::post('/dmr/export', [ReportsController::class, 'exportDmrReport']);
        Route::get('/dcr', [ReportsController::class, 'dcrReport']);
        Route::post('/dcr/export', [ReportsController::class, 'exportDcrReport']);
        Route::post('/docs-fee/export', [ReportsController::class, 'exportDocsFeeReport']);
        
        // Main reports
        Route::get('/daily-gate', [ReportsController::class, 'dailyGateReport']);
        Route::get('/inventory-status', [ReportsController::class, 'inventoryStatusReport']);
        Route::get('/client-activity', [ReportsController::class, 'clientActivityReport']);
        Route::get('/billing-summary', [ReportsController::class, 'billingSummaryReport']);
        Route::get('/container-movement', [ReportsController::class, 'containerMovementReport']);
        Route::get('/booking-status', [ReportsController::class, 'bookingStatusReport']);
        Route::get('/hold-containers', [ReportsController::class, 'holdContainersReport']);
        Route::get('/damaged-containers', [ReportsController::class, 'damagedContainersReport']);
        Route::get('/storage-utilization', [ReportsController::class, 'storageUtilizationReport']);
        
        // Export
        Route::post('/export', [ReportsController::class, 'exportReport']);
    });

    // Bookings - Full API with all 12 legacy actions
    Route::prefix('bookings')->group(function () {
        // Main CRUD (5 routes)
        Route::get('/', [BookingController::class, 'index']); // Get active bookings list
        Route::post('/', [BookingController::class, 'store']); // Create booking
        Route::get('/{id}', [BookingController::class, 'show']); // Get single booking
        Route::get('/{id}/edit', [BookingController::class, 'edit']); // Get booking for editing (hashed ID)
        Route::put('/{id}', [BookingController::class, 'update']); // Update booking (hashed ID)
        Route::delete('/{id}', [BookingController::class, 'destroy']); // Delete booking
        
        // Additional Actions (6 routes)
        Route::get('/{id}/containers', [BookingController::class, 'getContainers']); // View containers modal
        Route::get('/search/bookings', [BookingController::class, 'search']); // Search by booking number
        Route::get('/helpers/clients', [BookingController::class, 'getClientList']); // Clients dropdown
        Route::get('/helpers/shipper', [BookingController::class, 'getShipperByBooking']); // Get shipper by booking
        Route::get('/helpers/shipper-autocomplete', [BookingController::class, 'getShipperAutocomplete']); // Shipper autocomplete
        Route::get('/helpers/booking-autocomplete', [BookingController::class, 'getBookingNumberAutocomplete']); // Booking number autocomplete (expired)
        Route::get('/helpers/available-containers', [BookingController::class, 'getAvailableContainers']); // Available containers for gate out
    });

    // Invoices
    Route::apiResource('invoices', InvoiceController::class);
    Route::get('/invoices/{id}/pdf', [InvoiceController::class, 'generatePdf']);

    // Gate Operations
    Route::apiResource('gate-logs', GateController::class)->only(['index', 'show', 'store']);
    Route::get('/gate/statistics', [GateController::class, 'statistics']);

    // Users - Complete API with all legacy features
    Route::prefix('users')->group(function () {
        // List and search
        Route::post('/list', [UsersController::class, 'getList']);
        
        // Dropdowns (MUST come before {hashedId} routes to avoid matching "privileges" or "pages" as hashed IDs)
        Route::get('/privileges', [UsersController::class, 'getPrivileges']); // Get all privileges
        Route::get('/privileges/{privId}/pages', [UsersController::class, 'getPrivilegePages']); // Get pages for specific privilege
        Route::get('/privilege-templates', [UsersController::class, 'getAllPrivilegeTemplates']); // Get all privilege templates
        Route::get('/pages', [UsersController::class, 'getPages']); // Get all pages/modules
        Route::get('/online', [UsersController::class, 'getOnlineUsers']); // Get currently online users
        
        // Validation (specific routes before dynamic routes)
        Route::post('/check-username', [UsersController::class, 'checkUsername']); // Check username availability
        Route::post('/check-email', [UsersController::class, 'checkEmail']); // Check email availability
        
        // Password management (user-level)
        Route::post('/change-password', [UsersController::class, 'changeOwnPassword']); // User changes own password
        
        // CRUD operations (dynamic routes last)
        Route::post('/', [UsersController::class, 'store']); // Create user
        Route::get('/{hashedId}', [UsersController::class, 'getDetails']); // Get user details
        Route::put('/{hashedId}', [UsersController::class, 'update']); // Update user
        Route::delete('/{hashedId}', [UsersController::class, 'delete']); // Delete user
        
        // Privilege Management
        Route::get('/{hashedId}/privileges', [UsersController::class, 'getUserPrivileges']); // Get user's privileges
        Route::put('/{hashedId}/privileges', [UsersController::class, 'updateUserPrivileges']); // Update user's privileges
        Route::put('/{hashedId}/privilege-template', [UsersController::class, 'assignUserPrivilegeTemplate']); // Assign privilege template
        
        // Schedule Management (NEW!)
        Route::get('/{hashedId}/schedule', [UsersController::class, 'getSchedule']); // Get user's work schedule
        Route::put('/{hashedId}/schedule', [UsersController::class, 'updateSchedule']); // Update work schedule
        
        // Login History & Activity (NEW!)
        Route::get('/{hashedId}/login-history', [UsersController::class, 'getLoginHistory']); // Get login history
        Route::get('/{hashedId}/activity-log', [UsersController::class, 'getActivityLog']); // Get activity log
        
        // Password Management (admin-level) (NEW!)
        Route::post('/{hashedId}/reset-password', [UsersController::class, 'resetPassword']); // Admin reset password
        
        // Admin Actions (NEW!)
        Route::post('/{hashedId}/toggle-status', [UsersController::class, 'toggleStatus']); // Activate/Deactivate
        Route::post('/{hashedId}/force-logout', [UsersController::class, 'forceLogout']); // Force logout user
    });

    // Audit Logs - Complete API with all legacy features
    Route::prefix('audit')->group(function () {
        // Main audit log list with filters
        Route::get('/', [AuditController::class, 'index']);
        
        // Get audit log details
        Route::get('/{hashedId}', [AuditController::class, 'show']);
        
        // Export to Excel
        Route::post('/export', [AuditController::class, 'export']);
        
        // Statistics
        Route::get('/statistics/dashboard', [AuditController::class, 'statistics']);
        
        // Helper endpoints
        Route::get('/filters/users', [AuditController::class, 'getUsers']);
        
        // User activity
        Route::get('/activity/user', [AuditController::class, 'getUserActivity']);
        
        // Module activity
        Route::get('/activity/module', [AuditController::class, 'getModuleActivity']);
    });
});

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    protected $audit;

    public function __construct(AuditService $audit)
    {
        $this->audit = $audit;
    }

    /**
     * Handle user login.
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        // Log the login attempt for debugging
        Log::info('Login attempt', [
            'username' => $credentials['username'],
            'username_lower' => strtolower($credentials['username']),
            'has_password' => !empty($credentials['password']),
            'is_inertia' => $request->header('X-Inertia') !== null,
        ]);

        // Attempt authentication with lowercase username
        $attemptResult = Auth::attempt([
            'username' => strtolower($credentials['username']),
            'password' => $credentials['password'],
        ]);
        
        Log::info('Auth attempt result', [
            'success' => $attemptResult,
            'user_id' => Auth::check() ? Auth::user()->user_id : null,
        ]);
        
        if ($attemptResult) {
            $user = Auth::user();
            
            // Check if user is archived
            if ($user->archived) {
                Auth::logout();
                return response()->json([
                    'success' => false,
                    'message' => 'Your account is archived. Please contact administrator.',
                ], 403);
            }
            
            // Log successful login with detailed info - wrap in try-catch to ensure it doesn't fail silently
            try {
                DB::table('audit_logs')->insert([
                    'action' => 'LOGIN',
                    'description' => '[AUTH] User logged in: Username: "' . $user->username . '", Full Name: "' . $user->full_name . '"',
                    'user_id' => $user->user_id,
                    'date_added' => now(),
                    'ip_address' => $request->ip(),
                ]);
            } catch (\Exception $e) {
                Log::error('Failed to log login audit: ' . $e->getMessage());
            }
            
            // Get user permissions with page details
            $permissions = DB::table('pages_access')
                ->join('pages', 'pages_access.page_id', '=', 'pages.p_id')
                ->where('pages_access.privilege', $user->priv_id)
                ->select(
                    'pages.p_id',
                    'pages.page',
                    'pages.page_name',
                    'pages.page_icon',
                    'pages_access.acs_edit',
                    'pages_access.acs_delete'
                )
                ->orderBy('pages.arrange_no')
                ->get();
            
            // Create sanctum token for API requests
            $token = $user->createToken('auth-token')->plainTextToken;
            
            // If this is an Inertia/web request, redirect to dashboard
            if ($request->header('X-Inertia')) {
                // Regenerate session to prevent session fixation
                $request->session()->regenerate();
                
                return redirect()->route('dashboard');
            }
            
            // Otherwise return JSON for API
            return response()->json([
                'success' => true,
                'message' => 'Login successful',
                'user' => [
                    'id' => $user->user_id,
                    'username' => $user->username,
                    'full_name' => $user->full_name,
                    'email' => $user->email,
                    'privilege' => $user->privilege,
                ],
                'permissions' => $permissions,
                'token' => $token,
            ]);
        }

        // Log failed login attempt with username - wrap in try-catch
        try {
            DB::table('audit_logs')->insert([
                'action' => 'LOGIN',
                'description' => '[AUTH] Failed login attempt for username: "' . $credentials['username'] . '"',
                'user_id' => null,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to log failed login audit: ' . $e->getMessage());
        }

        // If this is an Inertia/web request, redirect back with error
        if ($request->header('X-Inertia')) {
            return back()->withErrors([
                'username' => 'These credentials do not match our records.',
            ]);
        }

        // Otherwise return JSON for API
        return response()->json([
            'success' => false,
            'message' => 'Invalid credentials. Please check your username and password.',
        ], 401);
    }

    /**
     * Handle user logout.
     */
    public function logout(Request $request)
    {
        $user = Auth::user();
        
        if ($user) {
            // Log logout with detailed info
            DB::table('audit_logs')->insert([
                'action' => 'LOGOUT',
                'description' => '[AUTH] User logged out: Username: "' . $user->username . '", Full Name: "' . $user->full_name . '"',
                'user_id' => $user->user_id,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);
        }
        
        // Use web guard for session-based logout
        Auth::guard('web')->logout();
        
        // Clear session
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        
        // If this is an Inertia/web request, redirect to login
        if ($request->wantsJson() === false && $request->header('X-Inertia')) {
            return redirect()->route('login');
        }
        
        // Otherwise return JSON for API
        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully',
        ]);
    }

    /**
     * Handle automatic logout due to inactivity.
     */
    public function logoutInactive(Request $request)
    {
        $user = Auth::user();
        
        if ($user) {
            $inactiveDuration = $request->input('inactive_duration', 1800); // default 30 min
            
            // Log inactivity logout
            DB::table('audit_logs')->insert([
                'action' => 'FORCE LOGOUT',
                'description' => '[AUTH] User logged out due to inactivity (' . round($inactiveDuration / 60) . ' minutes): Username: "' . $user->username . '", Full Name: "' . $user->full_name . '"',
                'user_id' => $user->user_id,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);
        }
        
        // Use web guard for session-based logout
        Auth::guard('web')->logout();
        
        // Clear session
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        
        return response()->json([
            'success' => true,
            'message' => 'Logged out due to inactivity',
            'reason' => 'inactivity',
        ]);
    }

    /**
     * Get current authenticated user.
     */
    public function me(Request $request)
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated',
            ], 401);
        }

        // Get user permissions
        $permissions = DB::table('pages_access')
            ->Join('pages', 'fjp_pages_access.page_id', '=', 'fjp_pages.p_id')
            ->where('fjp_pages_access.privilege', $user->priv_id)
            ->select(
                'fjp_pages.p_id',
                'fjp_pages.page',
                'fjp_pages.page_name',
                'fjp_pages.page_icon',
                'fjp_pages_access.acs_edit',
                'fjp_pages_access.acs_delete'
            )
            ->orderBy('fjp_pages.arrange_no')
            ->get();

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->user_id,
                'username' => $user->username,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'privilege' => $user->privilege,
            ],
            'permissions' => $permissions,
        ]);
    }

    /**
     * Refresh authentication token.
     */
    public function refresh(Request $request)
    {
        $user = $request->user();
        
        // Revoke old token
        $request->user()->currentAccessToken()->delete();
        
        // Create new token
        $token = $user->createToken('auth-token')->plainTextToken;
        
        return response()->json([
            'success' => true,
            'token' => $token,
        ]);
    }
}


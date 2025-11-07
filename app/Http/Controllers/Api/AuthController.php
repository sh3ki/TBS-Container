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
            
            // Log successful login
            $this->audit->logLogin($user->user_id, true);
            
            // Get user permissions with page details
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
            
            // Create sanctum token for API requests
            $token = $user->createToken('auth-token')->plainTextToken;
            
            // If this is an Inertia/web request, redirect to dashboard
            if ($request->header('X-Inertia')) {
                // Regenerate session to prevent session fixation
                $request->session()->regenerate();
                
                return redirect()->intended(route('dashboard'));
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

        // Log failed login attempt
        $this->audit->log(
            'LOGIN',
            'Failed login attempt for username: ' . $credentials['username'],
            'AUTH'
        );

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
            // Log logout
            $this->audit->logLogout($user->user_id);
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


<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MobileAuthController extends Controller
{
    /**
     * Mobile login with plain text credentials (old system compatibility).
     * This is a separate endpoint from the main auth API.
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $username = strtolower($credentials['username']);
        $password = $credentials['password'];

        // Log the mobile login attempt
        Log::info('Mobile login attempt', [
            'username' => $username,
            'ip_address' => $request->ip(),
        ]);

        try {
            // Find user by username
            $user = User::where('username', $username)->first();

            // Check if user exists
            if (!$user) {
                // Log failed login attempt
                $this->logLoginAttempt(false, $username, $request->ip(), 'User not found');
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid username or password.',
                ], 401);
            }

            // Check if user is archived
            if ($user->archived) {
                $this->logLoginAttempt(false, $username, $request->ip(), 'Account archived');
                return response()->json([
                    'success' => false,
                    'message' => 'Your account is archived. Please contact administrator.',
                ], 403);
            }

            // Compare plain text password (old system compatibility)
            if ($user->password !== $password) {
                $this->logLoginAttempt(false, $username, $request->ip(), 'Invalid password');
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid username or password.',
                ], 401);
            }

            // Log successful login
            $this->logLoginAttempt(true, $username, $request->ip(), null, $user->user_id);

            // Generate a simple token for mobile session tracking
            $token = base64_encode($user->user_id . ':' . $username . ':' . time());

            // Return user data with token
            return response()->json([
                'success' => true,
                'message' => 'Login successful',
                'user' => [
                    'id' => $user->user_id,
                    'username' => $user->username,
                    'full_name' => $user->full_name,
                    'email' => $user->email,
                ],
                'token' => $token,
            ], 200);
        } catch (\Exception $e) {
            Log::error('Mobile login error', [
                'username' => $username,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred. Please try again.',
            ], 500);
        }
    }

    /**
     * Mobile logout (with comprehensive audit logging).
     */
    public function logout(Request $request)
    {
        $username = $request->input('username', 'unknown');
        $userId = $request->input('user_id');

        try {
            // Fetch user details for better audit trail
            $userFullName = 'Unknown';
            $auditUserId = $userId; // Use the provided user_id for audit log
            
            // Try to find user by user_id first, fallback to username
            if ($userId) {
                $user = DB::table('users')->where('user_id', $userId)->first();
                if ($user) {
                    $userFullName = $user->full_name ?? 'Unknown';
                }
            }
            
            // If not found by user_id, try by username
            if ($userFullName === 'Unknown' && !empty($username) && $username !== 'unknown') {
                $user = DB::table('users')->where('username', strtolower($username))->first();
                if ($user) {
                    $userFullName = $user->full_name ?? 'Unknown';
                    $auditUserId = $user->user_id; // Use the looked-up user_id if needed
                }
            }

            // Log the logout attempt
            Log::info('Mobile logout', [
                'username' => $username,
                'user_id' => $auditUserId,
                'user_full_name' => $userFullName,
                'ip_address' => $request->ip(),
            ]);

            // Create comprehensive audit log entry
            DB::table('audit_logs')->insert([
                'action' => 'LOGOUT',
                'description' => '[MOBILE] User logged out: Username: "' . $username . '" | User: "' . $userFullName . '"',
                'user_id' => $auditUserId,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to log mobile logout', [
                'username' => $username,
                'user_id' => $userId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully',
        ], 200);
    }

    /**
     * Log login attempts to the audit logs table.
     */
    private function logLoginAttempt($success, $username, $ipAddress, $reason = null, $userId = null)
    {
        try {
            $action = 'LOGIN';
            $description = $success
                ? '[MOBILE] User logged in: Username: "' . $username . '"'
                : '[MOBILE] Failed login attempt for username: "' . $username . '"' . ($reason ? ' - ' . $reason : '');

            // Use user_id from parameter if available, otherwise use the username for identification
            $auditUserId = $userId ?: null;

            DB::table('audit_logs')->insert([
                'action' => $action,
                'description' => $description,
                'user_id' => $auditUserId,
                'date_added' => now(),
                'ip_address' => $ipAddress,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to log mobile login attempt', [
                'username' => $username,
                'error' => $e->getMessage(),
            ]);
        }
    }
}

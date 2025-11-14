<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class UsersController extends Controller
{
    /**
     * Get list of users with pagination and search
     */
    public function getList(Request $request)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        $start = $request->input('start', 0);
        $length = $request->input('length', 25);
        $search = $request->input('search');
        $status = $request->input('status'); // 0=Inactive, 1=Active, null=All
        $privilegeId = $request->input('privilege_id');
        
        // Base query
        $query = "SELECT 
            u.user_id,
            u.username,
            u.full_name,
            u.email,
            u.priv_id,
            u.archived,
            u.date_added,
            u.checker_id as contact,
            p.description as privilege_name
        FROM {$prefix}users u
        LEFT JOIN {$prefix}privileges p ON p.p_code = u.priv_id
        WHERE 1=1";
        
        $params = [];
        
        // Search filter
        if ($search) {
            $query .= " AND (u.username LIKE :search OR u.full_name LIKE :search OR u.email LIKE :search)";
            $params['search'] = "%{$search}%";
        }
        
        // Status filter
        if ($status !== null && $status !== '') {
            $query .= " AND u.archived = :status";
            $params['status'] = $status;
        }
        
        // Privilege filter
        if ($privilegeId) {
            $query .= " AND u.priv_id = :priv_id";
            $params['priv_id'] = $privilegeId;
        }
        
        // Get total count
        $countQuery = preg_replace('/SELECT\s+.*?\s+FROM/is', 'SELECT COUNT(*) as total FROM', $query);
        $total = DB::select($countQuery, $params)[0]->total ?? 0;
        
        // Add pagination
        $query .= " ORDER BY u.username ASC LIMIT :start, :length";
        $params['start'] = (int)$start;
        $params['length'] = (int)$length;
        
        $results = DB::select($query, $params);
        
        // Format results
        $data = [];
        foreach ($results as $row) {
            $data[] = [
                'user_id' => $row->user_id,
                'hashed_id' => md5($row->user_id),
                'username' => $row->username,
                'full_name' => $row->full_name,
                'email' => $row->email,
                'contact' => $row->contact ?? '',
                'privilege_id' => $row->priv_id,
                'privilege_name' => $row->privilege_name ?? 'N/A',
                'status' => $row->archived == 0 ? 'Active' : 'Inactive',
                'status_badge' => $row->archived == 0 ? 'success' : 'danger',
                'date_added' => $row->date_added ? date('Y-m-d H:i:s', strtotime($row->date_added)) : null,
            ];
        }
        
        return response()->json([
            'success' => true,
            'data' => $data,
            'total' => $total,
            'filtered' => count($data)
        ]);
    }

    /**
     * Get single user details
     */
    public function getDetails($hashedId)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        // Find user by hashed ID
        $users = DB::select("SELECT user_id FROM {$prefix}users");
        $userId = null;
        
        foreach ($users as $user) {
            if (md5($user->user_id) === $hashedId) {
                $userId = $user->user_id;
                break;
            }
        }
        
        if (!$userId) {
            return response()->json(['success' => false, 'message' => 'User not found'], 404);
        }
        
        $query = "SELECT 
            u.user_id,
            u.username,
            u.full_name,
            u.email,
            u.priv_id,
            u.archived,
            u.date_added,
            u.checker_id as contact,
            p.description as privilege_name
        FROM {$prefix}users u
        LEFT JOIN {$prefix}privileges p ON p.p_code = u.priv_id
        WHERE u.user_id = :user_id";
        
        $user = DB::select($query, ['user_id' => $userId]);
        
        if (empty($user)) {
            return response()->json(['success' => false, 'message' => 'User not found'], 404);
        }
        
        $user = $user[0];
        
        // Get user's page access
        $pageAccess = DB::select("SELECT 
            pa.pa_id,
            pa.page_id,
            pa.acs_edit,
            pa.acs_delete,
            p.page_name,
            p.page
        FROM {$prefix}pages_access pa
        LEFT JOIN {$prefix}pages p ON p.p_id = pa.page_id
        WHERE pa.privilege = :priv_id", ['priv_id' => $user->priv_id]);
        
        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $user->user_id,
                'hashed_id' => md5($user->user_id),
                'username' => $user->username,
                'full_name' => $user->full_name,
                'email' => $user->email,
                'contact' => $user->contact ?? '',
                'privilege_id' => $user->priv_id,
                'privilege_name' => $user->privilege_name ?? 'N/A',
                'status' => $user->archived == 0 ? 'Active' : 'Inactive',
                'date_added' => $user->date_added,
                'page_access' => $pageAccess
            ]
        ]);
    }

    /**
     * Create new user
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|unique:users,username|min:3|max:75',
            'password' => 'required|min:6',
            'full_name' => 'required|max:150',
            'email' => 'required|email|unique:users,email|max:150',
            'priv_id' => 'required|integer',
            'contact' => 'nullable|max:150'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }
        
        $prefix = env('DB_PREFIX', 'fjp_');
        
        try {
            // Generate salt and hash password (matching legacy MD5 + salt pattern)
            $salt = substr(md5(uniqid()), 0, 5);
            $password = md5($request->password . $salt);
            
            $userId = DB::table('users')->insertGetId([
                'username' => $request->username,
                'password' => $password,
                'salt' => $salt,
                'full_name' => $request->full_name,
                'email' => $request->email,
                'priv_id' => $request->priv_id,
                'checker_id' => $request->contact ?? '',
                'date_added' => now(),
                'archived' => $request->input('archived', 0)
            ]);
            
            // Get privilege name for logging
            $privilege = DB::table('privileges')->where('p_code', $request->priv_id)->first();
            $privilegeName = $privilege ? $privilege->p_desc : 'Unknown';
            
            // Log to audit - ADD action with all fields
            DB::table('audit_logs')->insert([
                'action' => 'ADD',
                'description' => '[USERS] Added new user: Username: "' . $request->username . '", Full Name: "' . $request->full_name . '", Email: "' . $request->email . '", Privilege: "' . $privilegeName . '", Contact: "' . ($request->contact ?? 'N/A') . '"',
                'user_id' => $request->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'User created successfully',
                'user_id' => $userId,
                'hashed_id' => md5($userId)
            ], 201);
            
        } catch (\Exception $e) {
            Log::error('User creation failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update existing user
     */
    public function update(Request $request, $hashedId)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        // Find user by hashed ID
        $users = DB::select("SELECT user_id FROM {$prefix}users");
        $userId = null;
        
        foreach ($users as $user) {
            if (md5($user->user_id) === $hashedId) {
                $userId = $user->user_id;
                break;
            }
        }
        
        if (!$userId) {
            return response()->json(['success' => false, 'message' => 'User not found'], 404);
        }
        
        $validator = Validator::make($request->all(), [
            'full_name' => 'required|max:150',
            'email' => 'required|email|max:150|unique:users,email,' . $userId . ',user_id',
            'priv_id' => 'required|integer',
            'contact' => 'nullable|max:150',
            'new_password' => 'nullable|min:6',
            'change_password' => 'nullable|boolean'
        ]);
        
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }
        
        try {
            // Get old user data for comparison
            $oldUser = DB::table('users as u')
                ->leftJoin('privileges as p', 'p.p_code', '=', 'u.priv_id')
                ->select('u.username', 'u.full_name', 'u.email', 'u.priv_id', 'u.checker_id', 'p.p_desc as privilege_name')
                ->where('u.user_id', $userId)
                ->first();
            
            $updateData = [
                'full_name' => $request->full_name,
                'email' => $request->email,
                'priv_id' => $request->priv_id,
                'checker_id' => $request->contact ?? '',
                'archived' => $request->input('archived', 0)
            ];
            
            // Update password if requested
            $passwordChanged = false;
            if ($request->change_password && $request->new_password) {
                $salt = substr(md5(uniqid()), 0, 5);
                $updateData['password'] = md5($request->new_password . $salt);
                $updateData['salt'] = $salt;
                $passwordChanged = true;
            }
            
            DB::table('users')
                ->where('user_id', $userId)
                ->update($updateData);
            
            // Get new privilege name
            $newPrivilege = DB::table('privileges')->where('p_code', $request->priv_id)->first();
            $newPrivilegeName = $newPrivilege ? $newPrivilege->p_desc : 'Unknown';
            
            // Log to audit - EDIT action with old->new tracking
            $changes = [];
            if ($oldUser->full_name !== $request->full_name) {
                $changes[] = 'Full Name: "' . $oldUser->full_name . '" -> "' . $request->full_name . '"';
            }
            if ($oldUser->email !== $request->email) {
                $changes[] = 'Email: "' . $oldUser->email . '" -> "' . $request->email . '"';
            }
            if ($oldUser->priv_id !== $request->priv_id) {
                $changes[] = 'Privilege: "' . $oldUser->privilege_name . '" -> "' . $newPrivilegeName . '"';
            }
            if (($oldUser->checker_id ?? '') !== ($request->contact ?? '')) {
                $changes[] = 'Contact: "' . ($oldUser->checker_id ?? 'N/A') . '" -> "' . ($request->contact ?? 'N/A') . '"';
            }
            if ($passwordChanged) {
                $changes[] = 'Password: Changed';
            }
            
            if (count($changes) > 0) {
                DB::table('audit_logs')->insert([
                    'action' => 'EDIT',
                    'description' => '[USERS] Edited user "' . $oldUser->username . '": ' . implode(', ', $changes),
                    'user_id' => $request->user()->user_id ?? null,
                    'date_added' => now(),
                    'ip_address' => $request->ip(),
                ]);
            }
            
            return response()->json([
                'success' => true,
                'message' => 'User updated successfully'
            ]);
            
        } catch (\Exception $e) {
            Log::error('User update failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete user
     */
    public function delete($hashedId, Request $request)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        // Find user by hashed ID
        $users = DB::select("SELECT user_id, username FROM {$prefix}users");
        $userId = null;
        $username = null;
        
        foreach ($users as $user) {
            if (md5($user->user_id) === $hashedId) {
                $userId = $user->user_id;
                $username = $user->username;
                break;
            }
        }
        
        if (!$userId) {
            return response()->json(['success' => false, 'message' => 'User not found'], 404);
        }
        
        // Prevent deleting yourself
        $currentUserId = $request->user()->user_id ?? 0;
        if ($userId == $currentUserId) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot delete your own account'
            ], 403);
        }
        
        try {
            // Get user details before deletion
            $userDetails = DB::table('users as u')
                ->leftJoin('privileges as p', 'p.p_code', '=', 'u.priv_id')
                ->select('u.username', 'u.full_name', 'u.email', 'p.p_desc as privilege_name', 'u.checker_id')
                ->where('u.user_id', $userId)
                ->first();
            
            DB::table('users')
                ->where('user_id', $userId)
                ->delete();
            
            // Log to audit - DELETE action with all details
            DB::table('audit_logs')->insert([
                'action' => 'DELETE',
                'description' => '[USERS] Deleted user: Username: "' . ($userDetails->username ?? 'Unknown') . '", Full Name: "' . ($userDetails->full_name ?? 'N/A') . '", Email: "' . ($userDetails->email ?? 'N/A') . '", Privilege: "' . ($userDetails->privilege_name ?? 'N/A') . '"',
                'user_id' => $currentUserId,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'User deleted successfully'
            ]);
            
        } catch (\Exception $e) {
            Log::error('User deletion failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all privileges/roles
     */
    public function getPrivileges()
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        $privileges = DB::select("SELECT p_code as priv_id, description as priv_name FROM {$prefix}privileges ORDER BY description ASC");
        
        return response()->json([
            'success' => true,
            'data' => $privileges
        ]);
    }

    /**
     * Get all pages/modules
     */
    public function getPages()
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        $pages = DB::select("SELECT p_id, page, page_name, page_icon FROM {$prefix}pages ORDER BY arrange_no ASC, page_name ASC");
        
        return response()->json([
            'success' => true,
            'data' => $pages
        ]);
    }

    /**
     * Get pages for a specific privilege
     */
    public function getPrivilegePages($privId)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        $pages = DB::select("
            SELECT 
                p.p_id as page_id,
                p.page,
                p.page_name,
                p.page_icon,
                COALESCE(pa.acs_edit, 0) as acs_edit,
                COALESCE(pa.acs_delete, 0) as acs_delete
            FROM {$prefix}pages p
            LEFT JOIN {$prefix}pages_access pa ON pa.page_id = p.p_id AND pa.privilege = :priv_id
            WHERE (pa.acs_edit = 1 OR pa.acs_delete = 1)
            ORDER BY p.arrange_no ASC, p.page_name ASC
        ", ['priv_id' => $privId]);
        
        return response()->json([
            'success' => true,
            'data' => $pages
        ]);
    }

    /**
     * Get user's page access permissions
     */
    public function getPageAccess($hashedId)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        // Find user by hashed ID
        $users = DB::select("SELECT user_id, priv_id FROM {$prefix}users");
        $userId = null;
        $privId = null;
        
        foreach ($users as $user) {
            if (md5($user->user_id) === $hashedId) {
                $userId = $user->user_id;
                $privId = $user->priv_id;
                break;
            }
        }
        
        if (!$userId) {
            return response()->json(['success' => false, 'message' => 'User not found'], 404);
        }
        
        $pageAccess = DB::select("SELECT 
            pa.pa_id,
            pa.page_id,
            pa.acs_edit,
            pa.acs_delete,
            p.page,
            p.page_name,
            p.page_icon
        FROM {$prefix}pages_access pa
        LEFT JOIN {$prefix}pages p ON p.p_id = pa.page_id
        WHERE pa.privilege = :priv_id
        ORDER BY p.arrange_no ASC, p.page_name ASC", ['priv_id' => $privId]);
        
        return response()->json([
            'success' => true,
            'data' => $pageAccess
        ]);
    }

    /**
     * Update user's page access permissions
     */
    public function updatePageAccess(Request $request, $hashedId)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        // Find user by hashed ID
        $users = DB::select("SELECT user_id, priv_id FROM {$prefix}users");
        $userId = null;
        $privId = null;
        
        foreach ($users as $user) {
            if (md5($user->user_id) === $hashedId) {
                $userId = $user->user_id;
                $privId = $user->priv_id;
                break;
            }
        }
        
        if (!$userId) {
            return response()->json(['success' => false, 'message' => 'User not found'], 404);
        }
        
        try {
            // Delete existing page access for this privilege
            DB::table($prefix . 'pages_access')
                ->where('privilege', $privId)
                ->delete();
            
            // Insert new page access
            $pageAccess = $request->input('page_access', []);
            
            foreach ($pageAccess as $access) {
                DB::table($prefix . 'pages_access')->insert([
                    'privilege' => $privId,
                    'page_id' => $access['page_id'],
                    'acs_edit' => $access['acs_edit'] ?? 0,
                    'acs_delete' => $access['acs_delete'] ?? 0
                ]);
            }
            
            // Log action
            $this->logAudit('UPDATE_PAGE_ACCESS', "Updated page access for user ID: {$userId}", $request->user()->user_id ?? 0);
            
            return response()->json([
                'success' => true,
                'message' => 'Page access updated successfully'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Page access update failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update page access: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check if username is available
     */
    public function checkUsername(Request $request)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        $username = $request->input('username');
        $userId = $request->input('user_id'); // For edit mode
        
        $query = "SELECT COUNT(*) as count FROM {$prefix}users WHERE username = :username";
        $params = ['username' => $username];
        
        if ($userId) {
            $query .= " AND user_id != :user_id";
            $params['user_id'] = $userId;
        }
        
        $result = DB::select($query, $params);
        $exists = $result[0]->count > 0;
        
        return response()->json([
            'available' => !$exists
        ]);
    }

    /**
     * Check if email is available
     */
    public function checkEmail(Request $request)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        $email = $request->input('email');
        $userId = $request->input('user_id'); // For edit mode
        
        $query = "SELECT COUNT(*) as count FROM {$prefix}users WHERE email = :email";
        $params = ['email' => $email];
        
        if ($userId) {
            $query .= " AND user_id != :user_id";
            $params['user_id'] = $userId;
        }
        
        $result = DB::select($query, $params);
        $exists = $result[0]->count > 0;
        
        return response()->json([
            'available' => !$exists
        ]);
    }

    /**
     * Toggle user status (Active/Inactive)
     */
    public function toggleStatus($hashedId, Request $request)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        // Find user by hashed ID
        $users = DB::select("SELECT user_id, archived FROM {$prefix}users");
        $userId = null;
        $currentStatus = null;
        
        foreach ($users as $user) {
            if (md5($user->user_id) === $hashedId) {
                $userId = $user->user_id;
                $currentStatus = $user->archived;
                break;
            }
        }
        
        if (!$userId) {
            return response()->json(['success' => false, 'message' => 'User not found'], 404);
        }
        
        try {
            // Get username before update
            $userInfo = DB::table('users')
                ->select('username', 'archived')
                ->where('user_id', $userId)
                ->first();
            
            $currentStatus = $userInfo->archived ?? 0;
            $newStatus = $currentStatus == 0 ? 1 : 0;
            
            DB::table('users')
                ->where('user_id', $userId)
                ->update(['archived' => $newStatus]);
            
            // Log to audit - EDIT action with status change
            $statusChange = 'Status: "' . ($currentStatus == 0 ? 'Active' : 'Inactive') . '" -> "' . ($newStatus == 0 ? 'Active' : 'Inactive') . '"';
            
            DB::table('audit_logs')->insert([
                'action' => 'EDIT',
                'description' => '[USERS] ' . ($newStatus == 1 ? 'Deactivated' : 'Activated') . ' user "' . ($userInfo->username ?? 'Unknown') . '": ' . $statusChange,
                'user_id' => $request->user()->user_id ?? null,
                'date_added' => now(),
                'ip_address' => $request->ip(),
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'User status updated successfully',
                'new_status' => $newStatus == 0 ? 'Active' : 'Inactive'
            ]);
            
        } catch (\Exception $e) {
            Log::error('Status toggle failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update status: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Log audit trail
     */
    private function logAudit($action, $description, $userId)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        try {
            DB::table($prefix . 'audit_logs')->insert([
                'action' => $action,
                'description' => $description,
                'user_id' => $userId,
                'date_added' => now(),
                'ip_address' => request()->ip()
            ]);
        } catch (\Exception $e) {
            Log::error('Audit log failed: ' . $e->getMessage());
        }
    }

    // ==================== PRIVILEGE MANAGEMENT ====================

    /**
     * Get user privileges (page access)
     */
    public function getUserPrivileges($hashedId)
    {
        // Decode hashed ID to get real user ID
        $user = DB::table('users')
            ->select('*')
            ->get()
            ->first(function ($u) use ($hashedId) {
                return md5($u->user_id) === $hashedId;
            });
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        // Get user's privilege ID
        $privId = $user->priv_id;

        // Get all pages
        $pages = DB::table('pages')
            ->orderBy('arrange_no')
            ->orderBy('page_name')
            ->get();

        // Get existing page accesses for this privilege
        $accesses = DB::table('pages_access')
            ->where('privilege', $privId)
            ->get()
            ->keyBy('page_id');

        // Map pages with access status
        $privileges = $pages->map(function ($page) use ($accesses) {
            $access = $accesses->get($page->p_id);
            return [
                'page_id' => $page->p_id,
                'page' => $page->page,
                'page_name' => $page->page_name,
                'page_icon' => $page->page_icon,
                'has_access' => isset($access),
                'can_edit' => $access->acs_edit ?? 0,
                'can_delete' => $access->acs_delete ?? 0,
                'pa_id' => $access->pa_id ?? null,
            ];
        });

        return response()->json([
            'success' => true,
            'user' => [
                'user_id' => $user->user_id,
                'username' => $user->username,
                'full_name' => $user->full_name,
                'priv_id' => $privId
            ],
            'privileges' => $privileges
        ]);
    }

    /**
     * Update user privileges
     */
    public function updateUserPrivileges(Request $request, $hashedId)
    {
        // Decode hashed ID to get real user ID
        $user = DB::table('users')
            ->select('*')
            ->get()
            ->first(function ($u) use ($hashedId) {
                return md5($u->user_id) === $hashedId;
            });
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        $validated = $request->validate([
            'privileges' => 'required|array',
            'privileges.*.page_id' => 'required|integer|exists:pages,p_id',
            'privileges.*.has_access' => 'required|boolean',
            'privileges.*.can_edit' => 'required|boolean',
            'privileges.*.can_delete' => 'required|boolean',
        ]);

        $privId = $user->priv_id;

        DB::beginTransaction();

        try {
            // Delete all existing accesses for this privilege
            DB::table('pages_access')->where('privilege', $privId)->delete();

            // Insert new accesses
            foreach ($validated['privileges'] as $privilege) {
                if ($privilege['has_access']) {
                    DB::table('pages_access')->insert([
                        'privilege' => $privId,
                        'page_id' => $privilege['page_id'],
                        'acs_edit' => $privilege['can_edit'] ? 1 : 0,
                        'acs_delete' => $privilege['can_delete'] ? 1 : 0,
                    ]);
                }
            }

            // Log audit
            $this->logAudit(
                'UPDATE',
                'Updated privileges for user: ' . $user->username,
                $request->user()->u_id ?? null
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Privileges updated successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Update privileges failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update privileges: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all available privilege templates
     */
    public function getAllPrivilegeTemplates()
    {
        $privileges = DB::table('privileges')
            ->orderBy('description')
            ->get();

        return response()->json([
            'success' => true,
            'privileges' => $privileges
        ]);
    }

    /**
     * Assign privilege template to user
     */
    public function assignUserPrivilegeTemplate(Request $request, $hashedId)
    {
        $validated = $request->validate([
            'priv_id' => 'required|integer|exists:privileges,p_code',
        ]);

        // Decode hashed ID to get real user ID
        $user = DB::table('users')
            ->select('*')
            ->get()
            ->first(function ($u) use ($hashedId) {
                return md5($u->user_id) === $hashedId;
            });
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        DB::beginTransaction();

        try {
            // Update user's privilege
            DB::table('users')
                ->where('user_id', $user->user_id)
                ->update(['priv_id' => $validated['priv_id']]);

            // Log audit
            $privilege = DB::table('privileges')->where('p_code', $validated['priv_id'])->first();
            $this->logAudit(
                'UPDATE',
                'Assigned privilege template "' . $privilege->description . '" to user: ' . $user->username,
                $request->user()->u_id ?? null
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Privilege template assigned successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Assign privilege template failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to assign privilege template: ' . $e->getMessage()
            ], 500);
        }
    }

    // ==================== SCHEDULE MANAGEMENT ====================

    /**
     * Get user's work schedule
     */
    public function getSchedule($hashedId)
    {
        // Decode hashed ID to get real user ID
        $user = DB::table('users')
            ->select('*')
            ->get()
            ->first(function ($u) use ($hashedId) {
                return md5($u->user_id) === $hashedId;
            });
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        // Get user's schedules
        $schedules = DB::table('user_schedules')
            ->where('user_id', $user->user_id)
            ->get();

        // Format schedules by day
        $days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        $formattedSchedules = [];

        foreach ($days as $day) {
            $schedule = $schedules->firstWhere('day_of_week', $day);
            $formattedSchedules[] = [
                'day' => $day,
                'shift_start' => $schedule->shift_start ?? null,
                'shift_end' => $schedule->shift_end ?? null,
                'is_active' => $schedule->is_active ?? 0,
                'schedule_id' => $schedule->schedule_id ?? null,
            ];
        }

        return response()->json([
            'success' => true,
            'user' => [
                'user_id' => $user->user_id,
                'username' => $user->username,
                'full_name' => $user->full_name,
                'force_logout_enabled' => $user->force_logout_enabled ?? 0
            ],
            'schedules' => $formattedSchedules
        ]);
    }

    /**
     * Update user's work schedule
     */
    public function updateSchedule(Request $request, $hashedId)
    {
        // Decode hashed ID to get real user ID
        $user = DB::table('users')
            ->select('*')
            ->get()
            ->first(function ($u) use ($hashedId) {
                return md5($u->user_id) === $hashedId;
            });
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        $validated = $request->validate([
            'enable_force_logout' => 'required|boolean',
            'schedules' => 'required|array',
            'schedules.*.day' => 'required|string',
            'schedules.*.shift_start' => 'nullable|date_format:H:i',
            'schedules.*.shift_end' => 'nullable|date_format:H:i',
            'schedules.*.is_active' => 'required|boolean',
        ]);

        DB::beginTransaction();

        try {
            // Update force_logout_enabled flag
            DB::table('users')
                ->where('user_id', $user->user_id)
                ->update(['force_logout_enabled' => $validated['enable_force_logout'] ? 1 : 0]);

            // Delete existing schedules
            DB::table('user_schedules')
                ->where('user_id', $user->user_id)
                ->delete();

            // Insert new schedules
            foreach ($validated['schedules'] as $schedule) {
                if ($schedule['is_active']) {
                    DB::table('user_schedules')->insert([
                        'user_id' => $user->user_id,
                        'day_of_week' => $schedule['day'],
                        'shift_start' => $schedule['shift_start'],
                        'shift_end' => $schedule['shift_end'],
                        'is_active' => 1,
                    ]);
                }
            }

            // Log audit
            $this->logAudit(
                'UPDATE',
                'Updated work schedule for user: ' . $user->username,
                $request->user()->u_id ?? null
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Work schedule updated successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Update schedule failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to update schedule: ' . $e->getMessage()
            ], 500);
        }
    }

    // ==================== LOGIN HISTORY & ACTIVITY ====================

    /**
     * Get user's login history
     */
    public function getLoginHistory(Request $request, $hashedId)
    {
        // Decode hashed ID to get real user ID
        $user = DB::table('users')
            ->select('*')
            ->get()
            ->first(function ($u) use ($hashedId) {
                return md5($u->user_id) === $hashedId;
            });
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        $limit = $request->input('limit', 50);

        // Get login history
        $history = DB::table('login_history')
            ->where('user_id', $user->user_id)
            ->orderBy('login_time', 'desc')
            ->limit($limit)
            ->get();

        // Calculate session duration for each entry
        $formattedHistory = $history->map(function ($entry) {
            $duration = null;
            if ($entry->login_time && $entry->logout_time) {
                $login = Carbon::parse($entry->login_time);
                $logout = Carbon::parse($entry->logout_time);
                $duration = $login->diff($logout)->format('%H:%I:%S');
            }

            return [
                'log_id' => $entry->log_id,
                'username' => $entry->username,
                'ip_address' => $entry->ip_address,
                'login_time' => $entry->login_time,
                'logout_time' => $entry->logout_time,
                'status' => $entry->status,
                'remarks' => $entry->remarks,
                'duration' => $duration,
            ];
        });

        return response()->json([
            'success' => true,
            'user' => [
                'user_id' => $user->user_id,
                'username' => $user->username,
                'full_name' => $user->full_name,
            ],
            'history' => $formattedHistory
        ]);
    }

    /**
     * Get user's activity log
     */
    public function getActivityLog(Request $request, $hashedId)
    {
        // Decode hashed ID to get real user ID
        $user = DB::table('users')
            ->select('*')
            ->get()
            ->first(function ($u) use ($hashedId) {
                return md5($u->user_id) === $hashedId;
            });
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        $limit = $request->input('limit', 100);

        // Get activity log from audit_logs
        $activity = DB::table('audit_logs')
            ->where('user_id', $user->user_id)
            ->orderBy('date_added', 'desc')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'user' => [
                'user_id' => $user->user_id,
                'username' => $user->username,
                'full_name' => $user->full_name,
            ],
            'activity' => $activity
        ]);
    }

    // ==================== PASSWORD MANAGEMENT ====================

    /**
     * Admin resets user password
     */
    public function resetPassword(Request $request, $hashedId)
    {
        // Decode hashed ID to get real user ID
        $user = DB::table('users')
            ->select('*')
            ->get()
            ->first(function ($u) use ($hashedId) {
                return md5($u->user_id) === $hashedId;
            });
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        }

        $validated = $request->validate([
            'new_password' => 'required|min:6',
            'confirm_password' => 'required|same:new_password',
        ]);

        try {
            // Generate salt and hash password (matching legacy MD5 + salt pattern)
            $salt = substr(md5(uniqid()), 0, 5);
            $password = md5($validated['new_password'] . $salt);

            DB::table('users')
                ->where('user_id', $user->user_id)
                ->update([
                    'password' => $password,
                    'salt' => $salt,
                ]);

            // Log audit
            $this->logAudit(
                'RESET_PASSWORD',
                'Admin reset password for user: ' . $user->username,
                $request->user()->u_id ?? null
            );

            return response()->json([
                'success' => true,
                'message' => 'Password reset successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Reset password failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to reset password: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * User changes own password
     */
    public function changeOwnPassword(Request $request)
    {
        $currentUser = $request->user();
        
        if (!$currentUser) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 401);
        }

        $validated = $request->validate([
            'current_password' => 'required',
            'new_password' => 'required|min:6',
            'confirm_password' => 'required|same:new_password',
        ]);

        try {
            // Get user from database
            $user = DB::table('users')
                ->where('user_id', $currentUser->u_id)
                ->first();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            // Verify current password
            $currentPasswordHash = md5($validated['current_password'] . $user->salt);
            if ($currentPasswordHash !== $user->password) {
                return response()->json([
                    'success' => false,
                    'message' => 'Current password is incorrect'
                ], 422);
            }

            // Generate new salt and hash password
            $salt = substr(md5(uniqid()), 0, 5);
            $password = md5($validated['new_password'] . $salt);

            DB::table('users')
                ->where('user_id', $user->user_id)
                ->update([
                    'password' => $password,
                    'salt' => $salt,
                ]);

            // Log audit
            $this->logAudit(
                'CHANGE_PASSWORD',
                'User changed own password: ' . $user->username,
                $currentUser->u_id
            );

            return response()->json([
                'success' => true,
                'message' => 'Password changed successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Change password failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to change password: ' . $e->getMessage()
            ], 500);
        }
    }

    // ==================== ADMIN ACTIONS ====================

    /**
     * Get currently online users
     */
    public function getOnlineUsers()
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        // Get active sessions (where dt_stamp_end is NULL)
        $onlineUsers = DB::select("
            SELECT 
                u.user_id,
                u.username,
                u.full_name,
                u.email,
                s.ip_address,
                s.dt_stamp_start as login_time,
                p.description as privilege_name
            FROM {$prefix}sessions s
            JOIN {$prefix}users u ON u.user_id = s.u_id
            LEFT JOIN {$prefix}privileges p ON p.p_code = u.priv_id
            WHERE s.dt_stamp_end IS NULL
            ORDER BY s.dt_stamp_start DESC
        ");

        return response()->json([
            'success' => true,
            'online_users' => $onlineUsers,
            'count' => count($onlineUsers)
        ]);
    }

    /**
     * Force logout a user (admin action)
     */
    public function forceLogout(Request $request, $hashedId)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        // Decode hashed ID to get real user ID
        $users = DB::select("SELECT user_id, username FROM {$prefix}users");
        $userId = null;
        $username = null;
        
        foreach ($users as $user) {
            if (md5($user->user_id) === $hashedId) {
                $userId = $user->user_id;
                $username = $user->username;
                break;
            }
        }
        
        if (!$userId) {
            return response()->json(['success' => false, 'message' => 'User not found'], 404);
        }

        try {
            // Update all active sessions for this user
            DB::table($prefix . 'sessions')
                ->where('u_id', $userId)
                ->whereNull('dt_stamp_end')
                ->update(['dt_stamp_end' => now()]);

            // Log to login history
            DB::table($prefix . 'login_history')->insert([
                'user_id' => $userId,
                'username' => $username,
                'ip_address' => $request->ip(),
                'login_time' => now(),
                'logout_time' => now(),
                'status' => 'Forced',
                'remarks' => 'Forced logout by admin: ' . ($request->user()->username ?? 'System'),
            ]);

            // Log audit
            $this->logAudit(
                'FORCE_LOGOUT',
                'Admin forced logout for user: ' . $username,
                $request->user()->u_id ?? null
            );

            return response()->json([
                'success' => true,
                'message' => 'User logged out successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Force logout failed: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to force logout: ' . $e->getMessage()
            ], 500);
        }
    }
}



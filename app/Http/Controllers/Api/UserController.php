<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Auth\LegacyHasher;

class UserController extends Controller
{
    protected $audit;
    protected $hasher;

    public function __construct(AuditService $audit, LegacyHasher $hasher)
    {
        $this->audit = $audit;
        $this->hasher = $hasher;
    }

    /**
     * Display a listing of users.
     */
    public function index(Request $request)
    {
        $query = User::with('privilege');

        // Search
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('username', 'like', "%{$search}%")
                  ->orWhere('full_name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Filter by privilege
        if ($request->has('privilege_id')) {
            $query->where('priv_id', $request->privilege_id);
        }

        // Filter by status (archived: 0=active, 1=archived)
        if ($request->has('archived')) {
            $query->where('archived', $request->archived);
        }

        $sortBy = $request->get('sort_by', 'full_name');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->get('per_page', 15);
        $users = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    /**
     * Store a newly created user.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:100|unique:users,username',
            'password' => 'required|string|min:6',
            'full_name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'priv_id' => 'required|exists:fjp_privileges,priv_id',
            'archived' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        
        // Generate salt
        $salt = bin2hex(random_bytes(16));
        
        // Hash password with salt using legacy method
        $data['password'] = $this->hasher->makeWithSalt($data['password'], $salt);
        $data['salt'] = $salt;
        $data['username'] = strtolower($data['username']);
        $data['archived'] = $data['archived'] ?? 0;
        $data['date_added'] = now();

        $user = User::create($data);

        $this->audit->logCreate(
            'USERS',
            $user->user_id,
            "Created user account: {$user->username} ({$user->full_name})"
        );

        return response()->json([
            'success' => true,
            'message' => 'User created successfully',
            'data' => $user->load('privilege'),
        ], 201);
    }

    /**
     * Display the specified user.
     */
    public function show($id)
    {
        $user = User::with('privilege')->find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $user,
        ]);
    }

    /**
     * Update the specified user.
     */
    public function update(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'username' => 'required|string|max:100|unique:users,username,' . $id . ',user_id',
            'full_name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $id . ',user_id',
            'priv_id' => 'required|exists:fjp_privileges,priv_id',
            'archived' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        $data['username'] = strtolower($data['username']);

        $user->update($data);

        $this->audit->logUpdate(
            'USERS',
            $user->user_id,
            "Updated user account: {$user->username}"
        );

        return response()->json([
            'success' => true,
            'message' => 'User updated successfully',
            'data' => $user->load('privilege'),
        ]);
    }

    /**
     * Update user password.
     */
    public function updatePassword(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'current_password' => 'required_if:self_update,true|string',
            'new_password' => 'required|string|min:6|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // If user is updating their own password, verify current password
        if ($request->get('self_update') == true) {
            if (!$this->hasher->check($request->current_password, $user->password, ['salt' => $user->salt])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Current password is incorrect',
                ], 422);
            }
        }

        // Generate new salt
        $salt = bin2hex(random_bytes(16));
        
        // Hash new password with salt
        $user->update([
            'password' => $this->hasher->makeWithSalt($request->new_password, $salt),
            'salt' => $salt,
        ]);

        $this->audit->log(
            'UPDATE',
            "Password changed for user: {$user->username}",
            'USERS',
            $user->user_id
        );

        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully',
        ]);
    }

    /**
     * Remove the specified user.
     */
    public function destroy($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        // Prevent deleting currently authenticated user
        if ($user->user_id == auth()->user()->user_id) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete your own account',
            ], 422);
        }

        $username = $user->username;
        $user->delete();

        $this->audit->logDelete(
            'USERS',
            $id,
            "Deleted user account: {$username}"
        );

        return response()->json([
            'success' => true,
            'message' => 'User deleted successfully',
        ]);
    }

    /**
     * Toggle user archived status (archived: 0=active, 1=archived).
     */
    public function toggleStatus($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $user->archived = !$user->archived;
        $user->save();

        $status = $user->archived ? 'archived' : 'activated';

        $this->audit->log(
            'UPDATE',
            "User account {$status}: {$user->username}",
            'USERS',
            $user->user_id
        );

        return response()->json([
            'success' => true,
            'message' => "User {$status} successfully",
            'data' => $user,
        ]);
    }
}


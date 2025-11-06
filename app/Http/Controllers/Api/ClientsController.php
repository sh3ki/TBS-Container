<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\StorageRate;
use App\Models\HandlingRate;
use App\Models\ClientRegularHours;
use App\Models\ContainerSize;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClientsController extends Controller
{
    /**
     * Get all available container sizes for dropdowns
     */
    public function getContainerSizes()
    {
        $sizes = DB::table('container_size')
            ->where('active', 1)
            ->orderBy('size_name')
            ->select('cs_id', 'size_name')
            ->get();

        return response()->json([
            'success' => true,
            'sizes' => $sizes
        ]);
    }

    public function index(Request $request)
    {
        // Fetch ALL clients (both active and inactive) but exclude archived
        $query = DB::table('clients')
            ->where('archived', 0);  // Exclude archived clients

        // Search functionality
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('client_name', 'like', "%{$search}%")
                  ->orWhere('client_code', 'like', "%{$search}%")
                  ->orWhere('contact_person', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'date_added');
        $sortOrder = $request->get('sort_order', 'desc');
        
        // Validate sort column
        $allowedSortColumns = ['client_name', 'client_code', 'client_email', 'contact_person', 'date_added'];
        if (!in_array($sortBy, $allowedSortColumns)) {
            $sortBy = 'date_added';
        }
        
        $query->orderBy($sortBy, $sortOrder);

        // Pagination (15 per page like legacy system)
        $perPage = $request->get('per_page', 15);
        $clients = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'clients' => $clients->items(),
            'pagination' => [
                'current_page' => $clients->currentPage(),
                'per_page' => $clients->perPage(),
                'total' => $clients->total(),
                'last_page' => $clients->lastPage(),
            ]
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'client_name' => 'required|string|max:100',
            'client_code' => 'required|string|max:45|unique:clients,client_code',
            'client_address' => 'nullable|string|max:250',
            'client_email' => 'nullable|string|max:250',
            'contact_person' => 'required|string|max:100',
            'phone_number' => 'nullable|string|max:45',
            'fax_number' => 'nullable|string|max:45',
        ]);

        $client = DB::table('clients')->insertGetId([
            'client_name' => $validated['client_name'],
            'client_code' => $validated['client_code'],
            'client_address' => $validated['client_address'] ?? null,
            'client_email' => $validated['client_email'] ?? null,
            'contact_person' => $validated['contact_person'],
            'phone_number' => $validated['phone_number'] ?? null,
            'fax_number' => $validated['fax_number'] ?? null,
            'date_added' => now(),
            'archived' => 0,
        ]);

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'CREATE',
            'description' => 'Created client: ' . $validated['client_name'],
            'user_id' => session('user_id') ?? 0,
            'date_added' => now(),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Client created successfully',
            'client_id' => $client
        ]);
    }

    public function show($id)
    {
        $client = DB::table('clients')->where('c_id', $id)->first();

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'client' => $client
        ]);
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'client_name' => 'required|string|max:100',
            'client_code' => 'required|string|max:45|unique:clients,client_code,' . $id . ',c_id',
            'client_address' => 'nullable|string|max:250',
            'client_email' => 'nullable|string|max:250',
            'contact_person' => 'required|string|max:100',
            'phone_number' => 'nullable|string|max:45',
            'fax_number' => 'nullable|string|max:45',
        ]);

        DB::table('clients')->where('c_id', $id)->update([
            'client_name' => $validated['client_name'],
            'client_code' => $validated['client_code'],
            'client_address' => $validated['client_address'] ?? null,
            'client_email' => $validated['client_email'] ?? null,
            'contact_person' => $validated['contact_person'],
            'phone_number' => $validated['phone_number'] ?? null,
            'fax_number' => $validated['fax_number'] ?? null,
        ]);

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'UPDATE',
            'description' => 'Updated client: ' . $validated['client_name'],
            'user_id' => session('user_id') ?? 0,
            'date_added' => now(),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Client updated successfully'
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $client = DB::table('clients')->where('c_id', $id)->first();

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found'
            ], 404);
        }

        // Soft delete by setting archived = 1
        DB::table('clients')->where('c_id', $id)->update(['archived' => 1]);

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'DELETE',
            'description' => 'Deleted client: ' . $client->client_name,
            'user_id' => session('user_id') ?? 0,
            'date_added' => now(),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Client deleted successfully'
        ]);
    }

    /**
     * Toggle client status (Active/Inactive)
     */
    public function toggleStatus(Request $request, $id)
    {
        $client = DB::table('clients')->where('c_id', $id)->first();

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found'
            ], 404);
        }

        // Toggle archived status: 0 = Active, 1 = Inactive
        $newStatus = $client->archived === 0 ? 1 : 0;
        
        DB::table('clients')->where('c_id', $id)->update(['archived' => $newStatus]);

        // Log audit
        $statusText = $newStatus === 0 ? 'activated' : 'deactivated';
        DB::table('audit_logs')->insert([
            'action' => 'UPDATE',
            'description' => 'Client ' . $statusText . ': ' . $client->client_name,
            'user_id' => session('user_id') ?? 0,
            'date_added' => now(),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Client status updated successfully',
            'new_status' => $newStatus === 0 ? 'Active' : 'Inactive',
            'archived' => $newStatus
        ]);
    }

    // ==================== STORAGE RATES ====================

    /**
     * Get storage rates for a client
     */
    public function getStorageRates($clientId)
    {
        $client = Client::findOrFail($clientId);
        
        $rates = DB::table('storage_rate as sr')
            ->join('container_size as cs', 'sr.size', '=', 'cs.cs_id')
            ->where('sr.client_id', $clientId)
            ->select('sr.*', 'cs.size_name')
            ->orderBy('cs.size_name')
            ->get();

        return response()->json([
            'success' => true,
            'rates' => $rates
        ]);
    }

    /**
     * Add storage rate for a client
     */
    public function addStorageRate(Request $request, $clientId)
    {
        $client = Client::findOrFail($clientId);

        $validated = $request->validate([
            'size' => 'required|integer|exists:container_size,cs_id',
            'rate' => 'required|numeric|min:0',
        ]);

        // Check if rate already exists for this client and size
        $existing = DB::table('storage_rate')
            ->where('client_id', $clientId)
            ->where('size', $validated['size'])
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'Storage rate already exists for this size'
            ], 422);
        }

        $rateId = DB::table('storage_rate')->insertGetId([
            'client_id' => $clientId,
            'size' => $validated['size'],
            'rate' => $validated['rate'],
            'date_added' => now(),
        ]);

        // Get the created rate with size name
        $rate = DB::table('storage_rate as sr')
            ->join('container_size as cs', 'sr.size', '=', 'cs.cs_id')
            ->where('sr.s_id', $rateId)
            ->select('sr.*', 'cs.size_name')
            ->first();

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'CREATE',
            'description' => 'Added storage rate for client: ' . $client->client_name,
            'user_id' => $request->user()->u_id ?? null,
            'date_added' => now(),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Storage rate added successfully',
            'rate' => $rate
        ]);
    }

    /**
     * Delete storage rate
     */
    public function deleteStorageRate($clientId, $rateId)
    {
        $client = Client::findOrFail($clientId);
        
        $rate = DB::table('storage_rate')
            ->where('s_id', $rateId)
            ->where('client_id', $clientId)
            ->first();

        if (!$rate) {
            return response()->json([
                'success' => false,
                'message' => 'Storage rate not found'
            ], 404);
        }

        DB::table('storage_rate')->where('s_id', $rateId)->delete();

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'DELETE',
            'description' => 'Deleted storage rate for client: ' . $client->client_name,
            'user_id' => request()->user()->u_id ?? null,
            'date_added' => now(),
            'ip_address' => request()->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Storage rate deleted successfully'
        ]);
    }

    // ==================== HANDLING RATES ====================

    /**
     * Get handling rates for a client
     */
    public function getHandlingRates($clientId)
    {
        $client = Client::findOrFail($clientId);
        
        $rates = DB::table('handling_rate as hr')
            ->join('container_size as cs', 'hr.size', '=', 'cs.cs_id')
            ->where('hr.client_id', $clientId)
            ->select('hr.*', 'cs.size_name')
            ->orderBy('cs.size_name')
            ->get();

        return response()->json([
            'success' => true,
            'rates' => $rates
        ]);
    }

    /**
     * Add handling rate for a client
     */
    public function addHandlingRate(Request $request, $clientId)
    {
        $client = Client::findOrFail($clientId);

        $validated = $request->validate([
            'size' => 'required|integer|exists:container_size,cs_id',
            'rate' => 'required|numeric|min:0',
        ]);

        // Check if rate already exists for this client and size
        $existing = DB::table('handling_rate')
            ->where('client_id', $clientId)
            ->where('size', $validated['size'])
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'Handling rate already exists for this size'
            ], 422);
        }

        $rateId = DB::table('handling_rate')->insertGetId([
            'client_id' => $clientId,
            'size' => $validated['size'],
            'rate' => $validated['rate'],
            'date_added' => now(),
        ]);

        // Get the created rate with size name
        $rate = DB::table('handling_rate as hr')
            ->join('container_size as cs', 'hr.size', '=', 'cs.cs_id')
            ->where('hr.h_id', $rateId)
            ->select('hr.*', 'cs.size_name')
            ->first();

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'CREATE',
            'description' => 'Added handling rate for client: ' . $client->client_name,
            'user_id' => $request->user()->u_id ?? null,
            'date_added' => now(),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Handling rate added successfully',
            'rate' => $rate
        ]);
    }

    /**
     * Delete handling rate
     */
    public function deleteHandlingRate($clientId, $rateId)
    {
        $client = Client::findOrFail($clientId);
        
        $rate = DB::table('handling_rate')
            ->where('h_id', $rateId)
            ->where('client_id', $clientId)
            ->first();

        if (!$rate) {
            return response()->json([
                'success' => false,
                'message' => 'Handling rate not found'
            ], 404);
        }

        DB::table('handling_rate')->where('h_id', $rateId)->delete();

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'DELETE',
            'description' => 'Deleted handling rate for client: ' . $client->client_name,
            'user_id' => request()->user()->u_id ?? null,
            'date_added' => now(),
            'ip_address' => request()->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Handling rate deleted successfully'
        ]);
    }

    // ==================== REGULAR HOURS ====================

    /**
     * Get regular hours for a client
     */
    public function getRegularHours($clientId)
    {
        $client = Client::findOrFail($clientId);
        
        $hours = DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->first();

        return response()->json([
            'success' => true,
            'hours' => $hours
        ]);
    }

    /**
     * Update regular hours for a client
     */
    public function updateRegularHours(Request $request, $clientId)
    {
        $client = Client::findOrFail($clientId);

        $validated = $request->validate([
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'w_start_time' => 'nullable|date_format:H:i',
            'w_end_time' => 'nullable|date_format:H:i',
        ]);

        // Check if hours already exist
        $existing = DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->first();

        if ($existing) {
            // Update existing
            DB::table('client_reg_hours')
                ->where('client_id', $clientId)
                ->update([
                    'start_time' => $validated['start_time'] ?? null,
                    'end_time' => $validated['end_time'] ?? null,
                    'w_start_time' => $validated['w_start_time'] ?? null,
                    'w_end_time' => $validated['w_end_time'] ?? null,
                ]);
        } else {
            // Create new
            DB::table('client_reg_hours')->insert([
                'client_id' => $clientId,
                'start_time' => $validated['start_time'] ?? null,
                'end_time' => $validated['end_time'] ?? null,
                'w_start_time' => $validated['w_start_time'] ?? null,
                'w_end_time' => $validated['w_end_time'] ?? null,
                'date_added' => now(),
            ]);
        }

        // Get the updated hours
        $hours = DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->first();

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'UPDATE',
            'description' => 'Updated regular hours for client: ' . $client->client_name,
            'user_id' => $request->user()->u_id ?? null,
            'date_added' => now(),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Regular hours updated successfully',
            'hours' => $hours
        ]);
    }

    /**
     * Delete regular hours for a client
     */
    public function deleteRegularHours($clientId)
    {
        $client = Client::findOrFail($clientId);
        
        $hours = DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->first();

        if (!$hours) {
            return response()->json([
                'success' => false,
                'message' => 'Regular hours not found'
            ], 404);
        }

        DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->delete();

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'DELETE',
            'description' => 'Deleted regular hours for client: ' . $client->client_name,
            'user_id' => request()->user()->u_id ?? null,
            'date_added' => now(),
            'ip_address' => request()->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Regular hours deleted successfully'
        ]);
    }

    // ==================== LEGACY INCOMING/WITHDRAWAL HOURS ====================

    /**
     * Add/Update regular hours for INCOMING operations
     * Legacy endpoint matching: addRegularHoursAction()
     */
    public function addIncomingHours(Request $request, $clientId)
    {
        $client = Client::findOrFail($clientId);

        $validated = $request->validate([
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
        ]);

        // Check if hours already exist
        $existing = DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->first();

        if ($existing) {
            // Update existing incoming hours only
            DB::table('client_reg_hours')
                ->where('client_id', $clientId)
                ->update([
                    'start_time' => $validated['start_time'],
                    'end_time' => $validated['end_time'],
                ]);
        } else {
            // Create new with incoming hours
            DB::table('client_reg_hours')->insert([
                'client_id' => $clientId,
                'start_time' => $validated['start_time'],
                'end_time' => $validated['end_time'],
                'w_start_time' => null,
                'w_end_time' => null,
                'date_added' => now(),
            ]);
        }

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'INSERT',
            'description' => 'Added incoming regular hours for client: ' . $client->client_name,
            'user_id' => $request->user()->u_id ?? null,
            'date_added' => now(),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Incoming hours added successfully'
        ]);
    }

    /**
     * Add/Update regular hours for WITHDRAWAL operations
     * Legacy endpoint matching: addWithRegularHoursAction()
     */
    public function addWithdrawalHours(Request $request, $clientId)
    {
        $client = Client::findOrFail($clientId);

        $validated = $request->validate([
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
        ]);

        // Check if hours already exist
        $existing = DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->first();

        if ($existing) {
            // Update existing withdrawal hours only
            DB::table('client_reg_hours')
                ->where('client_id', $clientId)
                ->update([
                    'w_start_time' => $validated['start_time'],
                    'w_end_time' => $validated['end_time'],
                ]);
        } else {
            // Create new with withdrawal hours
            DB::table('client_reg_hours')->insert([
                'client_id' => $clientId,
                'start_time' => null,
                'end_time' => null,
                'w_start_time' => $validated['start_time'],
                'w_end_time' => $validated['end_time'],
                'date_added' => now(),
            ]);
        }

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'INSERT',
            'description' => 'Added withdrawal regular hours for client: ' . $client->client_name,
            'user_id' => $request->user()->u_id ?? null,
            'date_added' => now(),
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Withdrawal hours added successfully'
        ]);
    }

    /**
     * Get INCOMING regular hours for a client
     * Legacy endpoint matching: getRegularHoursListAction()
     */
    public function getIncomingHours($clientId)
    {
        $client = Client::findOrFail($clientId);
        
        $hours = DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->select('reg_id', 'start_time', 'end_time')
            ->first();

        // Format time range like legacy: "HH:MMam/pm-HH:MMam/pm"
        $formatted = null;
        if ($hours && $hours->start_time && $hours->end_time) {
            $start = date('h:ia', strtotime($hours->start_time));
            $end = date('h:ia', strtotime($hours->end_time));
            $formatted = "$start-$end";
        }

        return response()->json([
            'success' => true,
            'hours' => $hours,
            'formatted' => $formatted,
            'reg_id' => $hours->reg_id ?? null
        ]);
    }

    /**
     * Get WITHDRAWAL regular hours for a client
     * Legacy endpoint matching: getWithRegularHoursListAction()
     */
    public function getWithdrawalHours($clientId)
    {
        $client = Client::findOrFail($clientId);
        
        $hours = DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->select('reg_id', 'w_start_time', 'w_end_time')
            ->first();

        // Format time range like legacy: "HH:MMam/pm-HH:MMam/pm"
        $formatted = null;
        if ($hours && $hours->w_start_time && $hours->w_end_time) {
            $start = date('h:ia', strtotime($hours->w_start_time));
            $end = date('h:ia', strtotime($hours->w_end_time));
            $formatted = "$start-$end";
        }

        return response()->json([
            'success' => true,
            'hours' => $hours,
            'formatted' => $formatted,
            'reg_id' => $hours->reg_id ?? null
        ]);
    }

    /**
     * Delete INCOMING regular hours
     * Legacy endpoint matching: deleteRegularHoursAction()
     */
    public function deleteIncomingHours($clientId)
    {
        $client = Client::findOrFail($clientId);
        
        $hours = DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->first();

        if (!$hours) {
            return response()->json([
                'success' => false,
                'message' => 'Regular hours not found'
            ], 404);
        }

        // Set incoming hours to NULL (legacy behavior)
        DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->update([
                'start_time' => null,
                'end_time' => null,
            ]);

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'DELETE',
            'description' => 'Deleted incoming regular hours for client: ' . $client->client_name,
            'user_id' => request()->user()->u_id ?? null,
            'date_added' => now(),
            'ip_address' => request()->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Incoming hours deleted successfully'
        ]);
    }

    /**
     * Delete WITHDRAWAL regular hours
     * Legacy endpoint matching: deleteWithRegularHoursAction()
     */
    public function deleteWithdrawalHours($clientId)
    {
        $client = Client::findOrFail($clientId);
        
        $hours = DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->first();

        if (!$hours) {
            return response()->json([
                'success' => false,
                'message' => 'Regular hours not found'
            ], 404);
        }

        // Set withdrawal hours to NULL (legacy behavior)
        DB::table('client_reg_hours')
            ->where('client_id', $clientId)
            ->update([
                'w_start_time' => null,
                'w_end_time' => null,
            ]);

        // Log audit
        DB::table('audit_logs')->insert([
            'action' => 'DELETE',
            'description' => 'Deleted withdrawal regular hours for client: ' . $client->client_name,
            'user_id' => request()->user()->u_id ?? null,
            'date_added' => now(),
            'ip_address' => request()->ip(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Withdrawal hours deleted successfully'
        ]);
    }
}





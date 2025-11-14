<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Maatwebsite\Excel\Facades\Excel;

class ClientController extends Controller
{
    protected $audit;

    public function __construct(AuditService $audit)
    {
        $this->audit = $audit;
    }

    /**
     * Display a listing of clients.
     */
    public function index(Request $request)
    {
        $query = Client::active();

        // Search functionality
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('client_name', 'like', "%{$search}%")
                  ->orWhere('client_code', 'like', "%{$search}%")
                  ->orWhere('client_email', 'like', "%{$search}%")
                  ->orWhere('contact_person', 'like', "%{$search}%");
            });
        }

        // Sort functionality
        $sortBy = $request->get('sort_by', 'client_name');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = $request->get('per_page', 15);
        $clients = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $clients,
        ]);
    }

    /**
     * Store a newly created client.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'client_name' => 'required|string|max:255',
            'client_code' => 'required|string|max:100|unique:clients,client_code',
            'client_address' => 'nullable|string',
            'client_email' => 'nullable|email|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone_number' => 'nullable|string|max:50',
            'fax_number' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        $data['date_added'] = now();
        $data['archived'] = 0;

        $client = Client::create($data);

        // Log the action
        $this->audit->logCreate(
            'CLIENTS',
            $client->c_id,
            "Added client record id {$client->c_id} and client name {$client->client_name}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Client created successfully',
            'data' => $client,
        ], 201);
    }

    /**
     * Display the specified client.
     */
    public function show($id)
    {
        $client = Client::find($id);

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        // Include related data
        $client->load(['bookings' => function($query) {
            $query->orderBy('date_added', 'desc')->limit(10);
        }]);

        return response()->json([
            'success' => true,
            'data' => $client,
        ]);
    }

    /**
     * Update the specified client.
     */
    public function update(Request $request, $id)
    {
        $client = Client::find($id);

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'client_name' => 'required|string|max:255',
            'client_code' => 'required|string|max:100|unique:clients,client_code,' . $id . ',c_id',
            'client_address' => 'nullable|string',
            'client_email' => 'nullable|email|max:255',
            'contact_person' => 'nullable|string|max:255',
            'phone_number' => 'nullable|string|max:50',
            'fax_number' => 'nullable|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $client->update($validator->validated());

        // Log the action
        $this->audit->logUpdate(
            'CLIENTS',
            $client->c_id,
            "Updated client record id {$client->c_id} and client name {$client->client_name}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Client updated successfully',
            'data' => $client,
        ]);
    }

    /**
     * Remove the specified client (archive).
     */
    public function destroy($id)
    {
        $client = Client::find($id);

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $clientName = $client->client_name;
        $client->archive();

        // Log the action
        $this->audit->logDelete(
            'CLIENTS',
            $client->c_id,
            "Deleted (archived) client record id {$client->c_id} and client name {$clientName}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Client deleted successfully',
        ]);
    }

    /**
     * Restore an archived client.
     */
    public function restore($id)
    {
        $client = Client::find($id);

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $client->restore();

        // Log the action
        $this->audit->log(
            'RESTORE',
            "Restored archived client: {$client->client_name}",
            'CLIENTS',
            $client->c_id
        );

        return response()->json([
            'success' => true,
            'message' => 'Client restored successfully',
            'data' => $client,
        ]);
    }

    /**
     * Get archived clients.
     */
    public function archived(Request $request)
    {
        $query = Client::archived();

        $perPage = $request->get('per_page', 15);
        $clients = $query->orderBy('client_name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $clients,
        ]);
    }

    /**
     * Export clients to Excel.
     */
    public function export(Request $request)
    {
        $this->audit->logExport('CLIENTS', 'Excel', 'Exported clients list');

        // This will be implemented with Laravel Excel
        return response()->json([
            'success' => true,
            'message' => 'Export functionality will be implemented',
        ]);
    }

    /**
     * Get client data for editing (using hashed ID).
     */
    public function edit($hashedId)
    {
        // Decode the MD5 hashed ID by finding the client
        $client = Client::all()->first(function($c) use ($hashedId) {
            return $c->hashed_id === $hashedId;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $client,
        ]);
    }

    /**
     * Add storage rate for a client.
     */
    public function addStorageRate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'client_id' => 'required|string', // MD5 hashed ID
            'size' => 'required|in:20,40,45',
            'rate' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Find client by hashed ID
        $client = Client::all()->first(function($c) use ($request) {
            return $c->hashed_id === $request->client_id;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $storageRate = $client->storageRates()->create([
            'size' => $request->size,
            'rate' => $request->rate,
            'date_added' => now(),
        ]);

        $this->audit->logCreate(
            'CLIENTS',
            $client->c_id,
            "Added storage rate for client {$client->client_name} - Size: {$request->size}, Rate: {$request->rate}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Storage rate added successfully',
            'data' => $storageRate,
        ]);
    }

    /**
     * Get list of storage rates for a client.
     */
    public function getStorageRateList($hashedId)
    {
        $client = Client::all()->first(function($c) use ($hashedId) {
            return $c->hashed_id === $hashedId;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $rates = $client->storageRates()->orderBy('date_added', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $rates->map(function($rate) {
                return [
                    'id' => $rate->hashed_id,
                    'size' => $rate->size,
                    'rate' => $rate->rate,
                    'date_added' => $rate->date_added,
                ];
            }),
        ]);
    }

    /**
     * Delete a storage rate.
     */
    public function deleteStorageRate($hashedId)
    {
        $storageRate = \App\Models\StorageRate::all()->first(function($r) use ($hashedId) {
            return $r->hashed_id === $hashedId;
        });

        if (!$storageRate) {
            return response()->json([
                'success' => false,
                'message' => 'Storage rate not found',
            ], 404);
        }

        $client = $storageRate->client;
        
        $this->audit->logDelete(
            'CLIENTS',
            $client->c_id,
            "Deleted storage rate for client {$client->client_name} - Size: {$storageRate->size}"
        );

        $storageRate->delete();

        return response()->json([
            'success' => true,
            'message' => 'Storage rate deleted successfully',
        ]);
    }

    /**
     * Add handling rate for a client.
     */
    public function addHandlingRate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'client_id' => 'required|string', // MD5 hashed ID
            'size' => 'required|in:20,40,45',
            'rate' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Find client by hashed ID
        $client = Client::all()->first(function($c) use ($request) {
            return $c->hashed_id === $request->client_id;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $handlingRate = $client->handlingRates()->create([
            'size' => $request->size,
            'rate' => $request->rate,
            'date_added' => now(),
        ]);

        $this->audit->logCreate(
            'CLIENTS',
            $client->c_id,
            "Added handling rate for client {$client->client_name} - Size: {$request->size}, Rate: {$request->rate}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Handling rate added successfully',
            'data' => $handlingRate,
        ]);
    }

    /**
     * Get list of handling rates for a client.
     */
    public function getHandlingRateList($hashedId)
    {
        $client = Client::all()->first(function($c) use ($hashedId) {
            return $c->hashed_id === $hashedId;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $rates = $client->handlingRates()->orderBy('date_added', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $rates->map(function($rate) {
                return [
                    'id' => $rate->hashed_id,
                    'size' => $rate->size,
                    'rate' => $rate->rate,
                    'date_added' => $rate->date_added,
                ];
            }),
        ]);
    }

    /**
     * Delete a handling rate.
     */
    public function deleteHandlingRate($hashedId)
    {
        $handlingRate = \App\Models\HandlingRate::all()->first(function($r) use ($hashedId) {
            return $r->hashed_id === $hashedId;
        });

        if (!$handlingRate) {
            return response()->json([
                'success' => false,
                'message' => 'Handling rate not found',
            ], 404);
        }

        $client = $handlingRate->client;
        
        $this->audit->logDelete(
            'CLIENTS',
            $client->c_id,
            "Deleted handling rate for client {$client->client_name} - Size: {$handlingRate->size}"
        );

        $handlingRate->delete();

        return response()->json([
            'success' => true,
            'message' => 'Handling rate deleted successfully',
        ]);
    }

    /**
     * Add or update regular hours (incoming) for a client.
     */
    public function addRegularHours(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'client_id' => 'required|string', // MD5 hashed ID
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Find client by hashed ID
        $client = Client::all()->first(function($c) use ($request) {
            return $c->hashed_id === $request->client_id;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        // Check if regular hours already exist
        $regularHours = $client->regularHours;

        if ($regularHours) {
            // Update existing
            $regularHours->update([
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
            ]);
            $message = 'Regular hours updated successfully';
        } else {
            // Create new
            $regularHours = $client->regularHours()->create([
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'date_added' => now(),
            ]);
            $message = 'Regular hours added successfully';
        }

        $this->audit->logCreate(
            'CLIENTS',
            $client->c_id,
            "Set regular incoming hours for client {$client->client_name} - {$request->start_time} to {$request->end_time}"
        );

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $regularHours,
        ]);
    }

    /**
     * Add or update regular hours (withdrawal) for a client.
     */
    public function addWithRegularHours(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'client_id' => 'required|string', // MD5 hashed ID
            'w_start_time' => 'required|date_format:H:i',
            'w_end_time' => 'required|date_format:H:i',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Find client by hashed ID
        $client = Client::all()->first(function($c) use ($request) {
            return $c->hashed_id === $request->client_id;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        // Check if regular hours already exist
        $regularHours = $client->regularHours;

        if ($regularHours) {
            // Update existing
            $regularHours->update([
                'w_start_time' => $request->w_start_time,
                'w_end_time' => $request->w_end_time,
            ]);
            $message = 'Withdrawal hours updated successfully';
        } else {
            // Create new
            $regularHours = $client->regularHours()->create([
                'w_start_time' => $request->w_start_time,
                'w_end_time' => $request->w_end_time,
                'date_added' => now(),
            ]);
            $message = 'Withdrawal hours added successfully';
        }

        $this->audit->logCreate(
            'CLIENTS',
            $client->c_id,
            "Set regular withdrawal hours for client {$client->client_name} - {$request->w_start_time} to {$request->w_end_time}"
        );

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $regularHours,
        ]);
    }

    /**
     * Get regular hours list (incoming) for a client.
     */
    public function getRegularHoursList($hashedId)
    {
        $client = Client::all()->first(function($c) use ($hashedId) {
            return $c->hashed_id === $hashedId;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $regularHours = $client->regularHours;

        if (!$regularHours) {
            return response()->json([
                'success' => true,
                'data' => null,
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $regularHours->hashed_id,
                'start_time' => $regularHours->start_time,
                'end_time' => $regularHours->end_time,
                'formatted' => $regularHours->formatted_incoming_hours,
            ],
        ]);
    }

    /**
     * Get regular hours list (withdrawal) for a client.
     */
    public function getWithRegularHoursList($hashedId)
    {
        $client = Client::all()->first(function($c) use ($hashedId) {
            return $c->hashed_id === $hashedId;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $regularHours = $client->regularHours;

        if (!$regularHours) {
            return response()->json([
                'success' => true,
                'data' => null,
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $regularHours->hashed_id,
                'w_start_time' => $regularHours->w_start_time,
                'w_end_time' => $regularHours->w_end_time,
                'formatted' => $regularHours->formatted_withdrawal_hours,
            ],
        ]);
    }

    /**
     * Delete regular hours (incoming) for a client.
     */
    public function deleteRegularHours($hashedId)
    {
        $client = Client::all()->first(function($c) use ($hashedId) {
            return $c->hashed_id === $hashedId;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $regularHours = $client->regularHours;

        if (!$regularHours) {
            return response()->json([
                'success' => false,
                'message' => 'Regular hours not found',
            ], 404);
        }

        $this->audit->logDelete(
            'CLIENTS',
            $client->c_id,
            "Deleted regular incoming hours for client {$client->client_name}"
        );

        // Clear incoming hours but keep withdrawal hours if they exist
        $regularHours->update([
            'start_time' => null,
            'end_time' => null,
        ]);

        // If both incoming and withdrawal are null, delete the record
        if (!$regularHours->w_start_time && !$regularHours->w_end_time) {
            $regularHours->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Regular hours deleted successfully',
        ]);
    }

    /**
     * Delete regular hours (withdrawal) for a client.
     */
    public function deleteWithRegularHours($hashedId)
    {
        $client = Client::all()->first(function($c) use ($hashedId) {
            return $c->hashed_id === $hashedId;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $regularHours = $client->regularHours;

        if (!$regularHours) {
            return response()->json([
                'success' => false,
                'message' => 'Withdrawal hours not found',
            ], 404);
        }

        $this->audit->logDelete(
            'CLIENTS',
            $client->c_id,
            "Deleted regular withdrawal hours for client {$client->client_name}"
        );

        // Clear withdrawal hours but keep incoming hours if they exist
        $regularHours->update([
            'w_start_time' => null,
            'w_end_time' => null,
        ]);

        // If both incoming and withdrawal are null, delete the record
        if (!$regularHours->start_time && !$regularHours->end_time) {
            $regularHours->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Withdrawal hours deleted successfully',
        ]);
    }
}


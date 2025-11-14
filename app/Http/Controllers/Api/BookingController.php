<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Client;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class BookingController extends Controller
{
    protected $audit;

    public function __construct(AuditService $audit)
    {
        $this->audit = $audit;
    }

    /**
     * Display a listing of bookings.
     */
    public function index(Request $request)
    {
        $query = Booking::with(['client', 'user']);

        // Default: show only active bookings (not expired with remaining containers)
        if (!$request->has('show_all')) {
            $query->active();
        }

        // Sort
        $sortBy = $request->get('sort_by', 'date_added');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Limit to 1000 records (legacy standard)
        $bookings = $query->limit(1000)->get();

        // Add computed fields
        $bookings->transform(function($booking) {
            $booking->status_text = $booking->is_active ? 'Active' : 'Expired';
            $booking->hashed_id = $booking->hashed_id;
            return $booking;
        });

        return response()->json([
            'success' => true,
            'data' => $bookings,
            'total' => $bookings->count(),
        ]);
    }

    /**
     * Store a newly created booking.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'bnum' => 'required|string',
            'cid' => 'required|string', // MD5 hashed client ID
            'shipper' => 'required|string|max:255',
            'two' => 'nullable|integer|min:0',
            'four' => 'nullable|integer|min:0',
            'fourf' => 'nullable|integer|min:0',
            'cnums' => 'nullable|string', // Container numbers
            'exp' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Remove spaces from booking number
        $bookNo = str_replace(' ', '', $request->bnum);

        // Check if booking number already exists
        if (Booking::where('book_no', $bookNo)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Error! Booking number is already exist!',
            ], 422);
        }

        // Find client by hashed ID
        $client = Client::all()->first(function($c) use ($request) {
            return $c->hashed_id === $request->cid;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $data = [
            'book_no' => $bookNo,
            'client_id' => $client->c_id,
            'shipper' => strtoupper($request->shipper), // Store in uppercase
            'twenty' => $request->two ?? 0,
            'fourty' => $request->four ?? 0,
            'fourty_five' => $request->fourf ?? 0,
            'twenty_rem' => $request->two ?? 0,
            'fourty_rem' => $request->four ?? 0,
            'fourty_five_rem' => $request->fourf ?? 0,
            'expiration_date' => $request->exp,
            'date_added' => now(),
            'user_id' => Auth::check() ? Auth::user()->user_id : null,
        ];

        // Process container list if provided
        if (!empty($request->cnums)) {
            $contList = preg_replace("/\r|\n/", "", $request->cnums);
            $contArray = array_filter(array_map('trim', explode(',', $contList)));
            
            // Validate container numbers (must be 11 characters each)
            foreach ($contArray as $cont) {
                if (strlen(str_replace(' ', '', $cont)) !== 11) {
                    return response()->json([
                        'success' => false,
                        'message' => "There's an error with container list!",
                    ], 422);
                }
            }
            
            $data['cont_list'] = implode(',', $contArray);
            $data['cont_list_rem'] = $data['cont_list'];
        } else {
            $data['cont_list'] = '';
            $data['cont_list_rem'] = '';
        }

        $booking = Booking::create($data);

        // Log the action
        $this->audit->logCreate(
            'BOOKINGS',
            $booking->b_id,
            "Added booking: {$booking->book_no} for shipper: {$booking->shipper}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Success! Booking has been saved!',
            'data' => $booking->load('client'),
        ], 201);
    }

    /**
     * Display the specified booking.
     */
    public function show($id)
    {
        $booking = Booking::with(['client', 'user'])->find($id);

        if (!$booking) {
            return response()->json([
                'success' => false,
                'message' => 'Booking not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $booking,
        ]);
    }

    /**
     * Get booking data for editing (using hashed ID).
     */
    public function edit($hashedId)
    {
        // Find booking by hashed ID
        // NOTE: This loads all bookings - frontend should use already-loaded data instead
        $booking = Booking::with('client')->get()->first(function($b) use ($hashedId) {
            return $b->hashed_id === $hashedId;
        });

        if (!$booking) {
            return response()->json([
                'success' => false,
                'message' => 'Booking not found',
            ], 404);
        }

        // Log the action
        $this->audit->log(
            'EDIT',
            "Attempt to modify book number {$booking->book_no} and shipper name {$booking->shipper}",
            'BOOKINGS',
            $booking->b_id
        );

        // Prepare response data
        $data = [
            'id' => $booking->hashed_id,
            'book_no' => $booking->book_no,
            'client_code' => $booking->client->client_code ?? '',
            'shipper' => $booking->shipper,
            'twenty' => $booking->twenty,
            'fourty' => $booking->fourty,
            'fourty_five' => $booking->fourty_five,
            'twenty_rem' => $booking->twenty_rem,
            'fourty_rem' => $booking->fourty_rem,
            'fourty_five_rem' => $booking->fourty_five_rem,
            'cont_list' => $booking->cont_list,
            'cont_list_rem' => $booking->cont_list_rem,
            'expiration_date' => $booking->expiration_date instanceof \Illuminate\Support\Carbon 
                ? $booking->expiration_date->format('Y-m-d') 
                : $booking->expiration_date,
            'has_container_list' => !empty($booking->cont_list),
        ];

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Update the specified booking.
     */
    public function update(Request $request, $hashedId)
    {
        // Find booking by hashed ID
        $booking = Booking::all()->first(function($b) use ($hashedId) {
            return $b->hashed_id === $hashedId;
        });

        if (!$booking) {
            return response()->json([
                'success' => false,
                'message' => 'Booking not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'bnum' => 'required|string',
            'ship' => 'required|string|max:255',
            'exp' => 'required|date',
            'two' => 'nullable|integer|min:0',
            'four' => 'nullable|integer|min:0',
            'fourf' => 'nullable|integer|min:0',
            'clientid' => 'required|string', // MD5 hashed
            'isc' => 'required|in:0,1', // Is container list (0=no, 1=yes - but reversed in legacy)
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $newBookNo = str_replace(' ', '', $request->bnum);
        $oldBookNo = $booking->book_no;
        $oldShipper = $booking->shipper;

        // Check if new booking number conflicts with existing (excluding current)
        if ($newBookNo !== $oldBookNo) {
            if (Booking::where('book_no', $newBookNo)->exists()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error! Booking number is already exist!',
                ], 422);
            }
        }

        // Find client by hashed ID
        $client = Client::all()->first(function($c) use ($request) {
            return $c->hashed_id === $request->clientid;
        });

        if (!$client) {
            return response()->json([
                'success' => false,
                'message' => 'Client not found',
            ], 404);
        }

        $data = [
            'book_no' => $newBookNo,
            'client_id' => $client->c_id,
            'shipper' => strtoupper($request->ship),
            'expiration_date' => $request->exp,
        ];

        // Update quantities if not container list based (isc=0 means no container list)
        if ($request->isc == '0') {
            $oldTwenty = $booking->twenty;
            $oldFourty = $booking->fourty;
            $oldFourtyFive = $booking->fourty_five;

            $newTwenty = $request->two ?? 0;
            $newFourty = $request->four ?? 0;
            $newFourtyFive = $request->fourf ?? 0;

            // Calculate new remaining values
            $twentyDiff = $newTwenty - $oldTwenty;
            $fourtyDiff = $newFourty - $oldFourty;
            $fourtyFiveDiff = $newFourtyFive - $oldFourtyFive;

            $newTwentyRem = $booking->twenty_rem + $twentyDiff;
            $newFourtyRem = $booking->fourty_rem + $fourtyDiff;
            $newFourtyFiveRem = $booking->fourty_five_rem + $fourtyFiveDiff;

            // Validate no negative remaining values
            if ($newTwentyRem < 0 || $newFourtyRem < 0 || $newFourtyFiveRem < 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Negative remaining value found!',
                ], 422);
            }

            $data['twenty'] = $newTwenty;
            $data['fourty'] = $newFourty;
            $data['fourty_five'] = $newFourtyFive;
            $data['twenty_rem'] = $newTwentyRem;
            $data['fourty_rem'] = $newFourtyRem;
            $data['fourty_five_rem'] = $newFourtyFiveRem;
        }

        $booking->update($data);

        // If booking number or shipper changed, update inventory records
        if ($newBookNo !== $oldBookNo || strtoupper($request->ship) !== $oldShipper) {
            try {
                DB::table('inventory')
                    ->where('booking', $oldBookNo)
                    ->where('shipper', $oldShipper)
                    ->update([
                        'booking' => $newBookNo,
                        'shipper' => strtoupper($request->ship),
                    ]);
            } catch (\Exception $e) {
                // Log but don't fail - inventory table might not exist yet
            }
        }

        // Log the action
        $this->audit->logUpdate(
            'BOOKINGS',
            $booking->b_id,
            "Updated booking: {$booking->book_no}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Booking updated successfully',
            'data' => $booking->load('client'),
        ]);
    }

    /**
     * Remove the specified booking.
     */
    public function destroy($hashedId)
    {
        // Find booking by hashed ID (same as edit/getContainers)
        $booking = Booking::get()->first(function($b) use ($hashedId) {
            return $b->hashed_id === $hashedId;
        });

        if (!$booking) {
            return response()->json([
                'success' => false,
                'message' => 'Booking not found',
            ], 404);
        }

        $bookNo = $booking->book_no;
        $bookingId = $booking->b_id;
        $booking->delete();

        // Log the action
        $this->audit->logDelete(
            'BOOKINGS',
            $bookingId,
            "Deleted booking: {$bookNo}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Booking deleted successfully',
        ]);
    }

    /**
     * Get containers for a booking (View Containers modal).
     */
    public function getContainers($hashedId)
    {
        // Find booking by hashed ID
        $booking = Booking::select('b_id', 'book_no')->get()->first(function($b) use ($hashedId) {
            return md5($b->b_id) === $hashedId;
        });

        if (!$booking) {
            return response()->json([
                'success' => false,
                'message' => 'Booking not found',
            ], 404);
        }

        // Get containers from inventory
        try {
            $containers = DB::table('inventory')
                ->where('booking', $booking->book_no)
                ->select('container_no')
                ->get()
                ->pluck('container_no')
                ->toArray();
        } catch (\Exception $e) {
            // Inventory table might not exist yet
            $containers = [];
        }

        return response()->json([
            'success' => true,
            'data' => $containers,
        ]);
    }

    /**
     * Search bookings by booking number.
     */
    public function search(Request $request)
    {
        $key = $request->get('key', '');

        $bookings = Booking::with('client')
            ->where('book_no', 'like', "%{$key}%")
            ->orderBy('date_added', 'desc')
            ->limit(500)
            ->get();

        // Add computed fields (hashed_id is already computed via accessor)
        $bookings->transform(function($booking) {
            $booking->status_text = $booking->is_active ? 'Active' : 'Expired';
            return $booking;
        });

        return response()->json([
            'success' => true,
            'data' => $bookings,
            'total' => $bookings->count(),
        ]);
    }

    /**
     * Get all clients for dropdown.
     */
    public function getClientList()
    {
        $clients = Client::where('archived', 0)
            ->orderBy('client_name')
            ->get()
            ->map(function($client) {
                return [
                    'id' => $client->hashed_id,
                    'text' => $client->client_code . ' - ' . $client->client_name,
                    'code' => $client->client_code,
                    'name' => $client->client_name,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $clients,
        ]);
    }

    /**
     * Get shipper for a booking number.
     */
    public function getShipperByBooking(Request $request)
    {
        $bookNo = $request->get('bnum', '');

        $booking = Booking::where('book_no', $bookNo)->first();

        if (!$booking) {
            return response()->json([
                'success' => false,
                'message' => 'Booking not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'shipper' => $booking->shipper,
        ]);
    }

    /**
     * Autocomplete shipper names.
     */
    public function getShipperAutocomplete(Request $request)
    {
        $key = $request->get('key', '');

        $shippers = Booking::where('shipper', 'like', "%{$key}%")
            ->select('shipper')
            ->distinct()
            ->orderBy('shipper')
            ->limit(20)
            ->pluck('shipper')
            ->toArray();

        return response()->json([
            'success' => true,
            'data' => $shippers,
        ]);
    }

    /**
     * Autocomplete booking numbers (expired bookings only).
     */
    public function getBookingNumberAutocomplete(Request $request)
    {
        $key = $request->get('key', '');

        $bookingNumbers = Booking::expired()
            ->where('book_no', 'like', "%{$key}%")
            ->select('book_no')
            ->orderBy('book_no')
            ->limit(20)
            ->pluck('book_no')
            ->toArray();

        return response()->json([
            'success' => true,
            'data' => $bookingNumbers,
        ]);
    }

    /**
     * Get available containers for gate out.
     */
    public function getAvailableContainers()
    {
        try {
            $containers = DB::table('inventory')
                ->where('status', 'IN')
                ->where('complete', 0)
                ->select('container_no')
                ->orderBy('container_no')
                ->pluck('container_no')
                ->toArray();
        } catch (\Exception $e) {
            // Inventory table might not exist yet
            $containers = [];
        }

        return response()->json([
            'success' => true,
            'data' => $containers,
        ]);
    }
}



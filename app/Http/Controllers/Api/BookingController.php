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
use Illuminate\Support\Facades\Log;

class BookingController extends Controller
{
    protected $audit;

    public function __construct(AuditService $audit)
    {
        $this->audit = $audit;
    }

    /** Normalize container mappings while keeping legacy comma-separated data readable. */
    private static function containerMappings(?string $value): array
    {
        if (!$value) return [];

        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $mappings = [];
            foreach ($decoded as $mapping) {
                if (!is_array($mapping)) continue;
                $sizeType = strtoupper(trim((string) ($mapping['size_type'] ?? '')));
                $containers = array_values(array_unique(array_filter(array_map(
                    static fn ($container) => strtoupper(preg_replace('/\s+/', '', trim((string) $container))),
                    is_array($mapping['containers'] ?? null) ? $mapping['containers'] : []
                ))));
                if ($containers) $mappings[] = ['size_type' => $sizeType, 'containers' => $containers];
            }
            return $mappings;
        }

        $containers = array_values(array_filter(array_map(
            static fn ($container) => strtoupper(preg_replace('/\s+/', '', trim((string) $container))),
            preg_split('/[\s,]+/', $value)
        )));
        return $containers ? [['size_type' => '', 'containers' => $containers]] : [];
    }

    private static function flattenContainerMappings(?string $value): array
    {
        $containers = [];
        foreach (self::containerMappings($value) as $mapping) {
            $containers = array_merge($containers, $mapping['containers']);
        }
        return array_values(array_unique($containers));
    }

    private static function encodeContainerMappings(array $mappings): string
    {
        return json_encode(array_values($mappings), JSON_UNESCAPED_SLASHES);
    }

    private static function markContainersAsRepo(array $containers, string $bookingNumber): void
    {
        $note = "Updated to Repo for Booking {$bookingNumber}";
        foreach (array_values(array_unique($containers)) as $container) {
            DB::table('inventory')
                ->where('container_no', $container)
                ->where('gate_status', 'IN')
                ->where('complete', 0)
                ->update(['container_status' => 8]);

            if (!DB::table('repo_containers')->where('container_no', $container)->exists()) {
                DB::table('repo_containers')->insert([
                    'container_no' => $container,
                    'date_added' => now(),
                    'notes' => $note,
                ]);
            }
        }
    }

    /**
     * Display a listing of bookings.
     */
    public function index(Request $request)
    {
        $query = Booking::with(['client', 'user']);

        // Default: show every booking that has not expired yet. A booking remains
        // visible through its expiration date, including bookings expiring today.
        if (!$request->has('show_all')) {
            $today = now(config('app.timezone', 'Asia/Manila'))->toDateString();
            $query->whereDate('expiration_date', '>=', $today)
                  ->whereHas('client', function ($clientQuery) {
                      $clientQuery->where('archived', 0);
                  });
        }

        // Search booking number or shipper when requested.
        if ($search = trim((string) $request->get('search', ''))) {
            $query->where(function ($searchQuery) use ($search) {
                $searchQuery->where('book_no', 'like', "%{$search}%")
                    ->orWhere('shipper', 'like', "%{$search}%");
            });
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
            'cnums' => 'nullable|string',
            'container_list' => 'nullable|string',
            'container_list_rem' => 'nullable|string',
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
        $containersToRepo = [];

        // Process container list if provided
        $submittedMappings = $request->filled('container_list')
            ? self::containerMappings($request->container_list)
            : self::containerMappings($request->cnums);
        $contArray = self::flattenContainerMappings($request->filled('container_list') ? $request->container_list : $request->cnums);

        if ($contArray) {

            $invalidContainers = array_values(array_filter($contArray, static fn ($container) => strlen($container) !== 11));
            $validContainers = array_values(array_filter($contArray, static fn ($container) => strlen($container) === 11));
            $heldLookup = [];
            $inventoryLookup = [];
            $inventoryRecords = collect();

            if ($validContainers) {
                $heldLookup = array_fill_keys(DB::table('hold_containers')
                    ->whereIn('container_no', $validContainers)
                    ->pluck('container_no')
                    ->map(static fn ($container) => strtoupper(trim((string) $container)))
                    ->all(), true);

                $inventoryRecords = DB::table('inventory as i')
                    ->leftJoin('container_size_type as st', 'st.s_id', '=', 'i.size_type')
                    ->whereIn('i.container_no', $validContainers)
                    ->where('i.gate_status', 'IN')
                    ->where('i.complete', 0)
                    ->get(['i.container_no', 'i.client_id', 'i.size_type', 'st.size']);
                $inventoryLookup = array_fill_keys($inventoryRecords
                    ->pluck('container_no')
                    ->map(static fn ($container) => strtoupper(trim((string) $container)))
                    ->all(), true);
            }

            $containerErrors = [];
            $today = now(config('app.timezone', 'Asia/Manila'))->toDateString();
            $activeReservedContainers = Booking::whereDate('expiration_date', '>=', $today)
                ->whereNotNull('cont_list')
                ->get(['book_no', 'cont_list'])
                ->flatMap(static function ($activeBooking) {
                    return self::flattenContainerMappings($activeBooking->cont_list);
                })
                ->filter()
                ->flip();

            foreach ($invalidContainers as $container) {
                $containerErrors[] = "{$container} container is not in inventory";
            }
            foreach ($validContainers as $container) {
                if (isset($heldLookup[$container])) {
                    $containerErrors[] = "{$container} container is on hold";
                } elseif (!isset($inventoryLookup[$container])) {
                    $containerErrors[] = "{$container} container is not in inventory";
                } else {
                    $inventoryRecord = $inventoryRecords->first(static fn ($record) => strtoupper(trim((string) $record->container_no)) === $container);
                    if (!$inventoryRecord || (int) $inventoryRecord->client_id !== (int) $client->c_id) {
                        $containerErrors[] = "{$container} container belongs to another client";
                    } elseif (!$inventoryRecord->size_type) {
                        $containerErrors[] = "{$container} container has no size/type assigned";
                    } elseif (isset($activeReservedContainers[$container])) {
                        $containerErrors[] = "{$container} container has already been reserved in another booking";
                    }
                }
            }

            if ($containerErrors) {
                return response()->json([
                    'success' => false,
                    'message' => implode(' and ', $containerErrors) . '.',
                ], 422);
            }
            
            $sizeTypeMappings = [];
            $sizeCounts = ['20' => 0, '40' => 0, '45' => 0];
            foreach ($validContainers as $container) {
                $inventoryRecord = $inventoryRecords->first(static fn ($record) => strtoupper(trim((string) $record->container_no)) === $container);
                $sizeTypeId = $inventoryRecord?->size_type;
                $key = (string) $sizeTypeId;
                if (!isset($sizeTypeMappings[$key])) {
                    $sizeTypeMappings[$key] = ['size_type' => (int) $sizeTypeId, 'containers' => []];
                }
                $sizeTypeMappings[$key]['containers'][] = $container;
                if (in_array((int) $inventoryRecord->size, [20, 22], true)) $sizeCounts['20']++;
                elseif (in_array((int) $inventoryRecord->size, [40, 42], true)) $sizeCounts['40']++;
                elseif ((int) $inventoryRecord->size === 45) $sizeCounts['45']++;
            }
            $data['twenty'] = $sizeCounts['20'];
            $data['fourty'] = $sizeCounts['40'];
            $data['fourty_five'] = $sizeCounts['45'];
            $data['twenty_rem'] = $sizeCounts['20'];
            $data['fourty_rem'] = $sizeCounts['40'];
            $data['fourty_five_rem'] = $sizeCounts['45'];
            $data['cont_list'] = self::encodeContainerMappings(array_values($sizeTypeMappings));
            $data['cont_list_rem'] = self::encodeContainerMappings(array_values($sizeTypeMappings));
            $containersToRepo = $validContainers;
        } else {
            $data['cont_list'] = '';
            $data['cont_list_rem'] = '';
        }

        $booking = Booking::create($data);
        if ($containersToRepo) {
            self::markContainersAsRepo($containersToRepo, $booking->book_no);
        }

        // Get client name for logging
        $clientName = $client->client_name ?? 'Unknown';
        
        // Log to audit - ADD action with all fields
        $description = '[BOOKING] Added new booking: Booking No: "' . $booking->book_no . '", Client: "' . $clientName . '", Shipper: "' . $booking->shipper . '", Expiration: "' . $booking->expiration_date . '"';
        
        if ($booking->cont_list) {
            $description .= ', Container List: "' . $booking->cont_list . '"';
        } else {
            $description .= ', 20ft: ' . $booking->twenty . ', 40ft: ' . $booking->fourty . ', 45ft: ' . $booking->fourty_five;
        }
        
        DB::table('audit_logs')->insert([
            'action' => 'ADD',
            'description' => $description,
            'user_id' => Auth::user()->user_id ?? null,
            'date_added' => now(),
            'ip_address' => request()->ip(),
        ]);

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
        // Find the booking without hydrating the entire bookings table.
        // Production contains tens of thousands of rows, so Booking::all()
        // can exhaust PHP-FPM's memory limit before the update runs.
        $booking = Booking::whereRaw('MD5(b_id) = ?', [$hashedId])->first();

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
            'cnums' => 'nullable|string',
            'container_list' => 'nullable|string',
            'container_list_rem' => 'nullable|string',
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

        // Resolve the client directly in SQL instead of loading every client.
        $client = Client::whereRaw('MD5(c_id) = ?', [$request->clientid])->first();

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

        // A booking is updated in one allocation mode at a time:
        // - without a container list: save the manually entered quantities;
        // - with a container list: derive the quantities from that list.
        // The latter keeps the existing used/remaining safeguards below.
        $isContainerList = (string) $request->isc === '1';

        // Quantities and a container list are independent allocations, but the
        // selected mode determines which one is authoritative for this update.
        if (!$isContainerList) {
            $oldTwenty = $booking->twenty;
            $oldFourty = $booking->fourty;
            $oldFourtyFive = $booking->fourty_five;

            $newTwenty = $request->two ?? 0;
            $newFourty = $request->four ?? 0;
            $newFourtyFive = $request->fourf ?? 0;

            // Already-used containers cannot be removed from the allocation.
            // The minimum is allocated minus remaining (the quantity already used).
            $minimumTwenty = max(0, $booking->twenty - $booking->twenty_rem);
            $minimumFourty = max(0, $booking->fourty - $booking->fourty_rem);
            $minimumFourtyFive = max(0, $booking->fourty_five - $booking->fourty_five_rem);
            if ($newTwenty < $minimumTwenty ||
                $newFourty < $minimumFourty ||
                $newFourtyFive < $minimumFourtyFive) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container quantities cannot be lower than the quantity already used.',
                ], 422);
            }

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

        $data['cont_list'] = '';
        $data['cont_list_rem'] = '';
        $newlyAddedContainers = [];

        $submittedListValue = $isContainerList
            ? ($request->filled('container_list') ? $request->container_list : $request->cnums)
            : null;
        if ($isContainerList && $submittedListValue !== null) {
            $submittedMappings = self::containerMappings($submittedListValue);
            $containers = self::flattenContainerMappings($submittedListValue);
            $normalizeList = static fn (?string $value): array => self::flattenContainerMappings($value);
            $oldMappings = self::containerMappings($booking->cont_list);
            $oldAllocated = $normalizeList($booking->cont_list);
            $oldRemaining = $normalizeList($booking->cont_list_rem);
            $removedContainers = array_values(array_diff($oldAllocated, $containers));
            $usedRemovedContainers = array_values(array_diff($removedContainers, $oldRemaining));

            if ($usedRemovedContainers) {
                return response()->json([
                    'success' => false,
                    'message' => implode(' and ', array_map(static fn ($container) => "{$container} container is already used and cannot be removed", $usedRemovedContainers)) . '.',
                ], 422);
            }

            $addedContainers = array_values(array_diff($containers, $oldAllocated));
            $invalidContainers = array_values(array_filter($addedContainers, static fn ($container) => strlen($container) !== 11));
            $validContainers = array_values(array_filter($addedContainers, static fn ($container) => strlen($container) === 11));
            $heldLookup = array_fill_keys(DB::table('hold_containers')->whereIn('container_no', $validContainers)->pluck('container_no')->map(static fn ($container) => strtoupper(trim((string) $container)))->all(), true);
            $inventoryRecords = DB::table('inventory as i')
                ->leftJoin('container_size_type as st', 'st.s_id', '=', 'i.size_type')
                ->whereIn('i.container_no', $validContainers)
                ->where('i.gate_status', 'IN')
                ->where('i.complete', 0)
                ->get(['i.container_no', 'i.client_id', 'i.size_type', 'st.size']);
            $inventoryLookup = array_fill_keys($inventoryRecords->pluck('container_no')->map(static fn ($container) => strtoupper(trim((string) $container)))->all(), true);
            $today = now(config('app.timezone', 'Asia/Manila'))->toDateString();
            $activeReservedContainers = Booking::whereDate('expiration_date', '>=', $today)
                ->where('b_id', '!=', $booking->b_id)
                ->whereNotNull('cont_list')
                ->get(['cont_list'])
                ->flatMap(static function ($activeBooking) {
                    return self::flattenContainerMappings($activeBooking->cont_list);
                })
                ->flip();
            $containerErrors = array_map(static fn ($container) => "{$container} container is not in inventory", $invalidContainers);
            foreach ($validContainers as $container) {
                if (isset($heldLookup[$container])) {
                    $containerErrors[] = "{$container} container is on hold";
                } elseif (!isset($inventoryLookup[$container])) {
                    $containerErrors[] = "{$container} container is not in inventory";
                } else {
                    $inventoryRecord = $inventoryRecords->first(static fn ($record) => strtoupper(trim((string) $record->container_no)) === $container);
                    if (!$inventoryRecord || (int) $inventoryRecord->client_id !== (int) $client->c_id) {
                        $containerErrors[] = "{$container} container belongs to another client";
                    } elseif (!$inventoryRecord->size_type) {
                        $containerErrors[] = "{$container} container has no size/type assigned";
                    }
                }
            }
            foreach ($containers as $container) {
                if (strlen($container) === 11 && isset($activeReservedContainers[$container])) {
                    $containerErrors[] = "{$container} container has already been reserved in another booking";
                }
            }

            if ($containerErrors) {
                return response()->json(['success' => false, 'message' => implode(' and ', $containerErrors) . '.'], 422);
            }

            $resolvedMappings = [];
            foreach ($containers as $container) {
                $oldMapping = collect($oldMappings)->first(static fn ($mapping) => in_array($container, $mapping['containers'], true));
                $inventoryRecord = $inventoryRecords->first(static fn ($record) => strtoupper(trim((string) $record->container_no)) === $container);
                $sizeType = $oldMapping['size_type'] ?? ($inventoryRecord?->size_type ?? null);
                if ($sizeType === null) continue;
                $key = (string) $sizeType;
                if (!isset($resolvedMappings[$key])) $resolvedMappings[$key] = ['size_type' => (int) $sizeType, 'containers' => []];
                $resolvedMappings[$key]['containers'][] = $container;
            }
            $resolvedMappings = array_values($resolvedMappings);
            $newlyAddedContainers = $validContainers;
            $sizeTypeIds = array_values(array_filter(array_map(static fn ($mapping) => $mapping['size_type'], $resolvedMappings)));
            $sizeLookup = DB::table('container_size_type')->whereIn('s_id', $sizeTypeIds)->pluck('size', 's_id');
            $sizeCounts = ['20' => 0, '40' => 0, '45' => 0];
            foreach ($resolvedMappings as $mapping) {
                $size = (int) ($sizeLookup[(int) $mapping['size_type']] ?? 0);
                if (in_array($size, [20, 22], true)) $sizeCounts['20'] += count($mapping['containers']);
                elseif (in_array($size, [40, 42], true)) $sizeCounts['40'] += count($mapping['containers']);
                elseif ($size === 45) $sizeCounts['45'] += count($mapping['containers']);
            }
            $minimums = [
                '20' => max(0, $booking->twenty - $booking->twenty_rem),
                '40' => max(0, $booking->fourty - $booking->fourty_rem),
                '45' => max(0, $booking->fourty_five - $booking->fourty_five_rem),
            ];
            foreach ($minimums as $size => $minimum) {
                if ($sizeCounts[$size] < $minimum) {
                    return response()->json(['success' => false, 'message' => "The container list cannot reduce used {$size}' containers below {$minimum}."], 422);
                }
            }
            $data['twenty'] = $sizeCounts['20'];
            $data['fourty'] = $sizeCounts['40'];
            $data['fourty_five'] = $sizeCounts['45'];
            $data['twenty_rem'] = $booking->twenty_rem + ($sizeCounts['20'] - $booking->twenty);
            $data['fourty_rem'] = $booking->fourty_rem + ($sizeCounts['40'] - $booking->fourty);
            $data['fourty_five_rem'] = $booking->fourty_five_rem + ($sizeCounts['45'] - $booking->fourty_five);
            $data['cont_list'] = self::encodeContainerMappings($resolvedMappings);
            $newRemaining = array_values(array_diff($oldRemaining, $removedContainers));
            $remainingMappings = array_map(static function ($mapping) use ($newRemaining) {
                return [
                    'size_type' => $mapping['size_type'],
                    'containers' => array_values(array_unique(array_merge(
                        array_values(array_intersect($mapping['containers'], $newRemaining)),
                        $mapping['containers']
                    ))),
                ];
            }, $resolvedMappings);
            $data['cont_list_rem'] = self::encodeContainerMappings($remainingMappings);
            if (!$containers) {
                $data['cont_list'] = '';
                $data['cont_list_rem'] = '';
            }
        }

        // Get old client name
        $oldClient = Client::find($booking->client_id);
        $oldClientName = $oldClient ? $oldClient->client_name : 'Unknown';

        // Keep the values used for the audit entry before mutating the model.
        // This also avoids comparing a cast Carbon date with the request string
        // after the update has already happened.
        $oldClientId = $booking->client_id;
        $oldExpirationDate = $booking->expiration_date?->toDateString() ?? (string) $booking->expiration_date;
        $oldContainerList = (string) ($booking->cont_list ?? '');
        
        $booking->update($data);
        if ($newlyAddedContainers) {
            self::markContainersAsRepo($newlyAddedContainers, $newBookNo);
        }

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

        // Log to audit - EDIT action with old->new tracking
        $newClientName = $client->client_name ?? 'Unknown';
        $changes = [];
        
        if ($oldBookNo !== $newBookNo) {
            $changes[] = 'Booking No: "' . $oldBookNo . '" -> "' . $newBookNo . '"';
        }
        if ($oldClientId !== $client->c_id) {
            $changes[] = 'Client: "' . $oldClientName . '" -> "' . $newClientName . '"';
        }
        if ($oldShipper !== strtoupper($request->ship)) {
            $changes[] = 'Shipper: "' . $oldShipper . '" -> "' . strtoupper($request->ship) . '"';
        }
        if ($oldExpirationDate !== $request->exp) {
            $changes[] = 'Expiration: "' . $oldExpirationDate . '" -> "' . $request->exp . '"';
        }
        
        if (isset($oldTwenty) && $oldTwenty !== ($request->two ?? 0)) {
            $changes[] = '20ft: ' . $oldTwenty . ' -> ' . ($request->two ?? 0);
        }
        if (isset($oldFourty) && $oldFourty !== ($request->four ?? 0)) {
            $changes[] = '40ft: ' . $oldFourty . ' -> ' . ($request->four ?? 0);
        }
        if (isset($oldFourtyFive) && $oldFourtyFive !== ($request->fourf ?? 0)) {
            $changes[] = '45ft: ' . $oldFourtyFive . ' -> ' . ($request->fourf ?? 0);
        }
        $newContainerList = (string) ($data['cont_list'] ?? '');
        if ($oldContainerList !== $newContainerList) {
            $changes[] = 'Container List: "' . $oldContainerList . '" -> "' . $newContainerList . '"';
        }
        
        if (count($changes) > 0) {
            try {
                // Keep the same EDIT action used by the other application pages.
                // Audit logging must not turn a successful booking update into
                // a 500 when the hosted database has an older audit definition.
                DB::table('audit_logs')->insert([
                    'action' => 'EDIT',
                    'description' => '[BOOKING] Edited booking "' . $newBookNo . '": ' . implode(', ', $changes),
                    'user_id' => Auth::user()?->user_id,
                    'date_added' => now(),
                    'ip_address' => request()->ip(),
                ]);
            } catch (\Throwable $e) {
                Log::warning('Booking updated but audit log could not be written.', [
                    'booking_id' => $booking->b_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

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
        $shipper = $booking->shipper;
        $bookingId = $booking->b_id;
        
        // Get client name before deletion
        $client = Client::find($booking->client_id);
        $clientName = $client ? $client->client_name : 'Unknown';
        
        $booking->delete();

        // Log to audit - DELETE action with all details
        DB::table('audit_logs')->insert([
            'action' => 'DELETE',
            'description' => '[BOOKING] Deleted booking: Booking No: "' . $bookNo . '", Client: "' . $clientName . '", Shipper: "' . $shipper . '"',
            'user_id' => Auth::user()->user_id ?? null,
            'date_added' => now(),
            'ip_address' => request()->ip(),
        ]);

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
        // Resolve the hashed public id in SQL instead of loading every booking
        // into PHP and hashing each row. The endpoint only needs one booking.
        $booking = Booking::query()
            ->select('b_id', 'book_no', 'cont_list', 'cont_list_rem')
            ->whereRaw('MD5(b_id) = ?', [$hashedId])
            ->first();

        if (!$booking) {
            return response()->json([
                'success' => false,
                'message' => 'Booking not found',
            ], 404);
        }

        try {
            $containers = self::flattenContainerMappings($booking->cont_list);
            $remainingContainers = self::flattenContainerMappings($booking->cont_list_rem);
            $allContainers = array_values(array_unique(array_merge($containers, $remainingContainers)));
            $heldContainers = empty($allContainers)
                ? []
                : DB::table('hold_containers')
                    ->whereIn('container_no', $allContainers)
                    ->pluck('container_no')
                    ->map(static fn ($container) => strtoupper(trim((string) $container)))
                    ->all();

            $heldLookup = array_fill_keys($heldContainers, true);
            $containers = array_values(array_filter($containers, static fn ($container) => !isset($heldLookup[$container])));
            $remainingContainers = array_values(array_filter($remainingContainers, static fn ($container) => !isset($heldLookup[$container])));

            $gateOutContainers = DB::table('inventory as i')
                ->leftJoin('container_size_type as st', 'st.s_id', '=', 'i.size_type')
                ->select(['i.container_no', 'i.date_added', 'st.size', 'st.type'])
                ->where('i.booking', $booking->book_no)
                ->where('i.gate_status', 'OUT')
                ->where('i.complete', 1)
                ->orderBy('i.date_added')
                ->get()
                ->map(static fn ($container) => [
                    'container_no' => strtoupper(trim((string) $container->container_no)),
                    'date_added' => $container->date_added,
                    'size' => $container->size,
                    'type' => $container->type,
                ])
                ->values()
                ->all();
        } catch (\Exception $e) {
            // Inventory table might not exist yet
            $containers = [];
            $remainingContainers = [];
            $gateOutContainers = [];
        }

        return response()->json([
            'success' => true,
            'data' => $containers,
            'remaining' => $remainingContainers,
            'data_mappings' => self::containerMappings($booking->cont_list),
            'remaining_mappings' => self::containerMappings($booking->cont_list_rem),
            'gate_out_containers' => $gateOutContainers,
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



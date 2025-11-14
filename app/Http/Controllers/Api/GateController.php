<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GateLog;
use App\Models\Booking;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class GateController extends Controller
{
    protected $audit;

    public function __construct(AuditService $audit)
    {
        $this->audit = $audit;
    }

    /**
     * Display a listing of gate logs.
     */
    public function index(Request $request)
    {
        $query = GateLog::with(['booking.client', 'user']);

        // Search
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('cont_no', 'like', "%{$search}%")
                  ->orWhere('truck_plate', 'like', "%{$search}%")
                  ->orWhere('driver_name', 'like', "%{$search}%");
            });
        }

        // Filter by type
        if ($request->has('type')) {
            if ($request->type == 'in') {
                $query->gateIn();
            } elseif ($request->type == 'out') {
                $query->gateOut();
            }
        }

        // Filter by booking
        if ($request->has('booking_id')) {
            $query->where('booking_id', $request->booking_id);
        }

        // Filter by date range
        if ($request->has('date_from') && $request->has('date_to')) {
            $query->dateRange($request->date_from, $request->date_to);
        }

        $sortBy = $request->get('sort_by', 'date_time');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->get('per_page', 15);
        $logs = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }

    /**
     * Store a new gate log (gate-in or gate-out).
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'booking_id' => 'required|exists:fjp_bookings,b_id',
            'cont_no' => 'required|string|size:11',
            'type' => 'required|in:in,out',
            'truck_plate' => 'required|string|max:50',
            'driver_name' => 'required|string|max:255',
            'remarks' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        // Remove spaces from container number
        $data['cont_no'] = str_replace(' ', '', $data['cont_no']);

        // Validate container number format (11 characters)
        if (strlen($data['cont_no']) !== 11) {
            return response()->json([
                'success' => false,
                'message' => 'Container number must be exactly 11 characters',
            ], 422);
        }

        // Get booking
        $booking = Booking::find($data['booking_id']);

        // For gate-in, verify container is in booking's container list
        if ($data['type'] == 'in') {
            $contList = $booking->getContainerList();
            if (!in_array($data['cont_no'], $contList)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container number not found in booking',
                ], 422);
            }

            // Check if already gated in
            $existing = GateLog::where('booking_id', $data['booking_id'])
                ->where('cont_no', $data['cont_no'])
                ->where('type', 'in')
                ->whereNull('gate_out_time')
                ->first();

            if ($existing) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container already gated in',
                ], 422);
            }
        }

        // For gate-out, verify container is gated in
        if ($data['type'] == 'out') {
            $gateIn = GateLog::where('booking_id', $data['booking_id'])
                ->where('cont_no', $data['cont_no'])
                ->where('type', 'in')
                ->whereNull('gate_out_time')
                ->first();

            if (!$gateIn) {
                return response()->json([
                    'success' => false,
                    'message' => 'Container must be gated in first',
                ], 422);
            }

            // Update gate-in record with gate-out information
            $gateIn->update([
                'gate_out_time' => now(),
                'out_truck_plate' => $data['truck_plate'],
                'out_driver_name' => $data['driver_name'],
                'out_remarks' => $data['remarks'] ?? null,
            ]);

            $this->audit->log(
                'UPDATE',
                "Gate-out: Container {$data['cont_no']} from booking {$booking->book_no}",
                'GATE',
                $gateIn->gate_id
            );

            return response()->json([
                'success' => true,
                'message' => 'Container gated out successfully',
                'data' => $gateIn->load(['booking.client', 'user']),
            ]);
        }

        // Create gate-in record
        $data['date_time'] = now();
        $data['user_id'] = auth()->user()->user_id;
        $data['gate_in_time'] = now();
        $data['in_truck_plate'] = $data['truck_plate'];
        $data['in_driver_name'] = $data['driver_name'];
        $data['in_remarks'] = $data['remarks'] ?? null;

        unset($data['truck_plate'], $data['driver_name'], $data['remarks']);

        $gateLog = GateLog::create($data);

        $this->audit->logCreate(
            'GATE',
            $gateLog->gate_id,
            "Gate-in: Container {$data['cont_no']} for booking {$booking->book_no}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Container gated in successfully',
            'data' => $gateLog->load(['booking.client', 'user']),
        ], 201);
    }

    /**
     * Display the specified gate log.
     */
    public function show($id)
    {
        $gateLog = GateLog::with(['booking.client', 'user'])->find($id);

        if (!$gateLog) {
            return response()->json([
                'success' => false,
                'message' => 'Gate log not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $gateLog,
        ]);
    }

    /**
     * Get summary statistics.
     */
    public function statistics(Request $request)
    {
        $dateFrom = $request->get('date_from', now()->startOfMonth());
        $dateTo = $request->get('date_to', now()->endOfMonth());

        $totalGateIn = GateLog::gateIn()
            ->dateRange($dateFrom, $dateTo)
            ->count();

        $totalGateOut = GateLog::gateOut()
            ->whereNotNull('gate_out_time')
            ->dateRange($dateFrom, $dateTo)
            ->count();

        $currentlyInYard = GateLog::gateIn()
            ->whereNull('gate_out_time')
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'total_gate_in' => $totalGateIn,
                'total_gate_out' => $totalGateOut,
                'currently_in_yard' => $currentlyInYard,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
        ]);
    }
}


<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Client;
use App\Models\Booking;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class InvoiceController extends Controller
{
    protected $audit;

    public function __construct(AuditService $audit)
    {
        $this->audit = $audit;
    }

    /**
     * Display a listing of invoices.
     */
    public function index(Request $request)
    {
        $query = Invoice::with(['client', 'booking', 'user']);

        // Search
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('invoice_no', 'like', "%{$search}%")
                  ->orWhereHas('client', function($q2) use ($search) {
                      $q2->where('client_name', 'like', "%{$search}%");
                  });
            });
        }

        // Filter by client
        if ($request->has('client_id')) {
            $query->where('client_id', $request->client_id);
        }

        // Filter by payment status
        if ($request->has('payment_status')) {
            $query->where('payment_status', $request->payment_status);
        }

        // Filter overdue
        if ($request->has('overdue') && $request->overdue == 'true') {
            $query->where('payment_status', '!=', 'paid')
                  ->where('due_date', '<', now());
        }

        $sortBy = $request->get('sort_by', 'invoice_date');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->get('per_page', 15);
        $invoices = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $invoices,
        ]);
    }

    /**
     * Store a newly created invoice.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'invoice_no' => 'required|string|unique:invoices,invoice_no',
            'client_id' => 'required|exists:fjp_clients,c_id',
            'booking_id' => 'nullable|exists:fjp_bookings,b_id',
            'invoice_date' => 'required|date',
            'due_date' => 'required|date|after_or_equal:invoice_date',
            'payment_status' => 'required|in:pending,paid,overdue',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|numeric|min:0',
            'items.*.unit_price' => 'required|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();
        try {
            $data = $validator->validated();
            $items = $data['items'];
            unset($data['items']);

            // Calculate totals
            $subtotal = 0;
            foreach ($items as $item) {
                $subtotal += $item['quantity'] * $item['unit_price'];
            }

            $data['subtotal'] = $subtotal;
            $data['tax_amount'] = 0; // Can be calculated if needed
            $data['total_amount'] = $subtotal + $data['tax_amount'];
            $data['user_id'] = auth()->user()->user_id;
            $data['date_added'] = now();

            $invoice = Invoice::create($data);

            // Create invoice items
            foreach ($items as $item) {
                InvoiceItem::create([
                    'invoice_id' => $invoice->inv_id,
                    'description' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'total_price' => $item['quantity'] * $item['unit_price'],
                ]);
            }

            DB::commit();

            // Log the action
            $this->audit->logCreate(
                'INVOICES',
                $invoice->inv_id,
                "Created invoice: {$invoice->invoice_no} for total amount: {$invoice->total_amount}"
            );

            return response()->json([
                'success' => true,
                'message' => 'Invoice created successfully',
                'data' => $invoice->load(['client', 'booking', 'items']),
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create invoice: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified invoice.
     */
    public function show($id)
    {
        $invoice = Invoice::with(['client', 'booking', 'items', 'user'])->find($id);

        if (!$invoice) {
            return response()->json([
                'success' => false,
                'message' => 'Invoice not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $invoice,
        ]);
    }

    /**
     * Update the specified invoice.
     */
    public function update(Request $request, $id)
    {
        $invoice = Invoice::find($id);

        if (!$invoice) {
            return response()->json([
                'success' => false,
                'message' => 'Invoice not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'payment_status' => 'required|in:pending,paid,overdue',
            'paid_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $invoice->update($validator->validated());

        $this->audit->logUpdate(
            'INVOICES',
            $invoice->inv_id,
            "Updated invoice: {$invoice->invoice_no} - Status: {$invoice->payment_status}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Invoice updated successfully',
            'data' => $invoice->load(['client', 'booking', 'items']),
        ]);
    }

    /**
     * Remove the specified invoice.
     */
    public function destroy($id)
    {
        $invoice = Invoice::find($id);

        if (!$invoice) {
            return response()->json([
                'success' => false,
                'message' => 'Invoice not found',
            ], 404);
        }

        $invoiceNo = $invoice->invoice_no;
        
        DB::beginTransaction();
        try {
            // Delete invoice items first
            InvoiceItem::where('invoice_id', $id)->delete();
            
            // Delete invoice
            $invoice->delete();
            
            DB::commit();

            $this->audit->logDelete(
                'INVOICES',
                $id,
                "Deleted invoice: {$invoiceNo}"
            );

            return response()->json([
                'success' => true,
                'message' => 'Invoice deleted successfully',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete invoice: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generate PDF for invoice.
     */
    public function generatePdf($id)
    {
        $invoice = Invoice::with(['client', 'booking', 'items', 'user'])->find($id);

        if (!$invoice) {
            return response()->json([
                'success' => false,
                'message' => 'Invoice not found',
            ], 404);
        }

        $this->audit->log(
            'EXPORT',
            "Generated PDF for invoice: {$invoice->invoice_no}",
            'INVOICES',
            $invoice->inv_id
        );

        // PDF generation will be implemented
        return response()->json([
            'success' => true,
            'message' => 'PDF generation will be implemented',
            'data' => $invoice,
        ]);
    }
}


<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'invoices';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'inv_id';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'invoice_no',
        'client_id',
        'booking_id',
        'invoice_date',
        'due_date',
        'amount',
        'tax_amount',
        'total_amount',
        'payment_status',
        'payment_date',
        'notes',
        'created_by',
        'date_added',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'invoice_date' => 'date',
            'due_date' => 'date',
            'payment_date' => 'date',
            'date_added' => 'datetime',
            'amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    /**
     * Get the client for the invoice.
     */
    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id', 'c_id');
    }

    /**
     * Get the booking for the invoice.
     */
    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'b_id');
    }

    /**
     * Get the user who created the invoice.
     */
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    /**
     * Get the invoice items.
     */
    public function items()
    {
        return $this->hasMany(InvoiceItem::class, 'invoice_id', 'inv_id');
    }

    /**
     * Check if invoice is overdue.
     */
    public function isOverdue()
    {
        return $this->payment_status !== 'paid' && $this->due_date < now();
    }

    /**
     * Check if invoice is paid.
     */
    public function isPaid()
    {
        return $this->payment_status === 'paid';
    }

    /**
     * Scope a query to only include pending invoices.
     */
    public function scopePending($query)
    {
        return $query->where('payment_status', 'pending');
    }

    /**
     * Scope a query to only include paid invoices.
     */
    public function scopePaid($query)
    {
        return $query->where('payment_status', 'paid');
    }

    /**
     * Scope a query to only include overdue invoices.
     */
    public function scopeOverdue($query)
    {
        return $query->where('payment_status', '!=', 'paid')
                     ->where('due_date', '<', now());
    }
}

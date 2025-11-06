<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GateLog extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'gate_logs';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'gate_id';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'container_no',
        'booking_id',
        'gate_type',
        'gate_date',
        'gate_time',
        'truck_no',
        'driver_name',
        'remarks',
        'user_id',
        'created_at',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'gate_date' => 'date',
            'created_at' => 'datetime',
        ];
    }

    /**
     * Get the booking for this gate log.
     */
    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'b_id');
    }

    /**
     * Get the user who recorded this log.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /**
     * Scope a query to only include gate-in logs.
     */
    public function scopeGateIn($query)
    {
        return $query->where('gate_type', 'in');
    }

    /**
     * Scope a query to only include gate-out logs.
     */
    public function scopeGateOut($query)
    {
        return $query->where('gate_type', 'out');
    }

    /**
     * Scope a query to filter by container number.
     */
    public function scopeByContainer($query, $containerNo)
    {
        return $query->where('container_no', $containerNo);
    }

    /**
     * Scope a query to filter by date range.
     */
    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('gate_date', [$startDate, $endDate]);
    }
}

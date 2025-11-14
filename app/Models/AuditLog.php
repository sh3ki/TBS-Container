<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'audit_logs';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'a_id';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     * Actual table columns: a_id, action, description, user_id, date_added, ip_address
     */
    protected $fillable = [
        'action',
        'description',
        'user_id',
        'date_added',
        'ip_address',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'date_added' => 'datetime',
        ];
    }

    /**
     * Get the user who performed the action.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /**
     * Scope a query to filter by action (changed from action_type to match actual column).
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('action', $type);
    }

    /**
     * Scope a query to filter by date range (using date_added).
     */
    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('date_added', [$startDate, $endDate]);
    }
}

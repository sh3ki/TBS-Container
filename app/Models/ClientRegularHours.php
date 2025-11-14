<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClientRegularHours extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'client_reg_hours';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'reg_id';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'client_id',
        'start_time',
        'end_time',
        'w_start_time',
        'w_end_time',
        'date_added',
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
     * Get the client that owns the regular hours.
     */
    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id', 'c_id');
    }

    /**
     * Get MD5 hashed ID for security (legacy compatibility).
     */
    public function getHashedIdAttribute()
    {
        return md5($this->reg_id);
    }

    /**
     * Get formatted incoming hours.
     */
    public function getFormattedIncomingHoursAttribute()
    {
        if (!$this->start_time || !$this->end_time) {
            return null;
        }
        return $this->start_time . '-' . $this->end_time;
    }

    /**
     * Get formatted withdrawal hours.
     */
    public function getFormattedWithdrawalHoursAttribute()
    {
        if (!$this->w_start_time || !$this->w_end_time) {
            return null;
        }
        return $this->w_start_time . '-' . $this->w_end_time;
    }
}

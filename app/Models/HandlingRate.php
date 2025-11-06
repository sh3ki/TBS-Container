<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HandlingRate extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'handling_rate';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'h_id';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'client_id',
        'size',
        'rate',
        'date_added',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'rate' => 'decimal:2',
            'date_added' => 'datetime',
        ];
    }

    /**
     * Get the client that owns the handling rate.
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
        return md5($this->h_id);
    }
}

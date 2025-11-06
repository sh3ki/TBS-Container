<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inventory extends Model
{
    protected $table = 'inventory';
    protected $primaryKey = 'i_id';
    public $timestamps = false;

    protected $fillable = [
        'container_no',
        'client_id',
        'size_type',
        'date_added',
        'out_id',
        'gate_status',
        'handling_count',
        'complete',
        'remarks',
    ];

    protected $casts = [
        'date_added' => 'date',
        'handling_count' => 'integer',
    ];

    /**
     * Get the client that owns the inventory
     */
    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id', 'c_id');
    }

    /**
     * Get the gate OUT record (self-referencing)
     * When a container gates out, a new inventory record is created and linked via out_id
     */
    public function gateOutRecord()
    {
        return $this->belongsTo(Inventory::class, 'out_id', 'i_id');
    }

    /**
     * Get hashed ID for security
     */
    public function getHashedIdAttribute()
    {
        return md5($this->i_id);
    }
}

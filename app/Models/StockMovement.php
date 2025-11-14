<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockMovement extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'stock_movements';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'movement_id';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'item_id',
        'movement_type',
        'quantity',
        'reason',
        'reference_no',
        'user_id',
        'movement_date',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'movement_date' => 'datetime',
            'quantity' => 'integer',
        ];
    }

    /**
     * Get the inventory item for this movement.
     */
    public function item()
    {
        return $this->belongsTo(InventoryItem::class, 'item_id', 'inv_id');
    }

    /**
     * Get the user who recorded this movement.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /**
     * Scope a query to only include stock in movements.
     */
    public function scopeStockIn($query)
    {
        return $query->where('movement_type', 'in');
    }

    /**
     * Scope a query to only include stock out movements.
     */
    public function scopeStockOut($query)
    {
        return $query->where('movement_type', 'out');
    }
}

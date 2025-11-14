<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryItem extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'inventory';

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
        'item_code',
        'item_name',
        'description',
        'category',
        'unit_of_measure',
        'quantity_on_hand',
        'reorder_level',
        'unit_cost',
        'location',
        'date_added',
        'last_updated',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'date_added' => 'datetime',
            'last_updated' => 'datetime',
            'quantity_on_hand' => 'integer',
            'reorder_level' => 'integer',
            'unit_cost' => 'decimal:2',
        ];
    }

    /**
     * Get the stock movements for this item.
     */
    public function movements()
    {
        return $this->hasMany(StockMovement::class, 'item_id', 'inv_id');
    }

    /**
     * Check if item needs reordering.
     */
    public function needsReorder()
    {
        return $this->quantity_on_hand <= $this->reorder_level;
    }

    /**
     * Check if item is in stock.
     */
    public function inStock()
    {
        return $this->quantity_on_hand > 0;
    }

    /**
     * Scope a query to only include items needing reorder.
     */
    public function scopeLowStock($query)
    {
        return $query->whereColumn('quantity_on_hand', '<=', 'reorder_level');
    }

    /**
     * Scope a query to only include out of stock items.
     */
    public function scopeOutOfStock($query)
    {
        return $query->where('quantity_on_hand', 0);
    }

    /**
     * Adjust stock quantity.
     */
    public function adjustStock($quantity, $type = 'in', $reason = null, $userId = null)
    {
        if ($type === 'in') {
            $this->quantity_on_hand += $quantity;
        } else {
            $this->quantity_on_hand -= $quantity;
        }

        $this->last_updated = now();
        $this->save();

        // Create movement record
        StockMovement::create([
            'item_id' => $this->inv_id,
            'movement_type' => $type,
            'quantity' => $quantity,
            'reason' => $reason,
            'user_id' => $userId,
            'movement_date' => now(),
        ]);

        return $this;
    }
}

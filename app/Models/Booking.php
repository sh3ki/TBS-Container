<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'bookings';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'b_id';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'book_no',
        'client_id',
        'shipper',
        'twenty',
        'fourty',
        'fourty_five',
        'twenty_rem',
        'fourty_rem',
        'fourty_five_rem',
        'cont_list',
        'cont_list_rem',
        'expiration_date',
        'date_added',
        'user_id',
        'status',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'date_added' => 'datetime',
            'expiration_date' => 'date',
            'twenty' => 'integer',
            'fourty' => 'integer',
            'fourty_five' => 'integer',
            'twenty_rem' => 'integer',
            'fourty_rem' => 'integer',
            'fourty_five_rem' => 'integer',
        ];
    }

    /**
     * Get the client for the booking.
     */
    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id', 'c_id');
    }

    /**
     * Get the user who created the booking.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /**
     * Get the container list as an array.
     */
    public function getContainerListAttribute()
    {
        return !empty($this->cont_list) ? explode(',', $this->cont_list) : [];
    }

    /**
     * Get the remaining container list as an array.
     */
    public function getContainerListRemAttribute()
    {
        return !empty($this->cont_list_rem) ? explode(',', $this->cont_list_rem) : [];
    }

    /**
     * Check if booking is expired.
     */
    public function isExpired()
    {
        return $this->expiration_date < now();
    }

    /**
     * Check if booking has containers available.
     */
    public function hasAvailableContainers()
    {
        return ($this->twenty > 0 || $this->fourty > 0 || $this->fourty_five > 0 ||
                $this->twenty_rem > 0 || $this->fourty_rem > 0 || $this->fourty_five_rem > 0 ||
                (!empty($this->cont_list) && $this->cont_list !== '') ||
                (!empty($this->cont_list_rem) && $this->cont_list_rem !== ''));
    }

    /**
     * Get total containers booked.
     */
    public function getTotalContainersAttribute()
    {
        return $this->twenty + $this->fourty + $this->fourty_five;
    }

    /**
     * Get total containers remaining.
     */
    public function getTotalRemainingAttribute()
    {
        return $this->twenty_rem + $this->fourty_rem + $this->fourty_five_rem;
    }

    /**
     * Get MD5 hashed ID.
     */
    public function getHashedIdAttribute()
    {
        return md5($this->b_id);
    }

    /**
     * Check if booking is active (not expired and has remaining containers).
     */
    public function getIsActiveAttribute()
    {
        return $this->expiration_date >= now()->toDateString() && $this->hasAvailableContainers();
    }

    /**
     * Get status text.
     */
    public function getStatusTextAttribute()
    {
        return $this->is_active ? 'Active' : 'Expired';
    }

    /**
     * Scope for active bookings (not expired with at least 1 container).
     */
    public function scopeActive($query)
    {
        return $query->where('expiration_date', '>=', now()->toDateString())
                     ->where(function($q) {
                         $q->where('twenty', '>', 0)
                           ->orWhere('fourty', '>', 0)
                           ->orWhere('fourty_five', '>', 0)
                           ->orWhere('twenty_rem', '>', 0)
                           ->orWhere('fourty_rem', '>', 0)
                           ->orWhere('fourty_five_rem', '>', 0)
                           ->orWhere(function($q2) {
                               $q2->whereNotNull('cont_list')
                                  ->where('cont_list', '!=', '');
                           })
                           ->orWhere(function($q2) {
                               $q2->whereNotNull('cont_list_rem')
                                  ->where('cont_list_rem', '!=', '');
                           });
                     });
    }

    /**
     * Scope for expired bookings.
     */
    public function scopeExpired($query)
    {
        return $query->where(function($q) {
            $q->where('expiration_date', '<', now()->toDateString())
              ->orWhere(function($q2) {
                  $q2->where('twenty_rem', '=', 0)
                     ->where('fourty_rem', '=', 0)
                     ->where('fourty_five_rem', '=', 0);
              });
        });
    }

    /**
     * Get containers from inventory.
     */
    public function inventoryContainers()
    {
        return $this->hasMany(\App\Models\Inventory::class, 'booking', 'book_no');
    }
}

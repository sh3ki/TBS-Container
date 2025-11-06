<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'clients';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'c_id';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The name of the "created at" column.
     */
    const CREATED_AT = 'date_added';

    /**
     * The name of the "deleted at" column (using archived field).
     */
    const DELETED_AT = null; // We'll use a custom approach for archived

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'client_name',
        'client_code',
        'client_address',
        'client_email',
        'contact_person',
        'phone_number',
        'fax_number',
        'date_added',
        'archived',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'date_added' => 'datetime',
            'archived' => 'boolean',
        ];
    }

    /**
     * Scope a query to only include non-archived clients.
     */
    public function scopeActive($query)
    {
        return $query->where('archived', 0);
    }

    /**
     * Scope a query to only include archived clients.
     */
    public function scopeArchived($query)
    {
        return $query->where('archived', 1);
    }

    /**
     * Get the bookings for the client.
     */
    public function bookings()
    {
        return $this->hasMany(Booking::class, 'client_id', 'c_id');
    }

    /**
     * Get the storage rates for the client.
     */
    public function storageRates()
    {
        return $this->hasMany(StorageRate::class, 'client_id', 'c_id');
    }

    /**
     * Get the handling rates for the client.
     */
    public function handlingRates()
    {
        return $this->hasMany(HandlingRate::class, 'client_id', 'c_id');
    }

    /**
     * Get the regular hours for the client.
     */
    public function regularHours()
    {
        return $this->hasOne(ClientRegularHours::class, 'client_id', 'c_id');
    }

    /**
     * Archive (soft delete) the client.
     */
    public function archive()
    {
        $this->archived = 1;
        return $this->save();
    }

    /**
     * Restore the archived client.
     */
    public function restore()
    {
        $this->archived = 0;
        return $this->save();
    }

    /**
     * Get MD5 hashed ID for security (legacy compatibility).
     */
    public function getHashedIdAttribute()
    {
        return md5($this->c_id);
    }
}

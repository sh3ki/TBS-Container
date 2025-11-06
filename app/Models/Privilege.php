<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Privilege extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'privileges';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'p_code';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'p_code',
        'p_name',
        'p_desc',
        'access',
    ];

    /**
     * Get the users with this privilege.
     */
    public function users()
    {
        return $this->hasMany(User::class, 'priv_id', 'p_id');
    }

    /**
     * Get the page access permissions for this privilege.
     */
    public function pageAccess()
    {
        return $this->hasMany(PageAccess::class, 'privilege', 'p_code');
    }
}

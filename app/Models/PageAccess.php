<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PageAccess extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'pages_access';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'pa_id';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'page_id',
        'privilege',
        'acs_edit',
        'acs_delete',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'acs_edit' => 'boolean',
            'acs_delete' => 'boolean',
        ];
    }

    /**
     * Get the page for this access permission.
     */
    public function page()
    {
        return $this->belongsTo(Page::class, 'page_id', 'p_id');
    }

    /**
     * Get the privilege for this access permission.
     */
    public function privilege()
    {
        return $this->belongsTo(Privilege::class, 'privilege', 'p_code');
    }
}

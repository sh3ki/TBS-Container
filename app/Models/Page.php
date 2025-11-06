<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Page extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'pages';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'p_id';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'page',
        'page_name',
        'page_icon',
        'arrange_no',
        'is_active',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'arrange_no' => 'integer',
        ];
    }

    /**
     * Get the page access permissions for this page.
     */
    public function pageAccess()
    {
        return $this->hasMany(PageAccess::class, 'page_id', 'p_id');
    }
}

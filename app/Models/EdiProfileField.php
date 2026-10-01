<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EdiProfileField extends Model
{
    protected $table = 'edi_profile_fields';
    protected $primaryKey = 'field_id';

    protected $fillable = [
        'profile_id', 'source_column', 'output_name', 'output_order', 'transform',
        'default_value', 'is_enabled', 'is_required',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'is_required' => 'boolean',
            'output_order' => 'integer',
        ];
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EdiProfileDirection extends Model
{
    protected $table = 'edi_profile_directions';
    protected $primaryKey = 'direction_id';

    protected $fillable = [
        'profile_id', 'direction', 'file_type', 'sample_filename', 'sample_content',
        'mapping_suggestions', 'mappings', 'structure_analysis',
    ];

    protected function casts(): array
    {
        return [
            'mapping_suggestions' => 'array',
            'mappings' => 'array',
            'structure_analysis' => 'array',
        ];
    }
}

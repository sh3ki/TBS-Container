<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EdiProfile extends Model
{
    protected $table = 'edi_profiles';
    protected $primaryKey = 'profile_id';

    protected $fillable = [
        'profile_name', 'client_id', 'legacy_key', 'edi_type', 'source_table',
        'is_enabled', 'manual_enabled', 'automatic_enabled', 'start_time', 'end_time',
        'interval_seconds', 'batch_limit', 'date_column', 'sort_column', 'sort_direction',
        'delimiter', 'line_ending', 'record_terminator', 'terminator_mode', 'include_header',
        'encoding', 'filename_pattern', 'destination_type', 'destination_config', 'credentials',
        'max_attempts', 'retry_backoff', 'timezone', 'last_run_at', 'next_run_at',
        'last_success_at', 'last_error', 'notes', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'manual_enabled' => 'boolean',
            'automatic_enabled' => 'boolean',
            'include_header' => 'boolean',
            'destination_config' => 'array',
            // Credentials are intentionally stored as plain JSON for compatibility with the legacy EDI setup.
            'credentials' => 'array',
            'retry_backoff' => 'array',
            'last_run_at' => 'datetime',
            'next_run_at' => 'datetime',
            'last_success_at' => 'datetime',
        ];
    }

    public function fields()
    {
        return $this->hasMany(EdiProfileField::class, 'profile_id', 'profile_id')->orderBy('output_order');
    }
}

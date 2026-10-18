<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EdiProfile extends Model
{
    protected $table = 'edi_profiles';
    protected $primaryKey = 'profile_id';

    protected $fillable = [
        'profile_name', 'client_id', 'legacy_key', 'edi_type', 'source_table',
        'is_enabled', 'enabled_at', 'direction_mode', 'manual_enabled', 'automatic_enabled', 'start_time', 'end_time',
        'interval_seconds', 'batch_limit', 'date_column', 'sort_column', 'sort_direction',
        'delimiter', 'line_ending', 'record_terminator', 'terminator_mode', 'include_header',
        'encoding', 'filename_pattern', 'destination_type', 'destination_config', 'credentials',
        'max_attempts', 'retry_delay_seconds', 'profile_version', 'retry_backoff', 'timezone', 'last_run_at', 'next_run_at',
        'last_success_at', 'last_error', 'notes', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
            'enabled_at' => 'datetime',
            'manual_enabled' => 'boolean',
            'automatic_enabled' => 'boolean',
            'include_header' => 'boolean',
            'destination_config' => 'array',
            'retry_backoff' => 'array',
            'last_run_at' => 'datetime',
            'next_run_at' => 'datetime',
            'last_success_at' => 'datetime',
            'schedule_minutes' => 'integer',
            'retry_delay_seconds' => 'integer',
            'profile_version' => 'integer',
        ];
    }

    public function fields()
    {
        return $this->hasMany(EdiProfileField::class, 'profile_id', 'profile_id')->orderBy('output_order');
    }

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id', 'c_id');
    }

    public function directions()
    {
        return $this->hasMany(EdiProfileDirection::class, 'profile_id', 'profile_id');
    }
}

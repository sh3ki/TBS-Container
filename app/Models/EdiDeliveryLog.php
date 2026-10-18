<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EdiDeliveryLog extends Model
{
    protected $table = 'edi_delivery_logs';
    protected $primaryKey = 'log_id';

    protected $fillable = [
        'profile_id', 'direction', 'filename', 'profile_version', 'transaction_count', 'status',
        'attempts', 'artifact_path', 'sha256', 'error_message', 'response', 'generated_at',
        'sent_at', 'next_retry_at', 'requested_by', 'transaction_fingerprint',
            'transaction_ids',
    ];

    protected function casts(): array
    {
        return [
            'response' => 'array',
            'transaction_ids' => 'array',
            'generated_at' => 'datetime',
            'sent_at' => 'datetime',
            'next_retry_at' => 'datetime',
        ];
    }

    public function profile()
    {
        return $this->belongsTo(EdiProfile::class, 'profile_id', 'profile_id');
    }
}

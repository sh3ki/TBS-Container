<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EdiTransaction extends Model
{
    protected $table = 'edi_transactions';
    protected $primaryKey = 'transaction_id';

    protected $fillable = [
        'profile_id', 'direction', 'inventory_id', 'profile_version', 'status', 'attempts',
        'eligible_at', 'sent_at', 'next_retry_at', 'last_error', 'snapshot',
    ];

    protected function casts(): array
    {
        return [
            'eligible_at' => 'datetime',
            'sent_at' => 'datetime',
            'next_retry_at' => 'datetime',
            'snapshot' => 'array',
        ];
    }
}

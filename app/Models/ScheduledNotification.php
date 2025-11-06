<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ScheduledNotification extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'fjp_scheduled_notifications';

    /**
     * The primary key associated with the table.
     */
    protected $primaryKey = 'pam_id';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'from_user',
        'to_user',
        'sent_date',
        'trigger_date',
        'type',
        'message',
        'screen',
        'email1',
        'email2',
        'sms1',
        'sms2',
        'tel1',
        'tel2',
        'mobile1',
        'mobile2',
        'fax1',
        'fax2',
        'ack_required',
        'ack_date',
        'ack_message',
        'delivered',
        'retry_count',
        'error_message',
        'to_email',
        'to_phone',
        'to_address',
        'deleted',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'sent_date' => 'datetime',
            'trigger_date' => 'datetime',
            'ack_date' => 'datetime',
            'screen' => 'boolean',
            'email1' => 'boolean',
            'email2' => 'boolean',
            'sms1' => 'boolean',
            'sms2' => 'boolean',
            'tel1' => 'boolean',
            'tel2' => 'boolean',
            'mobile1' => 'boolean',
            'mobile2' => 'boolean',
            'fax1' => 'boolean',
            'fax2' => 'boolean',
            'ack_required' => 'boolean',
            'delivered' => 'boolean',
            'deleted' => 'boolean',
        ];
    }

    /**
     * Get the sender user.
     */
    public function fromUser()
    {
        return $this->belongsTo(User::class, 'from_user', 'user_id');
    }

    /**
     * Get the recipient user.
     */
    public function toUser()
    {
        return $this->belongsTo(User::class, 'to_user', 'user_id');
    }

    /**
     * Scope a query to only include pending notifications.
     */
    public function scopePending($query)
    {
        return $query->where('delivered', 0)
                     ->where('deleted', 0)
                     ->where('trigger_date', '<=', now());
    }

    /**
     * Scope a query to only include delivered notifications.
     */
    public function scopeDelivered($query)
    {
        return $query->where('delivered', 1);
    }

    /**
     * Scope a query to filter by notification type.
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Mark notification as delivered.
     */
    public function markAsDelivered($message = null)
    {
        $this->delivered = true;
        $this->ack_date = now();
        if ($message) {
            $this->ack_message = $message;
        }
        return $this->save();
    }

    /**
     * Mark notification as failed.
     */
    public function markAsFailed($errorMessage)
    {
        $this->retry_count++;
        $this->error_message = $errorMessage;
        return $this->save();
    }

    /**
     * Get active delivery channels for this notification.
     */
    public function getActiveChannels(): array
    {
        $channels = [];
        
        if ($this->email1) $channels[] = 'email1';
        if ($this->email2) $channels[] = 'email2';
        if ($this->sms1) $channels[] = 'sms1';
        if ($this->sms2) $channels[] = 'sms2';
        if ($this->tel1) $channels[] = 'tel1';
        if ($this->tel2) $channels[] = 'tel2';
        if ($this->mobile1) $channels[] = 'mobile1';
        if ($this->mobile2) $channels[] = 'mobile2';
        if ($this->fax1) $channels[] = 'fax1';
        if ($this->fax2) $channels[] = 'fax2';
        if ($this->screen) $channels[] = 'screen';
        
        return $channels;
    }

    /**
     * Check if notification should be retried.
     */
    public function shouldRetry(): bool
    {
        return $this->retry_count < 3; // Max 3 retries
    }

    /**
     * Check if notification is due to be sent.
     */
    public function isDue()
    {
        return $this->trigger_date <= now() && !$this->delivered;
    }
}

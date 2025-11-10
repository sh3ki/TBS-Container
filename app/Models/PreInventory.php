<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class PreInventory extends Model
{
    protected $table = 'fjp_pre_inventory';
    protected $primaryKey = 'p_id';
    public $timestamps = false;

    protected $fillable = [
        'client_id',
        'container_no',
        'plate_no',
        'hauler',
        'gate_status',
        'user_id',
        'status',
        'inv_id',
        'date_added',
        'date_completed',
        'remarks',
        'size_type',
        'cnt_class',
        'cnt_status',
        'iso_code',
        'date_mnfg',
        'checker_id',
    ];

    protected $casts = [
        'client_id' => 'integer',
        'user_id' => 'integer',
        'status' => 'integer',
        'inv_id' => 'integer',
        'date_added' => 'datetime',
        'date_completed' => 'datetime',
    ];

    protected $appends = ['hashed_id', 'runtime_minutes', 'runtime_color', 'status_label'];

    // Relationships
    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id', 'c_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function inventory()
    {
        return $this->belongsTo(Inventory::class, 'inv_id', 'i_id');
    }

    // Accessors
    public function getHashedIdAttribute()
    {
        return md5($this->p_id);
    }

    public function getRuntimeMinutesAttribute()
    {
        $endTime = $this->date_completed ?? now();
        return $this->date_added->diffInMinutes($endTime);
    }

    public function getRuntimeColorAttribute()
    {
        $minutes = $this->runtime_minutes;
        
        if ($minutes <= 30) {
            return 'green'; // Good performance
        } elseif ($minutes <= 60) {
            return 'orange'; // Warning
        } else {
            return 'red'; // Critical
        }
    }

    public function getStatusLabelAttribute()
    {
        return $this->status == 0 ? 'Pending' : 'Finished';
    }

    // Scopes
    public function scopePending($query)
    {
        return $query->where('status', 0);
    }

    public function scopeFinished($query)
    {
        return $query->where('status', 1);
    }

    public function scopeGateIn($query)
    {
        return $query->where('gate_status', 'IN');
    }

    public function scopeGateOut($query)
    {
        return $query->where('gate_status', 'OUT');
    }

    // Helper Methods
    public static function getListWithDetails($gateStatus, $search = null, $start = 0, $length = 500)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        $searchCondition = '';
        $gateStatusCondition = '';
        $params = [':inc' => 0];
        
        // Only filter by gate_status if provided
        if (!empty($gateStatus)) {
            $gateStatusCondition = " AND p.gate_status = :gate";
            $params[':gate'] = $gateStatus;
        }
        
        if ($search) {
            $searchCondition = " AND (p.container_no LIKE :search OR p.plate_no LIKE :search)";
            $params[':search'] = "%{$search}%";
        }

        $query = "SELECT
                    p.p_id,
                    CASE WHEN p.client_id = 0 OR p.client_id IS NULL THEN
                        '-'
                    ELSE
                        (SELECT client_name FROM {$prefix}clients WHERE c_id=p.client_id LIMIT 1)
                    END client_name,
                    CASE WHEN p.client_id = 0 OR p.client_id IS NULL THEN
                        '-'
                    ELSE
                        (SELECT client_code FROM {$prefix}clients WHERE c_id=p.client_id LIMIT 1)
                    END client_code,
                    CASE WHEN p.hauler IS NULL OR p.hauler = '' THEN
                        '-'
                    ELSE
                        p.hauler
                    END hauler,
                    CASE WHEN p.container_no = '' OR p.container_no IS NULL THEN
                        '-'
                    ELSE
                        p.container_no
                    END container_no,
                    CASE WHEN p.plate_no = '' OR p.plate_no IS NULL THEN
                        '-'
                    ELSE
                        p.plate_no
                    END plate_no,
                    p.gate_status,
                    CASE WHEN p.status = 0 THEN
                        'Pending'
                    ELSE
                        'Finished'
                    END status,
                    p.date_added,
                    TIMESTAMPDIFF(MINUTE, p.date_added, 
                    (CASE WHEN p.date_completed IS NULL THEN 
                        NOW()
                    ELSE 
                        p.date_completed
                    END)) runtime,
                    p.client_id,
                    p.size_type,
                    p.cnt_class,
                    p.cnt_status,
                    p.remarks,
                    (SELECT full_name FROM {$prefix}users WHERE user_id=p.user_id LIMIT 1) created_by
                FROM {$prefix}pre_inventory p
                WHERE p.status = :inc {$gateStatusCondition}
                {$searchCondition}
                ORDER BY p.date_added DESC 
                LIMIT {$start},{$length}";
        
        $results = DB::select($query, $params);
        
        // Add hashed_id and runtime_color to each result
        foreach ($results as $result) {
            $result->hashed_id = md5($result->p_id ?? '');
            
            // Color code runtime
            if ($result->runtime <= 30) {
                $result->runtime_color = 'green';
            } elseif ($result->runtime <= 60) {
                $result->runtime_color = 'orange';
            } else {
                $result->runtime_color = 'red';
            }
        }
        
        return $results;
    }

    public static function checkContainerCanGateIn($containerNo, $clientId)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        // Check if already IN
        $alreadyIn = DB::selectOne(
            "SELECT container_no FROM {$prefix}inventory 
             WHERE container_no = :cno AND complete = 0 AND gate_status = 'IN'",
            ['cno' => $containerNo]
        );
        
        if ($alreadyIn) {
            return ['valid' => false, 'message' => '<strong>Alert!</strong> Container is currently gate in!'];
        }
        
        // Check if already in pre-gate pending
        $preDup = DB::selectOne(
            "SELECT container_no FROM {$prefix}pre_inventory 
             WHERE container_no = :cno AND status = 0",
            ['cno' => $containerNo]
        );
        
        if ($preDup) {
            return ['valid' => false, 'message' => '<strong>Alert!</strong> Container is currently pre-in!'];
        }
        
        // Check if banned
        $banned = DB::selectOne(
            "SELECT container_no, notes FROM {$prefix}ban_containers 
             WHERE container_no = :cno",
            ['cno' => $containerNo]
        );
        
        if ($banned) {
            return [
                'valid' => false, 
                'message' => '<strong>Alert!</strong> Block list container number has been detected! <hr/><strong>Notes:</strong><br/>' . $banned->notes
            ];
        }
        
        return ['valid' => true, 'message' => '<strong>Success!</strong> Valid container number!'];
    }

    public static function checkContainerCanGateOut($containerNo)
    {
        $prefix = env('DB_PREFIX', 'fjp_');
        
        // Check if container is IN yard
        $inYard = DB::selectOne(
            "SELECT container_no FROM {$prefix}inventory 
             WHERE container_no = :cno AND gate_status = 'IN' AND complete = 0",
            ['cno' => $containerNo]
        );
        
        if (!$inYard) {
            return ['valid' => false, 'message' => '<strong>Alert!</strong> Container number is not gate in yet.'];
        }
        
        // Check if on hold
        $onHold = DB::selectOne(
            "SELECT container_no, notes FROM {$prefix}hold_containers 
             WHERE container_no = :cno",
            ['cno' => $containerNo]
        );
        
        if ($onHold) {
            return [
                'valid' => false,
                'message' => '<strong>Alert!</strong> Container is currently on hold!<hr /><label>Notes:</label><br />' . $onHold->notes
            ];
        }
        
        return ['valid' => true, 'message' => '<strong>Success!</strong> Valid container number!'];
    }
}

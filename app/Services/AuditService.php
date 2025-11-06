<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;

class AuditService
{
    /**
     * Log an audit event.
     * 
     * Actual table columns: a_id, action, description, user_id, date_added, ip_address
     *
     * @param string $actionType
     * @param string $description
     * @param string|null $module
     * @param int|null $recordId
     * @param int|null $userId
     * @return AuditLog
     */
    public function log(
        string $actionType,
        string $description,
        ?string $module = null,
        ?int $recordId = null,
        ?int $userId = null
    ): AuditLog {
        // Build a comprehensive description that includes module and record_id if provided
        $fullDescription = $description;
        if ($module) {
            $fullDescription = "[$module] $fullDescription";
        }
        if ($recordId) {
            $fullDescription .= " (ID: $recordId)";
        }
        
        return AuditLog::create([
            'action' => strtoupper($actionType),
            'description' => $fullDescription,
            'user_id' => $userId ?? Auth::id() ?? 0,
            'date_added' => now(),
            'ip_address' => request()->ip() ?? '0.0.0.0',
        ]);
    }

    /**
     * Log a login event.
     */
    public function logLogin(int $userId, bool $success = true): AuditLog
    {
        return $this->log(
            'LOGIN',
            $success ? 'Successfully logged in' : 'Failed login attempt',
            'AUTH',
            null,
            $userId
        );
    }

    /**
     * Log a logout event.
     */
    public function logLogout(int $userId): AuditLog
    {
        return $this->log(
            'LOGOUT',
            'User logged out',
            'AUTH',
            null,
            $userId
        );
    }

    /**
     * Log a create event.
     */
    public function logCreate(string $module, int $recordId, string $description): AuditLog
    {
        return $this->log('ADD', $description, $module, $recordId);
    }

    /**
     * Log an update event.
     */
    public function logUpdate(string $module, int $recordId, string $description): AuditLog
    {
        return $this->log('UPDATE', $description, $module, $recordId);
    }

    /**
     * Log a delete event.
     */
    public function logDelete(string $module, int $recordId, string $description): AuditLog
    {
        return $this->log('DELETE', $description, $module, $recordId);
    }

    /**
     * Log an edit attempt (view edit form).
     */
    public function logEdit(string $module, int $recordId, string $description): AuditLog
    {
        return $this->log('EDIT', $description, $module, $recordId);
    }

    /**
     * Log an export event.
     */
    public function logExport(string $module, string $format, string $description): AuditLog
    {
        return $this->log('EXPORT', "$description (Format: $format)", $module);
    }

    /**
     * Log an import event.
     */
    public function logImport(string $module, int $recordCount, string $description): AuditLog
    {
        return $this->log('IMPORT', "$description ($recordCount records)", $module);
    }

    /**
     * Log a view/access event.
     */
    public function logAccess(string $module, ?int $recordId, string $description): AuditLog
    {
        return $this->log('ACCESS', $description, $module, $recordId);
    }

    /**
     * Log a custom event.
     */
    public function logCustom(string $actionType, string $description, ?string $module = null): AuditLog
    {
        return $this->log($actionType, $description, $module);
    }

    /**
     * Get recent audit logs for a specific module.
     */
    public function getRecentLogs(string $module, int $limit = 50)
    {
        return AuditLog::with('user')
            ->ofModule($module)
            ->orderBy('timestamp', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get logs for a specific user.
     */
    public function getUserLogs(int $userId, int $limit = 50)
    {
        return AuditLog::where('user_id', $userId)
            ->orderBy('timestamp', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get logs for a date range.
     */
    public function getLogsByDateRange(string $startDate, string $endDate, ?string $module = null)
    {
        $query = AuditLog::with('user')
            ->dateRange($startDate, $endDate);

        if ($module) {
            $query->ofModule($module);
        }

        return $query->orderBy('timestamp', 'desc')->get();
    }
}

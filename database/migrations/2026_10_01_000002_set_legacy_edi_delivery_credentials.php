<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // The legacy SFTP sender used these values for the MSC CODECO feed.
        // They are intentionally stored as plain JSON because EDI credentials
        // are managed from the EDI profile and must be usable by the worker.
        DB::table('edi_profiles')
            ->where('legacy_key', 'MSC')
            ->update([
                'destination_type' => 'sftp',
                'destination_config' => json_encode([
                    'host' => 'ftp.msc.com',
                    'remote_path' => '/To_MSC/CODECO/',
                    'timeout_seconds' => 120,
                ]),
                'credentials' => json_encode([
                    'host' => 'ftp.msc.com',
                    'port' => '22',
                    'username' => 'PH980-FJP_DPT',
                    'password' => 'jklpr8dp',
                ]),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('edi_profiles')
            ->where('legacy_key', 'MSC')
            ->update(['credentials' => null]);
    }
};

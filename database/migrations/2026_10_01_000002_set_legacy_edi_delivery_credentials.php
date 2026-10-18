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
                'host' => env('EDI_MSC_HOST', ''),
                    'remote_path' => '/To_MSC/CODECO/',
                    'timeout_seconds' => 120,
                ]),
                'credentials' => json_encode([
                    'host' => env('EDI_MSC_HOST', ''),
                    'port' => env('EDI_MSC_PORT', '22'),
                    'username' => env('EDI_MSC_USERNAME', ''),
                    'password' => env('EDI_MSC_PASSWORD', ''),
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

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('edi_profiles')->whereNotNull('credentials')->get()->each(function ($profile) {
            $value = (string) $profile->credentials;
            try {
                Crypt::decryptString($value);
                return;
            } catch (\Throwable) {
                // Legacy values were JSON. Encrypt them below.
            }
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                DB::table('edi_profiles')->where('profile_id', $profile->profile_id)->update([
                    'credentials' => Crypt::encryptString(json_encode($decoded)),
                    'updated_at' => now(),
                ]);
            }
        });
    }

    public function down(): void
    {
        // Credentials remain encrypted intentionally; decrypting secrets during rollback is unsafe.
    }
};

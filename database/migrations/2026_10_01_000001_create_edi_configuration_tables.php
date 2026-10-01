<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('edi_profiles', function (Blueprint $table) {
            $table->id('profile_id');
            $table->string('profile_name', 120)->unique();
            $table->unsignedInteger('client_id')->nullable()->index();
            $table->string('legacy_key', 80)->nullable();
            $table->string('edi_type', 40)->default('CODECO');
            $table->enum('source_table', ['inventory', 'pre_inventory'])->default('inventory');
            $table->boolean('is_enabled')->default(false);
            $table->boolean('manual_enabled')->default(true);
            $table->boolean('automatic_enabled')->default(false);
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->unsignedInteger('interval_seconds')->default(300);
            $table->unsignedInteger('batch_limit')->default(500);
            $table->string('date_column', 64)->default('date_added');
            $table->string('sort_column', 64)->default('date_added');
            $table->enum('sort_direction', ['asc', 'desc'])->default('desc');
            $table->string('delimiter', 20)->default('TAB');
            $table->enum('line_ending', ['LF', 'CRLF'])->default('LF');
            $table->string('record_terminator', 80)->default('ENDRECORD');
            $table->enum('terminator_mode', ['once', 'per_record'])->default('once');
            $table->boolean('include_header')->default(false);
            $table->string('encoding', 30)->default('UTF-8');
            $table->string('filename_pattern', 180)->default('edi_{profile}_{datetime}.txt');
            $table->enum('destination_type', ['cache_csp', 'http', 'sftp', 'file', 'email', 'manual'])->default('manual');
            $table->text('destination_config')->nullable();
            $table->text('credentials')->nullable();
            $table->unsignedInteger('max_attempts')->default(3);
            $table->text('retry_backoff')->nullable();
            $table->string('timezone', 64)->default('Asia/Manila');
            $table->dateTime('last_run_at')->nullable();
            $table->dateTime('next_run_at')->nullable();
            $table->dateTime('last_success_at')->nullable();
            $table->text('last_error')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('created_by')->nullable();
            $table->unsignedInteger('updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('edi_profile_fields', function (Blueprint $table) {
            $table->id('field_id');
            $table->foreignId('profile_id')->constrained('edi_profiles', 'profile_id')->cascadeOnDelete();
            $table->string('source_column', 64);
            $table->string('output_name', 100)->nullable();
            $table->unsignedInteger('output_order');
            $table->string('transform', 40)->nullable();
            $table->text('default_value')->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->boolean('is_required')->default(false);
            $table->timestamps();
            $table->unique(['profile_id', 'output_order']);
        });

        Schema::create('edi_dispatch_batches', function (Blueprint $table) {
            $table->id('batch_id');
            $table->foreignId('profile_id')->constrained('edi_profiles', 'profile_id')->cascadeOnDelete();
            $table->enum('trigger_type', ['manual', 'automatic', 'retry'])->default('manual');
            $table->enum('status', ['queued', 'processing', 'sent', 'failed', 'cancelled'])->default('queued');
            $table->unsignedInteger('record_count')->default(0);
            $table->string('filename', 180)->nullable();
            $table->string('payload_hash', 128)->nullable()->index();
            $table->text('payload_path')->nullable();
            $table->dateTime('queued_at');
            $table->dateTime('started_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->text('last_error')->nullable();
            $table->unsignedInteger('requested_by')->nullable();
            $table->timestamps();
        });

        Schema::create('edi_dispatch_records', function (Blueprint $table) {
            $table->id('dispatch_record_id');
            $table->foreignId('batch_id')->constrained('edi_dispatch_batches', 'batch_id')->cascadeOnDelete();
            $table->string('source_table', 40);
            $table->unsignedBigInteger('source_id');
            $table->string('record_hash', 128)->nullable();
            $table->timestamps();
            $table->unique(['batch_id', 'source_table', 'source_id']);
        });

        Schema::create('edi_dispatch_attempts', function (Blueprint $table) {
            $table->id('attempt_id');
            $table->foreignId('batch_id')->constrained('edi_dispatch_batches', 'batch_id')->cascadeOnDelete();
            $table->unsignedInteger('attempt_number');
            $table->enum('status', ['started', 'success', 'failed'])->default('started');
            $table->unsignedSmallInteger('response_code')->nullable();
            $table->text('response_body')->nullable();
            $table->text('error_message')->nullable();
            $table->dateTime('started_at');
            $table->dateTime('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['batch_id', 'attempt_number']);
        });

        Schema::create('edi_outbound_artifacts', function (Blueprint $table) {
            $table->id('artifact_id');
            $table->foreignId('batch_id')->constrained('edi_dispatch_batches', 'batch_id')->cascadeOnDelete();
            $table->string('artifact_type', 30)->default('payload');
            $table->string('filename', 180);
            $table->text('storage_path');
            $table->string('sha256', 64)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->dateTime('created_at');
        });

        $profiles = [
            ['HMM - Client 75', 75, 'HMM', 'END OF FILE', 100, 'cache_csp', 'Legacy index.php; five-minute refresh; source client 75.'],
            ['CKLINE - Client 77', 77, 'CKLINE', 'ENDRECORD', 500, 'cache_csp', 'Legacy index2.php and EDICKLINE trigger.'],
            ['MSC - Client 67', 67, 'MSC', 'ENDRECORD', 500, 'sftp', 'Legacy index3.php; MSC SFTP route uses /To_MSC/CODECO/.'],
            ['Client 93', 93, 'CLIENT_93', 'ENDRECORD', 500, 'cache_csp', 'Legacy index5.php. Confirm destination before enabling.'],
            ['Client 7 - Class Variant', 7, 'CLIENT_7', 'ENDRECORD', 500, 'cache_csp', 'Legacy index6.php includes class as the final field.'],
            ['Client 18', 18, 'CLIENT_18', 'ENDRECORD', 500, 'cache_csp', 'Legacy index7.php/index9.php. Confirm destination before enabling.'],
        ];

        $fields = [
            'i_id', 'gate_status', 'date_added', 'container_no', 'client_id', 'container_status',
            'size_type', 'vessel', 'voyage', 'origin', 'ex_consignee', 'load_type', 'plate_no',
            'hauler', 'hauler_driver', 'license_no', 'location', 'chasis', 'booking', 'shipper',
            'seal_no', 'remarks',
        ];

        foreach ($profiles as [$name, $clientId, $legacyKey, $terminator, $limit, $destination, $notes]) {
            $profileId = DB::table('edi_profiles')->insertGetId([
                'profile_name' => $name,
                'client_id' => $clientId,
                'legacy_key' => $legacyKey,
                'edi_type' => 'CODECO',
                'source_table' => 'inventory',
                'is_enabled' => false,
                'manual_enabled' => true,
                'automatic_enabled' => false,
                'interval_seconds' => 300,
                'batch_limit' => $limit,
                'record_terminator' => $terminator,
                'terminator_mode' => 'once',
                'destination_type' => $destination,
                'destination_config' => json_encode($destination === 'sftp'
                    ? ['remote_path' => '/To_MSC/CODECO/', 'legacy_staging_path' => 'HUB_EDI/MSC/TEMP']
                    : ['endpoint' => 'http://localhost:57772/csp/tbs-edi/CNTMovement.csp']),
                'retry_backoff' => json_encode([60, 300, 900]),
                'notes' => $notes,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($fields as $order => $field) {
                DB::table('edi_profile_fields')->insert([
                    'profile_id' => $profileId,
                    'source_column' => $field,
                    'output_order' => $order + 1,
                    'transform' => $field === 'remarks' ? 'strip_line_breaks' : null,
                    'is_enabled' => true,
                    'is_required' => in_array($field, ['i_id', 'container_no', 'client_id'], true),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            if ($legacyKey === 'CLIENT_7') {
                DB::table('edi_profile_fields')->insert([
                    'profile_id' => $profileId,
                    'source_column' => 'class',
                    'output_order' => count($fields) + 1,
                    'is_enabled' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('edi_outbound_artifacts');
        Schema::dropIfExists('edi_dispatch_attempts');
        Schema::dropIfExists('edi_dispatch_records');
        Schema::dropIfExists('edi_dispatch_batches');
        Schema::dropIfExists('edi_profile_fields');
        Schema::dropIfExists('edi_profiles');
    }
};

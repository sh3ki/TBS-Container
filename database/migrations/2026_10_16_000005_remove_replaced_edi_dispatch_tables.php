<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // These legacy tables are empty and are replaced by edi_transactions and edi_delivery_logs.
        Schema::dropIfExists('edi_outbound_artifacts');
        Schema::dropIfExists('edi_dispatch_attempts');
        Schema::dropIfExists('edi_dispatch_records');
        Schema::dropIfExists('edi_dispatch_batches');
    }

    public function down(): void
    {
        // Reversal is intentionally omitted; the replacement tables are the source of truth.
    }
};

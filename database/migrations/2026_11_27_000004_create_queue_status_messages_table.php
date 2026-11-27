<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('queue_status_messages', function (Blueprint $table): void {
            $table->id();
            $table->enum('status', [
                'waiting',
                'calling',
                'arrived',
                'floating',
                'serving',
                'completed',
                'forfeited',
            ])->unique();
            $table->text('message');
        });

        DB::table('queue_status_messages')->insert([
            [
                'status' => 'waiting',
                'message' => 'Thank you for checking in with TBS Container Yard. Your truck is now in the queue. We kindly ask for your patience while we arrange your entry.',
            ],
            [
                'status' => 'calling',
                'message' => 'Your truck is now being called. Kindly proceed to the designated gate when instructed by our personnel. Thank you for your cooperation.',
            ],
            [
                'status' => 'arrived',
                'message' => 'Your truck has arrived at TBS Container Yard. Kindly remain available and follow the instructions of our gate personnel. Thank you.',
            ],
            [
                'status' => 'floating',
                'message' => 'We sincerely apologize for the delay. Your truck remains in the queue and will be called again when ready. Thank you for your patience and understanding.',
            ],
            [
                'status' => 'serving',
                'message' => 'Your truck is now being served by TBS Container Yard. Kindly follow the instructions of our operations team. Thank you for your cooperation.',
            ],
            [
                'status' => 'completed',
                'message' => 'Your transaction at TBS Container Yard has been completed. Thank you very much for your patience and cooperation. We wish you a safe trip.',
            ],
            [
                'status' => 'forfeited',
                'message' => 'We sincerely apologize, but your queue slot has expired. Kindly coordinate with TBS Container Yard personnel so we can assist you.',
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('queue_status_messages');
    }
};

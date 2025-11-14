<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * This creates the fjp_scheduled_notifications table for the multi-channel
     * notification system (Email, SMS, Phone, Fax).
     * 
     * Based on legacy MX.PAM table structure from TBS module.
     */
    public function up(): void
    {
        Schema::create('fjp_scheduled_notifications', function (Blueprint $table) {
            $table->id('pam_id');
            
            // User references
            $table->integer('from_user')->nullable()->comment('User ID who created the notification');
            $table->integer('to_user')->nullable()->comment('User ID receiving the notification');
            
            // Timing
            $table->datetime('sent_date')->nullable()->comment('When notification was created');
            $table->datetime('trigger_date')->nullable()->comment('When to send the notification');
            
            // Message content
            $table->string('type', 100)->nullable()->comment('Type: Booking, Invoice, Reminder, etc.');
            $table->text('message')->nullable()->comment('The actual message content');
            
            // Delivery channels (Boolean flags)
            $table->boolean('screen')->default(false)->comment('Show on-screen notification');
            $table->boolean('email1')->default(false)->comment('Send to personal email');
            $table->boolean('email2')->default(false)->comment('Send to office email');
            $table->boolean('sms1')->default(false)->comment('Send SMS to personal mobile');
            $table->boolean('sms2')->default(false)->comment('Send SMS to office mobile');
            $table->boolean('tel1')->default(false)->comment('Call home phone');
            $table->boolean('tel2')->default(false)->comment('Call office phone');
            $table->boolean('mobile1')->default(false)->comment('Call personal mobile');
            $table->boolean('mobile2')->default(false)->comment('Call office mobile');
            $table->boolean('fax1')->default(false)->comment('Fax to home');
            $table->boolean('fax2')->default(false)->comment('Fax to office');
            
            // Acknowledgment tracking
            $table->boolean('ack_required')->default(false)->comment('Requires delivery confirmation');
            $table->datetime('ack_date')->nullable()->comment('When notification was delivered');
            $table->text('ack_message')->nullable()->comment('Delivery confirmation message');
            
            // Delivery status
            $table->boolean('delivered')->default(false)->comment('Has been delivered');
            $table->integer('retry_count')->default(0)->comment('Number of delivery attempts');
            $table->text('error_message')->nullable()->comment('Last error message if failed');
            
            // Additional fields
            $table->string('to_email', 255)->nullable()->comment('Override email address');
            $table->string('to_phone', 20)->nullable()->comment('Override phone number');
            $table->string('to_address', 255)->nullable()->comment('Generic to address');
            
            // Soft delete
            $table->boolean('deleted')->default(false)->comment('Soft delete flag');
            
            $table->index(['trigger_date', 'delivered']);
            $table->index(['to_user', 'delivered']);
            $table->index(['type', 'trigger_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fjp_scheduled_notifications');
    }
};

<?php

namespace App\Console\Commands;

use App\Jobs\CheckExpiringBookings;
use Illuminate\Console\Command;

class CheckBookingsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'bookings:check-expiring';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Manually trigger booking expiration check job';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('🔄 Starting booking expiration check job...');
        
        CheckExpiringBookings::dispatch();
        
        $this->info('✅ Booking expiration check job dispatched successfully!');
        $this->info('💡 Check logs for details on expiring bookings.');
        
        return Command::SUCCESS;
    }
}

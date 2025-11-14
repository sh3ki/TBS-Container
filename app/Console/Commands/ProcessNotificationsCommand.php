<?php

namespace App\Console\Commands;

use App\Jobs\ProcessScheduledNotifications;
use Illuminate\Console\Command;

class ProcessNotificationsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'notifications:process';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Manually trigger notification processing job to send pending notifications';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('🔄 Starting notification processing job...');
        
        ProcessScheduledNotifications::dispatch();
        
        $this->info('✅ Notification processing job dispatched successfully!');
        $this->info('💡 Check logs for details on notifications sent.');
        
        return Command::SUCCESS;
    }
}

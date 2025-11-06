<?php

namespace App\Console\Commands;

use App\Jobs\ForceLogoffUsers;
use Illuminate\Console\Command;

class ForceLogoffCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'jobs:force-logoff';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Manually trigger force logoff job to logout users after shift ended';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('🔄 Starting force logoff job...');
        
        ForceLogoffUsers::dispatch();
        
        $this->info('✅ Force logoff job dispatched successfully!');
        $this->info('💡 Check logs for details on users logged off.');
        
        return Command::SUCCESS;
    }
}

<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class CreateSyncToken extends Command
{
    protected $signature = 'sync:create-token {username : Existing Laravel username}';
    protected $description = 'Create a restricted token for the local legacy database synchronizer';

    public function handle(): int
    {
        $user = User::where('username', strtolower($this->argument('username')))->first();
        if (!$user) {
            $this->error('User not found.');
            return self::FAILURE;
        }

        $token = $user->createToken('legacy-sync', ['sync:read', 'sync:report']);
        $this->info('Copy this token to the local sync configuration. It will not be shown again:');
        $this->line($token->plainTextToken);
        return self::SUCCESS;
    }
}

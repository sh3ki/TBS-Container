#!/usr/bin/env bash
set -euo pipefail

cd /var/www/tbscontainermnl
php artisan tinker --execute="\$provider = auth()->guard('web')->getProvider(); \$user = \$provider->retrieveByCredentials(['username'=>'admin']); echo (\$user ? 'USER_FOUND' : 'USER_MISSING') . PHP_EOL; if (\$user) { echo (\$provider->validateCredentials(\$user, ['password'=>'admin123']) ? 'PASSWORD_OK' : 'PASSWORD_BAD') . PHP_EOL; }"

<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Auth\Events\Failed;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureViews();
        $this->configureRateLimiting();
        $this->configureAuditLogging();
    }

    /**
     * Configure Fortify views.
     */
    private function configureViews(): void
    {
        Fortify::loginView(fn (Request $request) => Inertia::render('auth/login', [
            'canResetPassword' => Features::enabled(Features::resetPasswords()),
            'status' => $request->session()->get('status'),
        ]));

        Fortify::verifyEmailView(fn (Request $request) => Inertia::render('auth/verify-email', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::twoFactorChallengeView(fn () => Inertia::render('auth/two-factor-challenge'));

        Fortify::confirmPasswordView(fn () => Inertia::render('auth/confirm-password'));
    }

    /**
     * Configure rate limiting.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('two-factor', function (Request $request) {
            return Limit::perMinute(5)->by($request->session()->get('login.id'));
        });

        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });
    }

    /**
     * Configure audit logging for authentication events.
     */
    private function configureAuditLogging(): void
    {
        // Log successful logins
        Event::listen(Login::class, function (Login $event) {
            try {
                if ($event->user) {
                    DB::table('audit_logs')->insert([
                        'action' => 'LOGIN',
                        'description' => '[AUTH] User logged in: Username: "' . $event->user->username . '", Full Name: "' . $event->user->full_name . '"',
                        'user_id' => $event->user->user_id,
                        'date_added' => now(),
                        'ip_address' => request()->ip(),
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('Failed to log login audit: ' . $e->getMessage());
            }
        });

        // Log failed login attempts
        Event::listen(Failed::class, function (Failed $event) {
            try {
                if ($event->user) {
                    DB::table('audit_logs')->insert([
                        'action' => 'LOGIN',
                        'description' => '[AUTH] Failed login attempt: Username: "' . $event->user->username . '"',
                        'user_id' => $event->user->user_id,
                        'date_added' => now(),
                        'ip_address' => request()->ip(),
                    ]);
                } else {
                    // Log failed attempt with credentials (username only, never password)
                    $username = $event->credentials['username'] ?? 'Unknown';
                    DB::table('audit_logs')->insert([
                        'action' => 'LOGIN',
                        'description' => '[AUTH] Failed login attempt: Username: "' . $username . '" (user not found)',
                        'user_id' => null,
                        'date_added' => now(),
                        'ip_address' => request()->ip(),
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('Failed to log failed login audit: ' . $e->getMessage());
            }
        });

        // Log logouts
        Event::listen(Logout::class, function (Logout $event) {
            try {
                if ($event->user) {
                    DB::table('audit_logs')->insert([
                        'action' => 'LOGOUT',
                        'description' => '[AUTH] User logged out: Username: "' . $event->user->username . '", Full Name: "' . $event->user->full_name . '"',
                        'user_id' => $event->user->user_id,
                        'date_added' => now(),
                        'ip_address' => request()->ip(),
                    ]);
                }
            } catch (\Exception $e) {
                Log::error('Failed to log logout audit: ' . $e->getMessage());
            }
        });
    }
}

<?php

namespace Tests\Feature\Auth;

use App\Http\Controllers\Api\UsersController;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LegacyAuthenticationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.default' => 'legacy_auth_test',
            'database.connections.legacy_auth_test' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
            ],
        ]);

        Schema::create('users', function (Blueprint $table) {
            $table->increments('user_id');
            $table->string('username')->unique();
            $table->string('password');
            $table->string('salt');
            $table->string('full_name');
            $table->string('email')->unique();
            $table->integer('priv_id');
            $table->string('checker_id')->nullable();
            $table->dateTime('date_added')->nullable();
            $table->boolean('archived')->default(false);
            $table->rememberToken();
        });
        Schema::create('privileges', function (Blueprint $table) {
            $table->integer('p_code');
            $table->string('description');
        });
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->string('action');
            $table->text('description');
            $table->integer('user_id')->nullable();
            $table->dateTime('date_added');
            $table->string('ip_address')->nullable();
        });
        Schema::create('pages', function (Blueprint $table) {
            $table->increments('p_id');
            $table->string('page');
            $table->string('page_name');
            $table->string('page_icon')->nullable();
            $table->integer('arrange_no');
        });
        Schema::create('pages_access', function (Blueprint $table) {
            $table->integer('page_id');
            $table->integer('privilege');
            $table->boolean('acs_edit');
            $table->boolean('acs_delete');
        });
    }

    public static function passwordFormats(): array
    {
        return [
            'MD5 old salt' => ['md5', 'a0bw1'],
            'MD5 new salt' => ['md5', '034c4'],
            'SHA1 old salt' => ['sha1', 'a0bw1'],
            'SHA1 new salt' => ['sha1', '034c4'],
            'bcrypt' => ['bcrypt', '034c4'],
        ];
    }

    #[DataProvider('passwordFormats')]
    public function test_login_accepts_correct_credentials_and_rejects_incorrect_credentials(string $format, string $salt): void
    {
        $password = 'Correct-password1!';
        $user = User::create([
            'username' => 'MixedCase_User',
            'password' => match ($format) {
                'md5' => md5($password.$salt),
                'sha1' => sha1($salt.sha1($password).sha1($salt)),
                'bcrypt' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 4]),
            },
            'salt' => $salt,
            'full_name' => 'Test User',
            'email' => 'test@example.com',
            'priv_id' => 1,
            'archived' => false,
        ]);

        foreach ([
            ['username' => 'mixedcase_user', 'password' => 'wrong-password'],
            ['username' => 'unknown-user', 'password' => $password],
        ] as $credentials) {
            $this->from('/login')->withHeaders(['X-Inertia' => 'true'])
                ->post(route('login.store'), $credentials)
                ->assertRedirect('/login')
                ->assertSessionHasErrors('username');
            $this->assertGuest();
        }

        $this->withHeaders(['X-Inertia' => 'true'])->post(route('login.store'), [
            'username' => 'MIXEDCASE_USER',
            'password' => $password,
        ])->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($user);
        $this->assertDatabaseHas('users', [
            'user_id' => $user->user_id,
            'password' => $user->password,
            'salt' => $salt,
        ]);
    }

    public function test_user_created_by_user_page_can_log_in(): void
    {
        DB::table('privileges')->insert(['p_code' => 1, 'description' => 'Test Role']);
        $request = Request::create('/api/users', 'POST', [
            'username' => 'new_user',
            'password' => 'New-password1!',
            'full_name' => 'New User',
            'email' => 'new@example.com',
            'priv_id' => 1,
        ]);

        $response = app(UsersController::class)->store($request);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertTrue($response->getData()->success);

        $user = User::where('username', 'new_user')->firstOrFail();
        $this->withHeaders(['X-Inertia' => 'true'])->post(route('login.store'), [
            'username' => 'new_user',
            'password' => 'New-password1!',
        ])->assertRedirect(route('dashboard'));

        $this->assertAuthenticatedAs($user);
    }

    #[DataProvider('passwordFormats')]
    public function test_archived_accounts_cannot_log_in(string $format, string $salt): void
    {
        User::create([
            'username' => 'archived_user',
            'password' => match ($format) {
                'md5' => md5('password'.$salt),
                'sha1' => sha1($salt.sha1('password').sha1($salt)),
                'bcrypt' => password_hash('password', PASSWORD_BCRYPT, ['cost' => 4]),
            },
            'salt' => $salt,
            'full_name' => 'Archived User',
            'email' => 'archived@example.com',
            'priv_id' => 1,
            'archived' => true,
        ]);

        $this->from('/login')->withHeaders(['X-Inertia' => 'true'])
            ->post(route('login.store'), [
                'username' => 'archived_user',
                'password' => 'password',
            ])
            ->assertRedirect('/login')
            ->assertSessionHasErrors('username');

        $this->assertGuest();
    }
}

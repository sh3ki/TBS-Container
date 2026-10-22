<?php

use App\Auth\LegacyHasher;

dataset('legacy password formats', [
    'MD5 with old salt' => ['md5', 'a0bw1'],
    'MD5 with generated salt' => ['md5', '034c4'],
    'SHA1 with old salt' => ['sha1', 'a0bw1'],
    'SHA1 with generated salt' => ['sha1', '034c4'],
    'SHA1 with long salt' => ['sha1', str_repeat('ab', 16)],
    'bcrypt' => ['bcrypt', '034c4'],
]);

test('password verification supports stored password formats', function (string $format, string $salt) {
    $password = 'Correct-password1!';
    $hash = match ($format) {
        'md5' => md5($password.$salt),
        'sha1' => sha1($salt.sha1($password).sha1($salt)),
        'bcrypt' => password_hash($password, PASSWORD_BCRYPT, ['cost' => 4]),
    };
    $hasher = new LegacyHasher;

    expect($hasher->check($password, $hash, ['salt' => $salt]))->toBeTrue()
        ->and($hasher->check('wrong-password', $hash, ['salt' => $salt]))->toBeFalse()
        ->and($hasher->check(strtolower($password), $hash, ['salt' => $salt]))->toBeFalse()
        ->and($hasher->check($hash, $hash, ['salt' => $salt]))->toBeFalse();

    if ($format !== 'bcrypt') {
        expect($hasher->check($password, $hash, ['salt' => 'wrong-salt']))->toBeFalse();
    }
})->with('legacy password formats');

test('empty and malformed password hashes are rejected', function () {
    $hasher = new LegacyHasher;

    foreach (['', 'not-a-hash', str_repeat('0', 32), str_repeat('0', 40)] as $hash) {
        expect($hasher->check('password', $hash, ['salt' => '034c4']))->toBeFalse();
    }
});

test('generated SHA1 credentials still verify with their generated salt', function () {
    $hasher = new LegacyHasher;
    $credentials = $hasher->makeWithSalt('password');

    expect($hasher->check('password', $credentials['hash'], ['salt' => $credentials['salt']]))->toBeTrue();
});

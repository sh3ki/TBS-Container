<?php

namespace App\Auth;

use Illuminate\Contracts\Hashing\Hasher as HasherContract;

class LegacyHasher implements HasherContract
{
    /**
     * Hash the given value using legacy algorithm.
     * Legacy: SHA1(CONCAT(salt, SHA1(password), SHA1(salt)))
     *
     * @param string $value
     * @param array $options
     * @return string
     */
    public function make($value, array $options = [])
    {
        $salt = $options['salt'] ?? $this->generateSalt();
        
        // Just return the hash - salt should be stored separately in database
        return $this->hashWithSalt($value, $salt);
    }

    /**
     * Make hash and return both hash and salt.
     * Use this when creating new users.
     *
     * @param string $value
     * @return array
     */
    public function makeWithSalt($value)
    {
        $salt = $this->generateSalt();
        
        return [
            'hash' => $this->hashWithSalt($value, $salt),
            'salt' => $salt,
        ];
    }

    /**
     * Check the given plain value against a hash.
     *
     * @param string $value
     * @param string $hashedValue
     * @param array $options
     * @return bool
     */
    public function check($value, $hashedValue, array $options = [])
    {
        if (strlen($hashedValue) === 0) {
            return false;
        }

        // Check if this is a bcrypt hash (modern Laravel hash)
        if (str_starts_with($hashedValue, '$2y$') || str_starts_with($hashedValue, '$2a$') || str_starts_with($hashedValue, '$2b$')) {
            return password_verify($value, $hashedValue);
        }

        // Otherwise use legacy SHA1 hashing
        $salt = $options['salt'] ?? '';
        
        return $this->hashWithSalt($value, $salt) === $hashedValue;
    }

    /**
     * Check if the given hash has been hashed using the given options.
     *
     * @param string $hashedValue
     * @param array $options
     * @return bool
     */
    public function needsRehash($hashedValue, array $options = [])
    {
        // Legacy hashes don't need rehashing
        return false;
    }

    /**
     * Hash password with salt using legacy algorithm.
     *
     * @param string $password
     * @param string $salt
     * @return string
     */
    protected function hashWithSalt($password, $salt)
    {
        // Legacy algorithm: SHA1(CONCAT(salt, SHA1(password), SHA1(salt)))
        return sha1($salt . sha1($password) . sha1($salt));
    }

    /**
     * Generate a random salt.
     *
     * @return string
     */
    protected function generateSalt()
    {
        return bin2hex(random_bytes(16));
    }

    /**
     * Get information about the given hashed value.
     *
     * @param string $hashedValue
     * @return array
     */
    public function info($hashedValue)
    {
        return [
            'algo' => 'legacy-sha1',
            'algoName' => 'legacy',
        ];
    }
}

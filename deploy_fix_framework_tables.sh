#!/usr/bin/env bash
set -euo pipefail

DB_NAME="fjpwl_sys_db"
PREFIX="fjp_"

mysql -u root -D "$DB_NAME" -e "
CREATE TABLE IF NOT EXISTS \`${PREFIX}sessions\` (
  \`id\` varchar(255) NOT NULL,
  \`user_id\` bigint unsigned DEFAULT NULL,
  \`ip_address\` varchar(45) DEFAULT NULL,
  \`user_agent\` text,
  \`payload\` longtext NOT NULL,
  \`last_activity\` int NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`${PREFIX}sessions_user_id_index\` (\`user_id\`),
  KEY \`${PREFIX}sessions_last_activity_index\` (\`last_activity\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"

mysql -u root -D "$DB_NAME" -e "
CREATE TABLE IF NOT EXISTS \`${PREFIX}cache\` (
  \`key\` varchar(255) NOT NULL,
  \`value\` mediumtext NOT NULL,
  \`expiration\` int NOT NULL,
  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"

mysql -u root -D "$DB_NAME" -e "
CREATE TABLE IF NOT EXISTS \`${PREFIX}cache_locks\` (
  \`key\` varchar(255) NOT NULL,
  \`owner\` varchar(255) NOT NULL,
  \`expiration\` int NOT NULL,
  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"

mysql -u root -D "$DB_NAME" -e "
CREATE TABLE IF NOT EXISTS \`${PREFIX}scheduled_notifications\` (
  \`pam_id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`from_user\` int DEFAULT NULL,
  \`to_user\` int DEFAULT NULL,
  \`sent_date\` datetime DEFAULT NULL,
  \`trigger_date\` datetime DEFAULT NULL,
  \`type\` varchar(100) DEFAULT NULL,
  \`message\` text,
  \`screen\` tinyint(1) NOT NULL DEFAULT 0,
  \`email1\` tinyint(1) NOT NULL DEFAULT 0,
  \`email2\` tinyint(1) NOT NULL DEFAULT 0,
  \`sms1\` tinyint(1) NOT NULL DEFAULT 0,
  \`sms2\` tinyint(1) NOT NULL DEFAULT 0,
  \`tel1\` tinyint(1) NOT NULL DEFAULT 0,
  \`tel2\` tinyint(1) NOT NULL DEFAULT 0,
  \`mobile1\` tinyint(1) NOT NULL DEFAULT 0,
  \`mobile2\` tinyint(1) NOT NULL DEFAULT 0,
  \`fax1\` tinyint(1) NOT NULL DEFAULT 0,
  \`fax2\` tinyint(1) NOT NULL DEFAULT 0,
  \`ack_required\` tinyint(1) NOT NULL DEFAULT 0,
  \`ack_date\` datetime DEFAULT NULL,
  \`ack_message\` text,
  \`delivered\` tinyint(1) NOT NULL DEFAULT 0,
  \`retry_count\` int NOT NULL DEFAULT 0,
  \`error_message\` text,
  \`to_email\` varchar(255) DEFAULT NULL,
  \`to_phone\` varchar(20) DEFAULT NULL,
  \`to_address\` varchar(255) DEFAULT NULL,
  \`deleted\` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (\`pam_id\`),
  KEY \`${PREFIX}scheduled_notifications_trigger_delivered_index\` (\`trigger_date\`,\`delivered\`),
  KEY \`${PREFIX}scheduled_notifications_to_user_delivered_index\` (\`to_user\`,\`delivered\`),
  KEY \`${PREFIX}scheduled_notifications_type_trigger_index\` (\`type\`,\`trigger_date\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"

cd /var/www/tbscontainermnl
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

chown -R www-data:www-data /var/www/tbscontainermnl/storage /var/www/tbscontainermnl/bootstrap/cache
chmod -R 775 /var/www/tbscontainermnl/storage /var/www/tbscontainermnl/bootstrap/cache

systemctl restart php8.3-fpm

echo "[OK] Framework tables verified (sessions/cache/cache_locks)"

#!/usr/bin/env bash
set -euo pipefail

DB_PASS="$(cat /root/tbs_db_password.txt)"
mysql -e "CREATE DATABASE IF NOT EXISTS tbs_container CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "GRANT ALL PRIVILEGES ON tbs_container.* TO \"tbs_user\"@\"localhost\"; FLUSH PRIVILEGES;"

echo "[OK] Added compatibility DB: tbs_container"

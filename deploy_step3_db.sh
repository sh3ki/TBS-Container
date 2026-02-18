#!/usr/bin/env bash
set -euo pipefail

DB_PASS="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"

mysql -e "CREATE DATABASE IF NOT EXISTS tbscontainermnl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS \"tbs_user\"@\"localhost\" IDENTIFIED BY '${DB_PASS}';"
mysql -e "ALTER USER \"tbs_user\"@\"localhost\" IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON tbscontainermnl.* TO \"tbs_user\"@\"localhost\"; FLUSH PRIVILEGES;"

echo "${DB_PASS}" > /root/tbs_db_password.txt
chmod 600 /root/tbs_db_password.txt

echo "[OK] Database ready"
echo "[OK] Credentials file: /root/tbs_db_password.txt"

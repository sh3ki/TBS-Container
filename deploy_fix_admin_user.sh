#!/usr/bin/env bash
set -euo pipefail

DB_NAME="fjpwl_sys_db"

PRIV_ID="$(mysql -N -B -D "$DB_NAME" -e "SELECT p_code FROM fjp_privileges ORDER BY p_code ASC LIMIT 1;")"
if [ -z "$PRIV_ID" ]; then
  PRIV_ID=1
fi

SALT="$(tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 5)"
HASH="$(mysql -N -B -D "$DB_NAME" -e "SELECT SHA1(CONCAT('${SALT}', SHA1('admin123'), SHA1('${SALT}')));")"

ADMIN_ID="$(mysql -N -B -D "$DB_NAME" -e "SELECT user_id FROM fjp_users WHERE LOWER(username)='admin' LIMIT 1;")"

if [ -n "$ADMIN_ID" ]; then
  mysql -D "$DB_NAME" -e "
    UPDATE fjp_users
    SET username='admin',
        password='${HASH}',
        salt='${SALT}',
        archived=0,
        priv_id=${PRIV_ID}
    WHERE user_id=${ADMIN_ID};
  "
  echo "[OK] Updated existing admin user (ID: ${ADMIN_ID})"
else
  mysql -D "$DB_NAME" -e "
    INSERT INTO fjp_users (full_name, username, password, salt, email, priv_id, date_added, archived, checker_id)
    VALUES ('System Administrator', 'admin', '${HASH}', '${SALT}', 'admin@tbscontainermnl.com', ${PRIV_ID}, NOW(), 0, '');
  "
  NEW_ID="$(mysql -N -B -D "$DB_NAME" -e "SELECT user_id FROM fjp_users WHERE LOWER(username)='admin' ORDER BY user_id DESC LIMIT 1;")"
  echo "[OK] Created admin user (ID: ${NEW_ID})"
fi

echo "[OK] Credentials set: username=admin, password=admin123"

#!/usr/bin/env bash
set -euo pipefail

mysql -N -B -D fjpwl_sys_db -e "SELECT user_id, username, archived, LENGTH(password) AS pass_len, LENGTH(salt) AS salt_len FROM fjp_users WHERE LOWER(username)='admin' LIMIT 5;"

#!/usr/bin/env bash
set -euo pipefail

echo "--- DB CHECK ---"
mysql -N -B -e "SHOW DATABASES LIKE 'tbscontainermnl';"

echo "--- USER CHECK ---"
mysql -N -B -e "SELECT user,host FROM mysql.user WHERE user='tbs_user';"

echo "--- PASS FILE CHECK ---"
wc -c /root/tbs_db_password.txt

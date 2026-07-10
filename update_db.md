tbs_user
pBjBBG13GGVMcatqYJyVwydr

mysql -u tbs_user -p 
use fjpwl_sys_db;
DROP TABLE IF EXISTS fjp_cache;
DROP TABLE IF EXISTS fjp_cache_locks;


update db on deployed:
scp C:/Users/USER/Downloads/local_data.sql root@72.60.42.105:/root/
mysql -u tbs_user -p fjpwl_sys_db << EOF
SET FOREIGN_KEY_CHECKS=0;

-- Truncate all tables
TRUNCATE TABLE fjp_audit_logs;
TRUNCATE TABLE fjp_ban_containers;
TRUNCATE TABLE fjp_bookings;
TRUNCATE TABLE fjp_checkers;
TRUNCATE TABLE fjp_clients;
TRUNCATE TABLE fjp_client_reg_hours;
TRUNCATE TABLE fjp_container_size_type;
TRUNCATE TABLE fjp_container_status;
TRUNCATE TABLE fjp_handling_rate;
TRUNCATE TABLE fjp_hold_containers;
TRUNCATE TABLE fjp_inventory;
TRUNCATE TABLE fjp_load_type;
TRUNCATE TABLE fjp_pages;
TRUNCATE TABLE fjp_pages_access;
TRUNCATE TABLE fjp_pre_inventory;
TRUNCATE TABLE fjp_privileges;
TRUNCATE TABLE fjp_storage_rate;
TRUNCATE TABLE fjp_users;
TRUNCATE TABLE fjp_email_automation_logs;
TRUNCATE TABLE fjp_email_reply_queue;
TRUNCATE TABLE fjp_fjp_scheduled_notifications;
TRUNCATE TABLE fjp_login_history;
TRUNCATE TABLE fjp_personal_access_tokens;
TRUNCATE TABLE fjp_user_privileges;
TRUNCATE TABLE fjp_user_schedules;

SET FOREIGN_KEY_CHECKS=1;
EOF


mysql -u tbs_user -p fjpwl_sys_db < /root/local_data.sql
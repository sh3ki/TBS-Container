#!/bin/bash

# Database Import Script for Server
# Run this script on your VPS server after uploading tbs_db.sql

echo "🗄️  TBS Container - Database Import Script"
echo "=========================================="
echo ""

DB_FILE="/tmp/tbs_db.sql"
DB_NAME="tbs_container"
DB_USER="tbs_user"
DB_PASS="TbsSecure2025!"

# Check if database file exists
if [ ! -f "$DB_FILE" ]; then
    echo "❌ Error: Database file not found at $DB_FILE"
    echo "   Please upload it first using:"
    echo "   scp C:\\Users\\USER\\Documents\\SYSTEMS\\WEB\\PHP\\LARAVEL\\fjpwl\\tbs_db.sql root@72.60.42.105:/tmp/tbs_db.sql"
    exit 1
fi

# Get file size
FILE_SIZE=$(du -h "$DB_FILE" | cut -f1)
echo "📊 Database file size: $FILE_SIZE"
echo ""

# Import database
echo "📥 Importing database into $DB_NAME..."
echo "   This may take a few minutes for large databases..."
echo ""

mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$DB_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database imported successfully!"
    echo ""
    
    # Clean up
    echo "🧹 Cleaning up temporary file..."
    rm "$DB_FILE"
    echo "✅ Temporary file removed"
    echo ""
    
    echo "📊 Database statistics:"
    mysql -u "$DB_USER" -p"$DB_PASS" -e "SELECT COUNT(*) as 'Total Tables' FROM information_schema.tables WHERE table_schema = '$DB_NAME';" 2>/dev/null
    echo ""
    
    echo "✅ All done! You can now run the specific migrations:"
    echo "   cd /var/www/tbscontainermnl"
    echo "   php artisan migrate --path=/database/migrations/2025_11_14_000002_change_audit_logs_description_to_text.php --force"
    echo "   php artisan migrate --path=/database/migrations/2025_11_14_100000_add_all_database_indexes.php --force"
else
    echo ""
    echo "❌ Database import failed!"
    echo "   Please check the error messages above and try again."
    exit 1
fi

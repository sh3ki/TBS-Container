# FJPWL System Migration Plan
## Legacy PHP to Laravel + React

**Date Created:** October 21, 2025  
**Status:** In Progress

---

## Executive Summary

This document outlines the complete migration strategy for rebuilding the FJPWL Warehousing & Logistics system from a legacy PHP application to a modern Laravel + React SPA architecture.

### Key Objectives
- ✅ Use existing Laravel + React setup in `fjpwl` folder
- ✅ Connect to existing MySQL database without schema changes
- ✅ Re-implement ALL features with 1:1 feature parity
- ✅ Modernize UI/UX with responsive React components
- ✅ Implement background jobs using Laravel Queue/Scheduler
- ✅ Deploy to Hostinger (shared/cloud hosting)

---

## Phase 1: Environment Setup & Database Connection

### 1.1 Database Configuration
- [x] Analyze legacy database structure
- [ ] Configure Laravel `.env` for existing MySQL database
- [ ] Create Eloquent models for all existing tables
- [ ] Test database connectivity

**Database Details (from legacy):**
```
Host: localhost
Database: fjpwl_sys_db
Username: fjp_user
Password: g8y1URb6gDbnH0Lz
Prefix: fjp_
```

### 1.2 Laravel Setup
- [x] Laravel project exists in `fjpwl` folder
- [ ] Install additional dependencies (PDF, Excel, etc.)
- [ ] Configure session, cache, queue drivers
- [ ] Set up API routes structure

---

## Phase 2: Core Features Migration

### 2.1 Authentication & Authorization Module
**Legacy Files:**
- `controller/login/LoginController.php`
- `controller/logout/`
- `controller/users/`
- `system/Session.php`

**Implementation Plan:**
- [ ] Create authentication API endpoints (Laravel Fortify/Sanctum)
- [ ] Implement role-based permissions system
- [ ] Create User model with relationships
- [ ] Password encryption (match legacy: SHA1 with salt)
- [ ] Session management
- [ ] Audit log integration for login/logout

**Database Tables:**
- `fjp_users`
- `fjp_privileges`
- `fjp_pages_access`
- `fjp_pages`

**React Components:**
- [ ] Login page
- [ ] User management dashboard
- [ ] Role & permission management

---

### 2.2 Clients Management Module
**Legacy Files:**
- `controller/clients/ClientsController.php`
- `view/clients/`

**Features to Implement:**
- [ ] CRUD operations for clients
- [ ] Client search & filtering
- [ ] Import/Export (Excel/CSV)
- [ ] Audit logging for all operations
- [ ] Archive/restore functionality

**Database Tables:**
- `fjp_clients`

**API Endpoints:**
```
GET    /api/clients              # List with pagination
POST   /api/clients              # Create new client
GET    /api/clients/{id}         # Get single client
PUT    /api/clients/{id}         # Update client
DELETE /api/clients/{id}         # Soft delete (archive)
GET    /api/clients/export       # Export to Excel
POST   /api/clients/import       # Import from Excel
```

**React Components:**
- [ ] ClientList (data table with search/filter)
- [ ] ClientForm (add/edit modal)
- [ ] ClientDetails (view details)
- [ ] Import/Export buttons

---

### 2.3 Bookings & Reservations Module
**Legacy Files:**
- `controller/booking/BookingController.php`
- `view/booking/`

**Features to Implement:**
- [ ] CRUD operations for bookings
- [ ] Container list management (20', 40', 45')
- [ ] Booking number validation
- [ ] Expiration date tracking
- [ ] Status updates
- [ ] Notifications (email/SMS) on booking events
- [ ] Search by booking number, client, dates

**Database Tables:**
- `fjp_bookings`

**Fields:**
- book_no, client_id, shipper
- twenty, fourty, fourty_five (container quantities)
- twenty_rem, fourty_rem, fourty_five_rem (remaining)
- cont_list, cont_list_rem (container numbers)
- expiration_date, date_added, user_id

**API Endpoints:**
```
GET    /api/bookings
POST   /api/bookings
GET    /api/bookings/{id}
PUT    /api/bookings/{id}
DELETE /api/bookings/{id}
POST   /api/bookings/{id}/notify  # Send notifications
```

---

### 2.4 Billing & Invoicing Module
**Legacy Files:**
- `controller/billing/BillingController.php`
- `view/billing/`

**Features to Implement:**
- [ ] Invoice CRUD operations
- [ ] PDF generation (using Laravel DomPDF)
- [ ] Payment tracking
- [ ] Multiple payment status (Pending, Paid, Overdue)
- [ ] Send invoice via email
- [ ] Export to Excel
- [ ] Billing reports

**API Endpoints:**
```
GET    /api/invoices
POST   /api/invoices
GET    /api/invoices/{id}
PUT    /api/invoices/{id}
DELETE /api/invoices/{id}
GET    /api/invoices/{id}/pdf         # Generate PDF
POST   /api/invoices/{id}/email       # Email invoice
PUT    /api/invoices/{id}/payment     # Update payment status
```

---

### 2.5 Inventory Management Module
**Legacy Files:**
- `controller/inventory/*`
- `view/inventory/`

**Features to Implement:**
- [ ] Stock item CRUD
- [ ] Stock tracking (in/out movements)
- [ ] Low stock alerts
- [ ] Inventory reports
- [ ] Export to Excel

**API Endpoints:**
```
GET    /api/inventory
POST   /api/inventory
GET    /api/inventory/{id}
PUT    /api/inventory/{id}
DELETE /api/inventory/{id}
POST   /api/inventory/movement      # Record stock movement
GET    /api/inventory/reports       # Various reports
```

---

### 2.6 Gate-In/Gate-Out Operations Module
**Legacy Files:**
- `controller/gateinout/GateinoutController.php`
- `view/gateinout/`

**Features to Implement:**
- [ ] Container gate-in recording
- [ ] Container gate-out recording
- [ ] Container tracking logs
- [ ] Search by container number
- [ ] Date range filtering
- [ ] Export reports

**Database Tables:**
- `fjp_gate_in` / `fjp_gate_out` (or similar)

**API Endpoints:**
```
GET    /api/gate-in
POST   /api/gate-in
GET    /api/gate-out
POST   /api/gate-out
GET    /api/gate-logs/{container_no}
GET    /api/gate-reports
```

---

### 2.7 Reports Module
**Legacy Files:**
- `controller/reports/*`
- `controller/reportstmp/*`
- `view/reports/`

**Features to Implement:**
- [ ] Various report types (bookings, billing, inventory, etc.)
- [ ] Date range filtering
- [ ] Export to PDF
- [ ] Export to Excel
- [ ] Real-time data visualization (charts)

**Report Types:**
- Daily/Monthly/Yearly summaries
- Client-wise reports
- Container movement reports
- Financial reports
- Inventory reports

**API Endpoints:**
```
GET    /api/reports/bookings
GET    /api/reports/billing
GET    /api/reports/inventory
GET    /api/reports/gate-operations
POST   /api/reports/generate/{type}  # Generate custom report
GET    /api/reports/{id}/pdf
GET    /api/reports/{id}/excel
```

---

### 2.8 Audit Logs Module
**Legacy Files:**
- `controller/audit/AuditController.php`
- `view/audit/`

**Features to Implement:**
- [ ] Log all user actions (login, CRUD operations, etc.)
- [ ] View audit trail
- [ ] Filter by user, date, action type
- [ ] Export audit logs

**Database Tables:**
- `fjp_audit_logs`

**Fields:**
- user_id, action_type, description, ip_address, timestamp

**API Endpoints:**
```
GET    /api/audit-logs
GET    /api/audit-logs/filter
GET    /api/audit-logs/export
```

---

### 2.9 Bancon & Size Type Modules
**Legacy Files:**
- `controller/bancon/BanconController.php`
- `controller/sizetype/`

**Features to Implement:**
- [ ] Implement as per legacy logic
- [ ] CRUD operations
- [ ] Integration with other modules

---

## Phase 3: Background Jobs & Automation

### 3.1 Force Logoff Background Job
**Legacy Path:** `public/cron/FORCE_LOGOFF/index.php`

**Purpose:** Automatically log out users after shift ends

**Implementation:**
```php
// app/Console/Commands/ForceLogoff.php
// Schedule: Hourly or daily at midnight
```

**Logic:**
1. Query users with active sessions
2. Check if shift end time has passed
3. Update `dt_stamp_end` field
4. Send notification to admins (optional)

**Laravel Scheduler:**
```php
// app/Console/Kernel.php
$schedule->command('users:force-logoff')->hourly();
```

---

### 3.2 Email Automation System (PAM Module)
**Legacy Path:** `public/php/tbs/web/export.ro`

**Purpose:** Multi-channel notification system

**Channels Supported:**
- Email (Personal & Office)
- SMS (Personal & Office Mobile)
- Phone Calls
- Fax

**Implementation Strategy:**

#### Database Table: `mx_pam`
```
from_user, to_user, sent_date, trigger_date
type, message, screen, email1, email2
sms1, sms2, tel1, tel2, mobile1, mobile2
fax1, fax2, ack_required, ack_date, ack_message
```

#### Laravel Implementation:
```php
// app/Models/Notification.php
// app/Jobs/SendScheduledNotification.php
// app/Notifications/MultiChannelNotification.php
```

**Laravel Notification Channels:**
- Email: Built-in
- SMS: Custom channel (integrate with SMS gateway)
- Phone/Fax: Custom channels

**Background Worker:**
```php
// Process notifications every 45 seconds
$schedule->job(new ProcessScheduledNotifications)->everyMinute();
```

**Configuration (`.env`):**
```env
SMTP_HOST=smtp.bizmail.yahoo.com
SMTP_PORT=587
SMTP_USERNAME=pam@mx-sys.com
SMTP_PASSWORD=xxxxx

SMS_GATEWAY_URL=http://172.16.1.91:80/sendsms
SMS_GATEWAY_USER=admin
SMS_GATEWAY_PASSWORD=passw0rd
```

---

### 3.3 Incoming Email Processing
**Purpose:** Process incoming emails (POP3)

**Implementation:**
```php
// app/Console/Commands/ProcessIncomingEmails.php
// Uses: webklex/php-imap package
```

**Process Flow:**
1. Connect to POP3 server
2. Download emails
3. Save attachments
4. Process specific email types (YARD FILE, AGENT FILE)
5. Send confirmation emails

**Schedule:** Every 5-10 minutes
```php
$schedule->command('emails:process-incoming')->everyTenMinutes();
```

---

### 3.4 Scheduled Notifications
**Trigger Types:**
- Booking confirmation
- Invoice reminders
- Payment due alerts
- Expiration warnings
- Low stock alerts

**Implementation:**
```php
// app/Jobs/SendBookingNotification.php
// app/Jobs/SendInvoiceReminder.php
// app/Jobs/SendExpirationWarning.php
```

**Usage Example:**
```php
// When booking is created
Notification::create([
    'to_user' => $client->email,
    'trigger_date' => now(),
    'type' => 'Booking Confirmation',
    'message' => 'Your booking #' . $booking->book_no . ' is confirmed',
    'email1' => true,
    'sms1' => true,
]);
```

---

## Phase 4: Frontend (React) Implementation

### 4.1 UI/UX Design Principles
- Modern, clean interface
- Responsive design (mobile-first)
- Consistent color scheme
- Intuitive navigation
- Fast load times

**Tech Stack:**
- React 19
- Inertia.js (Laravel adapter)
- Tailwind CSS
- Radix UI (components)
- Lucide React (icons)

---

### 4.2 Layout Structure
```
resources/js/
├── components/
│   ├── ui/              # Reusable UI components (buttons, inputs, etc.)
│   ├── layout/          # Layout components (header, sidebar, footer)
│   └── modules/         # Feature-specific components
├── pages/
│   ├── Auth/
│   │   ├── Login.tsx
│   │   └── ForgotPassword.tsx
│   ├── Dashboard/
│   │   └── Index.tsx
│   ├── Clients/
│   │   ├── Index.tsx
│   │   ├── Create.tsx
│   │   ├── Edit.tsx
│   │   └── Show.tsx
│   ├── Bookings/
│   │   └── ...
│   ├── Billing/
│   │   └── ...
│   ├── Inventory/
│   │   └── ...
│   ├── GateOperations/
│   │   └── ...
│   ├── Reports/
│   │   └── ...
│   ├── Users/
│   │   └── ...
│   └── AuditLogs/
│       └── ...
├── hooks/               # Custom React hooks
├── utils/               # Helper functions
├── types/               # TypeScript types
└── app.tsx              # Root component
```

---

### 4.3 Key Components to Build

#### Authentication
- [ ] Login form
- [ ] Password reset
- [ ] Session timeout warning

#### Dashboard
- [ ] Overview statistics cards
- [ ] Recent activity feed
- [ ] Quick action buttons
- [ ] Charts (bookings, revenue, etc.)

#### Data Tables
- [ ] ClientsTable (search, sort, pagination)
- [ ] BookingsTable
- [ ] InvoicesTable
- [ ] InventoryTable
- [ ] GateLogsTable
- [ ] AuditLogsTable

#### Forms
- [ ] ClientForm (add/edit)
- [ ] BookingForm
- [ ] InvoiceForm
- [ ] InventoryForm
- [ ] UserForm

#### Modals
- [ ] Confirmation dialogs
- [ ] Detail view modals
- [ ] Notification settings

#### Reports
- [ ] Report filters (date range, type, etc.)
- [ ] Export buttons (PDF, Excel)
- [ ] Charts (using Recharts or similar)

---

### 4.4 State Management
**Approach:** Inertia.js handles most state management

**Additional Libraries (if needed):**
- React Query (for caching API data)
- Zustand (for global state)

---

### 4.5 API Integration Pattern
```typescript
// Example: Fetch clients
import { router } from '@inertiajs/react';

const fetchClients = () => {
  router.get('/clients', {
    page: 1,
    search: searchTerm,
  });
};

// Create client
const createClient = (data) => {
  router.post('/clients', data, {
    onSuccess: () => {
      // Show success toast
    },
    onError: (errors) => {
      // Show validation errors
    },
  });
};
```

---

## Phase 5: Additional Features & Integrations

### 5.1 PDF Generation
**Package:** `barryvdh/laravel-dompdf`

**Use Cases:**
- Invoices
- Reports
- Booking confirmations
- Gate receipts

**Example:**
```php
use PDF;

$pdf = PDF::loadView('pdf.invoice', ['invoice' => $invoice]);
return $pdf->download('invoice-' . $invoice->id . '.pdf');
```

---

### 5.2 Excel Export/Import
**Package:** `maatwebsite/excel`

**Features:**
- Export clients, bookings, inventory, etc.
- Import bulk data from Excel/CSV
- Custom formatting

**Example:**
```php
use App\Exports\ClientsExport;
use Maatwebsite\Excel\Facades\Excel;

return Excel::download(new ClientsExport, 'clients.xlsx');
```

---

### 5.3 SMS Integration
**Gateway:** Custom SMS gateway at `http://172.16.1.91:80/sendsms`

**Implementation:**
```php
// app/Services/SmsService.php
public function sendSms($mobile, $message) {
    // Format mobile number
    // Call SMS gateway API
    // Log result
}
```

**Laravel Notification:**
```php
// app/Notifications/SmsNotification.php
public function toSms($notifiable) {
    return (new SmsMessage)
        ->content($this->message);
}
```

---

### 5.4 LDAP Integration (Optional)
**Legacy Config:**
```
domain: ldaps://172.16.0.34:636
base_dn: dc=csi,dc=lan
```

**Implementation:**
```php
// app/Services/LdapService.php
// Use: adldap2/adldap2-laravel
```

---

## Phase 6: Security & Validation

### 6.1 Authentication Security
- [ ] Password hashing (match legacy: SHA1 with salt)
- [ ] Session timeout (match legacy behavior)
- [ ] CSRF protection (Laravel built-in)
- [ ] XSS prevention
- [ ] SQL injection prevention (Eloquent ORM)

### 6.2 Authorization
- [ ] Role-based access control (RBAC)
- [ ] Page-level permissions
- [ ] Record-level permissions (edit/delete flags)
- [ ] API route protection (middleware)

### 6.3 Input Validation
- [ ] Server-side validation (Laravel Form Requests)
- [ ] Client-side validation (React Hook Form)
- [ ] Sanitization of user inputs

### 6.4 Audit Logging
- [ ] Log all user actions
- [ ] IP address tracking
- [ ] Timestamp all activities
- [ ] Middleware for automatic logging

**Implementation:**
```php
// app/Http/Middleware/AuditLog.php
public function handle($request, Closure $next) {
    // Log request details
    return $next($request);
}
```

---

## Phase 7: Testing

### 7.1 Backend Testing
- [ ] Unit tests for models
- [ ] Feature tests for API endpoints
- [ ] Integration tests for background jobs
- [ ] Test notification sending

**Example:**
```php
// tests/Feature/ClientTest.php
public function test_can_create_client() {
    $response = $this->post('/api/clients', [
        'client_name' => 'Test Client',
        'client_code' => 'TC001',
        // ...
    ]);
    
    $response->assertStatus(201);
}
```

### 7.2 Frontend Testing
- [ ] Component tests (React Testing Library)
- [ ] E2E tests (Playwright/Cypress)

---

## Phase 8: Deployment (Hostinger)

### 8.1 Hosting Options
**Recommended:** Hostinger VPS or Cloud Hosting

**Requirements:**
- PHP 8.1+
- MySQL 8.0+
- Node.js 18+ (for build process)
- Composer
- Supervisor (for queue workers)
- Cron (for scheduler)

---

### 8.2 Deployment Steps

#### Step 1: Server Setup
```bash
# SSH into server
ssh user@your-server-ip

# Install dependencies
sudo apt update
sudo apt install php8.1 php8.1-cli php8.1-mysql php8.1-xml php8.1-mbstring php8.1-curl php8.1-zip
sudo apt install mysql-server
sudo apt install composer
sudo apt install supervisor
```

#### Step 2: Deploy Laravel
```bash
# Clone/upload project
cd /var/www/
git clone your-repo.git fjpwl

# Install dependencies
cd fjpwl
composer install --optimize-autoloader --no-dev

# Set permissions
sudo chown -R www-data:www-data /var/www/fjpwl
sudo chmod -R 755 /var/www/fjpwl/storage

# Copy environment file
cp .env.example .env
nano .env  # Edit database credentials

# Generate app key
php artisan key:generate

# Optimize
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

#### Step 3: Build Frontend
```bash
# On local machine (build assets)
npm install
npm run build

# Upload build/manifest to server
# Files go to public/build/
```

#### Step 4: Configure Database
```bash
# No migrations needed (using existing DB)
# Test connection
php artisan tinker
>>> DB::connection()->getPdo();
```

#### Step 5: Configure Queue Worker
```bash
# Create supervisor config
sudo nano /etc/supervisor/conf.d/fjpwl-worker.conf
```

**Config:**
```ini
[program:fjpwl-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/fjpwl/artisan queue:work database --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/fjpwl/storage/logs/worker.log
stopwaitsecs=3600
```

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start fjpwl-worker:*
```

#### Step 6: Configure Scheduler
```bash
# Add to crontab
crontab -e

# Add line:
* * * * * cd /var/www/fjpwl && php artisan schedule:run >> /dev/null 2>&1
```

#### Step 7: Configure Web Server (Apache)
```bash
sudo nano /etc/apache2/sites-available/fjpwl.conf
```

**Config:**
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    ServerAdmin admin@your-domain.com
    DocumentRoot /var/www/fjpwl/public

    <Directory /var/www/fjpwl/public>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/fjpwl-error.log
    CustomLog ${APACHE_LOG_DIR}/fjpwl-access.log combined
</VirtualHost>
```

```bash
sudo a2ensite fjpwl.conf
sudo a2enmod rewrite
sudo systemctl restart apache2
```

#### Step 8: SSL Certificate (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d your-domain.com
```

---

### 8.3 Post-Deployment Checklist
- [ ] Test all modules
- [ ] Verify background jobs are running
- [ ] Test email sending
- [ ] Test SMS sending
- [ ] Check logs for errors
- [ ] Performance testing
- [ ] Security audit

---

## Phase 9: Documentation

### 9.1 Technical Documentation
- [ ] API documentation (Postman/OpenAPI)
- [ ] Database schema reference
- [ ] Deployment guide
- [ ] Environment variables reference
- [ ] Background jobs reference

### 9.2 User Documentation
- [ ] User manual
- [ ] Admin guide
- [ ] Video tutorials (optional)

---

## Phase 10: Maintenance & Monitoring

### 10.1 Logging
- [ ] Application logs (Laravel)
- [ ] Error logs
- [ ] Queue job logs
- [ ] Background job logs

### 10.2 Monitoring
- [ ] Server resource monitoring
- [ ] Database performance
- [ ] Queue job status
- [ ] Email/SMS delivery rates

### 10.3 Backups
- [ ] Daily database backups
- [ ] Weekly file system backups
- [ ] Offsite backup storage

---

## Timeline Estimate

| Phase | Estimated Time | Status |
|-------|---------------|--------|
| Phase 1: Setup | 1-2 days | 🟡 In Progress |
| Phase 2: Core Features | 2-3 weeks | ⚪ Pending |
| Phase 3: Background Jobs | 3-5 days | ⚪ Pending |
| Phase 4: Frontend | 2-3 weeks | ⚪ Pending |
| Phase 5: Additional Features | 1 week | ⚪ Pending |
| Phase 6: Security | 2-3 days | ⚪ Pending |
| Phase 7: Testing | 1 week | ⚪ Pending |
| Phase 8: Deployment | 2-3 days | ⚪ Pending |
| Phase 9: Documentation | 3-5 days | ⚪ Pending |
| **Total** | **6-8 weeks** | - |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Database schema unknown | High | Analyze legacy code thoroughly |
| Complex background jobs | Medium | Use Laravel Queue/Scheduler |
| SMS gateway integration | Low | Custom notification channel |
| Legacy password hashing | Medium | Maintain compatibility |
| Deployment complexity | Medium | Document thoroughly |

---

## Success Criteria

- ✅ All features from legacy system working
- ✅ No data loss or corruption
- ✅ Modern, responsive UI
- ✅ Background jobs running reliably
- ✅ Successfully deployed to Hostinger
- ✅ Performance improvements over legacy
- ✅ Complete documentation

---

## Next Steps

1. ✅ Create migration plan (this document)
2. Configure `.env` with existing database
3. Start with authentication module
4. Proceed with other modules one by one
5. Test thoroughly after each module
6. Deploy to staging environment
7. User acceptance testing
8. Production deployment

---

**END OF MIGRATION PLAN**

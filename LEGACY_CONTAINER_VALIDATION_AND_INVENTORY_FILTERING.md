# 🔍 LEGACY SYSTEM: Container Validation & Inventory Filtering
## Comprehensive Analysis of Gate OUT Container Input & Inventory Page Logic

---

## 📦 PART 1: GATE OUT CONTAINER NUMBER VALIDATION

### **How Container Input Works in Legacy System**

**Location:** `GateinoutController.php` - `getGateInfoAction()` (Line 632)

### **Step-by-Step Process:**

#### **1. User Types Container Number**
```javascript
// gateout.js - Line 127
$('#g-cno').on('keyup', function(ev) {
    if(ev.which == 13) {  // When user presses ENTER
        $.ajax({
            url: route.page + '/getGateInfo',
            type: 'post',
            data: { cno: $(this).val() },
            success: function(response) {
                var json = $.parseJSON(response);
                if(json['result'] == 'success') {
                    // Enable all fields and pre-fill data
                    enableFields();
                } else {
                    // Show error message
                    warningBox('c-check-warning','Message Alert',json['message'],'show-box');
                }
            }
        });
    }
});
```

---

#### **2. Backend Validates Container (3 Critical Checks)**

**Method:** `checkContainerOutInnerAction()` - Lines 224-252

```php
private function checkContainerOutInnerAction($cno) {
    $db = $this->dbOpen();
    
    // ✅ CHECK 1: Container must be IN yard
    $is_valid = $db->execQuery("
        SELECT container_no 
        FROM inventory 
        WHERE container_no = :cno 
          AND gate_status = 'IN'      -- Must be gated IN
          AND complete = 0             -- Must not be completed (not already OUT)
    ", array(':cno'=>$cno, ':in'=>'IN', ':complete'=>0), "count");
    
    if($is_valid > 0) {
        // ✅ CHECK 2: Container must NOT be on HOLD
        $is_hold = $db->execQuery("
            SELECT container_no, notes 
            FROM hold_containers 
            WHERE container_no = :cno
        ", array(':cno'=>$cno), "rows");
        
        if(count($is_hold) === 0) {
            // ✅ PASSED ALL CHECKS
            return [true, "Valid container number!"];
        } else {
            // ❌ FAILED: Container is on HOLD
            return [false, "Container is currently on hold!"];
        }
    } else {
        // ❌ FAILED: Container not IN yard
        return [false, "Container number is not gate in yet!"];
    }
}
```

---

#### **3. If Valid, Retrieve Container Details**

**Method:** `getGateInfoAction()` - Lines 632-667

```php
public function getGateInfoAction() {
    $db = $this->dbOpen();
    $cno = $this->get_req['cno'];
    
    // Call validation method
    $get_res = $this->checkContainerOutInnerAction($cno);
    
    if($get_res[0] === true) {
        // ✅ Container is VALID - Fetch details
        $inf = $db->execQuery("
            SELECT 
                i_id, 
                container_no, 
                client_id, 
                container_status,
                size_type, 
                iso_code, 
                remarks, 
                load_type, 
                approval_notes 
            FROM inventory 
            WHERE container_no = :cno 
              AND gate_status = 'IN'
            ORDER BY i_id DESC
        ", array(':cno'=>$cno, ':in'=>'IN'), "rows");
        
        // Return container info to frontend
        foreach($inf as $ci) {
            $tmp['cno'] = $ci['container_no'];
            $tmp['client'] = MD5($ci['client_id']);
            $tmp['status'] = MD5($ci['container_status']);
            $tmp['sizetype'] = MD5($ci['size_type']);
            $tmp['iso'] = $ci['iso_code'];
            $tmp['remarks'] = $ci['remarks'];
            $tmp['appnotes'] = $ci['approval_notes'];
            $tmp['load'] = MD5($ci['load_type']);
            $continfo[] = $tmp;
        }
        
        return ['gin'=>$continfo, 'result'=>'success', 'message'=>'Valid container number!'];
    } else {
        // ❌ Container is INVALID
        return ['gin'=>[], 'result'=>'danger', 'message'=>$get_res[1]];
    }
}
```

---

### **📋 VALIDATION SUMMARY: Gate OUT Container Input**

| Check # | Validation | SQL Condition | Error Message |
|---------|-----------|---------------|---------------|
| **1** | Container must be IN yard | `gate_status='IN' AND complete=0` | **"Container number is not gate in yet!"** |
| **2** | Container must NOT be on HOLD | `NOT EXISTS in hold_containers` | **"Container is currently on hold!"** |
| **3** | Container must exist | Record found in `inventory` | **"Valid container number!"** ✅ |

---

### **🔒 HOLD CONTAINERS TABLE Structure**

```sql
-- Table: hold_containers
CREATE TABLE hold_containers (
    container_no VARCHAR(11) PRIMARY KEY,
    notes TEXT,                    -- Reason for hold
    date_added DATETIME,
    user_id INT
);

-- Example hold record:
INSERT INTO hold_containers VALUES 
('FFAU5927415', 'Payment pending - Client owes $5,000', '2025-11-10 10:30:00', 5);
```

**How HOLD Works:**
1. Admin/Billing adds container to `hold_containers` table
2. When checker tries to gate OUT, system checks if container exists in `hold_containers`
3. If found: **REJECT** with hold notes
4. If not found: **ALLOW** gate out

---

## 📊 PART 2: INVENTORY PAGE FILTERING & DISPLAY LOGIC

### **Location:** `InventoryController.php` - `searchContainersAction()` (Lines 15-290)

---

### **🎯 KEY FILTERING OPTIONS**

#### **1. Gate Status Filter (Primary Filter)**

**Options:**
- **CURRENTLY** - Only containers IN yard (not gated out yet)
- **IN** - All gated IN transactions
- **OUT** - All gated OUT transactions  
- **BOTH** - All transactions (IN + OUT)

```php
// Line 138-157
if($gatestatus === 'CURRENTLY') {
    // Show only containers IN yard right now
    $filter_date .= "(i.gate_status = 'IN' AND i.complete = 0)";
    
} else if($gatestatus === 'IN') {
    // Show all gated IN transactions
    $filter_date .= "(i.gate_status = 'IN')";
    
} else if($gatestatus === 'OUT') {
    // Show all gated OUT transactions
    $filter_date .= "(i.gate_status = 'OUT')";
    
} else if($gatestatus === 'BOTH') {
    // Show both IN and OUT
    $filter_date .= "((i.gate_status = 'IN') OR (i.gate_status = 'OUT'))";
}
```

---

#### **2. Date Range Filter**

**Gate IN Date Range:**
```php
if(!empty($gifdate) && !empty($gitdate)) {
    // Filter by date_added between gifdate and gitdate
    $filter_date .= "DATE(i.date_added) BETWEEN :infrom AND :into";
}
```

**Gate OUT Date Range:**
```php
if(!empty($gofdate) && !empty($gotdate)) {
    // Filter by date_added between gofdate and gotdate
    $filter_date .= "DATE(i.date_added) BETWEEN :outfrom AND :outto";
}
```

---

#### **3. Advanced Search Filters**

| Filter | Field | Search Type |
|--------|-------|-------------|
| **Client** | `i.client_id` | Exact match (MD5) |
| **Container No.** | `i.container_no` | LIKE '%...%' |
| **Origin** | `i.origin` | LIKE '%...%' |
| **Consignee** | `i.ex_consignee` | LIKE '%...%' |
| **Hauler IN** | `i.hauler` | LIKE '%...%' |
| **Vessel IN** | `i.vessel` | LIKE '%...%' |
| **Plate No. IN** | `i.plate_no` | LIKE '%...%' |
| **Status IN** | `cs.status` | LIKE '%...%' |
| **Size** | `st.size` | Exact match |
| **Type** | `st.type` | Exact match |
| **ISO Code** | `i.iso_code` | LIKE '%...%' |
| **Hauler OUT** | `i.hauler` | LIKE '%...%' |
| **Vessel OUT** | `i.vessel` | LIKE '%...%' |
| **Shipper** | `i.shipper` | LIKE '%...%' |
| **Destination** | `i.location` | LIKE '%...%' |
| **Booking** | `i.booking` | LIKE '%...%' |
| **Seal No.** | `i.seal_no` | LIKE '%...%' |
| **Contact No.** | `i.contact_no` | LIKE '%...%' |
| **Bill of Lading** | `i.bill_of_lading` | LIKE '%...%' |

---

### **🗃️ MAIN INVENTORY QUERY**

**Lines 163-228:**

```sql
SELECT 
    MD5(i.i_id) i_id,
    CASE 
        WHEN i.gate_status='IN' THEN CONCAT(i.i_id,'I')
        ELSE CONCAT(i.i_id,'O')
    END eirno,
    i.container_no,
    CONCAT(st.size, st.type) size_type,
    DATE(i.date_added) date,
    DATE_FORMAT(i.date_added, '%H:%i') time,
    cs.status container_status,
    i.class,
    DATE_FORMAT(i.date_manufactured,'%Y-%m') date_manufactured,
    i.location,
    i.remarks,
    i.gate_status,
    
    -- Calculate total days in yard
    CASE WHEN i.gate_status='IN' THEN
        CASE WHEN i.complete = 0 THEN 
            DATEDIFF(CURRENT_DATE, SUBDATE(DATE(i.date_added), INTERVAL 1 DAY))
        ELSE
            DATEDIFF(DATE(o.date_added), SUBDATE(DATE(i.date_added), INTERVAL 1 DAY)) 
        END
    ELSE
        DATEDIFF(DATE(o.date_added), SUBDATE(DATE(i.date_added), INTERVAL 1 DAY))
    END total_days,
    
    -- Client name (code or name)
    CASE WHEN c.client_code IS NOT NULL AND c.client_code <> '' 
        THEN c.client_code 
        ELSE c.client_name 
    END client,
    
    -- HOLD STATUS (Critical for UI display)
    CASE 
        WHEN i.complete=0 AND i.gate_status='IN' THEN
            CASE WHEN hc.container_no IS NOT NULL THEN
                2  -- ⚠️ ON HOLD
            ELSE
                1  -- ✅ AVAILABLE
            END
        ELSE
            0  -- ⏹️ COMPLETED (already gated OUT)
    END hold,
    
    -- Approval notes
    CASE WHEN i.gate_status='IN' THEN
        CASE WHEN i.approval_notes IS NULL THEN '' ELSE i.approval_notes END
    ELSE
        (SELECT approval_notes FROM inventory WHERE out_id=i.i_id LIMIT 1)
    END app_notes,
    
    -- Approval date
    CASE WHEN DATE(i.approval_date) IS NULL OR DATE(i.approval_date)='0000-00-00' THEN
        'N/A'
    ELSE
        DATE(i.approval_date)
    END app_date,
    
    -- Check if already gated out
    CASE WHEN i.out_id = 0 OR i.out_id IS NULL THEN
        0
    ELSE
        i.out_id
    END is_out,
    
    st.size size,
    hc.notes notes  -- Hold notes (reason)
    
FROM inventory i
LEFT JOIN inventory o ON i.out_id = o.i_id  -- Link to OUT record
LEFT JOIN container_status cs ON i.container_status = cs.s_id
LEFT JOIN container_size_type st ON i.size_type = st.s_id
LEFT JOIN clients c ON c.c_id = i.client_id
LEFT JOIN hold_containers hc ON hc.container_no = i.container_no  -- Check HOLD status

WHERE
    {filter_date conditions}
    AND c.archived = 0  -- Exclude archived clients
    
ORDER BY 
    i.size_type ASC,
    i.date_added DESC
```

---

### **🎨 HOLD STATUS DISPLAY LOGIC**

**Value in `hold` column:**
- **0** = Completed (already gated OUT) - Gray/Disabled
- **1** = Available (can gate OUT) - Normal display
- **2** = On Hold (cannot gate OUT) - Red/Warning with hold notes

**Example UI Display:**
```javascript
// Frontend (inventory.js)
if(record.hold == 2) {
    // Show RED badge or warning icon
    html += '<span class="badge badge-danger">ON HOLD</span>';
    html += '<small>' + record.notes + '</small>';  // Show hold reason
    
} else if(record.hold == 1) {
    // Show AVAILABLE
    html += '<span class="badge badge-success">AVAILABLE</span>';
    
} else {
    // Already completed
    html += '<span class="badge badge-secondary">COMPLETED</span>';
}
```

---

### **📌 KEY INVENTORY TABLE CONDITIONS**

#### **Containers "Currently in Yard" (MOST IMPORTANT)**
```sql
WHERE gate_status = 'IN' 
  AND complete = 0
  AND archived = 0  -- Client not archived
```

**What this means:**
- Container was gated IN
- Has NOT been gated OUT yet (`complete = 0`)
- Client is still active

---

#### **Available for Gate OUT**
```sql
WHERE gate_status = 'IN' 
  AND complete = 0
  AND NOT EXISTS (SELECT 1 FROM hold_containers WHERE container_no = i.container_no)
```

**What this means:**
- Container is IN yard
- Not completed
- NOT in hold_containers table

---

#### **All Historical Transactions**
```sql
WHERE c.archived = 0  -- Only active clients
ORDER BY date_added DESC
```

No restrictions on `gate_status` or `complete` - shows everything.

---

## 🔄 COMPLETE WORKFLOW: Gate OUT Process

### **Step-by-Step with Validation:**

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: USER NAVIGATES TO GATE OUT FORM                     │
│ - Opens /gateinout/out?procin={id}                          │
│ - Form shows pre-filled plate number and hauler             │
│ - Container number field is EMPTY                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: USER TYPES CONTAINER NUMBER + PRESS ENTER           │
│ - JavaScript captures keyup event (Enter key)               │
│ - Sends AJAX to /gateinout/getGateInfo                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: BACKEND VALIDATES CONTAINER (3 CHECKS)              │
│                                                              │
│ ✅ CHECK 1: Is container IN yard?                           │
│    SELECT FROM inventory                                     │
│    WHERE container_no = X                                    │
│      AND gate_status = 'IN'                                  │
│      AND complete = 0                                        │
│    IF count = 0 → ERROR: "Not gate in yet!"                 │
│                                                              │
│ ✅ CHECK 2: Is container on HOLD?                           │
│    SELECT FROM hold_containers                               │
│    WHERE container_no = X                                    │
│    IF count > 0 → ERROR: "Currently on hold!" + show notes  │
│                                                              │
│ ✅ CHECK 3: Fetch container details                         │
│    SELECT client_id, status, size_type, iso_code, etc.      │
│    FROM inventory WHERE container_no = X AND gate_status='IN'│
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: IF VALID - PRE-FILL FORM FIELDS                     │
│ - ISO Code (from inventory)                                 │
│ - Client (from inventory, dropdown disabled)                │
│ - Size/Type (from inventory, dropdown disabled)             │
│ - Load Type (from inventory)                                │
│ - Remarks (from gate IN record)                             │
│ - Approval Notes (from gate IN record)                      │
│ - Enable all other fields for input                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: USER FILLS REMAINING FIELDS                         │
│ - Vessel, Voyage, Checker                                   │
│ - Hauler Driver, License No.                                │
│ - Location, Chasis, Booking, Shipper, Seal No.              │
│ - Contact No., Remarks                                      │
│ - Save and Book (YES/NO)                                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: USER CLICKS "SAVE & PRINT"                          │
│ - JavaScript validates all 20 fields                        │
│ - Submits form to /gateinout/addGateOut                     │
│ - If Save and Book = YES: Opens external booking system     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: BACKEND FINAL VALIDATION                            │
│ - Validates booking number exists                           │
│ - Validates booking has remaining slots                     │
│ - Validates shipper matches booking                         │
│ - Inserts new OUT record into inventory                     │
│ - Updates original IN record: complete=1, out_id=new_id     │
│ - Deducts booking remaining count                           │
│ - Updates pre_inventory: status=1, date_completed=NOW       │
│ - Generates gate pass PDF                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 8: SUCCESS - CONTAINER GATED OUT                       │
│ - Container removed from "Currently in Yard" list           │
│ - Gate pass printed                                         │
│ - Booking system opened (if Save and Book = YES)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 SUMMARY FOR MODERN SYSTEM IMPLEMENTATION

### **✅ Critical Validations to Implement:**

1. **Container Input Dropdown/Autocomplete:**
   ```typescript
   // Only show containers that are:
   // - gate_status = 'IN'
   // - complete = 0
   // - NOT in hold_containers table
   
   const availableContainers = await fetch('/api/gateinout/available-containers');
   // Returns only VALID containers for gate OUT
   ```

2. **Hold Container Check:**
   ```typescript
   // When container is selected, check hold status
   const response = await fetch(`/api/gateinout/check-container/${containerNo}`);
   if (response.hold) {
       alert(`Container is on HOLD: ${response.holdNotes}`);
       return; // Block gate OUT
   }
   ```

3. **Inventory Page Filter:**
   ```typescript
   // Add "Currently in Yard" filter (most used)
   const filters = {
       gateStatus: 'CURRENTLY',  // Shows only: gate_status='IN' AND complete=0
       dateFrom: '2025-01-01',
       dateTo: '2025-12-31',
       client: '',
       containerNo: '',
   };
   ```

---

## 🎯 RECOMMENDED MODERN UI IMPROVEMENTS

### **Gate OUT Modal - Container Selection:**
```typescript
// Instead of manual input, use searchable dropdown
<Select
    options={availableContainers}  // Only IN yard, not on hold
    onSearch={handleContainerSearch}
    placeholder="Search container number..."
    filterOption={(input, option) => 
        option.value.toLowerCase().includes(input.toLowerCase())
    }
/>

// Show container info on selection:
- Client name
- Size/Type
- Current location
- Days in yard
- Approval notes
```

### **Hold Status Badge:**
```typescript
// Show visual indicator if container is on hold
{container.hold && (
    <Badge color="red">
        ON HOLD: {container.holdNotes}
    </Badge>
)}
```

---

## 📊 DATABASE SCHEMA REFERENCE

### **Key Tables:**

```sql
-- Main inventory table
inventory (
    i_id INT PRIMARY KEY,
    container_no VARCHAR(11),
    gate_status ENUM('IN', 'OUT'),
    complete TINYINT DEFAULT 0,    -- 0=IN yard, 1=Gated OUT
    out_id INT,                     -- Links to OUT record
    client_id INT,
    -- ... many other fields
)

-- Hold containers (blocking gate OUT)
hold_containers (
    container_no VARCHAR(11) PRIMARY KEY,
    notes TEXT,                     -- Reason for hold
    date_added DATETIME,
    user_id INT
)

-- Pre-gate records
pre_inventory (
    p_id INT PRIMARY KEY,
    container_no VARCHAR(11),
    gate_status ENUM('IN', 'OUT'),
    status TINYINT DEFAULT 0,       -- 0=Pending, 1=Finished
    inv_id INT,                     -- Links to inventory after process
    -- ...
)
```

---

**END OF DOCUMENTATION**

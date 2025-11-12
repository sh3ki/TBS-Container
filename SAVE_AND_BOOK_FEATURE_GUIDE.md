# 📋 Save and Book Feature - Implementation Guide

## Date: January 12, 2025

---

## 🎯 QUESTION: What Should Happen When "Save and Book = YES"?

Based on the **legacy system** and your **current Booking page**, here's what should happen:

---

## 🔍 Legacy System Behavior

### **Legacy Code (gateout.js - Line 70):**
```javascript
if(savebook=="yes"){
    window.open("http://cdap.ph/csp/acyop-booking/admin/fjp/PreCNTBooking.csp?a=FJP||"+plateno+"||"+""+"||"+cno,"_blank")
};
```

### **What Legacy Did:**
1. ✅ Saves the Gate OUT record
2. ✅ Opens a **NEW EXTERNAL WINDOW** to a **different system** (CSP booking system)
3. ✅ Passes parameters: `plateno` (plate number) and `cno` (container number)
4. ✅ User completes booking in that external system
5. ✅ External system is at: `http://cdap.ph/csp/acyop-booking/`

**Important:** This was an **EXTERNAL SYSTEM**, not part of the main FJPWL application!

---

## 💡 Modern Approach (Your New System)

Since you now have a **built-in Booking page** (`/bookings`) in your Laravel system, you should:

### **OPTION 1: Navigate to Bookings Page with Pre-filled Data** ⭐ **RECOMMENDED**

**What happens:**
1. User clicks "Save & Print" with "Save and Book = YES"
2. Gate OUT saves successfully
3. Print window opens (auto-print)
4. **Navigates to `/bookings` page**
5. **Auto-opens Add Booking modal**
6. **Pre-fills fields** with Gate OUT data

**Advantages:**
- ✅ Keeps user in your system
- ✅ Seamless experience
- ✅ Can pre-fill more fields
- ✅ Better validation
- ✅ Audit trail maintained

---

### **OPTION 2: Open Bookings in New Tab** (Simple)

**What happens:**
1. User clicks "Save & Print" with "Save and Book = YES"
2. Gate OUT saves successfully
3. Print window opens (auto-print)
4. **Opens `/bookings` in new tab** with URL parameters
5. Bookings page detects parameters and auto-opens modal

**Advantages:**
- ✅ User can see both pages (Gate OUT and Booking)
- ✅ Similar to legacy behavior (new window)
- ✅ Easy to implement

---

## 🎨 Recommended Implementation (Option 1)

### **Step 1: Update ProcessGateOutModal.tsx**

```typescript
// ProcessGateOutModal.tsx - handleConfirm function
const handleConfirm = async () => {
    try {
        const response = await axios.post('/api/gateinout/process-out', {
            p_id: record.p_id,
            container_no: formData.container_no,
            client_id: record.client_id,
            cnt_status: parseInt(formData.status),
            checker: formData.checker,
            contact_no: formData.contact_no,
            save_and_book: formData.save_and_book,
        });

        if (response.data.success) {
            // 🖨️ AUTO-PRINT: Open print window
            const inventoryId = response.data.inventory_id;
            const printUrl = `/api/gateinout/print-gate-pass/${inventoryId}`;
            window.open(printUrl, '_blank', 'width=1280,height=800');
            
            // 📦 SAVE AND BOOK: Navigate to bookings page if YES
            if (formData.save_and_book === 'YES') {
                // Store booking data in sessionStorage for pre-filling
                sessionStorage.setItem('pendingBooking', JSON.stringify({
                    container_no: formData.container_no,
                    plate_no: record.plate_no,
                    client_id: record.client_id,
                    client_name: record.client_name,
                    hauler: record.hauler,
                    from_gate_out: true,
                }));
                
                // Navigate to bookings page
                window.location.href = '/bookings?action=create';
            } else {
                // Normal flow: close modal and refresh
                onSuccess();
                onClose();
                setShowConfirm(false);
            }
        }
    } catch (error: unknown) {
        const axiosError = error as { response?: { data?: { message?: string } } };
        alert(axiosError.response?.data?.message || 'Failed to process Gate OUT');
        setShowConfirm(false);
    }
};
```

---

### **Step 2: Update Bookings/Index.tsx**

Add logic to detect URL parameters and open modal with pre-filled data:

```typescript
// Bookings/Index.tsx - Add useEffect to check for pending booking
useEffect(() => {
    // Check if coming from Gate OUT with "Save and Book = YES"
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'create') {
        const pendingBookingData = sessionStorage.getItem('pendingBooking');
        
        if (pendingBookingData) {
            try {
                const data = JSON.parse(pendingBookingData);
                
                // Find client ID from client name
                const client = clients.find(c => 
                    c.name === data.client_name || 
                    c.code.includes(data.client_name)
                );
                
                // Pre-fill form data
                setFormData({
                    bnum: '', // User needs to enter booking number
                    cid: client?.id || '',
                    shipper: '', // User needs to enter shipper
                    two: 0,
                    four: 0,
                    fourf: 0,
                    cnums: data.container_no, // PRE-FILL container number
                    exp: '',
                });
                
                // Set booking type to "With Container List" since we have container
                setBookingType('with');
                
                // Open Add Booking modal
                setShowAddModal(true);
                
                // Clear sessionStorage
                sessionStorage.removeItem('pendingBooking');
                
                // Clean URL (remove ?action=create)
                window.history.replaceState({}, '', '/bookings');
                
                // Show info toast
                success('Container from Gate OUT ready for booking');
                
            } catch (err) {
                console.error('Failed to parse pending booking data:', err);
            }
        }
    }
}, [clients]); // Re-run when clients are loaded
```

---

### **Step 3: What Gets Pre-filled?**

| Field | Pre-filled? | Value | User Must Enter? |
|-------|------------|-------|------------------|
| **Booking Type** | ✅ YES | "With Container List" | ❌ Auto-set |
| **Booking Number** | ❌ NO | Empty | ✅ YES |
| **Client** | ✅ YES | From Gate OUT record | ❌ Pre-selected |
| **Shipper** | ❌ NO | Empty | ✅ YES |
| **Expiration Date** | ❌ NO | Empty | ✅ YES |
| **Container Numbers** | ✅ YES | Container from Gate OUT | ❌ Pre-filled |
| **20ft / 40ft / 45ft** | ❌ NO | 0 | ❌ Not needed (has container list) |

**Why these fields?**
- **Container Number:** Already known from Gate OUT ✅
- **Client:** Already known from Gate OUT ✅
- **Booking Number:** Must be unique, user provides ❌
- **Shipper:** Different from client, user provides ❌
- **Expiration Date:** User decides booking validity ❌

---

## 🔄 Complete User Flow

### **Scenario: Save and Book = YES**

```
┌─────────────────────────────────────────────────┐
│ STEP 1: Gate OUT Processing                    │
│ - User fills 5 fields                          │
│ - Sets "Save and Book" = YES                   │
│ - Clicks "Save & Print"                        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ STEP 2: Confirmation Dialog                    │
│ - "Are you sure you want to process Gate OUT?" │
│ - User clicks "Confirm Process"                │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ STEP 3: Backend Saves Data                     │
│ - POST to /api/gateinout/process-out          │
│ - Marks container as OUT in inventory          │
│ - Returns inventory_id                         │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ STEP 4: Print Window Opens                     │
│ - window.open(print-gate-pass/123)            │
│ - Browser print dialog shows                   │
│ - User can print EIR document                  │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ STEP 5: Check "Save and Book" Option           │
│ IF formData.save_and_book === 'YES':           │
│   → Store data in sessionStorage                │
│   → Navigate to /bookings?action=create         │
│ ELSE:                                           │
│   → Close modal, refresh table                  │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ STEP 6: Bookings Page Opens                    │
│ - Detects ?action=create in URL                │
│ - Reads data from sessionStorage               │
│ - Pre-fills Add Booking form                   │
│ - Opens Add Booking modal automatically        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ STEP 7: User Completes Booking                 │
│ - Booking Type: "With Container List" (set)    │
│ - Container Number: FFAU5927415 (pre-filled)   │
│ - Client: RCL FEEDERS (pre-filled)             │
│ - User enters: Booking No., Shipper, Exp Date  │
│ - Clicks "Save Booking"                        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ STEP 8: Booking Created Successfully           │
│ - Success toast: "Booking created"             │
│ - Container now has booking reference          │
│ - User can continue other tasks                │
└─────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagram

```
ProcessGateOutModal
    ↓
    ├─> [Save Data] → Backend (/api/gateinout/process-out)
    ├─> [Auto-Print] → window.open(print-gate-pass)
    └─> [Save and Book?]
            ↓
          [YES]
            ↓
        sessionStorage.setItem({
            container_no: "FFAU5927415",
            plate_no: "ABC1234",
            client_id: 123,
            client_name: "RCL FEEDERS",
            from_gate_out: true
        })
            ↓
        window.location.href = "/bookings?action=create"
            ↓
    Bookings Page (Index.tsx)
            ↓
        useEffect() detects:
            - URL param: ?action=create
            - sessionStorage: pendingBooking
            ↓
        Pre-fill formData:
            - bookingType = "with"
            - cid = client_id
            - cnums = container_no
            ↓
        setShowAddModal(true)
            ↓
        User sees modal with pre-filled data
```

---

## 🎨 Alternative: Option 2 (New Tab)

If you prefer opening bookings in a **new tab** (like legacy):

```typescript
// ProcessGateOutModal.tsx - handleConfirm
if (formData.save_and_book === 'YES') {
    // Open bookings page in new tab with parameters
    const bookingParams = new URLSearchParams({
        action: 'create',
        container: formData.container_no,
        plate: record.plate_no || '',
        client: record.client_id.toString(),
        from: 'gateout'
    });
    window.open(`/bookings?${bookingParams.toString()}`, '_blank');
    
    // Still close modal and refresh
    onSuccess();
    onClose();
    setShowConfirm(false);
}
```

Then in Bookings page, read URL parameters instead of sessionStorage:

```typescript
// Bookings/Index.tsx
useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const containerNo = urlParams.get('container');
    const clientId = urlParams.get('client');
    
    if (action === 'create' && containerNo) {
        // Pre-fill form...
        setFormData({
            ...formData,
            cnums: containerNo,
            cid: clientId || '',
        });
        setBookingType('with');
        setShowAddModal(true);
    }
}, []);
```

---

## 🆚 Comparison: Option 1 vs Option 2

| Feature | Option 1 (Navigate) | Option 2 (New Tab) |
|---------|---------------------|-------------------|
| **User Experience** | Seamless (same window) | Classic (new window) |
| **Legacy-like** | ❌ Different | ✅ Similar |
| **Data Passing** | sessionStorage | URL parameters |
| **User Can Print** | Yes (print window separate) | Yes (print window separate) |
| **User Can Go Back** | Yes (browser back) | Yes (switch tabs) |
| **Mobile Friendly** | ✅ Better | ⚠️ Tab management harder |
| **Implementation** | Medium | Easy |

---

## ✅ Recommendation

### **Use OPTION 1 (Navigate to Bookings Page)**

**Why?**
1. ✅ **Better UX:** User stays in same window, natural flow
2. ✅ **Modern:** Single-page application feel
3. ✅ **Mobile-friendly:** No tab management issues
4. ✅ **More control:** Can pre-fill more fields via sessionStorage
5. ✅ **Print still works:** Print window is separate, won't affect navigation

**Legacy system used new window because:**
- It was an **external system** (different domain)
- Old technology (CSP system)
- Had to pass data via URL parameters

**Your system is better:**
- Same application (same domain)
- Modern React/Laravel stack
- Can use sessionStorage/state management

---

## 🔧 Implementation Code

### **File 1: ProcessGateOutModal.tsx**

Add this after successful Gate OUT save:

```typescript
// Line ~126-140 in handleConfirm
if (response.data.success) {
    const inventoryId = response.data.inventory_id;
    const printUrl = `/api/gateinout/print-gate-pass/${inventoryId}`;
    window.open(printUrl, '_blank', 'width=1280,height=800');
    
    // ✅ ADD THIS: Handle "Save and Book = YES"
    if (formData.save_and_book === 'YES') {
        sessionStorage.setItem('pendingBooking', JSON.stringify({
            container_no: formData.container_no,
            plate_no: record.plate_no,
            client_id: record.client_id,
            client_name: record.client_name,
            hauler: record.hauler,
            from_gate_out: true,
        }));
        
        // Navigate to bookings with query param
        window.location.href = '/bookings?action=create';
    } else {
        onSuccess();
        onClose();
        setShowConfirm(false);
    }
}
```

---

### **File 2: Bookings/Index.tsx**

Add this useEffect **after** the `fetchClients()` call:

```typescript
// Around line 120-130, after existing useEffects
useEffect(() => {
    // Check for pending booking from Gate OUT
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'create' && clients.length > 0) {
        const pendingData = sessionStorage.getItem('pendingBooking');
        
        if (pendingData) {
            try {
                const data = JSON.parse(pendingData);
                const client = clients.find(c => c.id === data.client_id.toString());
                
                setFormData({
                    bnum: '',
                    cid: client?.id || '',
                    shipper: '',
                    two: 0,
                    four: 0,
                    fourf: 0,
                    cnums: data.container_no,
                    exp: '',
                });
                
                setBookingType('with');
                setShowAddModal(true);
                sessionStorage.removeItem('pendingBooking');
                window.history.replaceState({}, '', '/bookings');
                
                success(`Container ${data.container_no} ready for booking`);
            } catch (err) {
                console.error('Failed to parse pending booking:', err);
            }
        }
    }
}, [clients, success]);
```

---

## 🎯 Summary

### **What happens when "Save and Book = YES":**

1. ✅ **Gate OUT saves** → Container marked as OUT in database
2. ✅ **Print opens** → Auto-print EIR document in new window
3. ✅ **Data stored** → Container info saved in sessionStorage
4. ✅ **Navigate** → Browser goes to `/bookings?action=create`
5. ✅ **Modal opens** → Add Booking modal opens automatically
6. ✅ **Pre-filled** → Container number and client pre-filled
7. ✅ **User completes** → User enters booking no., shipper, exp. date
8. ✅ **Booking created** → Container now has booking reference

### **What user needs to do:**

| Action | Done By |
|--------|---------|
| Select container, status, checker, contact | ✅ User (Gate OUT form) |
| Set "Save and Book" to YES | ✅ User (Gate OUT form) |
| Save Gate OUT | ✅ System |
| Print EIR | ✅ System (auto) |
| Navigate to Bookings | ✅ System (auto) |
| Open Add Booking modal | ✅ System (auto) |
| Enter Booking Number | 👤 User (Booking form) |
| Enter Shipper | 👤 User (Booking form) |
| Enter Expiration Date | 👤 User (Booking form) |
| Save Booking | 👤 User (Booking form) |

---

## ⚠️ Important Notes

1. **sessionStorage** is used (not localStorage) because:
   - Data should only persist for current session
   - Automatically cleared when browser closes
   - More secure for temporary data

2. **URL parameter** `?action=create` is used to:
   - Trigger the booking modal
   - Can be bookmarked/shared
   - Browser back/forward works correctly

3. **Print window** is separate:
   - Opens in new window/tab
   - Doesn't block navigation
   - User can close after printing

4. **Client selection** pre-filled:
   - Uses client_id from Gate OUT record
   - Matches client in booking form
   - User can change if needed

---

## 🚀 Next Steps

1. **Implement Option 1 code** (recommended)
2. **Test the flow:**
   - Process Gate OUT with "Save and Book = NO" → Should close modal
   - Process Gate OUT with "Save and Book = YES" → Should navigate to bookings
   - Check if modal opens automatically
   - Verify container number pre-filled
   - Complete booking and verify

3. **Optional enhancements:**
   - Add loading spinner during navigation
   - Toast message: "Redirecting to bookings..."
   - Highlight pre-filled fields in green

---

**Would you like me to implement this code for you?** I can modify both files (ProcessGateOutModal.tsx and Bookings/Index.tsx) to add this functionality! 🚀

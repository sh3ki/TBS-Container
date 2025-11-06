# BILLING MODULE - TESTING CHECKLIST

## 🧪 Testing the Billing Module

### Prerequisites
- Server running: `php artisan serve`
- Login with valid credentials
- Navigate to: http://localhost:8000/billing

---

## ✅ TEST 1: Load Clients Dropdown
**Expected:**
- Client dropdown populated on page load
- Shows format: "CODE - Client Name"
- "All Clients" option available

**Steps:**
1. Open billing page
2. Check client dropdown

---

## ✅ TEST 2: Generate Billing (Current Month)
**Expected:**
- Billing data generates for current month
- Summary cards show totals
- Table displays all records
- Date range defaults to current month

**Steps:**
1. Click "Generate" button (without changing dates)
2. Verify data loads
3. Check summary cards have values
4. Verify table shows records

---

## ✅ TEST 3: Custom Date Range
**Expected:**
- Billing generates for specified date range
- Only containers within range included

**Steps:**
1. Set Start Date: 2024-01-01
2. Set End Date: 2024-01-31
3. Click "Generate"
4. Verify records are from January 2024

---

## ✅ TEST 4: Client Filtering
**Expected:**
- Only selected client's containers shown
- Summary updates for filtered client

**Steps:**
1. Select a client from dropdown
2. Click "Filter" button
3. Verify only that client's records shown
4. Check client name matches in all rows

---

## ✅ TEST 5: Storage Calculation
**Expected:**
- Storage Days = (Out - In) + 1 (inclusive)
- Containers still IN use current date
- Free days subtracted if configured
- Storage Charges = Billable Days × Rate

**Steps:**
1. Generate billing
2. Pick a record with OUT date
3. Manually calculate: (Out - In) + 1
4. Verify Days column matches
5. Verify Storage Charges = Days × Rate

---

## ✅ TEST 6: Handling Calculation
**Expected:**
- Handling Charges = Count × Rate

**Steps:**
1. Find record with handling count
2. Verify Handling Charges = Count × Rate

---

## ✅ TEST 7: Total Calculation
**Expected:**
- Total = Storage + Handling

**Steps:**
1. Pick any record
2. Verify Total = Storage Charges + Handling Charges

---

## ✅ TEST 8: Containers Still IN
**Expected:**
- Containers with no OUT date show "---"
- Storage days calculated using current date

**Steps:**
1. Generate billing
2. Find records with "---" in OUT column
3. Verify storage days calculated using today

---

## ✅ TEST 9: Excel Export
**Expected:**
- CSV file downloads
- Contains all billing data
- Includes totals row
- Proper formatting

**Steps:**
1. Generate billing
2. Click "Export to Excel" button
3. Verify CSV downloads
4. Open file and check data

---

## ✅ TEST 10: Summary Totals
**Expected:**
- Summary cards match table totals
- 4 cards: Records, Storage, Handling, Total

**Steps:**
1. Generate billing
2. Manually sum Storage Charges column
3. Verify matches summary card
4. Repeat for Handling and Total

---

## ✅ TEST 11: Table Footer Totals
**Expected:**
- Footer row shows column totals
- Matches data in table

**Steps:**
1. Verify footer totals match summary
2. Check Storage total
3. Check Handling total
4. Check Grand total

---

## ✅ TEST 12: Date Range Edge Cases

**Test A: Containers IN before, OUT during**
- Container: IN = 2023-12-15, OUT = 2024-01-15
- Range: 2024-01-01 to 2024-01-31
- Expected: INCLUDED ✅

**Test B: Containers IN during, OUT after**
- Container: IN = 2024-01-15, OUT = 2024-02-15
- Range: 2024-01-01 to 2024-01-31
- Expected: INCLUDED ✅

**Test C: Containers IN before, OUT after**
- Container: IN = 2023-12-01, OUT = 2024-02-28
- Range: 2024-01-01 to 2024-01-31
- Expected: INCLUDED ✅

**Test D: Containers still IN (no OUT)**
- Container: IN = 2023-12-01, OUT = NULL
- Range: 2024-01-01 to 2024-01-31
- Expected: INCLUDED ✅

---

## ✅ TEST 13: Rate Fallback Logic

**Test A: Client-specific rate exists**
- Expected: Use client-specific rate ✅

**Test B: No client rate, default exists**
- Expected: Use default rate (client_id = 0) ✅

**Test C: No rate found**
- Expected: Use 0.00 ✅

---

## ✅ TEST 14: Validation

**Test A: Missing start date**
- Expected: Error message "Please select both start and end dates" ✅

**Test B: Missing end date**
- Expected: Error message "Please select both start and end dates" ✅

**Test C: End before start**
- Expected: Laravel validation error ✅

---

## 🔍 API TESTING (Using Postman/curl)

### 1. Generate Billing
```bash
POST /api/billing/generate
Body: { "start": "2024-01-01", "end": "2024-01-31" }
```

### 2. Get Billing List
```bash
POST /api/billing/list
Body: { "start": "2024-01-01", "end": "2024-01-31", "client_id": "" }
```

### 3. Get Clients
```bash
GET /api/billing/clients
```

### 4. Export
```bash
POST /api/billing/export
Body: { "start": "2024-01-01", "end": "2024-01-31" }
```

---

## 📊 SAMPLE TEST DATA

To verify calculations, create test records:

**Container 1:**
- IN: 2024-01-01
- OUT: 2024-01-10
- Size: 20FT
- Storage Days: 10 (inclusive)
- Storage Rate: 50.00
- Expected Storage: 500.00

**Container 2:**
- IN: 2024-01-15
- OUT: NULL (still IN)
- Size: 40FT
- Today: 2024-01-31
- Storage Days: 17 (inclusive)
- Storage Rate: 75.00
- Expected Storage: 1,275.00

---

## ✅ PASS CRITERIA

- [ ] All 14 tests pass
- [ ] Calculations match manual verification
- [ ] Export works
- [ ] Date filtering correct
- [ ] Client filtering works
- [ ] Summary totals accurate
- [ ] No console errors
- [ ] No server errors

---

## 🐛 KNOWN ISSUES (To Fix Later)

1. TypeScript lint warnings (any types)
2. CSV export (Excel package not installed yet)
3. Real-time handling count update (UI refresh needed)

---

## 🚀 READY FOR PRODUCTION?

After all tests pass:
- ✅ Billing calculations verified
- ✅ Date range filtering tested
- ✅ Client filtering tested
- ✅ Export working
- ✅ No critical bugs

**Status:** READY FOR UAT (User Acceptance Testing) ✅

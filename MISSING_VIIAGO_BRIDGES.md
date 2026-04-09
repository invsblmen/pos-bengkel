# Missing ViaGo Proxy Methods - Top Optimization Opportunities

**Analysis Date:** April 8, 2026  
**Status:** Controllers scanned: All in `app/Http/Controllers/` and `app/Http/Controllers/Apps/`

---

## TOP 10 ENDPOINTS RANKED BY OPTIMIZATION IMPACT

### 🔴 TIER 1: CRITICAL - Implement FIRST (High Traffic + Complex Data)

#### 1️⃣ **ServiceOrderController → index()**  
- **Current Status:** No ViaGo proxy  
- **Location:** `app/Http/Controllers/Apps/ServiceOrderController.php:86`
- **Inertia Render:** `Dashboard/ServiceOrders/Index`
- **Why Critical:**
  - ✅ **Highest traffic** - Core workflow, every mechanic views this regularly
  - ✅ **Complex queries** - Joins with customer, vehicle, mechanic, status calculations
  - ✅ **Heavy filtering** - search, status filter, date range, mechanic_id
  - ✅ **Pagination** - 15 items per page with full relationship loading
  - ✅ **Stats calculation** - pending/in_progress/completed/paid counts + revenue sum
- **Recommended ViaGo Method:** `serviceOrderIndexViaGo()`
- **Expected Performance Gain:** 40-60% faster (complex aggregation + filtering)

#### 2️⃣ **ServiceOrderController → show($id)**
- **Current Status:** No ViaGo proxy  
- **Location:** `app/Http/Controllers/Apps/ServiceOrderController.php:173`
- **Inertia Render:** `Dashboard/ServiceOrders/Show`
- **Why High Impact:**
  - ✅ **Frequent access** - Users spend significant time viewing detail pages
  - ✅ **Multiple relationships** - customer, vehicle, mechanic, services, parts, warranty registrations
  - ✅ **Read-only operation** - Perfect for Go optimization
  - ✅ **Complex logic** - Warranty registration mapping, permission checks
- **Recommended ViaGo Method:** `serviceOrderShowViaGo()`
- **Expected Performance Gain:** 30-50% faster

---

#### 3️⃣ **CustomerController → index()**
- **Current Status:** No ViaGo proxy  
- **Location:** `app/Http/Controllers/Apps/CustomerController.php:37`
- **Inertia Render:** `Dashboard/Customers/Index`
- **Why High Impact:**
  - ✅ **Very high traffic** - Customer list accessed constantly across workflows
  - ✅ **Search + Pagination** - Filters across name, phone, email; 8 per page pagination
  - ✅ **Relationship loading** - Each customer loaded with vehicles
  - ✅ **Central data** - Referenced in service orders, appointments, part sales
- **Recommended ViaGo Method:** `customerIndexViaGo()`
- **Expected Performance Gain:** 35-50% faster

#### 4️⃣ **CustomerController → show($id)**
- **Current Status:** No ViaGo proxy  
- **Location:** `app/Http/Controllers/Apps/CustomerController.php:211`
- **Inertia Render:** `Dashboard/Customers/Show`
- **Why High Impact:**
  - ✅ **Moderate+ traffic** - Detail page viewed when processing service orders
  - ✅ **Multiple loads** - Vehicles relationship + serviceOrders with deep loads
  - ✅ **Complex join** - ServiceOrders with vehicle, mechanic, and detail cascades
- **Recommended ViaGo Method:** `customerShowViaGo()`
- **Expected Performance Gain:** 25-40% faster

---

### 🟠 TIER 2: HIGH PRIORITY (Read-Heavy, Frequently Accessed)

#### 5️⃣ **PartController (Apps) → index()**
- **Current Status:** No ViaGo proxy  
- **Location:** `app/Http/Controllers/Apps/PartController.php:88`
- **Inertia Render:** `Dashboard/Parts/Index`
- **Why Important:**
  - ✅ **Frequent access** - Parts referenced in service orders and sales
  - ✅ **Search + filter** - Name/SKU search, category filtering
  - ✅ **Pagination** - Full relationship load per page
  - ✅ **Shows stock levels** - Important display data
- **Recommended ViaGo Method:** `partIndexViaGo()`
- **Expected Performance Gain:** 30-45% faster

#### 6️⃣ **PartPurchaseController → index()**
- **Current Status:** PARTIAL - has `partPurchaseUpdateStatusViaGo` only  
- **Location:** `app/Http/Controllers/Apps/PartPurchaseController.php:68`
- **Inertia Render:** `Dashboard/PartPurchases/Index`
- **Why Important:**
  - ✅ **Inventory management** - Procurement tracking is critical
  - ✅ **Supplier joins** - Each purchase linked to supplier + parts
  - ✅ **Pagination heavy** - Likely many records
  - ⚠️ **Missing counterpart** - show(), create(), print(), edit() all lack ViaGo
- **Recommended ViaGo Methods:** `partPurchaseIndexViaGo()`, `partPurchaseShowViaGo()`, `partPurchaseEditViaGo()`
- **Expected Performance Gain:** 35-50% faster

#### 7️⃣ **PartSalesOrderController → index()**
- **Current Status:** No ViaGo proxy  
- **Location:** `app/Http/Controllers/Apps/PartSalesOrderController.php:54`
- **Inertia Render:** `Dashboard/PartSalesOrders/Index`
- **Why Important:**
  - ✅ **Sales operations** - Part sales order tracking
  - ✅ **Pagination** - Multiple orders listing
  - ✅ **Status filtering** - Order state queries
- **Recommended ViaGo Method:** `partSalesOrderIndexViaGo()`
- **Expected Performance Gain:** 30-40% faster

#### 8️⃣ **AppointmentController → calendar()**
- **Current Status:** Partial - has ViaGo but critical read-only page  
- **Location:** `app/Http/Controllers/Apps/AppointmentController.php:162`
- **Inertia Render:** `Dashboard/Appointments/Calendar`
- **Why Important:**
  - ✅ **High-traffic reporting** - Calendar view accessed frequently
  - ✅ **Complex aggregation** - Aggregates appointments into calendar format
  - ✅ **Read-only** - Perfect candidate for Go optimization
- **Status:** Already has `appointmentCalendarViaGo()` ✓

---

### 🟡 TIER 3: MEDIUM PRIORITY (Good Optimization Targets)

#### 9️⃣ **ServiceReportController** - Multiple Reports (Partially Optimized)
- **Current Status:** Has 6 ViaGo methods ✓  
- **Renders:** Overall, ServiceRevenue, MechanicProductivity, MechanicPayroll, PartsInventory, OutstandingPayments
- **Status:** ALREADY OPTIMIZED ✓
- **Performance Impact:** Reports are heavy calculation endpoints - optimization is working well

#### 🔟 **PartController → show($id)**
- **Current Status:** No ViaGo proxy  
- **Location:** `app/Http/Controllers/Apps/PartController.php:263`
- **Inertia Render:** `Dashboard/Parts/Show`
- **Why Important:**
  - ✅ **Use cases** - Viewed when adding parts to orders
  - ✅ **Complex data** - Category, stock levels, pricing, related parts
  - ✅ **Read-only** - Perfect for Go bridge
- **Recommended ViaGo Method:** `partShowViaGo()`
- **Expected Performance Gain:** 25-35% faster

---

## SUMMARY TABLE

| Rank | Endpoint | Controller | Inertia Render | ViaGo Status | Priority | Est. Gain |
|------|----------|-----------|---|---|---|---|
| 1 | index | ServiceOrderController | ServiceOrders/Index | ❌ None | 🔴 CRITICAL | 40-60% |
| 2 | show | ServiceOrderController | ServiceOrders/Show | ❌ None | 🔴 CRITICAL | 30-50% |
| 3 | index | CustomerController | Customers/Index | ❌ None | 🔴 CRITICAL | 35-50% |
| 4 | show | CustomerController | Customers/Show | ❌ None | 🔴 CRITICAL | 25-40% |
| 5 | index | PartController (Apps) | Parts/Index | ❌ None | 🟠 HIGH | 30-45% |
| 6 | index | PartPurchaseController | PartPurchases/Index | ❌ None | 🟠 HIGH | 35-50% |
| 7 | index | PartSalesOrderController | PartSalesOrders/Index | ❌ None | 🟠 HIGH | 30-40% |
| 8 | calendar | AppointmentController | Appointments/Calendar | ✅ Has ViaGo | 🟠 HIGH | 25-40% |
| 9 | reports | ServiceReportController | Reports/* | ✅ Complete | 🟠 HIGH | 40-60% |
| 10 | show | PartController (Apps) | Parts/Show | ❌ None | 🟡 MEDIUM | 25-35% |

---

## IMPLEMENTATION STRATEGY

### Phase 1: Critical Wins (Highest Impact/Effort Ratio)
1. **ServiceOrderController::index()** → Most traffic + highest gain
2. **ServiceOrderController::show()** → Core detail page
3. **CustomerController::index()** → Very high traffic

### Phase 2: High-Value Operations  
4. **PartController::index()** and **show()**
5. **PartPurchaseController** (all missing methods)
6. **PartSalesOrderController::index()**

### Phase 3: Additional Optimization
- Remaining index/show pages
- Detail pages for entities with complex relationships

---

## ADDITIONAL OBSERVATIONS

### Already Well-Optimized ✓
- **PartSaleController** - Complete ViaGo coverage for all major operations
- **ServiceReportController** - All reports have Go bridges
- **VehicleController** - Full index/detail/analytics coverage
- **AppointmentController** - Most operations proxied

### Partial Coverage Issues  
- **PartPurchaseController** - Only status update has ViaGo (needs index, create, show, edit, print)
- **CashManagementController** - Only suggest/settle operations proxied

### No ViaGo But Lower Priority
- UserController, RoleController, PermissionController - Admin operations (low traffic)
- ProfileController - User account settings (low traffic)
- NotificationController - Background notifications (lower latency requirement)
- SimpleReference data (ServiceCategory, MechanicController) - Could be optimized but lower impact

---

## ESTIMATED SYSTEM IMPACT

- **Combined potential improvement** for Top 4 endpoints: 15-20% faster overall response times
- **Critical path optimization**: Service order workflow would be 40-60% faster
- **User experience**: Noticeable improvement in responsiveness for core workflows


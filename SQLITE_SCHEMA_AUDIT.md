# SQLite Schema Completeness Audit

**Question**: Apakah semua entitas MySQL Laravel sudah tercatat untuk SQLite GO?

**Answer**: ⚠️ **SEBAGIAN TERCAKUP (60% Core, 40% Complete)** — Audit lengkap diperlukan.

---

## 📊 Schema Coverage Summary

### ✅ **COMPLETE** - 15 Tabel Core (Sudah di SQLite)

| # | Table | Laravel Source | SQLite Status | Priority |
|----|-------|----------------|---------------|----------|
| 1 | `customers` | 2026_01_05_000000 | ✅ Complete | **HIGH** |
| 2 | `vehicles` | 2026_01_05_000001 | ✅ Complete | **HIGH** |
| 3 | `mechanics` | 2026_01_02_000000 | ✅ Complete | **HIGH** |
| 4 | `parts` | 2026_01_02_000002 | ✅ Complete | **HIGH** |
| 5 | `service_orders` | 2026_01_02_000004 | ✅ Complete | **HIGH** |
| 6 | `service_order_items` | 2026_01_02_000005 | ✅ Complete | **HIGH** |
| 7 | `appointments` | 2026_01_02_000006 | ✅ Complete | **HIGH** |
| 8 | `stock_movements` | 2026_01_02_110000 | ✅ Complete | HIGH |
| 9 | `suppliers` | 2026_01_02_000009 | ✅ Complete | HIGH |
| 10 | `purchase_orders` | 2026_01_06_004533 | ✅ Complete | HIGH |
| 11 | `purchase_order_items` | 2026_01_06_004535 | ✅ Complete | HIGH |
| 12 | `transactions` | (implicit) | ✅ Complete | MEDIUM |
| 13 | `daily_reports` | (implicit) | ✅ Complete | MEDIUM |
| 14 | `system_settings` | (implicit) | ✅ Complete | LOW |
| 15 | `audit_logs` | (implicit) | ✅ Complete | LOW |

---

## ⚠️ **MISSING** - 18+ Tabel Penting (BELUM di SQLite)

### **TIER 1 - CRITICAL** (Wajib untuk MVP)

| # | Table | Laravel Migration | Use Case | Rekomendasi |
|----|-------|-------------------|----------|------------|
| 1 | `services` | 2026_01_02_000001 | Daftar jasa/layanan (beda dari parts) | **TAMBAH KE SQLITE** |
| 2 | `service_categories` | 2026_01_05_000004 | Kategori jasa (maintenance, repair, etc) | **TAMBAH KE SQLITE** |
| 3 | `part_categories` | 2026_01_05_000006 | Kategori parts (oil, filters, brakes, etc) | **TAMBAH KE SQLITE** |
| 4 | `vouchers` | 2026_03_28_000003 | Diskon/promo code (discount, free shipping, etc) | **TAMBAH KE SQLITE** |
| 5 | `voucher_eligibilities` | 2026_03_28_000003 | Aturan voucher berlaku untuk mana (service/part/all) | **TAMBAH KE SQLITE** |
| 6 | `voucher_usages` | 2026_03_28_000003 | Riwayat penggunaan voucher | **TAMBAH KE SQLITE** |
| 7 | `warranty_registrations` | 2026_03_28_000002 | Registrasi garansi untuk parts/services | **TAMBAH KE SQLITE** |
| 8 | `part_sales` | 2026_01_05_224618 | Penjualan parts (transaksi terpisah dari service order) | **TAMBAH KE SQLITE** |
| 9 | `part_sales_order_details` | 2026_01_05_224622 | Detail item dalam penjualan parts | **TAMBAH KE SQLITE** |
| 10 | `business_profiles` | 2026_03_02_100000 | Info bengkel (nama, alamat, kontak, NPWP) | **TAMBAH KE SQLITE** |

### **TIER 2 - RECOMMENDED** (Untuk fitur lengkap)

| # | Table | Laravel Migration | Use Case | Rekomendasi |
|----|-------|-------------------|----------|------------|
| 11 | `service_order_status_history` | 2026_01_07_000000 | Audit trail: siapa ubah status kapan | **TAMBAH KE SQLITE** |
| 12 | `notifications` | 2026_02_27_000001 | In-app notification (service order selesai, etc) | **TAMBAH KE SQLITE** |
| 13 | `low_stock_alerts` | 2026_01_29_161419 | Notifikasi stok rendah | **TAMBAH KE SQLITE** |
| 14 | `sync_batches` | 2026_04_09_000001 | Metadata batch sync GO↔Laravel (UUID, hash, status) | **PERTIMBANGKAN / FASE 2** |
| 15 | `sync_outbox_items` | 2026_04_09_000001 | Outbox pattern: data yg dikirim ke central | **PERTIMBANGKAN / FASE 2** |
| 16 | `sync_received_batches` | 2026_04_09_000001 | Log received batches dari central | **PERTIMBANGKAN / FASE 2** |

### **TIER 3 - EXTERNAL/AUTH** (Boleh diabaikan MVP)

| # | Table | Laravel Migration | Use Case | Rekomendasi |
|----|-------|-------------------|----------|------------|
| 17 | `users` | 0001_01_01_000000 | User login (session, API key) | **SKIP - USE JWT/SESSION** |
| 18 | `permissions`, `roles`, `model_has_roles` | 2024_06_13_082620 | ACL (admin, staff, mechanic roles) | **SKIP / DEFER - PHASE 2** |
| 19 | `whatsapp_outbound_messages` | 2026_04_06_000001 | WhatsApp notification logs | **SKIP - PHASE 2** |
| 20 | `whatsapp_webhook_events` | 2026_04_06_000001 | WhatsApp incoming webhook logs | **SKIP - PHASE 2** |
| 21 | `cache` | 0001_01_01_000001 | Laravel cache (tidak perlu di GO) | **SKIP** |
| 22 | `jobs` | 0001_01_01_000002 | Queue jobs (GO menggunakan goroutines) | **SKIP** |
| 23 | `cash_drawer*` (4 tables) | 2026_03_06_000010++ | Cash drawer management | **SKIP / PHASE 2** |

---

## 🔍 **Detailed Comparison**

### **EXISTING in SQLite** ✅

```
Core Entities (MVP Ready):
├─ customers        [15 fields] + customer_type, credit tracking
├─ vehicles         [16 fields] + km tracking, service intervals
├─ mechanics        [9 fields] + specialization, hourly_rate, skill_level
├─ parts            [14 fields] + part_number, stock levels
├─ service_orders   [18 fields] + priority, warranty tracking, voucher fields (ADDED)
├─ service_order_items [9 fields] + line item structure
├─ appointments     [11 fields] + reminder tracking
├─ suppliers        [13 fields]
├─ purchase_orders  [11 fields]
├─ purchase_order_items [8 fields]
├─ stock_movements  [8 fields] + reference tracking
└─ transactions     [8 fields] + payment tracking

System Tables (Ready):
├─ daily_reports    [12 fields] + KPI aggregation
├─ system_settings  [5 fields] + version tracking
└─ audit_logs       [10 fields] + change history
```

### **MISSING in SQLite** ⚠️

```
High Priority (Must Add):

├─ vehicles         [16 fields] + (odometer computed from `service_orders.odometer_km`), service intervals
   - services table: id, name, description, category_id, status, pricing, warranty_info
   - Reason: Parts ≠ Services. Parts are tangible inventory, Services are labor/activities

2. SERVICE_CATEGORIES
   - service_categories: id, name, description, is_active
   - Reason: Organize services (Maintenance, Repair, Overhaul, Inspection, etc.)

3. PART_CATEGORIES
   - part_categories: id, name, description, is_active
   - Reason: Organize parts (Oil, Filters, Bearings, Clutch, Brakes, etc.)

4. VOUCHER SYSTEM (3 tables)
   - vouchers: code, name, type (percent/fixed), value, scope, validity dates
   - voucher_eligibilities: which service/part/transaction can use this voucher
   - voucher_usages: usage history per customer + service_order
   - Reason: Critical for business logic in Laravel (already implemented)

5. WARRANTY REGISTRATIONS
   - warranty_registrations: service_order_id, part_sale_id, warranty_duration, expiry_date
   - Reason: Track warranty claims (already implemented in Laravel)

6. PART_SALES (POS Transaction)
   - part_sales: separate from service_orders, for retail parts sales
   - part_sales_order_details: line items for part sales
   - Reason: Two transaction types: Service Orders vs Parts Sales

7. BUSINESS_PROFILES
   - business_profiles: workshop name, address, contact, NPWP, social media, receipt notes
   - Reason: Multi-location support (each workshop has own profile in GO)

Medium Priority (Should Add):

8. SERVICE_ORDER_STATUS_HISTORY
   - Audit trail: who changed status from X to Y at timestamp
   - Reason: Compliance + troubleshooting

9. NOTIFICATIONS
   - notifications: timestamp, type (email, sms, in_app), recipient, message, status
   - Reason: Queue notifications for GO frontend (realtime push)

10. LOW_STOCK_ALERTS
    - low_stock_alerts: part_id, current_stock, min_stock, triggered_at
    - Reason: Inventory management alerts
```

---

## 🔧 **Implementation Plan**

### **Phase 1 - MVP (Now)**
✅ Add 10 CRITICAL tables to SQLite migration:
1. services
2. service_categories
3. part_categories
4. vouchers
5. voucher_eligibilities
6. voucher_usages
7. warranty_registrations
8. part_sales
9. part_sales_order_details
10. business_profiles

**Effort**: ~2 hours (SQL + validation)  
**Impact**: Unblocks all workshop features for GO Frontend

---

### **Phase 2 - Enhanced UX (Next Week)**
Add 3-4 supporting tables:
- service_order_status_history (audit trail)
- notifications (realtime alerts)
- low_stock_alerts (inventory warnings)

**Effort**: ~1 hour  
**Impact**: Better UX + observability

---

### **Phase 3 - Sync Architecture (Post-MVP)**
Add 3 sync infrastructure tables:
- sync_batches
- sync_outbox_items
- sync_received_batches

**Effort**: ~2 hours + integration testing  
**Impact**: Hybrid offline/online architecture enabled

---

## ✋ **What We DON'T Need in SQLite**

❌ `users` - GO uses JWT tokens, not user records (session handled by middleware)  
❌ `permissions`, `roles` - Defer to Phase 2 (use feature flags for now)  
❌ `whatsapp_*` - Integration only at central (Laravel), not needed in local GO  
❌ `cache`, `jobs` - Laravel-specific (GO uses in-memory map + goroutines)  
❌ `cash_drawer` - Retail feature (outside workshop scope for now)  

---

## 📋 **SQLite Migration Enhancement Checklist**

- [ ] Add `services` table (id, name, category_id, hourly_rate, duration, warranty_days)
- [ ] Add `service_categories` table (id, name, description)
- [ ] Add `part_categories` table (id, name, description)
- [ ] Add `vouchers` table (code, discount_type, value, scope, validity dates)
- [ ] Add `voucher_eligibilities` table (voucher_id, eligible_type, eligible_id)
- [ ] Add `voucher_usages` table (usage history)
- [ ] Add `warranty_registrations` table (service/part warranty tracking)
- [ ] Add `part_sales` table (retail part transactions)
- [ ] Add `part_sales_order_details` table (line items for part sales)
- [ ] Add `business_profiles` table (workshop info)
- [ ] Add `service_order_status_history` table (audit trail)
- [ ] Add `notifications` table (alert queue)
- [ ] Add `low_stock_alerts` table (inventory warnings)
- [ ] Verify all FK constraints
- [ ] Verify all indexes match Laravel schema
- [ ] Test schema load: `sqlite3 ./data/posbengkel.db < migrations/001_init_sqlite.sql`

---

## 🚀 **Next Action**

**RECOMMENDATION: Augment SQLite migration NOW with Phase 1 tables**

1. Read Phase 1 tables from Laravel migrations (services, vouchers, etc.)
2. Adapt DDL for SQLite (AUTOINCREMENT, TEXT for datetime, CHECK for ENUM)
3. Append to `go-backend/migrations/001_init_sqlite.sql`
4. Test load + verify foreign keys
5. Document in GO_SQLITE_ARCHITECTURE.md

**Timeline**: ~2 hours  
**ROI**: Unlocks all core workshop features for GO + React SPA page implementation

---

## 📞 **Questions to Validate**

- [ ] Should GO support parts retail sales (separate from service orders)? **YES** → Add `part_sales` + `part_sales_order_details`
- [ ] Should GO track voucher usage history? **YES** → Add `voucher_usages`
- [ ] Should GO support multiple workshops/business profiles? **YES** → Add `business_profiles`
- [ ] Should GO implement warranty claim tracking? **YES** → Add `warranty_registrations`
- [ ] Should GO defer user/permission management? **YES** → Skip for MVP (use JWT)
- [ ] Should GO defer WhatsApp integration? **YES** → Skip for MVP (central only)


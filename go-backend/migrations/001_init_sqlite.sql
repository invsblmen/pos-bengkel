-- GO Backend SQLite Schema Migration
-- Purpose: Local-first database schema for workshop operations
-- Date: 2026-04-12
-- Adapted from: Laravel 12 POS Bengkel MariaDB schema

-- Enable foreign keys (CRITICAL for SQLite)
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================================================
-- AUTHENTICATION & AUTHORIZATION (Phase 1 - Critical)
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    avatar TEXT,
    is_active INTEGER DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);

-- User roles (simple RBAC: admin, supervisor, mechanic, staff)
CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'mechanic', 'staff', 'customer')),
    assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, role),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Login audit trail (compliance + security)
CREATE TABLE IF NOT EXISTS login_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Password reset tokens (for "forgot password" flow)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API credentials (for third-party integrations, Phase 2)
CREATE TABLE IF NOT EXISTS api_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    api_secret TEXT NOT NULL,
    name TEXT,
    scope TEXT,
    last_used_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT UNIQUE,
    address TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    customer_type TEXT DEFAULT 'individual' CHECK (customer_type IN ('individual', 'corporate')),
    tax_id TEXT,
    credit_limit REAL DEFAULT 0,
    credit_used REAL DEFAULT 0,
    discount_rate REAL DEFAULT 0,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    plate_number TEXT UNIQUE NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    color TEXT,
    engine_number TEXT,
    chassis_number TEXT UNIQUE,
    vehicle_type TEXT DEFAULT 'car' CHECK (vehicle_type IN ('car', 'motorcycle', 'truck')),
    km_current INTEGER DEFAULT 0,
    km_service_interval INTEGER DEFAULT 10000,
    km_last_service INTEGER DEFAULT 0,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Mechanics (workshop staff)
CREATE TABLE IF NOT EXISTS mechanics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    specialization TEXT,
    specialty TEXT,
    hourly_rate REAL DEFAULT 0,
    skill_level TEXT DEFAULT 'junior' CHECK (skill_level IN ('junior', 'senior', 'lead')),
    is_available INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);

-- Parts (inventory items)
CREATE TABLE IF NOT EXISTS parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    unit_of_measure TEXT DEFAULT 'pcs',
    purchase_price REAL DEFAULT 0,
    selling_price REAL DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    minimum_stock INTEGER DEFAULT 10,
    reorder_quantity INTEGER DEFAULT 50,
    supplier_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);

-- Service Orders (main workflow)
CREATE TABLE IF NOT EXISTS service_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    mechanic_id INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'waiting_parts', 'completed', 'paid', 'cancelled')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    problem_description TEXT,
    estimated_labor_hours REAL DEFAULT 0,
    estimated_finish_at TEXT,
    actual_start_at TEXT,
    actual_finish_at TEXT,
    labor_cost REAL DEFAULT 0,
    material_cost REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    discount_percentage REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'transfer', 'credit', 'check')),
    notes TEXT,
    is_warranty INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (mechanic_id) REFERENCES mechanics(id)
);

-- Service Order Items (line items)
CREATE TABLE IF NOT EXISTS service_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_order_id INTEGER NOT NULL,
    part_id INTEGER,
    description TEXT NOT NULL,
    type TEXT DEFAULT 'part' CHECK (type IN ('part', 'labor', 'other')),
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

-- ============================================================================
-- APPOINTMENT SCHEDULING
-- ============================================================================

CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_number TEXT UNIQUE,
    customer_id INTEGER,
    vehicle_id INTEGER,
    mechanic_id INTEGER,
    service_type TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
    scheduled_at TEXT,
    scheduled_start_at TEXT NOT NULL,
    scheduled_end_at TEXT NOT NULL,
    actual_start_at TEXT,
    actual_end_at TEXT,
    notes TEXT,
    reminder_sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY (mechanic_id) REFERENCES mechanics(id)
);

-- ============================================================================
-- INVENTORY MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'return')),
    quantity INTEGER NOT NULL,
    reference_type TEXT,
    reference_id INTEGER,
    notes TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

-- ============================================================================
-- SUPPLIERS & PURCHASING
-- ============================================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    province TEXT,
    postal_code TEXT,
    tax_id TEXT,
    payment_terms TEXT DEFAULT 'cash',
    discount_rate REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'received', 'cancelled')),
    ordered_at TEXT NOT NULL,
    expected_delivery_at TEXT,
    received_at TEXT,
    subtotal REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_order_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    received_quantity INTEGER DEFAULT 0,
    subtotal REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id)
);

-- ============================================================================
-- TRANSACTIONS & PAYMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_number TEXT UNIQUE NOT NULL,
    service_order_id INTEGER,
    customer_id INTEGER,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'credit', 'check')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    reference_code TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- ============================================================================
-- SERVICES & SERVICE CATEGORIES (Phase 1 Enhancement)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    est_time_minutes INTEGER,
    price REAL DEFAULT 0,
    has_warranty INTEGER DEFAULT 0,
    warranty_duration_days INTEGER,
    warranty_terms TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL
);

-- ============================================================================
-- PART CATEGORIES (Phase 1 Enhancement)
-- ============================================================================

CREATE TABLE IF NOT EXISTS part_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Update parts table to include category_id (add column separately if needed in migration)
-- ALTER TABLE parts ADD COLUMN category_id INTEGER REFERENCES part_categories(id);

-- ============================================================================
-- VOUCHERS & PROMOTIONS (Phase 1 Enhancement)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    starts_at TEXT,
    ends_at TEXT,
    quota_total INTEGER,
    quota_used INTEGER DEFAULT 0,
    limit_per_customer INTEGER,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value REAL DEFAULT 0,
    scope TEXT DEFAULT 'transaction' CHECK (scope IN ('item_part', 'item_service', 'transaction')),
    min_purchase REAL DEFAULT 0,
    max_discount REAL,
    can_combine_with_discount INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voucher_eligibilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL,
    eligible_type TEXT NOT NULL,
    eligible_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (voucher_id, eligible_type, eligible_id),
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voucher_usages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id INTEGER NOT NULL,
    customer_id INTEGER,
    source_type TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    discount_amount REAL DEFAULT 0,
    used_at TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_type, source_id),
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- ============================================================================
-- WARRANTY MANAGEMENT (Phase 1 Enhancement)
-- ============================================================================

CREATE TABLE IF NOT EXISTS warranty_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    warrantable_type TEXT NOT NULL,
    warrantable_id INTEGER NOT NULL,
    source_type TEXT NOT NULL,
    source_id INTEGER NOT NULL,
    source_detail_id INTEGER,
    customer_id INTEGER,
    vehicle_id INTEGER,
    warranty_period_days INTEGER DEFAULT 0,
    warranty_start_date TEXT NOT NULL,
    warranty_end_date TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expiring', 'expired', 'claimed', 'void')),
    claimed_at TEXT,
    claim_notes TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_type, source_id, source_detail_id),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

-- ============================================================================
-- PARTS SALES (Phase 1 Enhancement - Retail Transactions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS part_sales_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER,
    order_date TEXT NOT NULL,
    expected_delivery_date TEXT,
    actual_delivery_date TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'fulfilled', 'cancelled')),
    total_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    voucher_id INTEGER,
    voucher_code TEXT,
    voucher_discount_amount REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS part_sales_order_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_sales_order_id INTEGER NOT NULL,
    part_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    subtotal REAL DEFAULT 0,
    warranty_days INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_sales_order_id) REFERENCES part_sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE RESTRICT
);

-- ============================================================================
-- BUSINESS PROFILE (Phase 1 Enhancement - Multi-Location Support)
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT,
    business_phone TEXT,
    business_address TEXT,
    business_city TEXT,
    business_province TEXT,
    business_postal_code TEXT,
    business_email TEXT,
    business_tax_id TEXT,
    business_website TEXT,
    business_social_media TEXT,
    receipt_notes TEXT,
    logo_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- AUDIT & STATUS HISTORY (Phase 2 Enhancement)
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_order_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,
    changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (service_order_id) REFERENCES service_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_type TEXT NOT NULL,
    recipient_type TEXT,
    recipient_id INTEGER,
    title TEXT,
    message TEXT,
    related_type TEXT,
    related_id INTEGER,
    is_read INTEGER DEFAULT 0,
    read_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- REPORTING & ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_date TEXT NOT NULL UNIQUE,
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    labor_revenue REAL DEFAULT 0,
    material_revenue REAL DEFAULT 0,
    parts_sold INTEGER DEFAULT 0,
    parts_revenue REAL DEFAULT 0,
    avg_order_value REAL DEFAULT 0,
    total_customers_served INTEGER DEFAULT 0,
    new_customers INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SYSTEM & CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    action TEXT NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete')),
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Authentication & Authorization
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_login_audits_user_id ON login_audits(user_id);
CREATE INDEX idx_login_audits_email ON login_audits(email);
CREATE INDEX idx_login_audits_attempted_at ON login_audits(attempted_at);
CREATE INDEX idx_login_audits_status ON login_audits(status);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX idx_api_credentials_user_id ON api_credentials(user_id);
CREATE INDEX idx_api_credentials_api_key ON api_credentials(api_key);
CREATE INDEX idx_api_credentials_is_active ON api_credentials(is_active);

-- Customers
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_is_active ON customers(is_active);

-- Services
CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_is_active ON services(is_active);

-- Vouchers
CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_vouchers_active_period ON vouchers(is_active, starts_at, ends_at);
CREATE INDEX idx_vouchers_scope_type ON vouchers(scope, discount_type);

-- Voucher Eligibilities
CREATE INDEX idx_voucher_eligibilities_eligible ON voucher_eligibilities(eligible_type, eligible_id);

-- Voucher Usages
CREATE INDEX idx_voucher_usages_voucher_customer ON voucher_usages(voucher_id, customer_id);
CREATE INDEX idx_voucher_usages_source ON voucher_usages(source_type, source_id);

-- Warranty Registrations
CREATE INDEX idx_warranty_registrations_warrantable ON warranty_registrations(warrantable_type, warrantable_id);
CREATE INDEX idx_warranty_registrations_source ON warranty_registrations(source_type, source_id);
CREATE INDEX idx_warranty_registrations_status_end ON warranty_registrations(status, warranty_end_date);
CREATE INDEX idx_warranty_registrations_customer_end ON warranty_registrations(customer_id, warranty_end_date);

-- Part Sales Orders
CREATE INDEX idx_part_sales_orders_customer_id ON part_sales_orders(customer_id);
CREATE INDEX idx_part_sales_orders_status ON part_sales_orders(status);
CREATE INDEX idx_part_sales_orders_created_at ON part_sales_orders(created_at);
CREATE INDEX idx_part_sales_orders_order_number ON part_sales_orders(order_number);

-- Part Sales Order Details
CREATE INDEX idx_part_sales_order_details_order_id ON part_sales_order_details(part_sales_order_id);
CREATE INDEX idx_part_sales_order_details_part_id ON part_sales_order_details(part_id);

-- Service Order Status History
CREATE INDEX idx_service_order_status_history_order_id ON service_order_status_history(service_order_id);
CREATE INDEX idx_service_order_status_history_changed_at ON service_order_status_history(changed_at);

-- Notifications
CREATE INDEX idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);

-- Vehicles
CREATE INDEX idx_vehicles_customer_id ON vehicles(customer_id);
CREATE INDEX idx_vehicles_plate_number ON vehicles(plate_number);
CREATE INDEX idx_vehicles_is_active ON vehicles(is_active);

-- Mechanics
CREATE INDEX idx_mechanics_is_available ON mechanics(is_available);

-- Service Orders
CREATE INDEX idx_service_orders_customer_id ON service_orders(customer_id);
CREATE INDEX idx_service_orders_vehicle_id ON service_orders(vehicle_id);
CREATE INDEX idx_service_orders_mechanic_id ON service_orders(mechanic_id);
CREATE INDEX idx_service_orders_status ON service_orders(status);
CREATE INDEX idx_service_orders_created_at ON service_orders(created_at);
CREATE INDEX idx_service_orders_order_number ON service_orders(order_number);

-- Service Order Items
CREATE INDEX idx_service_order_items_order_id ON service_order_items(service_order_id);
CREATE INDEX idx_service_order_items_part_id ON service_order_items(part_id);

-- Appointments
CREATE INDEX idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX idx_appointments_vehicle_id ON appointments(vehicle_id);
CREATE INDEX idx_appointments_mechanic_id ON appointments(mechanic_id);
CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX idx_appointments_scheduled_start ON appointments(scheduled_start_at);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Stock Movements
CREATE INDEX idx_stock_movements_part_id ON stock_movements(part_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);

-- Purchase Orders
CREATE INDEX idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at);

-- Transactions
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_service_order_id ON transactions(service_order_id);
CREATE INDEX idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

-- ============================================================================
-- INITIAL DATA (Optional)
-- ============================================================================

-- Insert default system settings
INSERT OR IGNORE INTO system_settings (key, value, description) VALUES
('app_name', 'POS Bengkel GO', 'Application name'),
('currency', 'IDR', 'Currency code'),
('tax_rate', '10', 'Default tax rate percentage'),
('workshop_name', 'Default Workshop', 'Workshop/location name'),
('sync_enabled', '1', 'Enable sync with central database'),
('offline_mode', '1', 'Allow offline operations'),
('created_at', CURRENT_TIMESTAMP, 'System initialization');

COMMIT;

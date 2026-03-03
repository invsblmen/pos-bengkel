import { usePage } from "@inertiajs/react";
import {
    IconBooks,
    IconBox,
    IconCar,
    IconCategory,
    IconChartArrowsVertical,
    IconChartBarPopular,
    IconChartInfographic,
    IconCirclePlus,
    IconClockHour6,
    IconCreditCard,
    IconFileCertificate,
    IconFileDescription,
    IconFolder,
    IconHistory,
    IconLayout2,
    IconReceipt,
    IconSchool,
    IconShoppingCart,
    IconTable,
    IconUserBolt,
    IconUserShield,
    IconUserSquare,
    IconUsers,
    IconUsersPlus,
    IconArrowUp,
    IconArrowDown,
    IconTrendingUp,
    IconCalendar,
    IconPackage,
    IconAlertCircle,
    IconBuildingStore,
} from "@tabler/icons-react";
import hasAnyPermission from "./Permission";
import React from "react";

export default function Menu() {
    // define use page
    const { url } = usePage();

    // define menu navigations
    const menuNavigation = [
        {
            title: "Overview",
            details: [
                {
                    title: "Dashboard",
                    href: route("dashboard"),
                    active: url === "/dashboard",
                    icon: <IconLayout2 size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["dashboard-access"]),
                },
            ],
        },
        {
            title: "Data Master",
            details: [
                {
                    title: "Kategori",
                    href: route("categories.index"),
                    active: url === "/dashboard/categories" || url.startsWith("/dashboard/categories"),
                    icon: <IconFolder size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["categories-access"]),
                },
                {
                    title: "Produk",
                    href: route("products.index"),
                    active: url === "/dashboard/products" || url.startsWith("/dashboard/products"),
                    icon: <IconBox size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["products-access"]),
                },
                {
                    title: "Pelanggan",
                    href: route("customers.index"),
                    active: url === "/dashboard/customers" || url.startsWith("/dashboard/customers"),
                    icon: <IconUsersPlus size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["customers-access"]),
                },
                {
                    title: "Kendaraan",
                    href: route("vehicles.index"),
                    active: url === "/dashboard/vehicles" || url.startsWith("/dashboard/vehicles"),
                    icon: <IconCar size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["vehicles-access"]),
                },
                {
                    title: "Supplier",
                    href: route("suppliers.index"),
                    active: url === "/dashboard/suppliers" || url.startsWith("/dashboard/suppliers"),
                    icon: <IconFileCertificate size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["suppliers-access"]),
                },
            ],
        },
        {
            title: "Inventory Sparepart",
            details: [
                {
                    title: "Daftar Sparepart",
                    href: route("parts.index"),
                    active: url === "/dashboard/parts" && !url.includes("/stock") && !url.includes("/sales") && !url.includes("/part-purchases"),
                    icon: <IconPackage size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["parts-access"]),
                },
                {
                    title: "Stok Minimal",
                    href: route("parts.low-stock"),
                    active: url.includes("/dashboard/parts/low-stock"),
                    icon: <IconAlertCircle size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["parts-access"]),
                },
                {
                    title: "Pembelian Sparepart",
                    href: route("part-purchases.index"),
                    active: url.includes("/dashboard/part-purchases"),
                    icon: <IconArrowDown size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["part-purchases-access"]),
                },
                {
                    title: "Penjualan Sparepart",
                    href: route("part-sales.index"),
                    active: url.includes("/dashboard/part-sales"),
                    icon: <IconArrowUp size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["part-sales-access"]),
                },
                {
                    title: "Stock Movement",
                    icon: <IconHistory size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["part-stock-history-access", "parts-stock-access"]),
                    subdetails: [
                        {
                            title: "History Transaksi",
                            href: route("part-stock-history.index"),
                            active: url.includes("/dashboard/part-stock-history"),
                            icon: <IconHistory size={20} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["part-stock-history-access", "parts-stock-access"]),
                        },
                        {
                            title: "Sparepart Masuk",
                            href: route("parts.stock.in.create"),
                            active: url.includes("/dashboard/parts/stock/in"),
                            icon: <IconArrowUp size={20} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["parts-stock-in"]),
                        },
                        {
                            title: "Sparepart Keluar",
                            href: route("parts.stock.out.create"),
                            active: url.includes("/dashboard/parts/stock/out"),
                            icon: <IconArrowDown size={20} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["parts-stock-out"]),
                        },
                    ],
                },
            ],
        },
        {
            title: "Workshop & Service",
            details: [
                {
                    title: "Daftar Layanan",
                    href: route("services.index"),
                    active: url === "/dashboard/services" || url.startsWith("/dashboard/services"),
                    icon: <IconBooks size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["services-access"]),
                },
                {
                    title: "Kategori Layanan",
                    href: route("service-categories.index"),
                    active: url === "/dashboard/service-categories" || url.startsWith("/dashboard/service-categories"),
                    icon: <IconCategory size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["service-categories-access"]),
                },
                {
                    title: "Service Orders",
                    href: route("service-orders.index"),
                    active: url === "/dashboard/service-orders" || url.startsWith("/dashboard/service-orders"),
                    icon: <IconFileDescription size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["service-orders-access"]),
                },
                {
                    title: "Mekanik",
                    icon: <IconUserSquare size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["mechanics-access"]),
                    subdetails: [
                        {
                            title: "Daftar Mekanik",
                            href: route("mechanics.index"),
                            active: url === "/dashboard/mechanics" || (url.startsWith("/dashboard/mechanics") && !url.includes("/performance")),
                            icon: <IconTable size={20} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["mechanics-access"]),
                        },
                        {
                            title: "Performa Mekanik",
                            href: route("mechanics.performance.dashboard"),
                            active: url.startsWith("/dashboard/mechanics/performance"),
                            icon: <IconTrendingUp size={20} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["mechanics-access"]),
                        },
                    ],
                },
                {
                    title: "Appointments",
                    icon: <IconClockHour6 size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["appointments-access"]),
                    subdetails: [
                        {
                            title: "Daftar Appointments",
                            href: route("appointments.index"),
                            active: url === "/dashboard/appointments" || (url.startsWith("/dashboard/appointments") && !url.includes("/calendar")),
                            icon: <IconTable size={20} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["appointments-access"]),
                        },
                        {
                            title: "Kalender Appointments",
                            href: route("appointments.calendar"),
                            active: url.startsWith("/dashboard/appointments/calendar"),
                            icon: <IconCalendar size={20} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["appointments-access"]),
                        },
                    ],
                },
            ],
        },
        {
            title: "Transaksi & Laporan",
            details: [
                {
                    title: "Transaksi",
                    href: route("transactions.index"),
                    active: url === "/dashboard/transactions",
                    icon: <IconShoppingCart size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["transactions-access"]),
                },
                {
                    title: "Riwayat Transaksi",
                    href: route("transactions.history"),
                    active: url === "/dashboard/transactions/history",
                    icon: <IconClockHour6 size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["transactions-access"]),
                },
                {
                    title: "Laporan Penjualan",
                    href: route("reports.sales.index"),
                    active: url.startsWith("/dashboard/reports/sales"),
                    icon: <IconChartArrowsVertical size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["reports-access"]),
                },
                {
                    title: "Laporan Keuntungan",
                    href: route("reports.profits.index"),
                    active: url.startsWith("/dashboard/reports/profits") && !url.startsWith("/dashboard/reports/part-sales-profit"),
                    icon: <IconChartBarPopular size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["profits-access"]),
                },
                {
                    title: "Profit Sparepart",
                    href: route("reports.part-sales-profit.index"),
                    active: url.startsWith("/dashboard/reports/part-sales-profit"),
                    icon: <IconTrendingUp size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["reports-access"]),
                },
                {
                    title: "Laporan Lanjutan",
                    icon: <IconChartInfographic size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["reports-access"]),
                    subdetails: [
                        {
                            title: "Revenue Servis",
                            href: route("reports.service-revenue.index"),
                            active: url.startsWith("/dashboard/reports/service-revenue"),
                            icon: <IconTrendingUp size={20} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["reports-access"]),
                        },
                        {
                            title: "Produktivitas Mekanik",
                            href: route("reports.mechanic-productivity.index"),
                            active: url.startsWith("/dashboard/reports/mechanic-productivity"),
                            icon: <IconUserSquare size={20} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["reports-access"]),
                        },
                        {
                            title: "Inventory Sparepart",
                            href: route("reports.parts-inventory.index"),
                            active: url.startsWith("/dashboard/reports/parts-inventory"),
                            icon: <IconPackage size={20} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["reports-access"]),
                        },
                        {
                            title: "Pembayaran Tertunggak",
                            href: route("reports.outstanding-payments.index"),
                            active: url.startsWith("/dashboard/reports/outstanding-payments"),
                            icon: <IconAlertCircle size={20} strokeWidth={1.5} />,
                            permissions: hasAnyPermission(["reports-access"]),
                        },
                    ],
                },
            ],
        },
        {
            title: "Administrasi",
            details: [
                {
                    title: "Hak Akses",
                    href: route("permissions.index"),
                    active: url === "/dashboard/permissions" || url.startsWith("/dashboard/permissions"),
                    icon: <IconUserBolt size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["permissions-access"]),
                },
                {
                    title: "Akses Group",
                    href: route("roles.index"),
                    active: url === "/dashboard/roles" || url.startsWith("/dashboard/roles"),
                    icon: <IconUserShield size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["roles-access"]),
                },
                {
                    title: "Pengguna",
                    icon: <IconUsers size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["users-access"]),
                    subdetails: [
                        {
                            title: "Data Pengguna",
                            href: route("users.index"),
                            icon: <IconTable size={20} strokeWidth={1.5} />,
                            active: url === "/dashboard/users",
                            permissions: hasAnyPermission(["users-access"]),
                        },
                        {
                            title: "Tambah Pengguna",
                            href: route("users.create"),
                            icon: <IconCirclePlus size={20} strokeWidth={1.5} />,
                            active: url === "/dashboard/users/create",
                            permissions: hasAnyPermission(["users-create"]),
                        },
                    ],
                },
                {
                    title: "Payment Gateway",
                    href: route("settings.payments.edit"),
                    active: url === "/dashboard/settings/payments",
                    icon: <IconCreditCard size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["payment-settings-access"]),
                },
                {
                    title: "Profil Bisnis",
                    href: route("settings.business-profile.edit"),
                    active: url === "/dashboard/settings/business-profile",
                    icon: <IconBuildingStore size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["payment-settings-access"]),
                },
            ],
        },
    ];

    return menuNavigation;
}

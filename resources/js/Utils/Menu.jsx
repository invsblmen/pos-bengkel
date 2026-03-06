import { usePage } from "@inertiajs/react";
import {
    IconBooks,
    IconCar,
    IconChartInfographic,
    IconCirclePlus,
    IconCreditCard,
    IconFileCertificate,
    IconFileDescription,
    IconHistory,
    IconLayout2,
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
    IconCash,
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
                    title: "Sparepart",
                    href: route("parts.index"),
                    active: url === "/dashboard/parts" && !url.includes("/stock") && !url.includes("/sales") && !url.includes("/part-purchases"),
                    icon: <IconPackage size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["parts-access"]),
                },
                {
                    title: "Layanan",
                    href: route("services.index"),
                    active: url === "/dashboard/services" || url.startsWith("/dashboard/services"),
                    icon: <IconBooks size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["services-access"]),
                },
                {
                    title: "Mekanik",
                    href: route("mechanics.index"),
                    active: url === "/dashboard/mechanics" || (url.startsWith("/dashboard/mechanics") && !url.includes("/performance")),
                    icon: <IconUserSquare size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["mechanics-access"]),
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
            title: "Transaksi",
            details: [
                {
                    title: "Service Orders",
                    href: route("service-orders.index"),
                    active: url === "/dashboard/service-orders" || url.startsWith("/dashboard/service-orders"),
                    icon: <IconFileDescription size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["service-orders-access"]),
                },
                {
                    title: "Penjualan Sparepart",
                    href: route("part-sales.index"),
                    active: url.includes("/dashboard/part-sales"),
                    icon: <IconArrowUp size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["part-sales-access"]),
                },
                {
                    title: "Pembelian Sparepart",
                    href: route("part-purchases.index"),
                    active: url.includes("/dashboard/part-purchases"),
                    icon: <IconArrowDown size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["part-purchases-access"]),
                },
                {
                    title: "Appointment",
                    href: route("appointments.calendar"),
                    active: url.startsWith("/dashboard/appointments/calendar") || url === "/dashboard/appointments",
                    icon: <IconCalendar size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["appointments-access"]),
                    disableWhenActive: true,
                },
            ],
        },
        {
            title: "Operasional Bengkel",
            details: [
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
                {
                    title: "Performa Mekanik",
                    href: route("mechanics.performance.dashboard"),
                    active: url.startsWith("/dashboard/mechanics/performance"),
                    icon: <IconTrendingUp size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["mechanics-access"]),
                },
                {
                    title: "Akuntansi Kas",
                    href: route("cash-management.index"),
                    active: url.startsWith("/dashboard/cash-management"),
                    icon: <IconCash size={20} strokeWidth={1.5} />,
                    permissions: hasAnyPermission(["cash-management-access"]),
                },
            ],
        },
        {
            title: "Laporan Bengkel",
            details: [
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
                            title: "Gaji Mekanik",
                            href: route("reports.mechanic-payroll.index"),
                            active: url.startsWith("/dashboard/reports/mechanic-payroll"),
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

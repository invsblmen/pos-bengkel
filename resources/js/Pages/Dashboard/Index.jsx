import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useRef } from "react";
import Chart from "chart.js/auto";
import {
    IconBox,
    IconCategory,
    IconMoneybag,
    IconUsers,
    IconCoin,
    IconReceipt,
    IconTrendingUp,
    IconArrowUpRight,
    IconArrowDownRight,
    IconShoppingCart,
    IconChartBar,
    IconClock,
    IconTool,
    IconUser,
    IconPackage,
    IconAlertTriangle,
} from "@tabler/icons-react";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

// Stat Card Component
function StatCard({ title, value, subtitle, icon: Icon, gradient, trend }) {
    return (
        <div
            className={`
            relative overflow-hidden rounded-2xl p-5
            bg-gradient-to-br ${gradient}
            text-white shadow-lg
        `}
        >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
                <Icon
                    size={128}
                    strokeWidth={0.5}
                    className="transform translate-x-8 -translate-y-8"
                />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-xl bg-white/20">
                        <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-medium opacity-90">
                        {title}
                    </span>
                </div>

                <p className="text-3xl font-bold">{value}</p>

                {subtitle && (
                    <p className="mt-2 text-sm opacity-80 flex items-center gap-1">
                        {trend === "up" && <IconArrowUpRight size={14} />}
                        {trend === "down" && <IconArrowDownRight size={14} />}
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}

// Info Card Component
function InfoCard({ title, value, subtitle, icon: Icon }) {
    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {title}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {value}
                    </p>
                    {subtitle && (
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Icon size={14} />
                            {subtitle}
                        </p>
                    )}
                </div>
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <Icon
                        size={24}
                        className="text-slate-600 dark:text-slate-400"
                        strokeWidth={1.5}
                    />
                </div>
            </div>
        </div>
    );
}

// List Card Component
function ListCard({ title, subtitle, icon: Icon, children, emptyMessage }) {
    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                        <Icon
                            size={18}
                            className="text-primary-600 dark:text-primary-400"
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {title}
                        </h3>
                        {subtitle && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
            </div>
            <div className="p-5">
                {children || (
                    <div className="flex h-32 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                        {emptyMessage}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Dashboard({
    revenueTrend,
    workshop = {},
}) {
    const { auth } = usePage().props;
    const canSeeManagerial = Boolean(
        auth?.super || auth?.permissions?.["reports-access"]
    );

    const chartRef = useRef(null);
    const chartInstance = useRef(null);

    const chartData = useMemo(() => revenueTrend ?? [], [revenueTrend]);
    const recentWorkshopOrders = workshop?.recentOrders ?? [];
    const urgentLowStockParts = workshop?.urgentLowStockParts ?? [];

    // Setup chart
    useEffect(() => {
        if (!chartRef.current) return;

        if (chartInstance.current) {
            chartInstance.current.destroy();
            chartInstance.current = null;
        }

        if (!chartData.length) return;

        const labels = chartData.map((item) => item.label);
        const totals = chartData.map((item) => item.total);

        const ctx = chartRef.current.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, "rgba(99, 102, 241, 0.3)");
        gradient.addColorStop(1, "rgba(99, 102, 241, 0.01)");

        chartInstance.current = new Chart(chartRef.current, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Pendapatan (Part + Service)",
                        data: totals,
                        borderColor: "#6366f1",
                        backgroundColor: gradient,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: "#6366f1",
                        pointHoverBorderColor: "#fff",
                        pointHoverBorderWidth: 2,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index",
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#1e293b",
                        titleColor: "#f1f5f9",
                        bodyColor: "#f1f5f9",
                        padding: 12,
                        borderRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => formatCurrency(ctx.raw),
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => formatCurrency(value),
                            color: "#94a3b8",
                            font: { size: 11 },
                        },
                        grid: {
                            color: "rgba(148, 163, 184, 0.1)",
                            drawBorder: false,
                        },
                        border: { display: false },
                    },
                    x: {
                        ticks: {
                            color: "#94a3b8",
                            font: { size: 11 },
                        },
                        grid: { display: false },
                        border: { display: false },
                    },
                },
            },
        });

        return () => chartInstance.current?.destroy();
    }, [chartData]);

    return (
        <>
            <Head title="Dashboard" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Dashboard Bengkel
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Fokus operasional harian: service, mekanik, dan sparepart
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={route("service-orders.create")}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors shadow-lg shadow-primary-500/30"
                        >
                            <IconTool size={18} />
                            <span>Service Order Baru</span>
                        </Link>
                        <Link
                            href={route("part-sales.create")}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
                        >
                            <IconPackage size={18} />
                            <span>Input Penjualan Part</span>
                        </Link>
                    </div>
                </div>

                {/* Main Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Pendapatan Service Hari Ini"
                        value={formatCurrency(workshop.todayRevenue || 0)}
                        subtitle="Order service yang selesai"
                        icon={IconCoin}
                        gradient="from-emerald-500 to-emerald-700"
                    />
                    <StatCard
                        title="Order Menunggu"
                        value={workshop.pendingOrders || 0}
                        subtitle="Belum mulai dikerjakan"
                        icon={IconClock}
                        gradient="from-amber-500 to-amber-600"
                    />
                    <StatCard
                        title="Sedang Dikerjakan"
                        value={workshop.inProgressOrders || 0}
                        subtitle="Service order aktif"
                        icon={IconTool}
                        gradient="from-blue-500 to-blue-700"
                    />
                    <StatCard
                        title="Selesai Hari Ini"
                        value={workshop.completedOrdersToday || 0}
                        subtitle="Order yang rampung"
                        icon={IconReceipt}
                        gradient="from-green-500 to-green-700"
                        trend="up"
                    />
                </div>

                {/* Workshop Secondary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <InfoCard
                        title="Total Service Order"
                        value={workshop.totalServiceOrders || 0}
                        subtitle="Semua waktu"
                        icon={IconTool}
                    />
                    <InfoCard
                        title="Mekanik Aktif"
                        value={`${workshop.activeMechanics || 0}/${workshop.totalMechanics || 0}`}
                        subtitle="Aktif / total"
                        icon={IconUser}
                    />
                    <InfoCard
                        title="Part Menunggu Stok"
                        value={workshop.waitingStockSales || 0}
                        subtitle="Penjualan status waiting stock"
                        icon={IconAlertTriangle}
                    />
                    <InfoCard
                        title="Siap Diambil"
                        value={workshop.readyPickupSales || 0}
                        subtitle="ready_to_notify / waiting_pickup"
                        icon={IconShoppingCart}
                    />
                </div>

                {/* Charts and Lists Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Revenue Chart */}
                    <ListCard
                        title="Tren Pendapatan Service"
                        subtitle="12 hari terakhir order selesai"
                        icon={IconChartBar}
                        emptyMessage="Belum ada data pendapatan"
                    >
                        {chartData.length > 0 && (
                            <div className="h-64">
                                <canvas ref={chartRef} />
                            </div>
                        )}
                    </ListCard>

                    {/* Recent Service Orders */}
                    <ListCard
                        title="Service Order Terbaru"
                        subtitle="Prioritas operasional saat ini"
                        icon={IconTool}
                        emptyMessage="Belum ada service order"
                    >
                        {recentWorkshopOrders.length > 0 && (
                            <ul className="space-y-3">
                                {recentWorkshopOrders.map((order, index) => (
                                    <li
                                        key={index}
                                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 text-xs font-bold flex items-center justify-center">
                                                {index + 1}
                                            </span>
                                            <div>
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                                    {order.order_number}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {order.customer} • {order.vehicle}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {order.status}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </ListCard>
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Urgent Low Stock */}
                    <ListCard
                        title="Sparepart Perlu Restock"
                        subtitle="Top 5 yang paling mendesak"
                        icon={IconAlertTriangle}
                        emptyMessage="Semua stok sparepart aman"
                    >
                        {urgentLowStockParts.length > 0 && (
                            <div className="space-y-3">
                                {urgentLowStockParts.map((part, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                                {part.name}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                Stok: {part.stock} • Reorder: {part.reorder_level}
                                            </p>
                                        </div>
                                        <Link
                                            href={route("parts.index", { filter: "low_stock", q: part.name })}
                                            className="text-sm font-bold text-primary-600 dark:text-primary-400"
                                        >
                                            Buka
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ListCard>

                    {canSeeManagerial && (
                        <ListCard
                            title="Monitoring Laporan Bengkel"
                            subtitle="Akses cepat laporan yang relevan"
                            icon={IconChartBar}
                            emptyMessage=""
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Link href={route("reports.service-revenue.index")} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Revenue Service</p>
                                    <p className="text-xs text-slate-500">Analisis pendapatan layanan</p>
                                </Link>
                                <Link href={route("reports.mechanic-productivity.index")} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Produktivitas Mekanik</p>
                                    <p className="text-xs text-slate-500">Order, revenue, dan performa</p>
                                </Link>
                                <Link href={route("reports.mechanic-payroll.index")} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Gaji Mekanik</p>
                                    <p className="text-xs text-slate-500">Estimasi take-home pay</p>
                                </Link>
                                <Link href={route("reports.outstanding-payments.index")} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Pembayaran Tertunda</p>
                                    <p className="text-xs text-slate-500">Pantau tagihan service</p>
                                </Link>
                            </div>
                        </ListCard>
                    )}
                </div>
            </div>
        </>
    );
}

Dashboard.layout = (page) => <DashboardLayout children={page} />;

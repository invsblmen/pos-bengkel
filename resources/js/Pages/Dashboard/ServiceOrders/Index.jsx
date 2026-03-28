import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Pagination from '@/Components/Dashboard/Pagination';
import { useVisibilityRealtime } from '@/Hooks/useRealtime';
import {
    IconPlus,
    IconSearch,
    IconEye,
    IconClock,
    IconCalendar,
    IconTool,
    IconEdit,
    IconChevronDown,
    IconFilter,
    IconX,
    IconClockHour4,
    IconCircleCheck,
    IconWallet,
    IconFileDescription,
    IconCurrencyDollar,
    IconLayoutGrid,
    IconList,
    IconUser,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { toDisplayDateTime } from '@/Utils/datetime';

const statusMeta = {
    all: { label: 'Semua', chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    pending: { label: 'Menunggu', chip: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
    in_progress: { label: 'Dikerjakan', chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    completed: { label: 'Selesai', chip: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    paid: { label: 'Lunas', chip: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' },
    cancelled: { label: 'Batal', chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

function StatCard({ title, value, subtitle, icon, tone }) {
    const tones = {
        yellow: 'from-yellow-50 to-yellow-100 border-yellow-200 dark:from-yellow-900/20 dark:to-yellow-800/20 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
        blue: 'from-blue-50 to-blue-100 border-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 dark:border-blue-800 text-blue-800 dark:text-blue-200',
        green: 'from-green-50 to-green-100 border-green-200 dark:from-green-900/20 dark:to-green-800/20 dark:border-green-800 text-green-800 dark:text-green-200',
        indigo: 'from-indigo-50 to-indigo-100 border-indigo-200 dark:from-indigo-900/20 dark:to-indigo-800/20 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200',
        primary: 'from-primary-50 to-primary-100 border-primary-200 dark:from-primary-900/20 dark:to-primary-800/20 dark:border-primary-800 text-primary-800 dark:text-primary-200',
    };

    return (
        <div className={`h-full rounded-2xl border bg-gradient-to-br p-4 ${tones[tone]}`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
                    <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
                    <p className="text-xs opacity-80">{subtitle}</p>
                </div>
                <div className="rounded-xl bg-white/70 dark:bg-slate-900/40 p-2.5">{icon}</div>
            </div>
        </div>
    );
}

function EmptyState({ hasFilters, onReset }) {
    return (
        <div className="py-16 text-center">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 mb-4">
                <IconTool size={40} className="text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Belum ada order layanan</h3>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                {hasFilters
                    ? 'Tidak ada order yang sesuai dengan filter yang diterapkan.'
                    : 'Mulai dengan membuat order layanan pertama Anda.'}
            </p>
            {hasFilters ? (
                <button
                    onClick={onReset}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-colors"
                >
                    <IconX size={18} />
                    Reset Filter
                </button>
            ) : (
                <Link
                    href={route('service-orders.create')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors shadow-sm"
                >
                    <IconPlus size={18} />
                    Tambah Order Pertama
                </Link>
            )}
        </div>
    );
}

export default function Index({ orders, stats, mechanics, filters }) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || 'all');
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');
    const [mechanicId, setMechanicId] = useState(filters.mechanic_id || 'all');
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState('table');
    const [liveServiceOrders, setLiveServiceOrders] = useState(orders?.data || []);

    useEffect(() => {
        setLiveServiceOrders(orders?.data || []);
    }, [orders?.data]);

    useEffect(() => {
        if (!window.Echo) return;

        const channel = window.Echo.channel('workshop.serviceorders');

        channel.listen('.serviceorder.created', (event) => {
            const incomingOrder = event?.order;
            if (!incomingOrder?.id) return;
            setLiveServiceOrders((prev) => {
                const exists = prev.some((o) => o.id === incomingOrder.id);
                return exists ? prev : [incomingOrder, ...prev];
            });
        });

        channel.listen('.serviceorder.deleted', (event) => {
            const deletedOrderId = event?.orderId;
            if (!deletedOrderId) return;
            setLiveServiceOrders((prev) => prev.filter((o) => o.id !== deletedOrderId));
        });

        channel.listen('.serviceorder.updated', (event) => {
            const updatedOrder = event?.order;
            if (!updatedOrder?.id) return;
            setLiveServiceOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
        });

        return () => {
            window.Echo.leaveChannel('workshop.serviceorders');
        };
    }, []);

    useVisibilityRealtime({
        interval: 5000,
        only: ['orders', 'stats'],
        preserveScroll: true,
        preserveState: true,
    });

    const handleFilter = (e) => {
        e?.preventDefault();
        router.get(
            route('service-orders.index'),
            {
                search: search || undefined,
                status: status !== 'all' ? status : undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                mechanic_id: mechanicId !== 'all' ? mechanicId : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handleReset = () => {
        setSearch('');
        setStatus('all');
        setDateFrom('');
        setDateTo('');
        setMechanicId('all');
        router.get(route('service-orders.index'));
    };

    const handleQuickStatusFilter = (newStatus) => {
        setStatus(newStatus);
        router.get(
            route('service-orders.index'),
            {
                search: search || undefined,
                status: newStatus !== 'all' ? newStatus : undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                mechanic_id: mechanicId !== 'all' ? mechanicId : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handleStatusChange = (orderId, newStatus) => {
        router.post(
            route('service-orders.update-status', orderId),
            { status: newStatus },
            {
                preserveScroll: true,
                onSuccess: () => toast.success('Status berhasil diperbarui!'),
                onError: () => toast.error('Gagal memperbarui status!'),
            }
        );
    };

    const formatPrice = (price) =>
        new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(Number(price || 0));

    const formatDate = (dateString) => (dateString ? toDisplayDateTime(dateString) : '-');

    const getMaintenanceAlertStatus = (order) => {
        if (!order.next_service_km && !order.next_service_date) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (order.next_service_date) {
            const nextServiceDate = new Date(order.next_service_date);
            const daysUntilService = Math.ceil((nextServiceDate - today) / (1000 * 60 * 60 * 24));

            if (daysUntilService < 0) {
                return {
                    label: `Overdue ${Math.abs(daysUntilService)} hari`,
                    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                };
            }

            if (daysUntilService <= 7) {
                return {
                    label: `${daysUntilService} hari lagi`,
                    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                };
            }
        }

        return null;
    };

    const activeFiltersCount = [
        search,
        status !== 'all',
        dateFrom,
        dateTo,
        mechanicId !== 'all',
    ].filter(Boolean).length;

    const statusChips = ['all', 'pending', 'in_progress', 'completed', 'paid', 'cancelled'];

    const compactRevenue = useMemo(() => {
        const value = Number(stats.total_revenue || 0);
        if (value >= 1000000000) return `Rp ${(value / 1000000000).toFixed(1)}B`;
        if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(1)}Jt`;
        return formatPrice(value);
    }, [stats.total_revenue]);

    return (
        <>
            <Head title="Service Orders" />

            <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white via-primary-50/50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 md:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-600 dark:text-primary-400">Workshop Operations</p>
                            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Order Layanan Service</h1>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Tampilan baru yang lebih compact untuk monitor dan update order lebih cepat.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('table')}
                                    className={`p-2 rounded-lg ${viewMode === 'table' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    <IconList size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('card')}
                                    className={`p-2 rounded-lg ${viewMode === 'card' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                >
                                    <IconLayoutGrid size={18} />
                                </button>
                            </div>
                            <Link
                                href={route('service-orders.create')}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
                            >
                                <IconPlus size={18} />
                                Order Baru
                            </Link>
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 auto-rows-fr lg:grid-cols-5 gap-3">
                        <StatCard title="Menunggu" value={stats.pending} subtitle="Belum dikerjakan" icon={<IconFileDescription size={20} />} tone="yellow" />
                        <StatCard title="Dikerjakan" value={stats.in_progress} subtitle="Dalam proses" icon={<IconClockHour4 size={20} />} tone="blue" />
                        <StatCard title="Selesai" value={stats.completed} subtitle="Order selesai" icon={<IconCircleCheck size={20} />} tone="green" />
                        <StatCard title="Lunas" value={stats.paid} subtitle="Sudah dibayar" icon={<IconWallet size={20} />} tone="indigo" />
                        <StatCard title="Revenue" value={compactRevenue} subtitle="Completed + Paid" icon={<IconCurrencyDollar size={20} />} tone="primary" />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        {statusChips.map((key) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => handleQuickStatusFilter(key)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                    status === key
                                        ? 'border-primary-500 bg-primary-500 text-white'
                                        : `border-transparent ${statusMeta[key].chip}`
                                }`}
                            >
                                {statusMeta[key].label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3">
                        <div className="flex-1 relative">
                            <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                                placeholder="Cari no order, pelanggan, kendaraan..."
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowFilters((prev) => !prev)}
                            className={`relative inline-flex items-center gap-2 px-4 py-2.5 border rounded-xl font-semibold text-sm ${
                                showFilters || activeFiltersCount > 0
                                    ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-300'
                                    : 'bg-white border-slate-300 text-slate-700 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300'
                            }`}
                        >
                            <IconFilter size={18} /> Filter
                            {activeFiltersCount > 0 && (
                                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-[10px] font-bold text-white">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleFilter}
                            className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl"
                        >
                            Terapkan
                        </button>
                    </div>

                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                                >
                                    <option value="all">Semua Status</option>
                                    <option value="pending">Menunggu</option>
                                    <option value="in_progress">Dikerjakan</option>
                                    <option value="completed">Selesai</option>
                                    <option value="paid">Sudah Dibayar</option>
                                    <option value="cancelled">Dibatalkan</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Dari Tanggal</label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Sampai Tanggal</label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Mekanik</label>
                                <select
                                    value={mechanicId}
                                    onChange={(e) => setMechanicId(e.target.value)}
                                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white"
                                >
                                    <option value="all">Semua Mekanik</option>
                                    {mechanics.map((mechanic) => (
                                        <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2 lg:col-span-4 flex flex-wrap justify-end gap-2 mt-1">
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl"
                                >
                                    <IconX size={16} /> Reset Filter
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFilter}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl"
                                >
                                    <IconFilter size={16} /> Terapkan Filter
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {liveServiceOrders && liveServiceOrders.length > 0 ? (
                        <>
                            {viewMode === 'table' ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                        <thead className="bg-slate-50 dark:bg-slate-800/70">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Order</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Pelanggan</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Mekanik</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Biaya</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Status</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {liveServiceOrders.map((order) => {
                                                const badge = statusMeta[order.status] || statusMeta.pending;
                                                const alert = getMaintenanceAlertStatus(order);
                                                const totalCost = Number(order.total || 0);

                                                return (
                                                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                        <td className="px-4 py-3">
                                                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{order.order_number}</div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(order.created_at)}</div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="text-sm text-slate-900 dark:text-slate-100">{order.customer?.name || '-'}</div>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">{order.vehicle?.brand || '-'} {order.vehicle?.model || ''} {order.vehicle?.plate_number ? `(${order.vehicle.plate_number})` : ''}</div>
                                                            {alert && <span className={`inline-flex mt-1 px-2 py-0.5 rounded text-[10px] font-semibold ${alert.color}`}>{alert.label}</span>}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{order.mechanic?.name || '-'}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatPrice(totalCost)}</div>
                                                            <div className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">Jasa {formatPrice(order.labor_cost || 0)}</div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <div className="relative inline-block">
                                                                <select
                                                                    value={order.status}
                                                                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                                    className={`appearance-none cursor-pointer rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold border-0 focus:ring-2 focus:ring-primary-500 ${badge.chip}`}
                                                                >
                                                                    <option value="pending">Menunggu</option>
                                                                    <option value="in_progress">Dikerjakan</option>
                                                                    <option value="completed">Selesai</option>
                                                                    <option value="paid">Sudah Dibayar</option>
                                                                    <option value="cancelled">Dibatalkan</option>
                                                                </select>
                                                                <IconChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Link href={route('service-orders.edit', order.id)} className="inline-flex min-w-[72px] items-center justify-center gap-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50">
                                                                    <IconEdit size={14} /> Edit
                                                                </Link>
                                                                <Link href={route('service-orders.show', order.id)} className="inline-flex min-w-[72px] items-center justify-center gap-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50">
                                                                    <IconEye size={14} /> Detail
                                                                </Link>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                                    {liveServiceOrders.map((order) => {
                                        const badge = statusMeta[order.status] || statusMeta.pending;
                                        const alert = getMaintenanceAlertStatus(order);
                                        return (
                                            <div key={order.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-800/30">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{order.order_number}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(order.created_at)}</p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${badge.chip}`}>{badge.label}</span>
                                                </div>

                                                <div className="mt-3 space-y-1.5 text-sm">
                                                    <p className="text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5"><IconUser size={14} /> {order.customer?.name || '-'}</p>
                                                    <p className="text-slate-600 dark:text-slate-400">{order.vehicle?.brand || '-'} {order.vehicle?.model || ''} {order.vehicle?.plate_number ? `(${order.vehicle.plate_number})` : ''}</p>
                                                    <p className="text-slate-600 dark:text-slate-400">Mekanik: {order.mechanic?.name || '-'}</p>
                                                </div>

                                                {alert && <span className={`inline-flex mt-3 px-2 py-0.5 rounded text-[10px] font-semibold ${alert.color}`}>{alert.label}</span>}

                                                <div className="mt-3 flex items-center justify-between">
                                                    <p className="text-sm font-black tabular-nums text-primary-700 dark:text-primary-300">{formatPrice(order.total || 0)}</p>
                                                    <div className="relative inline-block">
                                                        <select
                                                            value={order.status}
                                                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                            className={`appearance-none cursor-pointer rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold border-0 focus:ring-2 focus:ring-primary-500 ${badge.chip}`}
                                                        >
                                                            <option value="pending">Menunggu</option>
                                                            <option value="in_progress">Dikerjakan</option>
                                                            <option value="completed">Selesai</option>
                                                            <option value="paid">Sudah Dibayar</option>
                                                            <option value="cancelled">Dibatalkan</option>
                                                        </select>
                                                        <IconChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex items-center gap-2">
                                                    <Link href={route('service-orders.edit', order.id)} className="inline-flex min-w-[72px] items-center justify-center gap-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50">
                                                        <IconEdit size={14} /> Edit
                                                    </Link>
                                                    <Link href={route('service-orders.show', order.id)} className="inline-flex min-w-[72px] items-center justify-center gap-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50">
                                                        <IconEye size={14} /> Detail
                                                    </Link>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-900">
                                <Pagination links={orders.links} />
                            </div>
                        </>
                    ) : (
                        <EmptyState hasFilters={activeFiltersCount > 0} onReset={handleReset} />
                    )}
                </div>
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;

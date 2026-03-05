import React, { useState, useEffect } from 'react';
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
    IconCurrencyDollar
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { toDisplayDateTime } from '@/Utils/datetime';

export default function Index({ orders, stats, mechanics, filters }) {
    const [search, setSearch] = useState(filters.search || '');
    const [status, setStatus] = useState(filters.status || 'all');
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');
    const [mechanicId, setMechanicId] = useState(filters.mechanic_id || 'all');
    const [showFilters, setShowFilters] = useState(false);
    const [liveServiceOrders, setLiveServiceOrders] = useState(orders?.data || []);

    // Real-time listener for service orders
    useEffect(() => {
        if (!window.Echo) {
            console.warn('Echo not available - real-time updates disabled');
            return;
        }

        const channel = window.Echo.channel('workshop.serviceorders');

        channel.listen('.serviceorder.created', (event) => {
            console.log('Service order created event received:', event);
            const incomingOrder = event?.order;

            if (!incomingOrder?.id) {
                console.warn('Invalid service order data received');
                return;
            }

            setLiveServiceOrders(prev => {
                const exists = prev.some(o => o.id === incomingOrder.id);
                if (exists) {
                    console.log('Service order already in list, skipping');
                    return prev;
                }
                console.log('Adding new service order:', incomingOrder.order_number);
                return [incomingOrder, ...prev];
            });
        });

        channel.listen('.serviceorder.deleted', (event) => {
            console.log('Service order deleted event received:', event);
            const deletedOrderId = event?.orderId;

            if (!deletedOrderId) {
                console.warn('Invalid service order ID received');
                return;
            }

            setLiveServiceOrders(prev => {
                const filtered = prev.filter(o => o.id !== deletedOrderId);
                console.log('Removed service order with ID:', deletedOrderId);
                return filtered;
            });
        });

        channel.listen('.serviceorder.updated', (event) => {
            console.log('Service order updated event received:', event);
            const updatedOrder = event?.order;

            if (!updatedOrder?.id) {
                console.warn('Invalid service order data received');
                return;
            }

            setLiveServiceOrders(prev => {
                const index = prev.findIndex(o => o.id === updatedOrder.id);
                if (index === -1) {
                    console.log('Service order not found in list, skipping update');
                    return prev;
                }
                const updated = [...prev];
                updated[index] = updatedOrder;
                console.log('Updated service order:', updatedOrder.order_number);
                return updated;
            });
        });

        return () => {
            window.Echo.leaveChannel('workshop.serviceorders');
        };
    }, []);

    // Enable real-time updates - auto refresh every 5 seconds
    // Pause when tab not visible to save resources
    useVisibilityRealtime({
        interval: 5000,
        only: ['orders', 'stats'],
        preserveScroll: true,
        preserveState: true
    });

    const handleFilter = (e) => {
        e?.preventDefault();
        router.get(
            route('service-orders.index'),
            {
                search,
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

    const formatPrice = (price) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const formatDate = (dateString) => (dateString ? toDisplayDateTime(dateString) : '-');

    const getMaintenanceAlertStatus = (order) => {
        if (!order.next_service_km && !order.next_service_date) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const alerts = [];

        // Check by date
        if (order.next_service_date) {
            const nextServiceDate = new Date(order.next_service_date);
            const daysUntilService = Math.ceil((nextServiceDate - today) / (1000 * 60 * 60 * 24));

            if (daysUntilService < 0) {
                alerts.push({ type: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', days: Math.abs(daysUntilService) });
            } else if (daysUntilService <= 7) {
                alerts.push({ type: 'warning', label: `${daysUntilService} hari`, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', days: daysUntilService });
            }
        }

        return alerts.length > 0 ? alerts[0] : null;
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', label: 'Menunggu' },
            in_progress: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', label: 'Dikerjakan' },
            completed: { color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', label: 'Selesai' },
            paid: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', label: 'Sudah Dibayar' },
            cancelled: { color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', label: 'Dibatalkan' },
        };
        return badges[status] || badges.pending;
    };

    const handleStatusChange = (orderId, newStatus) => {
        router.post(
            route('service-orders.update-status', orderId),
            { status: newStatus },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Status berhasil diperbarui!');
                },
                onError: () => {
                    toast.error('Gagal memperbarui status!');
                },
            }
        );
    };

    const activeFiltersCount = [
        search,
        status !== 'all',
        dateFrom,
        dateTo,
        mechanicId !== 'all'
    ].filter(Boolean).length;

    return (
        <>
            <Head title="Service Orders" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Order Layanan Service
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Kelola pesanan layanan dan servis bengkel
                        </p>
                    </div>
                    <Link
                        href={route('service-orders.create')}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors shadow-sm"
                    >
                        <IconPlus size={20} />
                        <span>Order Baru</span>
                    </Link>
                </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-2xl p-5 border border-yellow-200 dark:border-yellow-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                                        Menunggu
                                    </p>
                                    <p className="mt-2 text-3xl font-bold text-yellow-900 dark:text-yellow-100">
                                        {stats.pending}
                                    </p>
                                </div>
                                <div className="p-3 bg-yellow-200 dark:bg-yellow-800 rounded-xl">
                                    <IconFileDescription size={24} className="text-yellow-700 dark:text-yellow-300" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-5 border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                        Dikerjakan
                                    </p>
                                    <p className="mt-2 text-3xl font-bold text-blue-900 dark:text-blue-100">
                                        {stats.in_progress}
                                    </p>
                                </div>
                                <div className="p-3 bg-blue-200 dark:bg-blue-800 rounded-xl">
                                    <IconClockHour4 size={24} className="text-blue-700 dark:text-blue-300" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl p-5 border border-green-200 dark:border-green-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                                        Selesai
                                    </p>
                                    <p className="mt-2 text-3xl font-bold text-green-900 dark:text-green-100">
                                        {stats.completed}
                                    </p>
                                </div>
                                <div className="p-3 bg-green-200 dark:bg-green-800 rounded-xl">
                                    <IconCircleCheck size={24} className="text-green-700 dark:text-green-300" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl p-5 border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                        Lunas
                                    </p>
                                    <p className="mt-2 text-3xl font-bold text-purple-900 dark:text-purple-100">
                                        {stats.paid}
                                    </p>
                                </div>
                                <div className="p-3 bg-purple-200 dark:bg-purple-800 rounded-xl">
                                    <IconWallet size={24} className="text-purple-700 dark:text-purple-300" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-2xl p-5 border border-primary-200 dark:border-primary-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-primary-700 dark:text-primary-300">
                                        Total Pendapatan
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-primary-900 dark:text-primary-100">
                                        {formatPrice(stats.total_revenue)}
                                    </p>
                                </div>
                                <div className="p-3 bg-primary-200 dark:bg-primary-800 rounded-xl">
                                    <IconCurrencyDollar size={24} className="text-primary-700 dark:text-primary-300" />
                                </div>
                            </div>
                        </div>
                    </div>

                {/* Search & Filter */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="p-6 space-y-4">
                        {/* Search Bar */}
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <IconSearch size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                                    placeholder="Cari order (nomor, pelanggan, kendaraan)..."
                                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                />
                                </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`relative inline-flex items-center gap-2 px-5 py-2.5 border rounded-xl font-medium transition-all ${
                                    showFilters || activeFiltersCount > 0
                                        ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-300'
                                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'
                                }`}
                                >
                                    <IconFilter size={20} />
                                    <span>Filter</span>
                                    {activeFiltersCount > 0 && (
                                        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                                            {activeFiltersCount}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={handleFilter}
                                    className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
                                >
                                    Cari
                                </button>
                            </div>

                        {/* Advanced Filters */}
                        {showFilters && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Status
                                    </label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
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
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Dari Tanggal
                                    </label>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        />
                                    </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Sampai Tanggal
                                    </label>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        />
                                    </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Mekanik
                                    </label>
                                    <select
                                        value={mechanicId}
                                        onChange={(e) => setMechanicId(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                        >
                                            <option value="all">Semua Mekanik</option>
                                            {mechanics.map((mechanic) => (
                                                <option key={mechanic.id} value={mechanic.id}>
                                                    {mechanic.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                <div className="lg:col-span-4 flex gap-3 justify-end">
                                    <button
                                        onClick={handleReset}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-colors"
                                        >
                                            <IconX size={18} />
                                            Reset Filter
                                    </button>
                                    <button
                                        onClick={handleFilter}
                                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
                                    >
                                        <IconFilter size={18} />
                                        Terapkan Filter
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {liveServiceOrders && liveServiceOrders.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                    <thead className="bg-slate-50 dark:bg-slate-900">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                    No. Order
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                Pelanggan & Kendaraan
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                Mekanik
                                            </th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                Tanggal
                                            </th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                Biaya
                                            </th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                Status
                                            </th>
                                            <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                Aksi
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                        {liveServiceOrders.map((order) => {
                                            const statusBadge = getStatusBadge(order.status);
                                            const totalCost = parseFloat(order.total || 0);
                                            const laborCost = parseFloat(order.labor_cost || 0);
                                            const materialCost = parseFloat(order.material_cost || 0);

                                            return (
                                                <tr
                                                    key={order.id}
                                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                                >
                                                    <td className="whitespace-nowrap px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
                                                                <IconFileDescription size={20} className="text-primary-600 dark:text-primary-400" />
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                                    {order.order_number}
                                                                </div>
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                        {formatDate(order.created_at)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                            {order.customer?.name || '-'}
                                                        </div>
                                                        {order.vehicle && (
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                                {order.vehicle.brand} {order.vehicle.model}
                                                                <span className="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs font-medium">
                                                                        {order.vehicle.plate_number}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {(() => {
                                                                const maintenanceAlert = getMaintenanceAlertStatus(order);
                                                                if (maintenanceAlert) {
                                                                    return (
                                                                        <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${maintenanceAlert.color}`}>
                                                                            {maintenanceAlert.type === 'overdue' ? (
                                                                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                                                </svg>
                                                                            ) : (
                                                                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                                </svg>
                                                                            )}
                                                                            <span>{maintenanceAlert.label}</span>
                                                                        </div>
                                                                    );
                                                                }
                                                            return null;
                                                        })()}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                            {order.mechanic?.name || (
                                                                <span className="text-slate-400 dark:text-slate-600 italic">
                                                                Belum ditentukan
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        {order.estimated_start_at && (
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                                                        <IconCalendar size={14} />
                                                                        <span>{formatDate(order.estimated_start_at)}</span>
                                                                    </div>
                                                                )}
                                                                {order.actual_start_at && (
                                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-600 dark:text-blue-400">
                                                                        <IconClock size={14} />
                                                                        <span>Mulai</span>
                                                                    </div>
                                                                )}
                                                                {order.actual_finish_at && (
                                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 dark:bg-green-900/20 rounded-lg text-xs text-green-600 dark:text-green-400">
                                                                        <IconCircleCheck size={14} />
                                                                        <span>Selesai</span>
                                                                    </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4">
                                                        <div className="text-center">
                                                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                                {formatPrice(totalCost)}
                                                            </div>
                                                            <div className="mt-1 space-y-0.5">
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                    Jasa: {formatPrice(laborCost)}
                                                                </div>
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                        Part: {formatPrice(materialCost)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="whitespace-nowrap px-6 py-4 text-center">
                                                            <div className="relative inline-block">
                                                                <select
                                                                    value={order.status}
                                                                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                                    className={`appearance-none cursor-pointer rounded-xl px-3 py-1.5 pr-8 text-xs font-semibold transition-all ${statusBadge.color} border-0 focus:ring-2 focus:ring-primary-500`}
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
                                                        <td className="whitespace-nowrap px-6 py-4">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <Link
                                                                    href={route('service-orders.edit', order.id)}
                                                                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 px-3 py-2 text-xs font-medium text-amber-700 transition-all hover:shadow-sm dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                                                                >
                                                                    <IconEdit size={16} />
                                                                    <span>Edit</span>
                                                                </Link>
                                                                <Link
                                                                    href={route('service-orders.show', order.id)}
                                                                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-100 hover:bg-blue-200 px-3 py-2 text-xs font-medium text-blue-700 transition-all hover:shadow-sm dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                                                                >
                                                                    <IconEye size={16} />
                                                                    <span>Detail</span>
                                                                </Link>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-900">
                                <Pagination links={orders.links} />
                            </div>
                        </>
                    ) : (
                        <div className="py-16 text-center">
                            <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700 mb-4">
                                <IconTool size={40} className="text-slate-400 dark:text-slate-500" />
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                                Belum ada order layanan
                            </h3>
                            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                                {activeFiltersCount > 0
                                    ? 'Tidak ada order yang sesuai dengan filter yang diterapkan.'
                                    : 'Mulai dengan membuat order layanan pertama Anda.'
                                }
                            </p>
                            {activeFiltersCount > 0 ? (
                                <button
                                    onClick={handleReset}
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
                    )}
                </div>
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;

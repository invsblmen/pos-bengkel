import React, { useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Pagination from '@/Components/Dashboard/Pagination';
import { IconFilter, IconSearch, IconX, IconCirclePlus, IconDatabaseOff, IconLayoutGrid, IconList, IconPencil, IconShoppingCart, IconReceipt } from '@tabler/icons-react';
import { useVisibilityRealtime } from '@/Hooks/useRealtime';

const defaultFilters = { search: '', status: '', payment_status: '', customer_id: '' };

const statusColors = {
    confirmed: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-100',
    draft: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-100',
    waiting_stock: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100',
    ready_to_notify: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-100',
    waiting_pickup: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-100',
    completed: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100',
    cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-100',
};

const paymentColors = {
    paid: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-100',
    partial: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100',
    unpaid: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800/60 dark:text-gray-100',
};

const statusLabel = {
    draft: '📝 Draft',
    confirmed: '✅ Dikonfirmasi',
    waiting_stock: '📦 Menunggu Stok',
    ready_to_notify: '🔔 Siap Diberitahu',
    waiting_pickup: '🛵 Menunggu Diambil',
    completed: '🎯 Selesai',
    cancelled: '❌ Dibatalkan',
};

export default function Index({ sales, filters, customers = [] }) {
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        ...(typeof filters !== 'undefined' ? filters : {}),
    });
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState('card');

    // Enable real-time updates - auto refresh every 5 seconds
    // Pause when tab not visible to save resources
    useVisibilityRealtime({
        interval: 5000,
        only: ['sales'],
        preserveScroll: true,
        preserveState: true
    });

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            ...(typeof filters !== 'undefined' ? filters : {}),
        });
    }, [filters]);

    const handleChange = (field, value) => {
        setFilterData((prev) => ({ ...prev, [field]: value }));
    };

    const applyFilters = (event) => {
        event?.preventDefault?.();
        router.get(route('part-sales.index'), filterData, {
            preserveScroll: true,
            preserveState: true,
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route('part-sales.index'), defaultFilters, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const formatCurrency = (value = 0) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

    const hasActiveFilters = filterData.search || filterData.status || filterData.payment_status || filterData.customer_id;

    const totalSalesValue = sales.data.reduce((sum, sale) => sum + (sale.grand_total || 0), 0);

    return (
        <>
            <Head title="Penjualan Sparepart" />

            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 -m-6 p-6">
                {/* Hero Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 rounded-2xl shadow-xl mb-6">
                    <div className="px-6 py-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm">
                                    <IconShoppingCart size={28} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                        Penjualan Sparepart
                                    </h1>
                                    <p className="text-emerald-100 mt-1">{sales?.total || 0} transaksi penjualan</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 lg:flex lg:gap-6">
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                                    <p className="text-emerald-100 text-xs font-medium mb-1">Total Transaksi</p>
                                    <p className="text-xl font-bold text-white">{sales?.total || 0}</p>
                                </div>
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
                                    <p className="text-emerald-100 text-xs font-medium mb-1">Nilai Penjualan</p>
                                    <p className="text-xl font-bold text-white">{formatCurrency(totalSalesValue)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-3 mt-6">
                            <div className="inline-flex items-center rounded-xl border-2 border-white/20 bg-white/10 backdrop-blur-sm p-1">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('card')}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                        viewMode === 'card'
                                            ? 'bg-white text-emerald-700 shadow-lg'
                                            : 'text-white hover:bg-white/10'
                                    }`}
                                    title="Card view"
                                >
                                    <IconLayoutGrid size={18} />
                                    <span>Card</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('table')}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                                        viewMode === 'table'
                                            ? 'bg-white text-emerald-700 shadow-lg'
                                            : 'text-white hover:bg-white/10'
                                    }`}
                                    title="Table view"
                                >
                                    <IconList size={18} />
                                    <span>List</span>
                                </button>
                            </div>
                            <button
                                onClick={() => setShowFilters((v) => !v)}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                    showFilters || hasActiveFilters
                                        ? 'bg-white text-emerald-700 shadow-lg'
                                        : 'bg-white/10 border-2 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm'
                                }`}
                            >
                                <IconFilter size={18} />
                                <span>Filter</span>
                                {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
                            </button>
                            <Link href={route('part-sales.create')}>
                                <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-emerald-700 text-sm font-bold shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200">
                                    <IconCirclePlus size={20} /> Penjualan Baru
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
                                    <IconFilter size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Filter Penjualan</h2>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">Saring data berdasarkan kriteria</p>
                                </div>
                            </div>
                        </div>
                        <form onSubmit={applyFilters}>
                            <div className="p-6 space-y-4">
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Cari</label>
                                        <div className="relative">
                                            <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={filterData.search}
                                                onChange={(e) => handleChange('search', e.target.value)}
                                                placeholder="Nomor penjualan, catatan..."
                                                className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Pelanggan</label>
                                        <select
                                            value={filterData.customer_id}
                                            onChange={(e) => handleChange('customer_id', e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
                                        >
                                            <option value="">Semua Pelanggan</option>
                                            {customers.map((customer) => (
                                                <option key={customer.id} value={customer.id}>
                                                    {customer.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Status</label>
                                        <select
                                            value={filterData.status}
                                            onChange={(e) => handleChange('status', e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
                                        >
                                            <option value="">Semua Status</option>
                                            <option value="draft">📝 Draft</option>
                                            <option value="confirmed">✅ Dikonfirmasi</option>
                                            <option value="waiting_stock">📦 Menunggu Stok</option>
                                            <option value="ready_to_notify">🔔 Siap Diberitahu</option>
                                            <option value="waiting_pickup">🛵 Menunggu Diambil</option>
                                            <option value="completed">🎯 Selesai</option>
                                            <option value="cancelled">❌ Dibatalkan</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Status Pembayaran</label>
                                        <select
                                            value={filterData.payment_status}
                                            onChange={(e) => handleChange('payment_status', e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
                                        >
                                            <option value="">Semua Pembayaran</option>
                                            <option value="unpaid">○ Belum Bayar</option>
                                            <option value="partial">◐ Sebagian</option>
                                            <option value="paid">✓ Lunas</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-end justify-end gap-3 pt-2">
                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold transition-all"
                                        >
                                            <IconX size={18} /> Reset
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold shadow-lg shadow-emerald-500/30 transition-all hover:scale-105"
                                    >
                                        <IconSearch size={18} /> Terapkan Filter
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* Content */}
                {sales.data.length > 0 ? (
                    viewMode === 'card' ? (
                        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                {sales.data.map((sale) => (
                                    <div key={sale.id} className="group rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 shadow-md hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:border-emerald-300 dark:hover:border-emerald-700 overflow-hidden">
                                        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 px-5 py-4 border-b-2 border-emerald-200 dark:border-emerald-700/30">
                                            <div className="flex items-center justify-between">
                                                <Link href={route('part-sales.show', sale.id)} className="text-lg font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors">
                                                    {sale.sale_number}
                                                </Link>
                                                <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border-2 shadow-sm ${
                                                    statusColors[sale.status] || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-gray-200'
                                                }`}>
                                                    {statusLabel[sale.status] || sale.status}
                                                </span>
                                            </div>
                                            <div className="mt-3 space-y-2 text-sm">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-600 dark:text-slate-400 font-medium">Pelanggan</span>
                                                    <span className="font-bold text-slate-900 dark:text-white">{sale.customer?.name || '-'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-600 dark:text-slate-400 font-medium">Tanggal</span>
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('id-ID') : '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-5 space-y-4">
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                                                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total Penjualan</span>
                                                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(sale.grand_total)}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Status Bayar</span>
                                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border-2 shadow-sm ${
                                                        paymentColors[sale.payment_status] || paymentColors.unpaid
                                                    }`}>
                                                        {sale.payment_status === 'paid' ? '✓ Lunas' : sale.payment_status === 'partial' ? '◐ Sebagian' : '○ Belum Bayar'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 pt-2">
                                                <Link
                                                    href={route('part-sales.show', sale.id)}
                                                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-bold hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/30 transition-all hover:scale-105"
                                                >
                                                    <IconReceipt size={16} /> Lihat Detail
                                                </Link>
                                                {sale.status === 'draft' && (
                                                    <Link
                                                        href={route('part-sales.edit', sale.id)}
                                                        className="inline-flex items-center justify-center w-11 h-11 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-emerald-500 hover:text-emerald-600 transition-all hover:scale-110"
                                                        title="Edit Penjualan"
                                                    >
                                                        <IconPencil size={18} />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-200 dark:border-slate-700">
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Nomor Penjualan</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Pelanggan</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tanggal</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Pembayaran</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {sales.data.map((sale) => (
                                            <tr key={sale.id} className="hover:bg-emerald-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                                    <Link href={route('part-sales.show', sale.id)} className="hover:underline">
                                                        {sale.sale_number}
                                                    </Link>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{sale.customer?.name || '-'}</td>
                                                <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-medium">
                                                    {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('id-ID') : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                    {formatCurrency(sale.grand_total)}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border-2 shadow-sm ${
                                                        statusColors[sale.status] || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-gray-200'
                                                    }`}>
                                                        {statusLabel[sale.status] || sale.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold border-2 shadow-sm ${
                                                        paymentColors[sale.payment_status] || paymentColors.unpaid
                                                    }`}>
                                                        {sale.payment_status === 'paid' ? '✓ Lunas' : sale.payment_status === 'partial' ? '◐ Sebagian' : '○ Belum Bayar'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="inline-flex items-center gap-2">
                                                        <Link
                                                            href={route('part-sales.show', sale.id)}
                                                            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-all"
                                                        >
                                                            Lihat
                                                        </Link>
                                                        {sale.status === 'draft' && (
                                                            <Link
                                                                href={route('part-sales.edit', sale.id)}
                                                                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                                                            >
                                                                <IconPencil size={14} /> Edit
                                                            </Link>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-20 text-center">
                            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 mb-6 shadow-inner">
                                <IconDatabaseOff size={48} className="text-slate-400 dark:text-slate-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Tidak ada penjualan</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm mx-auto">
                                {hasActiveFilters ? 'Tidak ada penjualan yang sesuai dengan filter. Coba sesuaikan kriteria pencarian Anda.' : 'Belum ada transaksi penjualan. Buat penjualan pertama Anda sekarang!'}
                            </p>
                            {!hasActiveFilters && (
                                <Link
                                    href={route('part-sales.create')}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/30 hover:from-emerald-700 hover:to-emerald-800 transition-all hover:scale-105"
                                >
                                    <IconCirclePlus size={20} /> Buat Penjualan Baru
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* Pagination */}
                {sales.data.length > 0 && (
                    <div className="pt-4">
                        <Pagination links={sales.links} />
                    </div>
                )}
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;

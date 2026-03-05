import React, { useState, useEffect } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Pagination from '@/Components/Dashboard/Pagination';
import { IconFilter, IconSearch, IconX, IconCirclePlus, IconEye, IconDatabaseOff, IconEdit, IconReceipt, IconTruck, IconCalendar, IconPackage, IconLayoutGrid, IconList } from '@tabler/icons-react';
import { toDisplayDate } from '@/Utils/datetime';

const defaultFilters = { q: '', supplier_id: '', status: '', date_from: '', date_to: '' };

const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    ordered: 'bg-blue-100 text-blue-700 border-blue-200',
    received: 'bg-green-100 text-green-700 border-green-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
};

const statusLabels = {
    pending: 'Pending',
    ordered: 'Ordered',
    received: 'Received',
    cancelled: 'Cancelled',
};

export default function Index({ purchases, suppliers, filters }) {
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        ...(typeof filters !== 'undefined' ? filters : {}),
    });
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
    const [liveItems, setLiveItems] = useState(purchases.data || []);

    useEffect(() => {
        setFilterData({
            ...defaultFilters,
            ...(typeof filters !== 'undefined' ? filters : {}),
        });
    }, [filters]);

    useEffect(() => {
        setLiveItems(purchases.data || []);
    }, [purchases.data]);

    useEffect(() => {
        const channel = window.Echo.channel('workshop.partpurchases');
        
        channel.listen('.partpurchase.created', (data) => {
            setLiveItems((prevItems) => [data.purchase, ...prevItems]);
        });

        channel.listen('.partpurchase.updated', (data) => {
            setLiveItems((prevItems) =>
                prevItems.map((item) => (item.id === data.purchase.id ? data.purchase : item))
            );
        });

        return () => {
            window.Echo.leaveChannel('workshop.partpurchases');
        };
    }, []);

    const handleChange = (field, value) => {
        setFilterData((prev) => ({ ...prev, [field]: value }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(route('part-purchases.index'), filterData, {
            preserveScroll: true,
            preserveState: true
        });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route('part-purchases.index'), defaultFilters, {
            preserveScroll: true,
            preserveState: true,
            replace: true
        });
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const formatDate = (dateString) => (dateString ? toDisplayDate(dateString) : '-');

    const hasActiveFilters = filterData.q || filterData.supplier_id || filterData.status || filterData.date_from || filterData.date_to;

    return (
        <>
            <Head title="Part Purchases" />
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 -m-6 p-4 sm:p-5 lg:p-6">
                {/* Hero Header */}
                <div className="bg-gradient-to-r from-amber-600 to-amber-700 dark:from-amber-700 dark:to-amber-800 rounded-2xl shadow-xl mb-6">
                    <div className="px-6 py-5">
                        <div className="flex items-center justify-between gap-6">
                            <div>
                                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                    <IconTruck size={32} className="text-white/90" />
                                    Pembelian Sparepart
                                </h1>
                                <p className="text-amber-100 mt-1">Kelola transaksi pembelian dari supplier</p>
                            </div>
                            <div className="hidden lg:flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-amber-100 text-sm font-medium">Total Pembelian</p>
                                    <p className="text-3xl font-bold text-white">{liveItems.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* View Toggle */}
                            <div className="inline-flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm">
                                <button
                                    onClick={() => setViewMode('card')}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                        viewMode === 'card'
                                            ? 'bg-amber-500 text-white shadow-md'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <IconLayoutGrid size={16} />
                                    <span className="hidden sm:inline">Kartu</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                        viewMode === 'table'
                                            ? 'bg-amber-500 text-white shadow-md'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <IconList size={16} />
                                    <span className="hidden sm:inline">Tabel</span>
                                </button>
                            </div>

                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                                    showFilters || hasActiveFilters
                                        ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 shadow-sm"
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                                }`}
                            >
                                <IconFilter size={18} />
                                <span>Filter</span>
                                {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
                            </button>
                        </div>
                        <Link
                            href={route('part-purchases.create')}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white inline-flex items-center gap-2 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                        >
                            <IconCirclePlus size={18} />
                            <span>Buat Pembelian</span>
                        </Link>
                    </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl animate-slide-up">
                        <form onSubmit={applyFilters}>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Cari</label>
                                    <input
                                        type="text"
                                        placeholder="No pembelian, catatan..."
                                        value={filterData.q}
                                        onChange={(e) => handleChange('q', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Supplier</label>
                                    <select
                                        value={filterData.supplier_id}
                                        onChange={(e) => handleChange('supplier_id', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
                                    >
                                        <option value="">Semua Supplier</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Status</label>
                                    <select
                                        value={filterData.status}
                                        onChange={(e) => handleChange('status', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
                                    >
                                        <option value="">Semua Status</option>
                                        <option value="pending">Pending</option>
                                        <option value="ordered">Ordered</option>
                                        <option value="received">Received</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Dari Tanggal</label>
                                    <input
                                        type="date"
                                        value={filterData.date_from}
                                        onChange={(e) => handleChange('date_from', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Sampai Tanggal</label>
                                    <input
                                        type="date"
                                        value={filterData.date_to}
                                        onChange={(e) => handleChange('date_to', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors"
                                    />
                                </div>
                                <div className="flex items-end gap-2">
                                    <button
                                        type="submit"
                                        className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200"
                                    >
                                        <IconSearch size={18} />
                                        <span>Cari</span>
                                    </button>
                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            <IconX size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* Purchase List */}
                {liveItems && liveItems.length > 0 ? (
                    <>
                        {/* Card View */}
                        {viewMode === 'card' && (
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {liveItems.map((p, idx) => (
                                <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 hover:shadow-xl hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-200 overflow-hidden shadow-lg">
                                    {/* Card Header */}
                                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 px-6 py-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                                                    <IconReceipt size={20} className="text-white" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-medium text-amber-100">Pembelian #{idx + 1 + ((purchases.current_page || 1) - 1) * (purchases.per_page || purchases.data.length)}</div>
                                                    <div className="text-lg font-bold text-white">{p.purchase_number}</div>
                                                </div>
                                            </div>
                                            <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold border ${statusColors[p.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                {statusLabels[p.status] || p.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-6 space-y-4">
                                        {/* Supplier */}
                                        <div className="flex items-start gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                                                <IconTruck size={20} className="text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-0.5">Supplier</div>
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                    {p.supplier?.name || '-'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Date & Items */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex items-start gap-2">
                                                <IconCalendar size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tanggal</div>
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {formatDate(p.purchase_date)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <IconPackage size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Item</div>
                                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {p.details?.length || 0} item
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Notes */}
                                        {p.notes && (
                                            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3 line-clamp-2 border border-slate-100 dark:border-slate-700">
                                                {p.notes}
                                            </div>
                                        )}

                                        {/* Total Amount */}
                                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-900/50">
                                            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mb-1">Total Pembelian</div>
                                            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                                                {formatCurrency(p.total_amount)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer */}
                                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                                        <Link
                                            href={route('part-purchases.show', p.id)}
                                            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-all duration-200"
                                        >
                                            <IconEye size={16} />
                                            <span>Lihat</span>
                                        </Link>
                                        {(p.status === 'pending' || p.status === 'ordered') && (
                                            <Link
                                                href={route('part-purchases.edit', p.id)}
                                                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-all duration-200 shadow-md hover:shadow-lg"
                                            >
                                                <IconEdit size={16} />
                                                <span>Edit</span>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            ))}
                            </div>
                        )}

                        {/* Table View */}
                        {viewMode === 'table' && (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">No</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">No Pembelian</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Supplier</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Tanggal</th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Item</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total</th>
                                                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Status</th>
                                                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {liveItems.map((p, idx) => (
                                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                                        {idx + 1 + ((purchases.current_page || 1) - 1) * (purchases.per_page || purchases.data.length)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{p.purchase_number}</div>
                                                        {p.notes && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{p.notes}</div>}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        {p.supplier?.name || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        {formatDate(p.purchase_date)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        {p.details?.length || 0} item
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-right font-semibold text-slate-900 dark:text-white">
                                                        {formatCurrency(p.total_amount)}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${statusColors[p.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                            {statusLabels[p.status] || p.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Link
                                                                href={route('part-purchases.show', p.id)}
                                                                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
                                                            >
                                                                <IconEye size={16} />
                                                                <span>Lihat</span>
                                                            </Link>
                                                            {(p.status === 'pending' || p.status === 'ordered') && (
                                                                <Link
                                                                    href={route('part-purchases.edit', p.id)}
                                                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-200"
                                                                >
                                                                    <IconEdit size={16} />
                                                                    <span>Edit</span>
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
                        )}

                        <div className="mt-6">
                            <Pagination links={purchases.links} />
                        </div>
                    </>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-lg">
                        <IconDatabaseOff size={52} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Pembelian tidak ditemukan</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            {hasActiveFilters ? 'Coba sesuaikan filter Anda' : 'Buat pembelian pertama Anda'}
                        </p>
                        {!hasActiveFilters && (
                            <Link
                                href={route('part-purchases.create')}
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                            >
                                <IconCirclePlus size={18} />
                                <span>Buat Pembelian Baru</span>
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

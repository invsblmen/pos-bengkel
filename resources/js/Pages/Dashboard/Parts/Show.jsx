import React, { useState, useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import {
    IconArrowLeft,
    IconPencil,
    IconPackage,
    IconTrendingUp,
    IconTrendingDown,
    IconHistory,
    IconAlertCircle,
    IconCurrencyDollar,
    IconTruck,
    IconCategory,
    IconBarcode,
    IconMapPin,
    IconBox,
    IconFileText,
    IconCalendar,
    IconSearch,
    IconX,
    IconFilter,
    IconTool,
    IconExternalLink,
} from '@tabler/icons-react';
import { toDisplayDateTime } from '@/Utils/datetime';

export default function Show({ part, stock_history }) {
    const [dateFilter, setDateFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [directionFilter, setDirectionFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const formatPrice = (price) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(price || 0);
    };

    const formatDateTime = (dateString) => (dateString ? toDisplayDateTime(dateString) : '-');

    const getTransactionRoute = (movement) => {
        if (!movement.reference_type || !movement.reference_id) return null;

        const referenceType = movement.reference_type.split('\\').pop();

        const routeMap = {
            'ServiceOrder': 'service-orders.show',
            'PartPurchase': 'part-purchases.show',            'PartSale': 'part-sales.show',            // Add more mappings as needed
        };

        const routeName = routeMap[referenceType];

        try {
            return routeName ? route(routeName, movement.reference_id) : null;
        } catch (e) {
            return null;
        }
    };

    const getMovementColor = (type, reference_type) => {
        // Service Order gets special color
        if (reference_type && reference_type.includes('ServiceOrder')) {
            return 'text-blue-600 dark:text-blue-400';
        }

        if (type === 'in' || type === 'purchase' || type === 'adjustment_in') {
            return 'text-success-600 dark:text-success-400';
        }
        return 'text-danger-600 dark:text-danger-400';
    };

    const getMovementIcon = (type, reference_type) => {
        // Service Order gets special icon
        if (reference_type && reference_type.includes('ServiceOrder')) {
            return <IconTool size={18} className="text-blue-600 dark:text-blue-400" />;
        }

        if (type === 'in' || type === 'purchase' || type === 'adjustment_in') {
            return <IconTrendingUp size={18} className="text-success-600 dark:text-success-400" />;
        }
        return <IconTrendingDown size={18} className="text-danger-600 dark:text-danger-400" />;
    };

    const getMovementLabel = (movement) => {
        // Check if it's from Service Order
        if (movement.reference_type && movement.reference_type.includes('ServiceOrder')) {
            return 'Service Order';
        }

        const labels = {
            'in': 'Stok Masuk',
            'out': 'Stok Keluar',
            'purchase': 'Pembelian',
            'sale': 'Penjualan',
            'adjustment_in': 'Penyesuaian (+)',
            'adjustment_out': 'Penyesuaian (-)',
            'return': 'Retur',
        };
        return labels[movement.type] || movement.type;
    };

    const filteredHistory = useMemo(() => {
        if (!stock_history?.data) return [];

        let filtered = stock_history.data;

        // Filter by type
        if (typeFilter !== 'all') {
            if (typeFilter === 'service_order') {
                // Filter for Service Order (type 'out' with ServiceOrder reference)
                filtered = filtered.filter(item =>
                    item.type === 'out' &&
                    item.reference_type &&
                    item.reference_type.includes('ServiceOrder')
                );
            } else {
                filtered = filtered.filter(item => item.type === typeFilter);
            }
        }

        // Filter by direction (in/out)
        if (directionFilter !== 'all') {
            if (directionFilter === 'in') {
                filtered = filtered.filter(item => ['in', 'purchase', 'adjustment_in', 'return'].includes(item.type));
            } else if (directionFilter === 'out') {
                filtered = filtered.filter(item => ['out', 'sale', 'adjustment_out'].includes(item.type));
            }
        }

        // Filter by date range
        if (dateFilter !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            filtered = filtered.filter(item => {
                const itemDate = new Date(item.created_at);

                switch(dateFilter) {
                    case 'today':
                        return itemDate >= today;
                    case 'week':
                        const weekAgo = new Date(today);
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return itemDate >= weekAgo;
                    case 'month':
                        const monthAgo = new Date(today);
                        monthAgo.setMonth(monthAgo.getMonth() - 1);
                        return itemDate >= monthAgo;
                    case 'year':
                        const yearAgo = new Date(today);
                        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                        return itemDate >= yearAgo;
                    default:
                        return true;
                }
            });
        }

        // Filter by search query (notes or reference)
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item => {
                const notes = (item.notes || '').toLowerCase();
                const reference = (item.reference_type || '').toLowerCase();
                const user = (item.user?.name || '').toLowerCase();
                return notes.includes(query) || reference.includes(query) || user.includes(query);
            });
        }

        return filtered;
    }, [stock_history, typeFilter, directionFilter, dateFilter, searchQuery]);

    const stockStatusColor = () => {
        if (part.stock <= 0) return 'text-danger-600 dark:text-danger-400';
        if (part.stock <= part.minimal_stock) return 'text-warning-600 dark:text-warning-400';
        return 'text-success-600 dark:text-success-400';
    };

    const stockStatusBadge = () => {
        if (part.stock <= 0) {
            return <span className="inline-flex items-center gap-1 rounded-full bg-danger-100 px-3 py-1 text-xs font-semibold text-danger-700 dark:bg-danger-900/30 dark:text-danger-300">Habis</span>;
        }
        if (part.stock <= part.minimal_stock) {
            return <span className="inline-flex items-center gap-1 rounded-full bg-warning-100 px-3 py-1 text-xs font-semibold text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">Stok Rendah</span>;
        }
        return <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-3 py-1 text-xs font-semibold text-success-700 dark:bg-success-900/30 dark:text-success-300">Tersedia</span>;
    };

    return (
        <>
            <Head title={`Sparepart ${part.name}`} />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">Detail Sparepart</p>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                            {part.name}
                        </h1>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                            {part.part_number && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700 ring-1 ring-blue-100 dark:bg-blue-900/30 dark:text-blue-200 dark:ring-blue-800">
                                    <IconBox size={16} /> {part.part_number}
                                </span>
                            )}
                            {stockStatusBadge()}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href={route('parts.index')}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700"
                        >
                            <IconArrowLeft size={18} />
                            Kembali
                        </Link>
                        <Link
                            href={route('parts.edit', part.id)}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:from-primary-600 hover:to-accent-600"
                        >
                            <IconPencil size={18} />
                            Edit Sparepart
                        </Link>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Stok Saat Ini</p>
                            <IconPackage size={18} className="text-primary-500" />
                        </div>
                        <p className={`mt-3 text-2xl font-bold ${stockStatusColor()}`}>{part.stock || 0}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Min: {part.minimal_stock || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Harga Beli</p>
                            <IconCurrencyDollar size={18} className="text-primary-500" />
                        </div>
                        <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(part.buy_price)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Per unit</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Harga Jual</p>
                            <IconCurrencyDollar size={18} className="text-primary-500" />
                        </div>
                        <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(part.sell_price)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Per unit</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Transaksi</p>
                            <IconHistory size={18} className="text-primary-500" />
                        </div>
                        <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{stock_history?.total || 0}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Riwayat mutasi</p>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Basic Info */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-2">
                            <IconBox size={20} className="text-primary-600 dark:text-primary-400" />
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Informasi Dasar</h2>
                        </div>
                        <div className="space-y-3 text-sm">
                            {part.barcode && (
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Barcode</p>
                                    <p className="font-semibold text-slate-900 dark:text-white">{part.barcode}</p>
                                </div>
                            )}
                            {part.category && (
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Kategori</p>
                                    <p className="font-semibold text-slate-900 dark:text-white">{part.category.name}</p>
                                </div>
                            )}
                            {part.rack_location && (
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400">Lokasi Rak</p>
                                    <p className="font-semibold text-slate-900 dark:text-white">{part.rack_location}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Supplier Info */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-2">
                            <IconTruck size={20} className="text-primary-600 dark:text-primary-400" />
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Supplier</h2>
                        </div>
                        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                            {part.supplier ? (
                                <>
                                    <div>
                                        <p className="text-slate-500 dark:text-slate-400">Nama</p>
                                        <p className="font-semibold text-slate-900 dark:text-white">{part.supplier.name}</p>
                                    </div>
                                    {part.supplier.phone && (
                                        <div>
                                            <p className="text-slate-500 dark:text-slate-400">Telepon</p>
                                            <p className="font-semibold text-slate-900 dark:text-white">{part.supplier.phone}</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-slate-400">Tidak ada supplier</p>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-2">
                            <IconFileText size={20} className="text-primary-600 dark:text-primary-400" />
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Deskripsi</h2>
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                            {part.description || <span className="text-slate-400">Tidak ada deskripsi</span>}
                        </div>
                    </div>
                </div>

                {/* Stock History */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-200 p-6 dark:border-slate-800">
                        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <IconHistory size={20} className="text-primary-600 dark:text-primary-400" />
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">History Stok</h2>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Riwayat keluar masuk sparepart {filteredHistory.length > 0 && `(${filteredHistory.length} data)`}
                                </p>
                            </div>
                            {(typeFilter !== 'all' || directionFilter !== 'all' || dateFilter !== 'all' || searchQuery !== '') && (
                                <button
                                    onClick={() => {
                                        setTypeFilter('all');
                                        setDirectionFilter('all');
                                        setDateFilter('all');
                                        setSearchQuery('');
                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl bg-danger-100 px-4 py-2 text-sm font-medium text-danger-700 transition hover:bg-danger-200 dark:bg-danger-900/30 dark:text-danger-300 dark:hover:bg-danger-900/50"
                                >
                                    <IconX size={16} />
                                    Reset Filter
                                </button>
                            )}
                        </div>

                        {/* Filter Controls */}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {/* Search */}
                            <div className="relative">
                                <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cari catatan, user..."
                                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                />
                            </div>

                            {/* Direction Filter */}
                            <div className="relative">
                                <IconFilter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={directionFilter}
                                    onChange={(e) => setDirectionFilter(e.target.value)}
                                    className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-8 text-sm text-slate-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                    <option value="all">Semua Arah</option>
                                    <option value="in">Masuk</option>
                                    <option value="out">Keluar</option>
                                </select>
                            </div>

                            {/* Type Filter */}
                            <div className="relative">
                                <IconFilter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-8 text-sm text-slate-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                    <option value="all">Semua Tipe</option>
                                    <option value="service_order">Service Order</option>
                                    <option value="purchase">Pembelian</option>
                                    <option value="sale">Penjualan</option>
                                    <option value="adjustment_in">Penyesuaian (+)</option>
                                    <option value="adjustment_out">Penyesuaian (-)</option>
                                    <option value="in">Stok Masuk</option>
                                    <option value="out">Stok Keluar</option>
                                    <option value="return">Retur</option>
                                </select>
                            </div>

                            {/* Date Range Filter */}
                            <div className="relative">
                                <IconCalendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-8 text-sm text-slate-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                >
                                    <option value="all">Semua Waktu</option>
                                    <option value="today">Hari Ini</option>
                                    <option value="week">7 Hari Terakhir</option>
                                    <option value="month">30 Hari Terakhir</option>
                                    <option value="year">1 Tahun Terakhir</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="p-6">
                        {filteredHistory.length > 0 ? (
                            <div className="space-y-3">
                                {filteredHistory.map((movement) => {
                                    const transactionRoute = getTransactionRoute(movement);
                                    const isClickable = transactionRoute !== null;

                                    const content = (
                                        <>
                                            <div className="flex-shrink-0">
                                                {getMovementIcon(movement.type, movement.reference_type)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold text-slate-900 dark:text-white">
                                                            {getMovementLabel(movement)}
                                                        </p>
                                                        {isClickable && (
                                                            <IconExternalLink size={14} className="text-primary-500 opacity-0 transition-opacity group-hover:opacity-100" />
                                                        )}
                                                    </div>
                                                    <p className={`text-sm font-bold ${getMovementColor(movement.type, movement.reference_type)}`}>
                                                        {movement.type === 'in' || movement.type === 'purchase' || movement.type === 'adjustment_in' ? '+' : '-'}{movement.qty}
                                                    </p>
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <span>{formatDateTime(movement.created_at)}</span>
                                                    {movement.user && <span>oleh {movement.user.name}</span>}
                                                    {movement.reference_type && (
                                                        <span className="rounded bg-slate-200 px-2 py-0.5 dark:bg-slate-700">
                                                            {movement.reference_type.split('\\').pop()}
                                                        </span>
                                                    )}
                                                </div>
                                                {movement.notes && (
                                                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                                                        {movement.notes}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex-shrink-0 text-right">
                                                <p className="text-xs text-slate-500 dark:text-slate-400">Stok Akhir</p>
                                                <p className="font-semibold text-slate-900 dark:text-white">
                                                    {movement.after_stock}
                                                </p>
                                            </div>
                                        </>
                                    );

                                    return isClickable ? (
                                        <Link
                                            key={movement.id}
                                            href={transactionRoute}
                                            className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:scale-[1.01] hover:border-primary-300 hover:bg-white hover:shadow-md dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-primary-600 dark:hover:bg-slate-800 cursor-pointer"
                                        >
                                            {content}
                                        </Link>
                                    ) : (
                                        <div
                                            key={movement.id}
                                            className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600"
                                        >
                                            {content}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12">
                                <IconHistory size={48} className="mb-3 text-slate-300 dark:text-slate-600" />
                                <p className="text-slate-500 dark:text-slate-400">Belum ada history transaksi</p>
                            </div>
                        )}

                        {/* Pagination */}
                        {stock_history?.links && stock_history.links.length > 3 && (
                            <div className="mt-6 flex items-center justify-center gap-2">
                                {stock_history.links.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={link.url || '#'}
                                        className={`rounded-lg px-3 py-1.5 text-sm transition-all ${
                                            link.active
                                                ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-md'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                        } ${!link.url && 'cursor-not-allowed opacity-50'}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

Show.layout = (page) => <DashboardLayout children={page} />;

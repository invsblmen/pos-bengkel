import React, { useMemo, useState } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Button from '@/Components/Dashboard/Button';
import Search from '@/Components/Dashboard/Search';
import Pagination from '@/Components/Dashboard/Pagination';
import { useVisibilityRealtime } from '@/Hooks/useRealtime';
import {
    IconDatabaseOff, IconCirclePlus, IconPencilCog, IconTrash,
    IconPackage, IconAlertCircle, IconMapPin,
    IconFilter, IconX, IconChevronDown, IconArrowUp, IconArrowDown, IconArrowsSort,
    IconArrowUpRight, IconCategory, IconTruck, IconBox, IconDownload, IconPrinter,
    IconCheck, IconChevronUp, IconEye, IconEyeOff, IconSquareX, IconStack
} from '@tabler/icons-react';

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(value);

// Gradient Stat Card Component
function StatCard({ title, value, subtitle, icon: Icon, gradient }) {
    return (
        <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${gradient} text-white shadow-lg`}>
            <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
                <Icon size={128} strokeWidth={0.5} className="transform translate-x-8 -translate-y-8" />
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-xl bg-white/20">
                        <Icon size={20} strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-medium opacity-90">{title}</span>
                </div>
                <p className="text-3xl font-bold">{value}</p>
                {subtitle && (
                    <p className="mt-2 text-sm opacity-80 flex items-center gap-1">
                        <IconArrowUpRight size={14} />
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function Index({ parts, filters, categories, suppliers }) {
    const [showFilters, setShowFilters] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        name: true,
        part_number: true,
        category: true,
        supplier: true,
        rack_location: true,
        stock: true,
        minimal_stock: true,
        buy_price: true,
        sell_price: true,
    });
    const [showColumnToggle, setShowColumnToggle] = useState(false);
    const [activeFilters, setActiveFilters] = useState({
        category_id: filters?.category_id || '',
        supplier_id: filters?.supplier_id || '',
        stock_status: filters?.stock_status || '',
    });

    // Enable real-time updates - auto refresh every 5 seconds
    // Pause when tab not visible to save resources
    useVisibilityRealtime({
        interval: 5000,
        only: ['parts'],
        preserveScroll: true,
        preserveState: true
    });

    const pageStats = useMemo(() => {
        const items = parts?.data || [];
        const lowStock = items.filter((p) => p.minimal_stock > 0 && p.stock <= p.minimal_stock).length;
        const outStock = items.filter((p) => p.stock === 0).length;
        return { lowStock, outStock, pageCount: items.length };
    }, [parts]);

    const handleSort = (column) => {
        const currentSort = filters?.sort_by;
        const currentDirection = filters?.sort_direction || 'asc';
        let newDirection = 'asc';
        if (currentSort === column && currentDirection === 'asc') {
            newDirection = 'desc';
        }
        router.get(route('parts.index'), {
            ...filters,
            sort_by: column,
            sort_direction: newDirection,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const getSortIcon = (column) => {
        if (filters?.sort_by !== column) {
            return <IconArrowsSort size={14} className="opacity-50" />;
        }
        return filters?.sort_direction === 'asc'
            ? <IconArrowUp size={14} className="text-primary-600 dark:text-primary-400" />
            : <IconArrowDown size={14} className="text-primary-600 dark:text-primary-400" />;
    };

    const handleFilterChange = (key, value) => {
        const newFilters = { ...activeFilters, [key]: value };
        setActiveFilters(newFilters);
        router.get(route('parts.index'), {
            search: filters?.search || '',
            ...newFilters,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearFilters = () => {
        setActiveFilters({
            category_id: '',
            supplier_id: '',
            stock_status: '',
        });
        router.get(route('parts.index'), {
            search: filters?.search || '',
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handlePerPageChange = (newPerPage) => {
        router.get(route('parts.index'), {
            per_page: parseInt(newPerPage),
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const hasActiveFilters = Object.values(activeFilters).some(value => value !== '');

    const toggleRowSelection = (id, isSelected) => {
        // Not used anymore, keeping for compatibility
    };

    const toggleAllSelection = (isSelected) => {
        // Not used anymore, keeping for compatibility
    };

    const toggleColumn = (column) => {
        setVisibleColumns({
            ...visibleColumns,
            [column]: !visibleColumns[column]
        });
    };

    const handleExportCSV = () => {
        const headers = [];
        const rows = [];

        // Add headers
        if (visibleColumns.name) headers.push('Nama Part');
        if (visibleColumns.part_number) headers.push('Kode Part');
        if (visibleColumns.category) headers.push('Kategori');
        if (visibleColumns.supplier) headers.push('Supplier');
        if (visibleColumns.rack_location) headers.push('Lokasi Rak');
        if (visibleColumns.stock) headers.push('Stok');
        if (visibleColumns.minimal_stock) headers.push('Min. Stok');
        if (visibleColumns.buy_price) headers.push('Harga Beli');
        if (visibleColumns.sell_price) headers.push('Harga Jual');

        // Add data rows
        parts.data.forEach(p => {
            const row = [];
            if (visibleColumns.name) row.push(`"${p.name}"`);
            if (visibleColumns.part_number) row.push(p.part_number || '');
            if (visibleColumns.category) row.push(p.category?.name || '');
            if (visibleColumns.supplier) row.push(p.supplier?.name || '');
            if (visibleColumns.rack_location) row.push(p.rack_location || '');
            if (visibleColumns.stock) row.push(p.stock);
            if (visibleColumns.minimal_stock) row.push(p.minimal_stock || '');
            if (visibleColumns.buy_price) row.push(p.buy_price || '');
            if (visibleColumns.sell_price) row.push(p.sell_price || '');
            rows.push(row.join(','));
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sparepart-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            <Head title="Part" />

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sparepart</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{parts?.total || 0} part tersedia</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="link"
                            href={route('part-categories.index')}
                            icon={<IconCategory size={18} />}
                            label="Kategori Sparepart"
                            className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700"
                        />
                        <Button type="link" href={route('parts.create')} icon={<IconCirclePlus size={18} />} label="Tambah Part" className="bg-primary-500 hover:bg-primary-600 text-white shadow-lg shadow-primary-500/30" />
                    </div>
                </div>

                {/* Summary Stats with Gradient Cards */}
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Total Part"
                        value={parts?.total || 0}
                        subtitle={`${pageStats.pageCount} di halaman ini`}
                        icon={IconBox}
                        gradient="from-blue-500 to-cyan-500"
                    />
                    <StatCard
                        title="Stok Minimal"
                        value={pageStats.lowStock}
                        subtitle="Perlu segera di-restock"
                        icon={IconAlertCircle}
                        gradient="from-amber-500 to-orange-500"
                    />
                    <StatCard
                        title="Stok Habis"
                        value={pageStats.outStock}
                        subtitle="Tidak tersedia"
                        icon={IconPackage}
                        gradient="from-rose-500 to-pink-500"
                    />
                    <Link
                        href={route('parts.low-stock')}
                        className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg hover:shadow-xl transition-shadow group"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 opacity-20">
                            <IconAlertCircle size={128} strokeWidth={0.5} className="transform translate-x-8 -translate-y-8" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 rounded-xl bg-white/20">
                                    <IconAlertCircle size={20} strokeWidth={1.5} />
                                </div>
                                <span className="text-sm font-medium opacity-90">Notifikasi</span>
                            </div>
                            <p className="text-3xl font-bold mb-1">Stok Minimal</p>
                            <p className="text-sm opacity-80 flex items-center gap-1">
                                <IconArrowUpRight size={14} />
                                Lihat semua alert
                            </p>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="mb-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                    <div className="flex-1 max-w-md">
                        <Search route={route('parts.index')} placeholder="Cari part, kode, lokasi rak..." />
                    </div>
                    <div className="flex gap-2 items-center">
                        <select
                            value={filters?.per_page || 10}
                            onChange={(e) => handlePerPageChange(e.target.value)}
                            className="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-medium focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                            title="Data per halaman"
                        >
                            <option value="10">10 per halaman</option>
                            <option value="25">25 per halaman</option>
                            <option value="50">50 per halaman</option>
                            <option value="100">100 per halaman</option>
                        </select>
                        <div className="relative">
                            <button
                                onClick={() => setShowColumnToggle(!showColumnToggle)}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all"
                                title="Kolom yang Ditampilkan"
                            >
                                <IconEye size={18} />
                            </button>
                            {showColumnToggle && (
                                <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg z-20 min-w-48">
                                    <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Tampilkan Kolom</p>
                                    </div>
                                    <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                                        {Object.entries(visibleColumns).map(([col, visible]) => (
                                            <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-2 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={visible}
                                                    onChange={() => toggleColumn(col)}
                                                    className="w-4 h-4 rounded"
                                                />
                                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                                    {col === 'part_number' && 'Kode Part'}
                                                    {col === 'buy_price' && 'Harga Beli'}
                                                    {col === 'sell_price' && 'Harga Jual'}
                                                    {col === 'rack_location' && 'Lokasi Rak'}
                                                    {col === 'minimal_stock' && 'Min. Stok'}
                                                    {col === 'name' && 'Nama Part'}
                                                    {col === 'category' && 'Kategori'}
                                                    {col === 'supplier' && 'Supplier'}
                                                    {col === 'stock' && 'Stok'}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all"
                            title="Export CSV"
                        >
                            <IconDownload size={18} />
                        </button>
                        <button
                            onClick={handlePrint}
                            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all"
                            title="Print"
                        >
                            <IconPrinter size={18} />
                        </button>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={hasActiveFilters || showFilters
                                ? 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/30'
                                : 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }
                        >
                            <IconFilter size={18} />
                            {hasActiveFilters && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                                    {Object.values(activeFilters).filter(v => v !== '').length}
                                </span>
                            )}
                            <IconChevronDown size={16} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Filter Panel */}
                {showFilters && (
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                                        <IconFilter size={20} className="text-primary-600 dark:text-primary-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                            Filter Sparepart
                                        </h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Saring data berdasarkan kriteria
                                        </p>
                                    </div>
                                </div>
                                {hasActiveFilters && (
                                    <button
                                        onClick={clearFilters}
                                        className="inline-flex items-center gap-2 rounded-xl bg-danger-100 px-4 py-2 text-sm font-medium text-danger-700 transition hover:bg-danger-200 dark:bg-danger-900/30 dark:text-danger-300 dark:hover:bg-danger-900/50"
                                    >
                                        <IconX size={16} />
                                        Hapus Filter
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid gap-6 md:grid-cols-3">
                                {/* Category Filter */}
                                <div>
                                    <label className="flex text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 items-center gap-2">
                                        <IconCategory size={16} />
                                        Kategori
                                    </label>
                                    <select
                                        value={activeFilters.category_id}
                                        onChange={(e) => handleFilterChange('category_id', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    >
                                        <option value="">Semua Kategori</option>
                                        {categories?.map((cat) => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Supplier Filter */}
                                <div>
                                    <label className="flex text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 items-center gap-2">
                                        <IconTruck size={16} />
                                        Supplier
                                    </label>
                                    <select
                                        value={activeFilters.supplier_id}
                                        onChange={(e) => handleFilterChange('supplier_id', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    >
                                        <option value="">Semua Supplier</option>
                                        {suppliers?.map((sup) => (
                                            <option key={sup.id} value={sup.id}>{sup.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Stock Status Filter */}
                                <div>
                                    <label className="flex text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 items-center gap-2">
                                        <IconPackage size={16} />
                                        Status Stok
                                    </label>
                                    <select
                                        value={activeFilters.stock_status}
                                        onChange={(e) => handleFilterChange('stock_status', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    >
                                        <option value="">Semua Status</option>
                                        <option value="normal">Normal</option>
                                        <option value="low">Stok Rendah</option>
                                        <option value="out">Habis</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {parts.data && parts.data.length > 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                            <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">No</th>
                                            {visibleColumns.name && <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                <button onClick={() => handleSort('name')} className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                                    Nama Part {getSortIcon('name')}
                                                </button>
                                            </th>}
                                            {visibleColumns.part_number && <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                <button onClick={() => handleSort('part_number')} className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                                    Kode Part {getSortIcon('part_number')}
                                                </button>
                                            </th>}
                                            {visibleColumns.category && <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kategori</th>}
                                            {visibleColumns.supplier && <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Supplier</th>}
                                            {visibleColumns.rack_location && <th className="px-4 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                <button onClick={() => handleSort('rack_location')} className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                                    Lokasi Rak {getSortIcon('rack_location')}
                                                </button>
                                            </th>}
                                            {visibleColumns.stock && <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                <button onClick={() => handleSort('stock')} className="flex items-center justify-center gap-2 w-full hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                                    Stok {getSortIcon('stock')}
                                                </button>
                                            </th>}
                                            {visibleColumns.minimal_stock && <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Min. Stok</th>}
                                            {visibleColumns.buy_price && <th className="px-4 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                <button onClick={() => handleSort('buy_price')} className="flex items-center justify-end gap-2 w-full hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                                    Harga Beli {getSortIcon('buy_price')}
                                                </button>
                                            </th>}
                                            {visibleColumns.sell_price && <th className="px-4 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                <button onClick={() => handleSort('sell_price')} className="flex items-center justify-end gap-2 w-full hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                                    Harga Jual {getSortIcon('sell_price')}
                                                </button>
                                            </th>}
                                            <th className="px-4 py-4 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {parts.data.map((p, idx) => {
                                            const stockStatus = p.stock === 0 ? 'out' : (p.minimal_stock > 0 && p.stock <= p.minimal_stock ? 'low' : 'normal');
                                            const stockBadge = {
                                                out: 'bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-300',
                                                low: 'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300',
                                                normal: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300'
                                            }[stockStatus];

                                            return (
                                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{idx + 1 + ((parts.current_page || 1) - 1) * (parts.per_page || parts.data.length)}</td>
                                                    {visibleColumns.name && <td className="px-4 py-4">
                                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}</div>
                                                        {p.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{p.description}</div>}
                                                    </td>}
                                                    {visibleColumns.part_number && <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400 font-mono">{p.part_number || '-'}</td>}
                                                    {visibleColumns.category && <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{p.category?.name || '-'}</td>}
                                                    {visibleColumns.supplier && <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">{p.supplier?.name || '-'}</td>}
                                                    {visibleColumns.rack_location && <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                        {p.rack_location ? (
                                                            <div className="flex items-center gap-1">
                                                                <IconMapPin size={14} className="text-slate-400" />
                                                                <span>{p.rack_location}</span>
                                                            </div>
                                                        ) : '-'}
                                                    </td>}
                                                    {visibleColumns.stock && <td className="px-4 py-4 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${stockBadge}`}>
                                                            <IconPackage size={14} />
                                                            {p.stock}
                                                        </span>
                                                    </td>}
                                                    {visibleColumns.minimal_stock && <td className="px-4 py-4 text-center">
                                                        {p.minimal_stock > 0 ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                                                                <IconAlertCircle size={12} />
                                                                {p.minimal_stock}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">-</span>
                                                        )}
                                                    </td>}
                                                    {visibleColumns.buy_price && <td className="px-4 py-4 text-right text-sm text-slate-600 dark:text-slate-400">{formatCurrency(p.buy_price || 0)}</td>}
                                                    {visibleColumns.sell_price && <td className="px-4 py-4 text-right text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(p.sell_price || 0)}</td>}
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Link href={route('parts.show', p.id)} className="inline-flex items-center justify-center p-2 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors" title="Lihat Detail">
                                                                <IconEye size={16} />
                                                            </Link>
                                                            <Link href={route('parts.edit', p.id)} className="inline-flex items-center justify-center p-2 rounded-lg text-warning-600 hover:bg-warning-50 dark:hover:bg-warning-900/30 transition-colors" title="Edit">
                                                                <IconPencilCog size={16} />
                                                            </Link>
                                                            <Button type="delete" icon={<IconTrash size={16} />} className="inline-flex items-center justify-center p-2 rounded-lg text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/30" url={route('parts.destroy', p.id)} label="" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                        <IconDatabaseOff size={32} className="text-slate-400" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-1">Belum Ada Part</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Part akan muncul di sini setelah dibuat.</p>
                    <Button type="link" href={route('parts.create')} icon={<IconCirclePlus size={18} />} label="Tambah Part Pertama" />
                </div>
            )}


            {/* Pagination */}
            {parts.links && (
                <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 rounded-b-2xl">
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                        Menampilkan <span className="font-semibold">{parts.from}</span> hingga <span className="font-semibold">{parts.to}</span> dari <span className="font-semibold">{parts.total}</span> data
                    </div>
                    <div className="flex gap-2">
                        {parts.links.map((link, index) => (
                            <Link
                                key={index}
                                href={link.url || '#'}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                    link.active
                                        ? 'bg-primary-500 text-white shadow-md'
                                        : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                                } ${!link.url && 'cursor-not-allowed opacity-50 pointer-events-none'}`}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;

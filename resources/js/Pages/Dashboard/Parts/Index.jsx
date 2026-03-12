import React, { useState, useEffect } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Button from '@/Components/Dashboard/Button';
import Pagination from '@/Components/Dashboard/Pagination';
import { useVisibilityRealtime } from '@/Hooks/useRealtime';
import {
    IconCirclePlus, IconPencilCog, IconTrash,
    IconPackage, IconAlertCircle, IconMapPin,
    IconFilter, IconX, IconArrowUp, IconArrowDown, IconArrowsSort,
    IconCategory, IconTruck, IconBox, IconDownload, IconPrinter,
    IconEye, IconSearch, IconList, IconLayoutGrid,
    IconShieldCheck, IconAlertTriangle,
} from '@tabler/icons-react';

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(value);

const stockMeta = {
    all:    { label: 'Semua',       chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    normal: { label: 'Normal',      chip: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    low:    { label: 'Stok Rendah', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    out:    { label: 'Habis',       chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

function StatCard({ title, value, subtitle, icon, tone }) {
    const tones = {
        blue:   'from-blue-50 to-blue-100 border-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 dark:border-blue-800 text-blue-800 dark:text-blue-200',
        green:  'from-green-50 to-green-100 border-green-200 dark:from-green-900/20 dark:to-green-800/20 dark:border-green-800 text-green-800 dark:text-green-200',
        amber:  'from-amber-50 to-amber-100 border-amber-200 dark:from-amber-900/20 dark:to-amber-800/20 dark:border-amber-800 text-amber-800 dark:text-amber-200',
        red:    'from-red-50 to-red-100 border-red-200 dark:from-red-900/20 dark:to-red-800/20 dark:border-red-800 text-red-800 dark:text-red-200',
    };
    return (
        <div className={`rounded-2xl border bg-gradient-to-br p-4 ${tones[tone]}`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
                    <p className="mt-1 text-2xl font-black">{value}</p>
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
                <IconBox size={40} className="text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Belum ada sparepart</h3>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                {hasFilters
                    ? 'Tidak ada part yang sesuai dengan filter yang diterapkan.'
                    : 'Mulai dengan menambahkan sparepart pertama Anda.'}
            </p>
            {hasFilters ? (
                <button
                    onClick={onReset}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-colors"
                >
                    <IconX size={18} /> Reset Filter
                </button>
            ) : (
                <Link
                    href={route('parts.create')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors shadow-sm"
                >
                    <IconCirclePlus size={18} /> Tambah Part Pertama
                </Link>
            )}
        </div>
    );
}

export default function Index({ parts, filters, categories, suppliers, stats }) {
    const [search, setSearch]             = useState(filters?.q || '');
    const [stockStatus, setStockStatus]   = useState(filters?.stock_status || 'all');
    const [showFilters, setShowFilters]   = useState(false);
    const [viewMode, setViewMode]         = useState('table');
    const [liveItems, setLiveItems]       = useState(parts?.data || []);
    const [showColumnToggle, setShowColumnToggle] = useState(false);
    const [visibleColumns, setVisibleColumns] = useState({
        name: true, part_number: true, category: true, supplier: true,
        rack_location: true, stock: true, minimal_stock: true,
        buy_price: true, sell_price: true,
    });
    const [activeFilters, setActiveFilters] = useState({
        category_id: filters?.category_id || '',
        supplier_id: filters?.supplier_id || '',
    });

    useEffect(() => { setLiveItems(parts?.data || []); }, [parts?.data]);

    useVisibilityRealtime({ interval: 5000, only: ['parts', 'stats'], preserveScroll: true, preserveState: true });

    useEffect(() => {
        if (!window.Echo) return;
        const channel = window.Echo.channel('workshop.parts');
        channel.listen('.part.created', ({ part }) => {
            if (!part?.id) return;
            setLiveItems(prev => prev.some(i => i.id === part.id) ? prev : [part, ...prev]);
        });
        channel.listen('.part.updated', ({ part }) => {
            if (!part?.id) return;
            setLiveItems(prev => prev.map(i => i.id === part.id ? part : i));
        });
        channel.listen('.part.deleted', ({ partId }) => {
            if (!partId) return;
            setLiveItems(prev => prev.filter(i => i.id !== partId));
        });
        return () => window.Echo.leaveChannel('workshop.parts');
    }, []);

    const handleSort = (column) => {
        const dir = filters?.sort_by === column && filters?.sort_direction === 'asc' ? 'desc' : 'asc';
        router.get(route('parts.index'), { ...filters, sort_by: column, sort_direction: dir }, { preserveState: true, preserveScroll: true });
    };

    const getSortIcon = (col) => {
        if (filters?.sort_by !== col) return <IconArrowsSort size={14} className="opacity-50" />;
        return filters?.sort_direction === 'asc'
            ? <IconArrowUp size={14} className="text-primary-600 dark:text-primary-400" />
            : <IconArrowDown size={14} className="text-primary-600 dark:text-primary-400" />;
    };

    const handleFilter = (e) => {
        e?.preventDefault();
        router.get(route('parts.index'), {
            q:            search || undefined,
            stock_status: stockStatus !== 'all' ? stockStatus : undefined,
            category_id:  activeFilters.category_id || undefined,
            supplier_id:  activeFilters.supplier_id || undefined,
            per_page:     filters?.per_page || 10,
        }, { preserveState: true, preserveScroll: true });
    };

    const handleQuickStockFilter = (val) => {
        setStockStatus(val);
        router.get(route('parts.index'), {
            q:            search || undefined,
            stock_status: val !== 'all' ? val : undefined,
            category_id:  activeFilters.category_id || undefined,
            supplier_id:  activeFilters.supplier_id || undefined,
            per_page:     filters?.per_page || 10,
        }, { preserveState: true, preserveScroll: true });
    };

    const handleReset = () => {
        setSearch(''); setStockStatus('all');
        setActiveFilters({ category_id: '', supplier_id: '' });
        router.get(route('parts.index'));
    };

    const toggleColumn = (col) => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));

    const handleExportCSV = () => {
        const colLabels = { name: 'Nama Part', part_number: 'Kode Part', category: 'Kategori', supplier: 'Supplier', rack_location: 'Lokasi Rak', stock: 'Stok', minimal_stock: 'Min. Stok', buy_price: 'Harga Beli', sell_price: 'Harga Jual' };
        const headers = Object.keys(colLabels).filter(c => visibleColumns[c]).map(c => colLabels[c]);
        const rows = parts.data.map(p => {
            const row = [];
            if (visibleColumns.name)          row.push(`"${p.name}"`);
            if (visibleColumns.part_number)   row.push(p.part_number || '');
            if (visibleColumns.category)      row.push(p.category?.name || '');
            if (visibleColumns.supplier)      row.push(p.supplier?.name || '');
            if (visibleColumns.rack_location) row.push(p.rack_location || '');
            if (visibleColumns.stock)         row.push(p.stock);
            if (visibleColumns.minimal_stock) row.push(p.minimal_stock || '');
            if (visibleColumns.buy_price)     row.push(p.buy_price || '');
            if (visibleColumns.sell_price)    row.push(p.sell_price || '');
            return row.join(',');
        });
        const csv  = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = window.URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `sparepart-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    };

    const activeFiltersCount = [search, stockStatus !== 'all', activeFilters.category_id, activeFilters.supplier_id].filter(Boolean).length;
    const colLabels = { name: 'Nama Part', part_number: 'Kode Part', category: 'Kategori', supplier: 'Supplier', rack_location: 'Lokasi Rak', stock: 'Stok', minimal_stock: 'Min. Stok', buy_price: 'Harga Beli', sell_price: 'Harga Jual' };

    const getStockBadge = (p) => {
        const s = p.stock === 0 ? 'out' : (p.minimal_stock > 0 && p.stock <= p.minimal_stock ? 'low' : 'normal');
        return {
            key: s,
            cls: { out: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', low: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', normal: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }[s],
            label: { out: 'Habis', low: 'Stok Rendah', normal: 'Normal' }[s],
        };
    };

    return (
        <>
            <Head title="Sparepart" />
            <div className="space-y-6">

                {/*  Hero Banner  */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white via-primary-50/50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 md:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-600 dark:text-primary-400">Inventory Management</p>
                            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Sparepart</h1>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Kelola stok, harga, dan informasi seluruh sparepart bengkel.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* View mode toggle */}
                            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                                <button type="button" onClick={() => setViewMode('table')} className={`p-2 rounded-lg ${viewMode === 'table' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><IconList size={18} /></button>
                                <button type="button" onClick={() => setViewMode('card')}  className={`p-2 rounded-lg ${viewMode === 'card'  ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><IconLayoutGrid size={18} /></button>
                            </div>
                            <Link href={route('part-categories.index')} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-colors text-sm">
                                <IconCategory size={16} /> Kategori
                            </Link>
                            <Link href={route('parts.create')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-colors shadow-sm text-sm">
                                <IconCirclePlus size={18} /> Tambah Part
                            </Link>
                        </div>
                    </div>

                    {/* Stat cards */}
                    <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <StatCard title="Total Part"    value={stats?.total        ?? parts?.total ?? 0} subtitle="Seluruh sparepart"  icon={<IconBox size={20} />}           tone="blue"  />
                        <StatCard title="Normal"        value={stats?.normal       ?? 0}                 subtitle="Stok aman"          icon={<IconShieldCheck size={20} />}   tone="green" />
                        <StatCard title="Stok Rendah"   value={stats?.low_stock    ?? 0}                 subtitle="Perlu restock"      icon={<IconAlertTriangle size={20} />} tone="amber" />
                        <StatCard title="Habis"         value={stats?.out_of_stock ?? 0}                 subtitle="Tidak tersedia"     icon={<IconPackage size={20} />}       tone="red"   />
                    </div>
                </div>

                {/*  Filter Bar  */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                    {/* Quick stock chips */}
                    <div className="flex flex-wrap items-center gap-2">
                        {['all', 'normal', 'low', 'out'].map((key) => (
                            <button
                                key={key} type="button"
                                onClick={() => handleQuickStockFilter(key)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${stockStatus === key ? 'border-primary-500 bg-primary-500 text-white' : `border-transparent ${stockMeta[key].chip}`}`}
                            >
                                {stockMeta[key].label}
                            </button>
                        ))}
                    </div>

                    {/* Search + controls */}
                    <div className="flex flex-col lg:flex-row gap-3">
                        <div className="flex-1 relative">
                            <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text" value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                                placeholder="Cari nama, kode part, lokasi rak..."
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Per page */}
                            <select
                                value={filters?.per_page || 10}
                                onChange={(e) => router.get(route('parts.index'), { ...filters, per_page: parseInt(e.target.value) }, { preserveState: true, preserveScroll: true })}
                                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>

                            {/* Column toggle */}
                            <div className="relative">
                                <button onClick={() => setShowColumnToggle(!showColumnToggle)} className="inline-flex items-center rounded-xl px-3 py-2.5 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" title="Kolom">
                                    <IconEye size={16} />
                                </button>
                                {showColumnToggle && (
                                    <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg z-20 min-w-[11rem]">
                                        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Tampilkan Kolom</p>
                                        </div>
                                        <div className="p-3 space-y-1.5 max-h-64 overflow-y-auto">
                                            {Object.entries(colLabels).map(([col, label]) => (
                                                <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-1.5 rounded">
                                                    <input type="checkbox" checked={visibleColumns[col]} onChange={() => toggleColumn(col)} className="w-4 h-4 rounded" />
                                                    <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Export */}
                            <button onClick={handleExportCSV} className="inline-flex items-center rounded-xl px-3 py-2.5 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" title="Export CSV"><IconDownload size={16} /></button>
                            {/* Print */}
                            <button onClick={() => window.print()} className="inline-flex items-center rounded-xl px-3 py-2.5 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700" title="Print"><IconPrinter size={16} /></button>

                            {/* Advanced filter toggle */}
                            <button
                                type="button" onClick={() => setShowFilters(prev => !prev)}
                                className={`relative inline-flex items-center gap-2 px-4 py-2.5 border rounded-xl font-semibold text-sm transition-colors ${showFilters || activeFiltersCount > 1 ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-300' : 'bg-white border-slate-300 text-slate-700 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300'}`}
                            >
                                <IconFilter size={16} /> Filter
                                {activeFiltersCount > 1 && (
                                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-[10px] font-bold text-white">{activeFiltersCount}</span>
                                )}
                            </button>
                            <button type="button" onClick={handleFilter} className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl">Terapkan</button>
                        </div>
                    </div>

                    {/* Advanced filter panel */}
                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"><IconCategory size={14} /> Kategori</label>
                                <select value={activeFilters.category_id} onChange={(e) => setActiveFilters(prev => ({ ...prev, category_id: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
                                    <option value="">Semua Kategori</option>
                                    {categories?.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"><IconTruck size={14} /> Supplier</label>
                                <select value={activeFilters.supplier_id} onChange={(e) => setActiveFilters(prev => ({ ...prev, supplier_id: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
                                    <option value="">Semua Supplier</option>
                                    {suppliers?.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"><IconPackage size={14} /> Status Stok</label>
                                <select value={stockStatus !== 'all' ? stockStatus : ''} onChange={(e) => { const v = e.target.value; setStockStatus(v || 'all'); }} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
                                    <option value="">Semua Status</option>
                                    <option value="normal">Normal</option>
                                    <option value="low">Stok Rendah</option>
                                    <option value="out">Habis</option>
                                </select>
                            </div>
                            <div className="md:col-span-3 flex flex-wrap justify-end gap-2 mt-1">
                                <button type="button" onClick={handleReset} className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl"><IconX size={16} /> Reset Filter</button>
                                <button type="button" onClick={handleFilter} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl"><IconFilter size={16} /> Terapkan Filter</button>
                            </div>
                        </div>
                    )}
                </div>

                {/*  Data Table / Card  */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {liveItems && liveItems.length > 0 ? (
                        <>
                            {viewMode === 'table' ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                        <thead className="bg-slate-50 dark:bg-slate-800/70">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300">No</th>
                                                {visibleColumns.name && <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300"><button onClick={() => handleSort('name')} className="flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-primary-400">Nama Part {getSortIcon('name')}</button></th>}
                                                {visibleColumns.part_number && <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300"><button onClick={() => handleSort('part_number')} className="flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-primary-400">Kode Part {getSortIcon('part_number')}</button></th>}
                                                {visibleColumns.category && <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Kategori</th>}
                                                {visibleColumns.supplier && <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Supplier</th>}
                                                {visibleColumns.rack_location && <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300"><button onClick={() => handleSort('rack_location')} className="flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-primary-400">Lokasi Rak {getSortIcon('rack_location')}</button></th>}
                                                {visibleColumns.stock && <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-500 dark:text-slate-300"><button onClick={() => handleSort('stock')} className="flex items-center justify-center gap-1.5 w-full hover:text-primary-600 dark:hover:text-primary-400">Stok {getSortIcon('stock')}</button></th>}
                                                {visibleColumns.minimal_stock && <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Min. Stok</th>}
                                                {visibleColumns.buy_price && <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500 dark:text-slate-300"><button onClick={() => handleSort('buy_price')} className="flex items-center justify-end gap-1.5 w-full hover:text-primary-600 dark:hover:text-primary-400">Harga Beli {getSortIcon('buy_price')}</button></th>}
                                                {visibleColumns.sell_price && <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500 dark:text-slate-300"><button onClick={() => handleSort('sell_price')} className="flex items-center justify-end gap-1.5 w-full hover:text-primary-600 dark:hover:text-primary-400">Harga Jual {getSortIcon('sell_price')}</button></th>}
                                                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {liveItems.map((p, idx) => {
                                                const { cls: stockCls } = getStockBadge(p);
                                                return (
                                                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{idx + 1 + ((parts.current_page || 1) - 1) * (parts.per_page || parts.data.length)}</td>
                                                        {visibleColumns.name && <td className="px-4 py-3"><div className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}</div>{p.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{p.description}</div>}</td>}
                                                        {visibleColumns.part_number && <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 font-mono">{p.part_number || '-'}</td>}
                                                        {visibleColumns.category && <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.category?.name || '-'}</td>}
                                                        {visibleColumns.supplier && <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.supplier?.name || '-'}</td>}
                                                        {visibleColumns.rack_location && (
                                                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                                                                {p.rack_location ? <div className="flex items-center gap-1"><IconMapPin size={13} className="text-slate-400 shrink-0" />{p.rack_location}</div> : '-'}
                                                            </td>
                                                        )}
                                                        {visibleColumns.stock && (
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${stockCls}`}><IconPackage size={13} />{p.stock}</span>
                                                            </td>
                                                        )}
                                                        {visibleColumns.minimal_stock && (
                                                            <td className="px-4 py-3 text-center">
                                                                {p.minimal_stock > 0
                                                                    ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"><IconAlertCircle size={12} />{p.minimal_stock}</span>
                                                                    : <span className="text-xs text-slate-400">-</span>}
                                                            </td>
                                                        )}
                                                        {visibleColumns.buy_price && <td className="px-4 py-3 text-right text-sm text-slate-600 dark:text-slate-400">{formatCurrency(p.buy_price || 0)}</td>}
                                                        {visibleColumns.sell_price && <td className="px-4 py-3 text-right text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(p.sell_price || 0)}</td>}
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Link href={route('parts.show', p.id)} className="inline-flex items-center gap-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50"><IconEye size={14} /> Detail</Link>
                                                                <Link href={route('parts.edit', p.id)} className="inline-flex items-center gap-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50"><IconPencilCog size={14} /> Edit</Link>
                                                                <Button type="delete" icon={<IconTrash size={14} />} className="inline-flex items-center justify-center p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50" url={route('parts.destroy', p.id)} label="" />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                /* Card view */
                                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {liveItems.map((p) => {
                                        const { cls: stockCls, label: stockLabel } = getStockBadge(p);
                                        return (
                                            <div key={p.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-800/30 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</p>
                                                        {p.part_number && <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{p.part_number}</p>}
                                                    </div>
                                                    <span className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold ${stockCls}`}>{stockLabel}</span>
                                                </div>
                                                <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                                                    <div className="flex items-center gap-1.5"><IconCategory size={13} className="shrink-0 text-slate-400" /><span>{p.category?.name || '-'}</span></div>
                                                    <div className="flex items-center gap-1.5"><IconTruck size={13} className="shrink-0 text-slate-400" /><span>{p.supplier?.name || '-'}</span></div>
                                                    {p.rack_location && <div className="flex items-center gap-1.5"><IconMapPin size={13} className="shrink-0 text-slate-400" /><span>{p.rack_location}</span></div>}
                                                </div>
                                                <div className="mt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-3">
                                                    <div>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Stok</p>
                                                        <p className="text-lg font-black text-slate-900 dark:text-white">{p.stock}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Harga Jual</p>
                                                        <p className="text-sm font-bold text-primary-700 dark:text-primary-300">{formatCurrency(p.sell_price || 0)}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex items-center gap-2">
                                                    <Link href={route('parts.show', p.id)} className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 py-1.5 text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50"><IconEye size={14} /> Detail</Link>
                                                    <Link href={route('parts.edit', p.id)} className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 py-1.5 text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50"><IconPencilCog size={14} /> Edit</Link>
                                                    <Button type="delete" icon={<IconTrash size={14} />} className="flex-1 flex items-center justify-center p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50" url={route('parts.destroy', p.id)} label="" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Menampilkan <span className="font-semibold">{parts.from}</span><span className="font-semibold">{parts.to}</span> dari <span className="font-semibold">{parts.total}</span> part
                                </p>
                                <Pagination links={parts.links} />
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

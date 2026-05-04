import React, { useState, useEffect, useRef } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Pagination from '@/Components/Dashboard/Pagination';
import Button from '@/Components/Dashboard/Button';
import { toDisplayDate } from '@/Utils/datetime';
import {
    IconPlus, IconEdit, IconTrash, IconCar, IconCalendar,
    IconFilter, IconX, IconArrowUp, IconArrowDown, IconArrowsSort,
    IconLayoutGrid, IconList, IconSearch, IconUsers,
    IconShieldCheck, IconAlertTriangle, IconDownload, IconPrinter, IconEye,
} from '@tabler/icons-react';

function StatCard({ title, value, subtitle, icon, tone }) {
    const tones = {
        blue:   'from-blue-50 to-blue-100 border-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 dark:border-blue-800 text-blue-800 dark:text-blue-200',
        green:  'from-green-50 to-green-100 border-green-200 dark:from-green-900/20 dark:to-green-800/20 dark:border-green-800 text-green-800 dark:text-green-200',
        amber:  'from-amber-50 to-amber-100 border-amber-200 dark:from-amber-900/20 dark:to-amber-800/20 dark:border-amber-800 text-amber-800 dark:text-amber-200',
        indigo: 'from-indigo-50 to-indigo-100 border-indigo-200 dark:from-indigo-900/20 dark:to-indigo-800/20 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200',
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
                <IconCar size={40} className="text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Belum ada kendaraan</h3>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                {hasFilters
                    ? 'Tidak ada kendaraan yang sesuai dengan filter yang diterapkan.'
                    : 'Mulai dengan mendaftarkan kendaraan pertama Anda.'}
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
                    href={route('vehicles.create')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors shadow-sm"
                >
                    <IconPlus size={18} /> Tambah Kendaraan
                </Link>
            )}
        </div>
    );
}

const formatDate = (d) => (d ? toDisplayDate(d) : '-');

export default function Index({ vehicles, filters, stats }) {
    const [search, setSearch]           = useState(filters?.search || '');
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode]       = useState('grid');
    const [liveItems, setLiveItems]     = useState(vehicles?.data || []);
    const [activeFilters, setActiveFilters] = useState({
        brand:          filters?.brand || '',
        year:           filters?.year || '',
        transmission:   filters?.transmission || '',
        service_status: filters?.service_status || '',
    });

    useEffect(() => { setLiveItems(vehicles?.data || []); }, [vehicles?.data]);

    const handleSort = (col) => {
        const dir = filters?.sort_by === col && filters?.sort_direction === 'asc' ? 'desc' : 'asc';
        router.get(route('vehicles.index'), { ...filters, sort_by: col, sort_direction: dir }, { preserveState: true, preserveScroll: true });
    };

    const getSortIcon = (col) => {
        if (filters?.sort_by !== col) return <IconArrowsSort size={14} className="opacity-50" />;
        return filters?.sort_direction === 'asc'
            ? <IconArrowUp size={14} className="text-primary-600 dark:text-primary-400" />
            : <IconArrowDown size={14} className="text-primary-600 dark:text-primary-400" />;
    };

    const handleFilter = (e) => {
        e?.preventDefault();
        router.get(route('vehicles.index'), {
            search:         search || undefined,
            brand:          activeFilters.brand || undefined,
            year:           activeFilters.year || undefined,
            transmission:   activeFilters.transmission || undefined,
            service_status: activeFilters.service_status || undefined,
            per_page:       filters?.per_page || 8,
        }, { preserveState: true, preserveScroll: true });
    };

    const handleReset = () => {
        setSearch('');
        setActiveFilters({ brand: '', year: '', transmission: '', service_status: '' });
        router.get(route('vehicles.index'));
    };

    const activeFiltersCount = [search, activeFilters.brand, activeFilters.year, activeFilters.transmission, activeFilters.service_status].filter(Boolean).length;

    const handleExportCSV = () => {
        const headers = ['No. Plat', 'Merek', 'Model', 'Tahun', 'Warna', 'Pemilik', 'Transmisi', 'Mesin', 'KM'];
        const rows = vehicles.data.map(v => [
            v.plate_number, v.brand, v.model, v.year || '', v.color || '',
            v.customer?.name || '', v.transmission_type || '', v.engine_type || '', v.km || '',
        ].join(','));
        const csv  = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = window.URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = `kendaraan-${new Date().toISOString().split('T')[0]}.csv`; a.click();
        window.URL.revokeObjectURL(url);
    };

    /*  VehicleCard (grid tile)  */
    const VehicleCard = ({ vehicle }) => {
        return (
            <div className="group overflow-hidden rounded-2xl shadow-sm ring-1 transition-all duration-200 hover:shadow-lg bg-white ring-slate-200 hover:ring-primary-300 dark:bg-slate-800 dark:ring-slate-700 dark:hover:ring-primary-700">
            {/* Gradient header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary-500 to-accent-500 p-4">
                <div className="absolute right-0 top-0 -mr-6 -mt-6 opacity-10 transition-transform duration-300 group-hover:scale-110">
                    <IconCar size={100} />
                </div>
                <div className="relative space-y-2">
                    <div className="text-2xl font-bold text-white">{vehicle.plate_number}</div>
                    <div className="flex items-center gap-2">
                        <span className="inline-block rounded-lg bg-white/20 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">{vehicle.brand}</span>
                        <span className="text-sm text-white/80">{vehicle.model}</span>
                    </div>
                    {vehicle.transmission_type && (
                        <div className="flex items-center gap-2 pt-1">
                            <span className="inline-block rounded-lg bg-white/20 px-3 py-1 text-xs font-medium capitalize text-white">{vehicle.transmission_type}</span>
                            {vehicle.year && <span className="text-xs text-white/80">Tahun {vehicle.year}</span>}
                        </div>
                    )}
                </div>
            </div>
            {/* Body */}
            <div className="p-4 space-y-3">
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400">Mesin</span>
                        <div className="flex items-center gap-1">
                            {vehicle.engine_type && <span className="rounded-lg bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{vehicle.engine_type}</span>}
                            {vehicle.cylinder_volume && <span className="text-slate-900 dark:text-slate-100 font-medium">{vehicle.cylinder_volume} cc</span>}
                        </div>
                    </div>
                    {vehicle.km && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">Km</span>
                            <span className="font-medium text-slate-900 dark:text-slate-100">{vehicle.km.toLocaleString('id-ID')} km</span>
                        </div>
                    )}
                    {vehicle.customer && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">Pemilik</span>
                            <span className="font-medium text-slate-900 dark:text-slate-100 line-clamp-1">{vehicle.customer.name}</span>
                        </div>
                    )}
                </div>
                {vehicle.last_service_date && (
                    <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-700/30">
                        <IconCalendar size={14} className="text-primary-600 dark:text-primary-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-900 dark:text-slate-100">Service: {formatDate(vehicle.last_service_date)}</p>
                            {vehicle.next_service_date && <p className="text-xs text-slate-500 dark:text-slate-400">Berikutnya: {formatDate(vehicle.next_service_date)}</p>}
                        </div>
                    </div>
                )}
                <div className="flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                    <Link href={route('vehicles.show', vehicle.id)} className="flex-1 rounded-lg bg-blue-100 py-2 text-center text-xs font-semibold text-blue-700 transition hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50">Detail</Link>
                    <Link href={route('vehicles.edit', vehicle.id)} className="flex-1 rounded-lg bg-amber-100 py-2 text-center text-xs font-semibold text-amber-700 transition hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50">Edit</Link>
                    <Button type="delete" label="Hapus" icon={null} url={route('vehicles.destroy', vehicle.id)} className="flex-1 flex items-center justify-center rounded-lg bg-red-100 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50" />
                </div>
            </div>
        </div>
        );
    };

    return (
        <>
            <Head title="Kendaraan" />
            <div className="space-y-6">

                {/*  Hero Banner  */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white via-primary-50/50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-5 md:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-600 dark:text-primary-400">Fleet Management</p>
                            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Kendaraan</h1>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Kelola data kendaraan, riwayat service, dan jadwal perawatan.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* View mode toggle */}
                            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                                <button type="button" onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><IconLayoutGrid size={18} /></button>
                                <button type="button" onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><IconList size={18} /></button>
                            </div>
                            <Link href={route('vehicles.create')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl text-sm shadow-sm transition-colors">
                                <IconPlus size={18} /> Tambah Kendaraan
                            </Link>
                        </div>
                    </div>

                    {/* Stat cards */}
                    <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <StatCard title="Total Kendaraan" value={stats?.total          ?? vehicles?.total ?? 0} subtitle="Semua terdaftar"   icon={<IconCar size={20} />}           tone="blue"   />
                        <StatCard title="Pernah Service"  value={stats?.serviced        ?? 0}                   subtitle="Ada riwayat"       icon={<IconShieldCheck size={20} />}   tone="green"  />
                        <StatCard title="Belum Service"   value={stats?.never_serviced  ?? 0}                   subtitle="Perlu perhatian"   icon={<IconAlertTriangle size={20} />} tone="amber"  />
                        <StatCard title="Bulan Ini"       value={stats?.this_month      ?? 0}                   subtitle="Service bulan ini" icon={<IconCalendar size={20} />}      tone="indigo" />
                    </div>
                </div>

                {/*  Filter Bar  */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                    <div className="flex flex-col lg:flex-row gap-3">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <IconSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text" value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                                placeholder="Cari no. plat, merek, model, pemilik..."
                                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Per page */}
                            <select
                                value={filters?.per_page || 8}
                                onChange={(e) => router.get(route('vehicles.index'), { ...filters, per_page: parseInt(e.target.value) }, { preserveState: true, preserveScroll: true })}
                                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="8">8</option>
                                <option value="12">12</option>
                                <option value="16">16</option>
                                <option value="24">24</option>
                            </select>
                            {/* Export */}
                            <button onClick={handleExportCSV} title="Export CSV" className="inline-flex items-center rounded-xl px-3 py-2.5 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"><IconDownload size={16} /></button>
                            {/* Print */}
                            <button onClick={() => window.print()} title="Print" className="inline-flex items-center rounded-xl px-3 py-2.5 text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"><IconPrinter size={16} /></button>
                            {/* Filter toggle */}
                            <button
                                type="button" onClick={() => setShowFilters(prev => !prev)}
                                className={`relative inline-flex items-center gap-2 px-4 py-2.5 border rounded-xl font-semibold text-sm transition-colors ${showFilters || activeFiltersCount > 0 ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30 dark:border-primary-700 dark:text-primary-300' : 'bg-white border-slate-300 text-slate-700 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300'}`}
                            >
                                <IconFilter size={16} /> Filter
                                {activeFiltersCount > 0 && (
                                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-[10px] font-bold text-white">{activeFiltersCount}</span>
                                )}
                            </button>
                            <button type="button" onClick={handleFilter} className="px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl">Terapkan</button>
                        </div>
                    </div>

                    {/* Advanced filter panel */}
                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                            {/* Merek */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Merek</label>
                                <select value={activeFilters.brand} onChange={(e) => setActiveFilters(p => ({ ...p, brand: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
                                    <option value="">Semua Merek</option>
                                    {['Honda','Yamaha','Suzuki','Kawasaki','TVS','Viar'].map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            {/* Tahun */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Tahun</label>
                                <select value={activeFilters.year} onChange={(e) => setActiveFilters(p => ({ ...p, year: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
                                    <option value="">Semua Tahun</option>
                                    {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            {/* Transmisi */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Transmisi</label>
                                <select value={activeFilters.transmission} onChange={(e) => setActiveFilters(p => ({ ...p, transmission: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
                                    <option value="">Semua Transmisi</option>
                                    <option value="manual">Manual</option>
                                    <option value="automatic">Automatic</option>
                                    <option value="semi-automatic">Semi-Automatic</option>
                                </select>
                            </div>
                            {/* Status Service */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Status Service</label>
                                <select value={activeFilters.service_status} onChange={(e) => setActiveFilters(p => ({ ...p, service_status: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white">
                                    <option value="">Semua Status</option>
                                    <option value="serviced">Pernah Service</option>
                                    <option value="never">Belum Pernah</option>
                                </select>
                            </div>
                            <div className="md:col-span-4 flex justify-end gap-2 mt-1">
                                <button type="button" onClick={handleReset} className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl"><IconX size={16} /> Reset</button>
                                <button type="button" onClick={handleFilter} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl"><IconFilter size={16} /> Terapkan</button>
                            </div>
                        </div>
                    )}
                </div>

                {/*  Data Container  */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    {liveItems && liveItems.length > 0 ? (
                        <>
                            {/* Grid view */}
                            {viewMode === 'grid' && (
                                <div className="p-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {liveItems.map(v => <VehicleCard key={v.id} vehicle={v} />)}
                                </div>
                            )}

                            {/* List (table) view */}
                            {viewMode === 'list' && (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                        <thead className="bg-slate-50 dark:bg-slate-800/70">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300"><button onClick={() => handleSort('plate_number')} className="flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-primary-400">No. Plat {getSortIcon('plate_number')}</button></th>
                                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300"><button onClick={() => handleSort('brand')} className="flex items-center gap-1.5 hover:text-primary-600 dark:hover:text-primary-400">Kendaraan {getSortIcon('brand')}</button></th>
                                                <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Pemilik</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-500 dark:text-slate-300"><button onClick={() => handleSort('year')} className="flex items-center justify-center gap-1.5 w-full hover:text-primary-600 dark:hover:text-primary-400">Spesifikasi {getSortIcon('year')}</button></th>
                                                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Service Terakhir</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold uppercase text-slate-500 dark:text-slate-300">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {liveItems.map(v => (
                                                <tr key={v.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 shrink-0">
                                                                <IconCar size={18} className="text-white" />
                                                            </div>
                                                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{v.plate_number}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{v.brand} {v.model}</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">{v.year && `Tahun ${v.year}`}{v.color && `  ${v.color}`}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{v.customer?.name || '-'}</div>
                                                        {v.customer?.phone && <div className="text-xs text-slate-500 dark:text-slate-400">{v.customer.phone}</div>}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs text-slate-600 dark:text-slate-400">
                                                        {v.engine_type && <div>{v.engine_type}</div>}
                                                        {v.cylinder_volume && <div>{v.cylinder_volume} cc</div>}
                                                        {v.transmission_type && <div className="capitalize">{v.transmission_type}</div>}
                                                        {v.km && <div className="font-medium mt-0.5">{v.km.toLocaleString('id-ID')} km</div>}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {v.last_service_date ? (
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400"><IconCalendar size={13} />{formatDate(v.last_service_date)}</div>
                                                                {v.next_service_date && <div className="text-xs text-primary-600 dark:text-primary-400">Next: {formatDate(v.next_service_date)}</div>}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">Belum pernah</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Link href={route('vehicles.show', v.id)} className="inline-flex items-center gap-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50"><IconEye size={14} /> Detail</Link>
                                                            <Link href={route('vehicles.edit', v.id)} className="inline-flex items-center gap-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50"><IconEdit size={14} /> Edit</Link>
                                                            <Button type="delete" icon={<IconTrash size={14} />} label="Hapus" url={route('vehicles.destroy', v.id)} className="inline-flex items-center gap-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/50" />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination */}
                            <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-900 flex items-center justify-between gap-4">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Menampilkan <span className="font-semibold">{vehicles.from}</span><span className="font-semibold">{vehicles.to}</span> dari <span className="font-semibold">{vehicles.total}</span> kendaraan
                                </p>
                                <Pagination links={vehicles.links} />
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


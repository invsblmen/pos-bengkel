import React, { useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { IconPlus, IconSearch, IconEdit, IconTrash, IconCar, IconCalendar, IconFilter, IconX, IconChevronDown, IconArrowUp, IconArrowDown, IconArrowsSort, IconLayoutGrid, IconList } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { toDisplayDate } from '@/Utils/datetime';
import Button from '@/Components/Dashboard/Button';
import Search from '@/Components/Dashboard/Search';

export default function Index({ vehicles, filters }) {
    const [showFilters, setShowFilters] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    const [perPage, setPerPage] = useState(filters?.per_page || 8);
    const [liveItems, setLiveItems] = useState(vehicles?.data || []);
    const [activeFilters, setActiveFilters] = useState({
        brand: filters?.brand || '',
        year: filters?.year || '',
        transmission: filters?.transmission || '',
        service_status: filters?.service_status || '',
    });

    // Sync per_page with URL parameter
    useEffect(() => {
        const newPerPage = filters?.per_page || 8;
        setPerPage(newPerPage);
    }, [filters?.per_page]);

    // Real-time Echo listeners
    useEffect(() => {
        if (!window.Echo) return;
        const channel = window.Echo.channel('workshop.vehicles');
        
        channel.listen('.vehicle.created', (event) => {
            const incoming = event?.vehicle;
            if (!incoming?.id) return;
            setLiveItems(prev => {
                if (prev.some(i => i.id === incoming.id)) return prev;
                return [incoming, ...prev];
            });
        });
        
        channel.listen('.vehicle.updated', (event) => {
            const updated = event?.vehicle;
            if (!updated?.id) return;
            setLiveItems(prev => {
                const index = prev.findIndex(i => i.id === updated.id);
                if (index === -1) return prev;
                const newArr = [...prev];
                newArr[index] = updated;
                return newArr;
            });
        });
        
        channel.listen('.vehicle.deleted', (event) => {
            const id = event?.vehicleId;
            if (!id) return;
            setLiveItems(prev => prev.filter(i => i.id !== id));
        });
        
        return () => window.Echo.leaveChannel('workshop.vehicles');
    }, []);

    const handleSort = (column) => {
        const currentSort = filters?.sort_by;
        const currentDirection = filters?.sort_direction || 'desc';

        let newDirection = 'asc';
        if (currentSort === column && currentDirection === 'asc') {
            newDirection = 'desc';
        }

        router.get(route('vehicles.index'), {
            ...filters,
            sort_by: column,
            sort_direction: newDirection,
            per_page: perPage,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handlePerPageChange = (value) => {
        setPerPage(value);
        router.get(route('vehicles.index'), {
            search: filters?.search || '',
            ...activeFilters,
            per_page: value,
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
    const handleDelete = (id, plateNumber) => {
        if (confirm(`Apakah Anda yakin ingin menghapus kendaraan ${plateNumber}?`)) {
            router.delete(route('vehicles.destroy', id), {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Kendaraan berhasil dihapus!');
                },
                onError: () => {
                    toast.error('Gagal menghapus kendaraan!');
                },
            });
        }
    };

    const handleFilterChange = (key, value) => {
        const newFilters = { ...activeFilters, [key]: value };
        setActiveFilters(newFilters);

        // Apply filters
        router.get(route('vehicles.index'), {
            search: filters?.search || '',
            ...newFilters,
            per_page: perPage,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearFilters = () => {
        setActiveFilters({
            brand: '',
            year: '',
            transmission: '',
            service_status: '',
        });

        router.get(route('vehicles.index'), {
            search: filters?.search || '',
            per_page: perPage,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleClearFilter = () => {
        const params = new URLSearchParams(window.location.search);
        const hasActiveFilter = params.has('search');

        if (hasActiveFilter) {
            router.get(route('vehicles.index'), {
                per_page: perPage,
            }, {
                preserveState: true,
                preserveScroll: true,
            });
        }
    };

    const hasActiveFilters = Object.values(activeFilters).some(value => value !== '');

    const formatDate = (dateString) => (dateString ? toDisplayDate(dateString) : '-');

    const VehicleCard = ({ vehicle }) => (
        <div className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition-all duration-200 hover:shadow-lg hover:ring-slate-300 dark:bg-slate-800 dark:ring-slate-700 dark:hover:ring-slate-600">
            {/* Top Panel with Info */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary-500 to-accent-500 p-4">
                <div className="absolute right-0 top-0 -mr-6 -mt-6 opacity-5 transition-transform duration-300 group-hover:scale-110">
                    <IconCar size={100} />
                </div>
                <div className="relative space-y-2">
                    {/* Plate Number */}
                    <div className="text-2xl font-bold text-white">
                        {vehicle.plate_number}
                    </div>

                    {/* Brand and Model */}
                    <div className="flex items-center gap-2">
                        <span className="inline-block rounded-lg bg-white/20 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">
                            {vehicle.brand}
                        </span>
                        <span className="text-sm text-white/80">
                            {vehicle.model}
                        </span>
                    </div>

                    {/* Transmission */}
                    {vehicle.transmission_type && (
                        <div className="flex items-center gap-2 pt-1">
                            <span className="inline-block rounded-lg bg-white/20 px-3 py-1 text-xs font-medium capitalize text-white">
                                {vehicle.transmission_type}
                            </span>
                            {vehicle.year && (
                                <span className="text-xs text-white/80">
                                    Tahun {vehicle.year}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Vehicle Details */}
                <div className="space-y-2">
                    {/* Engine and Cylinder */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400">Mesin</span>
                        <div className="flex items-center gap-1">
                            {vehicle.engine_type && (
                                <span className="rounded-lg bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                    {vehicle.engine_type}
                                </span>
                            )}
                            {vehicle.cylinder_volume && (
                                <span className="text-slate-900 dark:text-slate-100 font-medium">
                                    {vehicle.cylinder_volume} cc
                                </span>
                            )}
                        </div>
                    </div>

                    {/* KM */}
                    {vehicle.km && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">Km</span>
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                                {vehicle.km.toLocaleString('id-ID')} km
                            </span>
                        </div>
                    )}

                    {/* Owner */}
                    {vehicle.customer && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">Pemilik</span>
                            <span className="font-medium text-slate-900 dark:text-slate-100 line-clamp-1">
                                {vehicle.customer.name}
                            </span>
                        </div>
                    )}
                </div>

                {/* Last Service */}
                {vehicle.last_service_date && (
                    <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-700/30">
                        <IconCalendar size={14} className="text-primary-600 dark:text-primary-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                                Service: {formatDate(vehicle.last_service_date)}
                            </p>
                            {vehicle.next_service_date && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Berikutnya: {formatDate(vehicle.next_service_date)}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                    <Link
                        href={route('vehicles.show', vehicle.id)}
                        className="flex-1 rounded-lg bg-blue-100 py-2 text-center text-xs font-medium text-blue-700 transition-all hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                    >
                        Detail
                    </Link>
                    <Link
                        href={route('vehicles.edit', vehicle.id)}
                        className="flex-1 rounded-lg bg-amber-100 py-2 text-center text-xs font-medium text-amber-700 transition-all hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                    >
                        Edit
                    </Link>
                    <button
                        onClick={() => handleDelete(vehicle.id, vehicle.plate_number)}
                        className="flex-1 rounded-lg bg-red-100 py-2 text-center text-xs font-medium text-red-700 transition-all hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                    >
                        Hapus
                    </button>
                </div>
            </div>
        </div>
    );

    const hasActiveFilter = new URLSearchParams(window.location.search).has('search');

    return (
        <>
            <Head title="Kendaraan" />
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-500">
                                <IconCar size={24} className="text-white" />
                            </div>
                            <h1 className="bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-3xl font-bold text-transparent dark:from-primary-400 dark:to-accent-400">
                                Manajemen Kendaraan
                            </h1>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Total {vehicles.total || vehicles.data?.length || 0} kendaraan terdaftar
                        </p>
                    </div>
                    <Button
                        type="link"
                        icon={<IconPlus size={18} strokeWidth={1.5} />}
                        className="bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 text-white shadow-lg shadow-primary-500/30"
                        label="Tambah Kendaraan"
                        href={route('vehicles.create')}
                    />
                </div>

                {/* Search and Filters */}
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex-1">
                            <Search
                                url={route('vehicles.index')}
                                placeholder="Cari nomor plat, merek, model, atau pelanggan..."
                            />
                        </div>

                        {/* Per Page Selector */}
                        <div className="flex items-center gap-3">
                            <select
                                value={perPage}
                                onChange={(e) => handlePerPageChange(parseInt(e.target.value))}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 transition-all hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500"
                            >
                                <option value={8}>8 per halaman</option>
                                <option value={12}>12 per halaman</option>
                                <option value={16}>16 per halaman</option>
                                <option value={20}>20 per halaman</option>
                                <option value={24}>24 per halaman</option>
                            </select>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`rounded-lg px-3 py-2 transition-all ${
                                    viewMode === 'grid'
                                        ? 'bg-white text-primary-600 shadow-sm dark:bg-slate-700 dark:text-primary-400'
                                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                                }`}
                            >
                                <IconLayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`rounded-lg px-3 py-2 transition-all ${
                                    viewMode === 'list'
                                        ? 'bg-white text-primary-600 shadow-sm dark:bg-slate-700 dark:text-primary-400'
                                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                                }`}
                            >
                                <IconList size={18} />
                            </button>
                        </div>

                        {/* Filter Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                                hasActiveFilters || showFilters
                                    ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white hover:from-primary-600 hover:to-accent-600 shadow-lg shadow-primary-500/30'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
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

                    {/* Clear Filter Button */}
                    {hasActiveFilter && (
                        <button
                            onClick={handleClearFilter}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-danger-500 to-danger-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:from-danger-600 hover:to-danger-700 shadow-lg shadow-danger-500/30"
                        >
                            <IconX size={16} />
                            Hapus Filter Pencarian
                        </button>
                    )}

                    {/* Filter Panel */}
                    {showFilters && (
                        <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 dark:border-slate-700 dark:from-slate-800/50 dark:to-slate-800/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-500">
                                            <IconFilter size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="inline-block bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-lg font-semibold text-transparent dark:from-primary-400 dark:to-accent-400">
                                                Filter Kendaraan
                                            </h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Saring data berdasarkan kriteria
                                            </p>
                                        </div>
                                    </div>
                                    {hasActiveFilters && (
                                        <button
                                            onClick={clearFilters}
                                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-danger-500 to-danger-600 px-4 py-2 text-sm font-medium text-white transition hover:from-danger-600 hover:to-danger-700 shadow-lg shadow-danger-500/20"
                                        >
                                            <IconX size={16} />
                                            Hapus Filter
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 backdrop-blur-sm">
                                <div className="grid gap-6 md:grid-cols-4">
                                    {/* Brand Filter */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Merek
                                        </label>
                                        <select
                                            value={activeFilters.brand}
                                            onChange={(e) => handleFilterChange('brand', e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                        >
                                            <option value="">Semua Merek</option>
                                            <option value="Honda">Honda</option>
                                            <option value="Yamaha">Yamaha</option>
                                            <option value="Suzuki">Suzuki</option>
                                            <option value="Kawasaki">Kawasaki</option>
                                            <option value="TVS">TVS</option>
                                            <option value="Viar">Viar</option>
                                        </select>
                                    </div>

                                    {/* Year Filter */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Tahun
                                        </label>
                                        <select
                                            value={activeFilters.year}
                                            onChange={(e) => handleFilterChange('year', e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                        >
                                            <option value="">Semua Tahun</option>
                                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Transmission Filter */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Transmisi
                                        </label>
                                        <select
                                            value={activeFilters.transmission}
                                            onChange={(e) => handleFilterChange('transmission', e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                        >
                                            <option value="">Semua Transmisi</option>
                                            <option value="manual">Manual</option>
                                            <option value="automatic">Automatic</option>
                                            <option value="semi-automatic">Semi-Automatic</option>
                                        </select>
                                    </div>

                                    {/* Service Status Filter */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Status Service
                                        </label>
                                        <select
                                            value={activeFilters.service_status}
                                            onChange={(e) => handleFilterChange('service_status', e.target.value)}
                                            className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                        >
                                            <option value="">Semua Status</option>
                                            <option value="serviced">Pernah Service</option>
                                            <option value="never">Belum Pernah</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Content */}
                {liveItems && liveItems.length > 0 ? (
                    <div>
                        {/* Grid View */}
                        {viewMode === 'grid' && (
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {liveItems.map((vehicle) => (
                                    <VehicleCard key={vehicle.id} vehicle={vehicle} />
                                ))}
                            </div>
                        )}

                        {/* List View (Table) */}
                        {viewMode === 'list' && (
                            <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                        <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                                            <tr>
                                                <th
                                                    onClick={() => handleSort('plate_number')}
                                                    className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span>No. Plat</span>
                                                        {getSortIcon('plate_number')}
                                                    </div>
                                                </th>
                                                <th
                                                    onClick={() => handleSort('brand')}
                                                    className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span>Kendaraan</span>
                                                        {getSortIcon('brand')}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                    Pemilik
                                                </th>
                                                <th
                                                    onClick={() => handleSort('year')}
                                                    className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    <div className="flex items-center justify-center gap-2">
                                                        <span>Spesifikasi</span>
                                                        {getSortIcon('year')}
                                                    </div>
                                                </th>
                                                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                    Service Terakhir
                                                </th>
                                                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                                    Aksi
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                                            {liveItems.map((vehicle) => (
                                                <tr
                                                    key={vehicle.id}
                                                    className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                                >
                                                    <td className="whitespace-nowrap px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-500">
                                                                <IconCar size={20} className="text-white" />
                                                            </div>
                                                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                                {vehicle.plate_number}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                            {vehicle.brand} {vehicle.model}
                                                        </div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            {vehicle.year && `Tahun ${vehicle.year}`}
                                                            {vehicle.color && ` • ${vehicle.color}`}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                            {vehicle.customer?.name || '-'}
                                                        </div>
                                                        {vehicle.customer?.phone && (
                                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                                {vehicle.customer.phone}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-center">
                                                        <div className="text-xs text-slate-600 dark:text-slate-400">
                                                            {vehicle.engine_type && (
                                                                <div>Mesin: {vehicle.engine_type}</div>
                                                            )}
                                                            {vehicle.cylinder_volume && (
                                                                <div>{vehicle.cylinder_volume} cc</div>
                                                            )}
                                                            {vehicle.transmission_type && (
                                                                <div className="capitalize">{vehicle.transmission_type}</div>
                                                            )}
                                                            {vehicle.km && (
                                                                <div className="mt-1 font-medium">
                                                                    {vehicle.km.toLocaleString('id-ID')} km
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            {vehicle.last_service_date ? (
                                                                <>
                                                                    <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                                                                        <IconCalendar size={14} />
                                                                        {formatDate(vehicle.last_service_date)}
                                                                    </div>
                                                                    {vehicle.next_service_date && (
                                                                        <div className="text-xs text-primary-600 dark:text-primary-400">
                                                                            Next: {formatDate(vehicle.next_service_date)}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-slate-400">Belum pernah</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Link
                                                                href={route('vehicles.show', vehicle.id)}
                                                                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-100 hover:bg-blue-200 px-3 py-2 text-xs font-medium text-blue-700 transition-all hover:shadow-sm dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                                                            >
                                                                <IconCar size={16} />
                                                                Detail
                                                            </Link>
                                                            <Link
                                                                href={route('vehicles.edit', vehicle.id)}
                                                                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 px-3 py-2 text-xs font-medium text-amber-700 transition-all hover:shadow-sm dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
                                                            >
                                                                <IconEdit size={16} />
                                                                Edit
                                                            </Link>
                                                            <button
                                                                onClick={() => handleDelete(vehicle.id, vehicle.plate_number)}
                                                                className="inline-flex items-center gap-1.5 rounded-xl bg-red-100 hover:bg-red-200 px-3 py-2 text-xs font-medium text-red-700 transition-all hover:shadow-sm dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                                                            >
                                                                <IconTrash size={16} />
                                                                Hapus
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {vehicles.links && (
                                    <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
                                        <div className="text-sm text-slate-700 dark:text-slate-300">
                                            Menampilkan {vehicles.from} hingga {vehicles.to} dari{' '}
                                            {vehicles.total} data
                                        </div>
                                        <div className="flex gap-2">
                                            {vehicles.links.map((link, index) => (
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
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Pagination for Grid View */}
                        {viewMode === 'grid' && vehicles.links && (
                            <div className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                                {vehicles.links.map((link, index) => (
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
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
                            <IconCar size={40} className="text-slate-400 dark:text-slate-500" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                            Belum ada data kendaraan
                        </h3>
                        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                            Mulai dengan menambahkan kendaraan pertama Anda
                        </p>
                        <Link
                            href={route('vehicles.create')}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 px-6 py-2.5 font-medium text-white transition hover:from-primary-600 hover:to-accent-600 shadow-lg shadow-primary-500/30"
                        >
                            <IconPlus size={20} />
                            Tambah Kendaraan
                        </Link>
                    </div>
                )}
            </div>
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;

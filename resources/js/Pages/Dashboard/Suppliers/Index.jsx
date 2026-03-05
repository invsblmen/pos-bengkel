import React, { useEffect, useState } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import toast from 'react-hot-toast';
import Pagination from '@/Components/Dashboard/Pagination';
import { useVisibilityRealtime } from '@/Hooks/useRealtime';
import {
    IconDatabaseOff,
    IconFilter,
    IconSearch,
    IconX,
    IconCirclePlus,
    IconChevronDown,
    IconTruck,
    IconPhone,
    IconMail,
    IconMapPin,
    IconEdit,
    IconTrash
} from '@tabler/icons-react';


// Filters
const defaultFilters = { q: '' };

export default function Index({ suppliers, filters }) {
    // filter state
    const [filterData, setFilterData] = useState({
        ...defaultFilters,
        ...(typeof filters !== 'undefined' ? filters : {}),
    });
    const [showFilters, setShowFilters] = useState(false);
    const [liveItems, setLiveItems] = useState(suppliers?.data || []);

    // Enable real-time updates
    useVisibilityRealtime({
        interval: 5000,
        only: ['suppliers'],
        preserveScroll: true,
        preserveState: true
    });

    // Real-time Echo listeners
    useEffect(() => {
        if (!window.Echo) return;
        const channel = window.Echo.channel('workshop.suppliers');
        
        channel.listen('.supplier.created', (event) => {
            const incoming = event?.supplier;
            if (!incoming?.id) return;
            setLiveItems(prev => {
                if (prev.some(i => i.id === incoming.id)) return prev;
                return [incoming, ...prev];
            });
        });
        
        channel.listen('.supplier.updated', (event) => {
            const updated = event?.supplier;
            if (!updated?.id) return;
            setLiveItems(prev => {
                const index = prev.findIndex(i => i.id === updated.id);
                if (index === -1) return prev;
                const newArr = [...prev];
                newArr[index] = updated;
                return newArr;
            });
        });
        
        channel.listen('.supplier.deleted', (event) => {
            const id = event?.supplierId;
            if (!id) return;
            setLiveItems(prev => prev.filter(i => i.id !== id));
        });
        
        return () => window.Echo.leaveChannel('workshop.suppliers');
    }, []);

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
        event.preventDefault();
        router.get(route('suppliers.index'), filterData, { preserveScroll: true, preserveState: true });
        setShowFilters(false);
    };

    const resetFilters = () => {
        setFilterData(defaultFilters);
        router.get(route('suppliers.index'), defaultFilters, { preserveScroll: true, preserveState: true, replace: true });
    };

    const remove = async (id) => {
        if (!confirm('Hapus supplier ini?')) return;

        router.delete(route('suppliers.destroy', id), {
            onSuccess: () => {
                toast.success('Supplier dihapus');
            },
            onError: () => {
                toast.error('Gagal menghapus supplier');
            },
        });
    };

    const activeFiltersCount = Object.values(filterData).filter(v => v !== '').length;

    return (
        <>
            <Head title="Supplier" />

            {/* Header with Gradient */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 p-8 mb-6 shadow-lg">
                <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/3 translate-x-1/3 rounded-full bg-white/10"></div>
                <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                            <IconTruck size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Daftar Supplier</h1>
                            <p className="mt-1 text-sm text-white/80">{liveItems.length} supplier terdaftar</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition ${
                                showFilters || activeFiltersCount > 0
                                    ? 'bg-white text-primary-700'
                                    : 'bg-white/20 text-white backdrop-blur-sm hover:bg-white/30'
                            }`}
                        >
                            <IconFilter size={18} />
                            <span>Filter</span>
                            {activeFiltersCount > 0 && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
                                    {activeFiltersCount}
                                </span>
                            )}
                            <IconChevronDown
                                size={16}
                                className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}
                            />
                        </button>
                        <Link
                            href={route('suppliers.create')}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-white/90"
                        >
                            <IconCirclePlus size={18} />
                            Tambah Supplier
                        </Link>
                    </div>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="mb-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    <div className="border-b border-slate-200 bg-gradient-to-r from-primary-50 to-primary-100/50 px-6 py-4 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800/50">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                                <IconFilter size={20} className="text-primary-600 dark:text-primary-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Filter Pencarian</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Cari supplier berdasarkan kriteria</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <form onSubmit={applyFilters}>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="md:col-span-2">
                                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Pencarian
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Cari nama, phone, email, atau contact person..."
                                        value={filterData.q}
                                        onChange={(e) => handleChange('q', e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-800 transition-all focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                </div>
                                <div className="flex items-end gap-2">
                                    <button
                                        type="submit"
                                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-6 font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:shadow-xl hover:shadow-primary-500/40"
                                    >
                                        <IconSearch size={18} />
                                        Cari
                                    </button>
                                    {activeFiltersCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 font-medium text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                        >
                                            <IconX size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Supplier List */}
            {suppliers.data && suppliers.data.length > 0 ? (
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                        No
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                        Supplier
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                        Kontak
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                        Alamat
                                    </th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {liveItems.map((s, idx) => (
                                    <tr
                                        key={s.id}
                                        className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                    >
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                            {idx + 1 + ((suppliers.current_page || 1) - 1) * (suppliers.per_page || liveItems.length)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                                                    <IconTruck size={20} className="text-primary-600 dark:text-primary-400" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-900 dark:text-white">
                                                        {s.name}
                                                    </div>
                                                    {s.contact_person && (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            PIC: {s.contact_person}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {s.phone && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                        <IconPhone size={14} className="text-slate-400" />
                                                        {s.phone}
                                                    </div>
                                                )}
                                                {s.email && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                        <IconMail size={14} className="text-slate-400" />
                                                        {s.email}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {s.address ? (
                                                <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                    <IconMapPin size={14} className="mt-0.5 flex-shrink-0 text-slate-400" />
                                                    <span className="line-clamp-2">{s.address}</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-slate-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={route('suppliers.edit', s.id)}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-100 dark:bg-primary-900/50 dark:text-primary-400 dark:hover:bg-primary-900"
                                                >
                                                    <IconEdit size={16} />
                                                    Edit
                                                </Link>
                                                <button
                                                    onClick={() => remove(s.id)}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700 transition hover:bg-danger-100 dark:bg-danger-900/50 dark:text-danger-400 dark:hover:bg-danger-900"
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
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <IconDatabaseOff size={40} className="text-slate-400" strokeWidth={1.5} />
                    </div>
                    <h3 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-200">
                        Belum Ada Supplier
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Supplier akan muncul di sini setelah dibuat
                    </p>
                </div>
            )}

            {suppliers.last_page !== 1 && <Pagination links={suppliers.links} />}
        </>
    );
}

Index.layout = (page) => <DashboardLayout children={page} />;

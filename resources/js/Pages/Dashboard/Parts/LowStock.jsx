import React, { useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import Pagination from '@/Components/Dashboard/Pagination';
import {
    IconAlertCircle, IconDatabaseOff, IconPackage, IconMapPin, IconPencilCog,
    IconArrowUpRight, IconBox, IconTrendingDown, IconArrowUp, IconArrowDown, IconArrowsSort
} from '@tabler/icons-react';

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

export default function LowStock({ alerts, filters }) {
    const stats = useMemo(() => {
        const data = alerts?.data || [];
        const outOfStock = data.filter(a => a.current_stock === 0).length;
        const lowStock = data.filter(a => a.current_stock > 0 && a.current_stock <= a.minimal_stock).length;
        return {
            total: alerts?.total || 0,
            pageCount: data.length,
            outOfStock,
            lowStock
        };
    }, [alerts]);

    const handleSort = (column) => {
        const currentSort = filters?.sort_by;
        const currentDirection = filters?.sort_direction || 'asc';
        let newDirection = 'asc';
        if (currentSort === column && currentDirection === 'asc') {
            newDirection = 'desc';
        }
        router.get(route('parts.low-stock'), {
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

    return (
        <>
            <Head title="Sparepart Stok Minimal" />

            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sparepart Stok Minimal</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{stats.total} part membutuhkan perhatian</p>
                    </div>
                    <Link
                        href={route('parts.index')}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800"
                    >
                        <IconPackage size={16} />
                        Kembali ke Sparepart
                    </Link>
                </div>

                {/* Gradient Stat Cards */}
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Total Alert"
                        value={stats.total}
                        subtitle="Perlu perhatian"
                        icon={IconAlertCircle}
                        gradient="from-amber-500 to-orange-500"
                    />
                    <StatCard
                        title="Di Halaman Ini"
                        value={stats.pageCount}
                        subtitle="Item saat ini"
                        icon={IconBox}
                        gradient="from-blue-500 to-cyan-500"
                    />
                    <StatCard
                        title="Stok Habis"
                        value={stats.outOfStock}
                        subtitle="Perlu restock segera"
                        icon={IconTrendingDown}
                        gradient="from-rose-500 to-pink-500"
                    />
                    <StatCard
                        title="Stok Rendah"
                        value={stats.lowStock}
                        subtitle="Hampir habis"
                        icon={IconPackage}
                        gradient="from-purple-500 to-indigo-500"
                    />
                </div>
            </div>

            {alerts.data && alerts.data.length > 0 ? (
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                                    <th className="px-4 py-4">No</th>
                                    <th className="px-4 py-4">
                                        <button onClick={() => handleSort('name')} className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                            Nama Part {getSortIcon('name')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-4">
                                        <button onClick={() => handleSort('part_number')} className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                            Kode {getSortIcon('part_number')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-4">
                                        <button onClick={() => handleSort('rack_location')} className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                            Lokasi Rak {getSortIcon('rack_location')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-4 text-center">
                                        <button onClick={() => handleSort('current_stock')} className="flex items-center justify-center gap-2 w-full hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                            Stok {getSortIcon('current_stock')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-4 text-center">
                                        <button onClick={() => handleSort('minimal_stock')} className="flex items-center justify-center gap-2 w-full hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                            Min. Stok {getSortIcon('minimal_stock')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-4">Supplier</th>
                                    <th className="px-4 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {alerts.data.map((alert, idx) => {
                                    const isOut = alert.current_stock === 0;
                                    const statusClass = isOut
                                        ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/40 dark:text-danger-300'
                                        : 'bg-warning-100 text-warning-700 dark:bg-warning-900/40 dark:text-warning-300';

                                    return (
                                        <tr key={alert.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                {idx + 1 + ((alerts.current_page || 1) - 1) * (alerts.per_page || alerts.data.length)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {alert.part?.name || 'Part'}
                                                </div>
                                                <div className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                                                    <IconAlertCircle size={12} className="text-rose-500" />
                                                    <span className={statusClass}>{isOut ? 'Habis' : 'Rendah'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm font-mono text-slate-600 dark:text-slate-400">
                                                {alert.part?.part_number || '-'}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                {alert.part?.rack_location ? (
                                                    <div className="flex items-center gap-1">
                                                        <IconMapPin size={14} className="text-slate-400" />
                                                        <span>{alert.part.rack_location}</span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>
                                                    <IconPackage size={14} />
                                                    {alert.current_stock}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center text-sm text-slate-600 dark:text-slate-400">
                                                {alert.minimal_stock}
                                            </td>
                                            <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-400">
                                                {alert.part?.supplier?.name || '-'}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                {alert.part && (
                                                    <Link
                                                        href={route('parts.edit', alert.part.id)}
                                                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-warning-50 px-3 py-1.5 text-xs font-medium text-warning-700 transition hover:bg-warning-100 dark:bg-warning-900/30 dark:text-warning-300 dark:hover:bg-warning-900/50"
                                                    >
                                                        <IconPencilCog size={14} />
                                                        Edit
                                                    </Link>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {alerts.last_page > 1 && (
                        <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                            <Pagination links={alerts.links} />
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <IconDatabaseOff size={28} className="text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Tidak ada stok minim</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Semua stok sparepart aman.</p>
                </div>
            )}
        </>
    );
}

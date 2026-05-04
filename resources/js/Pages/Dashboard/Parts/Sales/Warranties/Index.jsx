import React, { useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import Pagination from '@/Components/Dashboard/Pagination';
import {
    IconShieldCheck,
    IconSearch,
    IconFilter,
    IconRefresh,
    IconAlertTriangle,
    IconCheck,
    IconClock,
    IconX,
    IconReceipt,
    IconDownload,
    IconTool,
    IconCar,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

const statusConfig = {
    active: {
        label: 'Aktif',
        badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100',
    },
    expiring: {
        label: 'Akan Habis',
        badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100',
    },
    expired: {
        label: 'Expired',
        badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-100',
    },
    claimed: {
        label: 'Sudah Diklaim',
        badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100',
    },
};

function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function sourceLabel(sourceType) {
    if ((sourceType || '').includes('PartSale')) return 'Part Sale';
    if ((sourceType || '').includes('ServiceOrder')) return 'Service Order';
    return '-';
}

export default function Index({ warranties, summary, filters, customers = [], vehicles = [], mechanics = [] }) {
    const currentFilters = {
        search: filters?.search || '',
        warranty_status: filters?.warranty_status || 'all',
        source_type: filters?.source_type || 'all',
        item_type: filters?.item_type || 'all',
        customer_id: filters?.customer_id || '',
        vehicle_id: filters?.vehicle_id || '',
        mechanic_id: filters?.mechanic_id || '',
        date_from: filters?.date_from || '',
        date_to: filters?.date_to || '',
        expiring_in_days: Number(filters?.expiring_in_days || 30),
    };


    const statusOptions = [
        { value: 'all', label: 'Semua' },
        { value: 'active', label: 'Aktif' },
        { value: 'expiring', label: 'Akan Habis' },
        { value: 'expired', label: 'Expired' },
        { value: 'claimed', label: 'Sudah Diklaim' },
    ];

    const cards = useMemo(() => ([
        {
            key: 'all',
            title: 'Total Garansi',
            value: summary?.all || 0,
            icon: IconShieldCheck,
            className: 'from-slate-600 to-slate-700',
        },
        {
            key: 'active',
            title: 'Garansi Aktif',
            value: summary?.active || 0,
            icon: IconCheck,
            className: 'from-emerald-600 to-emerald-700',
        },
        {
            key: 'expiring',
            title: 'Akan Expired',
            value: summary?.expiring || 0,
            icon: IconClock,
            className: 'from-amber-500 to-amber-600',
        },
        {
            key: 'expired',
            title: 'Sudah Expired',
            value: summary?.expired || 0,
            icon: IconAlertTriangle,
            className: 'from-rose-600 to-rose-700',
        },
        {
            key: 'claimed',
            title: 'Sudah Diklaim',
            value: summary?.claimed || 0,
            icon: IconReceipt,
            className: 'from-blue-600 to-blue-700',
        },
    ]), [summary]);

    const applyFilters = (nextFilters) => {
        router.get(route('part-sales.warranties.index'), {
            search: nextFilters.search,
            warranty_status: nextFilters.warranty_status,
            source_type: nextFilters.source_type,
            item_type: nextFilters.item_type,
            customer_id: nextFilters.customer_id,
            vehicle_id: nextFilters.vehicle_id,
            mechanic_id: nextFilters.mechanic_id,
            date_from: nextFilters.date_from,
            date_to: nextFilters.date_to,
            expiring_in_days: nextFilters.expiring_in_days,
        }, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

    const handleClaim = (item) => {
        const notes = window.prompt('Catatan klaim garansi (opsional):') || '';

        if ((item.source_type || '').includes('PartSale')) {
            router.post(route('part-sales.details.claim-warranty', {
                partSale: item.source_id,
                detail: item.source_detail_id,
            }), {
                warranty_claim_notes: notes,
            }, {
                preserveScroll: true,
                onSuccess: () => toast.success('Klaim garansi berhasil dicatat'),
                onError: (errors) => toast.error(errors?.error || 'Gagal mencatat klaim garansi'),
            });
            return;
        }

        if ((item.source_type || '').includes('ServiceOrder')) {
            router.post(route('service-orders.details.claim-warranty', {
                id: item.source_id,
                detailId: item.source_detail_id,
            }), {
                claim_notes: notes,
            }, {
                preserveScroll: true,
                onSuccess: () => toast.success('Klaim garansi berhasil dicatat'),
                onError: (errors) => toast.error(errors?.error || 'Gagal mencatat klaim garansi'),
            });
            return;
        }

        toast.error('Sumber klaim tidak dikenali');
    };

    const handleExport = () => {
        const url = route('part-sales.warranties.export', {
            search: currentFilters.search,
            warranty_status: currentFilters.warranty_status,
            source_type: currentFilters.source_type,
            item_type: currentFilters.item_type,
            customer_id: currentFilters.customer_id,
            vehicle_id: currentFilters.vehicle_id,
            mechanic_id: currentFilters.mechanic_id,
            date_from: currentFilters.date_from,
            date_to: currentFilters.date_to,
            expiring_in_days: currentFilters.expiring_in_days,
        });

        window.location.href = url;
    };

    return (
        <DashboardLayout>
            <Head title="Manajemen Garansi" />

            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 -m-6 p-4 sm:p-5 lg:p-6 space-y-6">
                <div className="bg-gradient-to-r from-cyan-600 to-blue-700 rounded-2xl shadow-xl">
                    <div className="px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                                <IconShieldCheck size={30} />
                                Manajemen Garansi Terpadu
                            </h1>
                            <p className="text-cyan-100 mt-1">Pantau garansi Part Sale dan Service Order dari satu halaman.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                href={route('part-sales.index')}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition-all"
                            >
                                <IconReceipt size={16} /> Transaksi
                            </Link>
                            <button
                                type="button"
                                onClick={handleExport}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all"
                            >
                                <IconDownload size={16} /> Export CSV
                            </button>
                            <button
                                type="button"
                                onClick={() => applyFilters(currentFilters)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-700 text-sm font-bold hover:bg-blue-50 transition-all"
                            >
                                <IconRefresh size={16} /> Refresh
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    {cards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <button
                                key={card.key}
                                type="button"
                                onClick={() => applyFilters({ ...currentFilters, warranty_status: card.key === 'all' ? 'all' : card.key })}
                                className={`text-left rounded-2xl p-4 bg-gradient-to-r ${card.className} text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-white/90">{card.title}</span>
                                    <Icon size={18} className="text-white/90" />
                                </div>
                                <div className="mt-3 text-3xl font-bold">{card.value}</div>
                            </button>
                        );
                    })}
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
                            <IconFilter size={16} /> Filter Garansi
                        </div>
                    </div>
                    <div className="p-5 grid gap-4 md:grid-cols-12">
                        <div className="md:col-span-4">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Cari</label>
                            <div className="relative mt-1">
                                <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={currentFilters.search}
                                    onChange={(e) => applyFilters({ ...currentFilters, search: e.target.value })}
                                    placeholder="Ref transaksi, item, pelanggan"
                                    className="w-full h-10 pl-9 pr-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Sumber</label>
                            <select
                                value={currentFilters.source_type}
                                onChange={(e) => applyFilters({ ...currentFilters, source_type: e.target.value })}
                                className="mt-1 w-full h-10 px-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                            >
                                <option value="all">Semua</option>
                                <option value="part_sale">Part Sale</option>
                                <option value="service_order">Service Order</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Tipe Item</label>
                            <select
                                value={currentFilters.item_type}
                                onChange={(e) => applyFilters({ ...currentFilters, item_type: e.target.value })}
                                className="mt-1 w-full h-10 px-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                            >
                                <option value="all">Semua</option>
                                <option value="part">Sparepart</option>
                                <option value="service">Layanan</option>
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Status</label>
                            <select
                                value={currentFilters.warranty_status}
                                onChange={(e) => applyFilters({ ...currentFilters, warranty_status: e.target.value })}
                                className="mt-1 w-full h-10 px-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                            >
                                {statusOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Akan Expired (hari)</label>
                            <input
                                type="number"
                                min="1"
                                max="365"
                                value={currentFilters.expiring_in_days}
                                onChange={(e) => applyFilters({ ...currentFilters, expiring_in_days: Number(e.target.value) || 30 })}
                                className="mt-1 w-full h-10 px-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                            />
                        </div>

                        <div className="md:col-span-3">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Pelanggan</label>
                            <select
                                value={currentFilters.customer_id}
                                onChange={(e) => applyFilters({ ...currentFilters, customer_id: e.target.value })}
                                className="mt-1 w-full h-10 px-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                            >
                                <option value="">Semua Pelanggan</option>
                                {customers.map((customer) => (
                                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-3">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Kendaraan</label>
                            <select
                                value={currentFilters.vehicle_id}
                                onChange={(e) => applyFilters({ ...currentFilters, vehicle_id: e.target.value })}
                                className="mt-1 w-full h-10 px-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                            >
                                <option value="">Semua Kendaraan</option>
                                {vehicles.map((vehicle) => (
                                    <option key={vehicle.id} value={vehicle.id}>
                                        {vehicle.plate_number} {vehicle.brand} {vehicle.model}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Mekanik</label>
                            <select
                                value={currentFilters.mechanic_id}
                                onChange={(e) => applyFilters({ ...currentFilters, mechanic_id: e.target.value })}
                                className="mt-1 w-full h-10 px-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                            >
                                <option value="">Semua Mekanik</option>
                                {mechanics.map((mechanic) => (
                                    <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Tanggal Mulai</label>
                            <input
                                type="date"
                                value={currentFilters.date_from}
                                onChange={(e) => applyFilters({ ...currentFilters, date_from: e.target.value })}
                                className="mt-1 w-full h-10 px-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Tanggal Akhir</label>
                            <input
                                type="date"
                                value={currentFilters.date_to}
                                onChange={(e) => applyFilters({ ...currentFilters, date_to: e.target.value })}
                                className="mt-1 w-full h-10 px-3 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm"
                            />
                        </div>

                        <div className="md:col-span-12 flex justify-end">
                            <button
                                type="button"
                                onClick={() => applyFilters({
                                    search: '', warranty_status: 'all', source_type: 'all', item_type: 'all',
                                    customer_id: '', vehicle_id: '', mechanic_id: '', date_from: '', date_to: '', expiring_in_days: 30,
                                })}
                                className="h-10 inline-flex items-center justify-center gap-2 rounded-lg border-2 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-200 px-4 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <IconX size={16} /> Reset
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-5 py-3 text-left font-bold text-slate-700 dark:text-slate-300">Sumber</th>
                                    <th className="px-5 py-3 text-left font-bold text-slate-700 dark:text-slate-300">Pelanggan / Kendaraan</th>
                                    <th className="px-5 py-3 text-left font-bold text-slate-700 dark:text-slate-300">Item</th>
                                    <th className="px-5 py-3 text-right font-bold text-slate-700 dark:text-slate-300">Periode</th>
                                    <th className="px-5 py-3 text-center font-bold text-slate-700 dark:text-slate-300">Status</th>
                                    <th className="px-5 py-3 text-center font-bold text-slate-700 dark:text-slate-300">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {warranties?.data?.length > 0 ? warranties.data.map((item) => {
                                    const conf = statusConfig[item.resolved_status] || statusConfig.active;
                                    const canClaim = item.resolved_status === 'active';

                                    return (
                                        <tr key={item.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                            <td className="px-5 py-4">
                                                <div className="font-bold text-cyan-700 dark:text-cyan-400">{item.reference_number || '-'}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sourceLabel(item.source_type)} â€¢ {formatDate(item.source_date)}</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-slate-900 dark:text-white">{item.customer_name || '-'}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1"><IconCar size={12} /> {item.vehicle_label || '-'}</span>
                                                    {(item.source_type || '').includes('ServiceOrder') && (
                                                        <span className="inline-flex items-center gap-1"><IconTool size={12} /> {item.mechanic_name || '-'}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-slate-900 dark:text-white">{item.item_name || '-'}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {(item.item_type || '').toLowerCase() === 'service' ? 'Layanan' : 'Sparepart'} {item.item_number && item.item_number !== '-' ? `â€¢ ${item.item_number}` : ''}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="font-semibold text-slate-800 dark:text-slate-100">{item.warranty_period_days || 0} hari</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {formatDate(item.warranty_start_date)} - {formatDate(item.warranty_end_date)}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold border ${conf.badgeClass}`}>
                                                    {conf.label}
                                                </span>
                                                {item.claimed_at && (
                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                        Klaim: {formatDate(item.claimed_at)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {canClaim ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleClaim(item)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                                                    >
                                                        <IconShieldCheck size={14} /> Klaim
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="6" className="px-5 py-10 text-center text-slate-500 dark:text-slate-400">
                                            Data garansi tidak ditemukan untuk filter saat ini.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800">
                        <Pagination links={warranties?.links || []} align="right" />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}



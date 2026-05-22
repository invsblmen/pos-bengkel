import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import toast from 'react-hot-toast';
import { IconEdit, IconTrash, IconPlus, IconSearch, IconCalendar, IconAlertTriangle, IconCheck, IconTag } from '@tabler/icons-react';

function formatDateTime(value) {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
    } catch {
        return value;
    }
}

function ScopeBadge({ scope }) {
    const scopeConfig = {
        transaction: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Transaksi' },
        item_part: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Sparepart' },
        item_service: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Service' },
    };
    const config = scopeConfig[scope] || { bg: 'bg-gray-100', text: 'text-gray-700', label: scope };
    return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>{config.label}</span>;
}

function StatusBadge({ isActive, isExpired, quotaFull }) {
    if (!isActive) {
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700"><IconAlertTriangle size={14} /> Nonaktif</span>;
    }
    if (isExpired) {
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"><IconAlertTriangle size={14} /> Kedaluwarsa</span>;
    }
    if (quotaFull) {
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><IconAlertTriangle size={14} /> Kuota Habis</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><IconCheck size={14} /> Aktif</span>;
}

export default function Index({ vouchers, filters = {} }) {
    const [showDelete, setShowDelete] = useState(null);

    const applyFilter = (next) => {
        router.get(route('vouchers.index'), next, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const current = {
        q: filters.q || '',
        status: filters.status || 'all',
        scope: filters.scope || 'all',
    };

    const handleDelete = (voucher) => {
        if (window.confirm(`Hapus voucher ${voucher.code}? Tindakan ini tidak dapat dibatalkan.`)) {
            router.delete(route('vouchers.destroy', voucher.id), {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Voucher berhasil dihapus');
                    setShowDelete(null);
                },
                onError: () => {
                    toast.error('Gagal menghapus voucher');
                }
            });
        }
    };

    const isExpired = (v) => v.ends_at && new Date(v.ends_at) < new Date();
    const quotaFull = (v) => v.quota_total && v.quota_used >= v.quota_total;
    const quotaPercent = (v) => v.quota_total ? Math.round((v.quota_used / v.quota_total) * 100) : 0;

    return (
        <>
            <Head title="Voucher" />

            <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Master Voucher</h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Kelola diskon dan promosi untuk transaksi sparepart dan service order.</p>
                    </div>
                    <Link
                        href={route('vouchers.create')}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-primary-700 hover:to-primary-800 transition-all"
                    >
                        <IconPlus size={18} />
                        Tambah Voucher
                    </Link>
                </div>

                {/* Filter Section */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
                    <div className="grid gap-3 md:grid-cols-4">
                        <div className="relative">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Cari kode atau nama..."
                                value={current.q}
                                onChange={(e) => applyFilter({ ...current, q: e.target.value })}
                                className="h-10 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            />
                        </div>
                        <select
                            value={current.status}
                            onChange={(e) => applyFilter({ ...current, status: e.target.value })}
                            className="h-10 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        >
                            <option value="all">Semua Status</option>
                            <option value="active">Aktif</option>
                            <option value="inactive">Nonaktif</option>
                        </select>
                        <select
                            value={current.scope}
                            onChange={(e) => applyFilter({ ...current, scope: e.target.value })}
                            className="h-10 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        >
                            <option value="all">Semua Scope</option>
                            <option value="transaction">Transaksi</option>
                            <option value="item_part">Item Sparepart</option>
                            <option value="item_service">Item Layanan</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => applyFilter({ q: '', status: 'all', scope: 'all' })}
                            className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            Reset Filter
                        </button>
                    </div>
                </div>

                {/* Vouchers List */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm">
                    {vouchers?.data?.length ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-800/60">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Kode</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Nama</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Scope</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Diskon</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Periode</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Kuota</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Status</th>
                                        <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {vouchers.data.map((voucher) => (
                                        <tr key={voucher.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-900 dark:text-white">{voucher.code}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-slate-700 dark:text-slate-300">{voucher.name}</div>
                                                {voucher.description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{voucher.description}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <ScopeBadge scope={voucher.scope} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold">
                                                    {voucher.discount_type === 'percent' ? (
                                                        <>
                                                            <IconTag size={14} />
                                                            {voucher.discount_value}%
                                                        </>
                                                    ) : (
                                                        <>Rp {Number(voucher.discount_value || 0).toLocaleString('id-ID')}</>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                                                <div className="inline-flex items-center gap-1">
                                                    <IconCalendar size={14} />
                                                    {formatDateTime(voucher.starts_at)} → {formatDateTime(voucher.ends_at)}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="space-y-1.5">
                                                    <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${quotaPercent(voucher) >= 90 ? 'bg-red-500' : quotaPercent(voucher) >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                                                            style={{ width: `${quotaPercent(voucher)}%` }}
                                                        />
                                                    </div>
                                                    <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">{voucher.quota_used}/{voucher.quota_total || '∞'}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusBadge isActive={voucher.is_active} isExpired={isExpired(voucher)} quotaFull={quotaFull(voucher)} />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="inline-flex items-center gap-2">
                                                    <Link
                                                        href={route('vouchers.edit', voucher.id)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors"
                                                    >
                                                        <IconEdit size={14} />
                                                        Edit
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(voucher)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                                                    >
                                                        <IconTrash size={14} />
                                                        Hapus
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-8 py-12 text-center">
                            <div className="text-slate-400 dark:text-slate-600 text-lg font-semibold mb-2">Belum ada voucher</div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Buat voucher pertama Anda untuk mulai memberikan diskon kepada pelanggan.</p>
                            <Link href={route('vouchers.create')} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors">
                                <IconPlus size={18} />
                                Buat Voucher
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

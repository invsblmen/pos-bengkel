import React from 'react';
import { Head, Link, router } from '@inertiajs/react';
import toast from 'react-hot-toast';

function formatDateTime(value) {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleString('id-ID');
    } catch {
        return value;
    }
}

export default function Index({ vouchers, filters = {} }) {
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

    return (
        <>
            <Head title="Voucher" />

            <div className="space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Master Voucher</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Kelola voucher transaksi sparepart dan service order.</p>
                    </div>
                    <Link
                        href={route('vouchers.create')}
                        className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                    >
                        Tambah Voucher
                    </Link>
                </div>

                <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-4">
                    <input
                        type="text"
                        placeholder="Cari kode atau nama..."
                        value={current.q}
                        onChange={(e) => applyFilter({ ...current, q: e.target.value })}
                        className="h-10 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <select
                        value={current.status}
                        onChange={(e) => applyFilter({ ...current, status: e.target.value })}
                        className="h-10 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                        <option value="all">Semua Status</option>
                        <option value="active">Aktif</option>
                        <option value="inactive">Nonaktif</option>
                    </select>
                    <select
                        value={current.scope}
                        onChange={(e) => applyFilter({ ...current, scope: e.target.value })}
                        className="h-10 rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                        <option value="all">Semua Scope</option>
                        <option value="transaction">Transaksi</option>
                        <option value="item_part">Item Sparepart</option>
                        <option value="item_service">Item Layanan</option>
                    </select>
                    <button
                        type="button"
                        onClick={() => applyFilter({ q: '', status: 'all', scope: 'all' })}
                        className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
                    >
                        Reset
                    </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/60">
                                <tr>
                                    <th className="px-4 py-3 text-left">Kode</th>
                                    <th className="px-4 py-3 text-left">Nama</th>
                                    <th className="px-4 py-3 text-left">Scope</th>
                                    <th className="px-4 py-3 text-left">Diskon</th>
                                    <th className="px-4 py-3 text-left">Periode</th>
                                    <th className="px-4 py-3 text-left">Kuota</th>
                                    <th className="px-4 py-3 text-left">Status</th>
                                    <th className="px-4 py-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {vouchers?.data?.length ? vouchers.data.map((voucher) => (
                                    <tr key={voucher.id}>
                                        <td className="px-4 py-3 font-semibold">{voucher.code}</td>
                                        <td className="px-4 py-3">{voucher.name}</td>
                                        <td className="px-4 py-3">{voucher.scope}</td>
                                        <td className="px-4 py-3">{voucher.discount_type === 'percent' ? `${voucher.discount_value}%` : `Rp ${Number(voucher.discount_value || 0).toLocaleString('id-ID')}`}</td>
                                        <td className="px-4 py-3">{formatDateTime(voucher.starts_at)} - {formatDateTime(voucher.ends_at)}</td>
                                        <td className="px-4 py-3">{voucher.quota_used}/{voucher.quota_total ?? '-'}</td>
                                        <td className="px-4 py-3">{voucher.is_active ? 'Aktif' : 'Nonaktif'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <Link href={route('vouchers.edit', voucher.id)} className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">Edit</Link>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (window.confirm('Hapus voucher ini?')) {
                                                            router.delete(route('vouchers.destroy', voucher.id), {
                                                                preserveScroll: true,
                                                                onSuccess: () => {
                                                                    toast.success('Voucher dihapus');
                                                                    router.reload();
                                                                },
                                                                onError: () => {
                                                                    toast.error('Gagal menghapus voucher');
                                                                }
                                                            });
                                                        }
                                                    }}
                                                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                                                >
                                                    Hapus
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">Belum ada data voucher.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}

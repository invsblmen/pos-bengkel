import React, { useState } from 'react';
import { Head, Link, usePage, router } from '@inertiajs/react';
import { IconChevronLeft, IconSearch } from '@tabler/icons-react';

export default function Usages() {
    const { props } = usePage();
    const { voucher = {}, usages = { data: [] }, filters = {} } = props;

    const [q, setQ] = useState(filters.q || '');
    const [customerId, setCustomerId] = useState(filters.customer_id || '');
    const [sourceType, setSourceType] = useState(filters.source_type || '');

    const applyFilter = (next) => {
        router.get(route('vouchers.usages.index', voucher.id), next, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        applyFilter({ q, customer_id: customerId, source_type: sourceType });
    };

    return (
        <>
            <Head title={`Pemakaian Voucher — ${voucher.code || ''}`} />

            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Link href={route('vouchers.index')} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:underline">
                        <IconChevronLeft size={18} /> Kembali ke Voucher
                    </Link>
                    <h1 className="text-2xl font-bold">Riwayat Pemakaian: {voucher.code}</h1>
                </div>

                <div className="rounded-xl border bg-white p-4">
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs font-semibold">Cari</label>
                            <div className="relative">
                                <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full h-9 px-3 rounded-lg border" placeholder="cari metadata atau jumlah" />
                                <IconSearch className="absolute right-2 top-2 text-slate-400" size={16} />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold">ID Pelanggan</label>
                            <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full h-9 px-3 rounded-lg border" placeholder="customer id" />
                        </div>

                        <div>
                            <label className="text-xs font-semibold">Sumber</label>
                            <input value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="w-full h-9 px-3 rounded-lg border" placeholder="App\\Models\\PartSale" />
                        </div>

                        <div className="flex items-end">
                            <button type="submit" className="h-9 px-3 rounded-lg bg-primary-600 text-white">Filter</button>
                        </div>
                    </form>
                </div>

                <div className="rounded-xl border bg-white">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold">Waktu</th>
                                    <th className="px-4 py-3 text-left font-semibold">Customer</th>
                                    <th className="px-4 py-3 text-left font-semibold">Sumber</th>
                                    <th className="px-4 py-3 text-left font-semibold">ID Sumber</th>
                                    <th className="px-4 py-3 text-left font-semibold">Diskon</th>
                                    <th className="px-4 py-3 text-left font-semibold">Metadata</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {usages.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-6 text-center text-slate-500">Belum ada pemakaian untuk voucher ini.</td>
                                    </tr>
                                ) : (
                                    usages.data.map((u) => (
                                        <tr key={u.id}>
                                            <td className="px-4 py-3">{u.used_at}</td>
                                            <td className="px-4 py-3">{u.customer ? u.customer.name : '-'}</td>
                                            <td className="px-4 py-3">{u.source_type}</td>
                                            <td className="px-4 py-3">{u.source_id}</td>
                                            <td className="px-4 py-3">Rp {Number(u.discount_amount || 0).toLocaleString('id-ID')}</td>
                                            <td className="px-4 py-3"><pre className="text-xs whitespace-pre-wrap">{JSON.stringify(u.metadata || {}, null, 2)}</pre></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t flex items-center justify-between">
                        <div className="text-xs text-slate-600">Menampilkan {usages.from || 0} - {usages.to || 0} dari {usages.total || 0}</div>
                        <div>
                            {usages.links && usages.links.map((l, idx) => (
                                <Link key={idx} href={l.url || '#'} dangerouslySetInnerHTML={{ __html: l.label }} className={`px-2 py-1 rounded ml-1 ${l.active ? 'bg-primary-600 text-white' : 'text-slate-700 border'}`} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
function MultiSelectList({ title, items, selected, onChange, labelKey = 'name' }) {
    const selectedSet = new Set((selected || []).map((v) => Number(v)));

    return (
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
            <div className="max-h-40 space-y-1 overflow-auto pr-1">
                {items.map((item) => {
                    const checked = selectedSet.has(Number(item.id));
                    return (
                        <label key={item.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                    const next = new Set(selectedSet);
                                    if (e.target.checked) {
                                        next.add(Number(item.id));
                                    } else {
                                        next.delete(Number(item.id));
                                    }
                                    onChange(Array.from(next));
                                }}
                            />
                            <span>{item[labelKey]}</span>
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

export default function Create({ partCategories = [], parts = [], serviceCategories = [], services = [] }) {
    const { data, setData, post, processing, errors } = useForm({
        code: '',
        name: '',
        description: '',
        is_active: true,
        starts_at: '',
        ends_at: '',
        quota_total: '',
        limit_per_customer: '',
        discount_type: 'percent',
        discount_value: '',
        scope: 'transaction',
        min_purchase: 0,
        max_discount: '',
        can_combine_with_discount: false,
        eligible_parts: [],
        eligible_part_categories: [],
        eligible_services: [],
        eligible_service_categories: [],
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('vouchers.store'));
    };

    return (
        <>
            <Head title="Tambah Voucher" />

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tambah Voucher</h1>
                    <Link href={route('vouchers.index')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700 dark:text-white">Kembali</Link>
                </div>

                <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-sm font-medium">Kode</label>
                        <input value={data.code} onChange={(e) => setData('code', e.target.value.toUpperCase())} className="h-10 w-full rounded-lg border px-3" />
                        {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code}</p>}
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Nama</label>
                        <input value={data.name} onChange={(e) => setData('name', e.target.value)} className="h-10 w-full rounded-lg border px-3" />
                        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                    </div>
                    <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium">Deskripsi</label>
                        <textarea value={data.description} onChange={(e) => setData('description', e.target.value)} rows={3} className="w-full rounded-lg border px-3 py-2" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Scope</label>
                        <select value={data.scope} onChange={(e) => setData('scope', e.target.value)} className="h-10 w-full rounded-lg border px-3">
                            <option value="transaction">Transaksi</option>
                            <option value="item_part">Item Sparepart</option>
                            <option value="item_service">Item Layanan</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Tipe Diskon</label>
                        <select value={data.discount_type} onChange={(e) => setData('discount_type', e.target.value)} className="h-10 w-full rounded-lg border px-3">
                            <option value="percent">Percent</option>
                            <option value="fixed">Fixed</option>
                        </select>
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Nilai Diskon</label>
                        <input type="number" min="0" step="0.01" value={data.discount_value} onChange={(e) => setData('discount_value', e.target.value)} className="h-10 w-full rounded-lg border px-3" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Minimal Belanja</label>
                        <input type="number" min="0" value={data.min_purchase} onChange={(e) => setData('min_purchase', e.target.value)} className="h-10 w-full rounded-lg border px-3" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Kuota Total</label>
                        <input type="number" min="1" value={data.quota_total} onChange={(e) => setData('quota_total', e.target.value)} className="h-10 w-full rounded-lg border px-3" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Limit per Customer</label>
                        <input type="number" min="1" value={data.limit_per_customer} onChange={(e) => setData('limit_per_customer', e.target.value)} className="h-10 w-full rounded-lg border px-3" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Maksimal Diskon</label>
                        <input type="number" min="0" value={data.max_discount} onChange={(e) => setData('max_discount', e.target.value)} className="h-10 w-full rounded-lg border px-3" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Mulai</label>
                        <input type="datetime-local" value={data.starts_at} onChange={(e) => setData('starts_at', e.target.value)} className="h-10 w-full rounded-lg border px-3" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium">Berakhir</label>
                        <input type="datetime-local" value={data.ends_at} onChange={(e) => setData('ends_at', e.target.value)} className="h-10 w-full rounded-lg border px-3" />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
                        <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} />
                        Voucher aktif
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm md:col-span-2">
                        <input type="checkbox" checked={data.can_combine_with_discount} onChange={(e) => setData('can_combine_with_discount', e.target.checked)} />
                        Bisa digabung diskon transaksi manual
                    </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <MultiSelectList title="Part Categories" items={partCategories} selected={data.eligible_part_categories} onChange={(value) => setData('eligible_part_categories', value)} />
                    <MultiSelectList title="Parts" items={parts} selected={data.eligible_parts} onChange={(value) => setData('eligible_parts', value)} />
                    <MultiSelectList title="Service Categories" items={serviceCategories} selected={data.eligible_service_categories} onChange={(value) => setData('eligible_service_categories', value)} />
                    <MultiSelectList title="Services" items={services} selected={data.eligible_services} onChange={(value) => setData('eligible_services', value)} labelKey="title" />
                </div>

                <button type="submit" disabled={processing} className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                    {processing ? 'Menyimpan...' : 'Simpan Voucher'}
                </button>
            </form>
        </>
    );
}

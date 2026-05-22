import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import VoucherForm from './VoucherForm';

export default function Edit({ voucher, parts, partCategories, services, serviceCategories }) {
    const { data, setData, put, processing, errors } = useForm({
        code: voucher.code || '',
        name: voucher.name || '',
        description: voucher.description || '',
        is_active: !!voucher.is_active,
        starts_at: voucher.starts_at || '',
        ends_at: voucher.ends_at || '',
        quota_total: voucher.quota_total || '',
        limit_per_customer: voucher.limit_per_customer || '',
        discount_type: voucher.discount_type || 'percent',
        discount_value: voucher.discount_value || '',
        scope: voucher.scope || 'transaction',
        min_purchase: voucher.min_purchase || 0,
        max_discount: voucher.max_discount || '',
        can_combine_with_discount: !!voucher.can_combine_with_discount,
        eligible_parts: (voucher.eligible_parts || []).map(p => String(p.id)),
        eligible_part_categories: (voucher.eligible_part_categories || []).map(p => String(p.id)),
        eligible_services: (voucher.eligible_services || []).map(s => String(s.id)),
        eligible_service_categories: (voucher.eligible_service_categories || []).map(s => String(s.id)),
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        put(route('vouchers.update', voucher.id));
    };

    return (
        <>
            <Head title="Edit Voucher" />

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Edit Voucher</h1>
                    <Link href={route('vouchers.index')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700 dark:text-white">Kembali</Link>
                </div>

                <VoucherForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    parts={parts}
                    partCategories={partCategories}
                    services={services}
                    serviceCategories={serviceCategories}
                    submitting={processing}
                />

                <div className="flex gap-3">
                    <button type="submit" disabled={processing} className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
                        {processing ? 'Menyimpan...' : 'Perbarui Voucher'}
                    </button>
                    <Link href={route('vouchers.index')} className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-medium dark:border-slate-700 dark:text-white">Batal</Link>
                </div>
            </form>
        </>
    );
}

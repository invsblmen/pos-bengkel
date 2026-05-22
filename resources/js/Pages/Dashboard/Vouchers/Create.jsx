import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import VoucherForm from './VoucherForm';

export default function Create({ parts, partCategories, services, serviceCategories }) {
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
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Tambah Voucher</h1>
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
                        {processing ? 'Menyimpan...' : 'Simpan Voucher'}
                    </button>
                    <Link href={route('vouchers.index')} className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-medium dark:border-slate-700 dark:text-white">Batal</Link>
                </div>
            </form>
        </>
    );
}

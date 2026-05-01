import React, { useState } from 'react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import Input from '@/Components/Dashboard/Input';
import Select from '@/Components/Dashboard/Select';
import toast from 'react-hot-toast';
import { IconArrowLeft, IconArrowUp, IconArrowDown, IconDeviceFloppy } from '@tabler/icons-react';

export default function Create({ type, parts, suppliers }) {
    const { data, setData, post, processing, errors } = useForm({
        part_id: '',
        qty: 1,
        unit_price: '',
        supplier_id: '',
        notes: '',
    });

    const submit = (e) => {
        e.preventDefault();
        const routeName = type === 'in' ? 'parts.stock.in.store' : 'parts.stock.out.store';
        post(route(routeName), {
            onSuccess: () => { toast.success('Berhasil'); router.reload(); },
            onError: () => toast.error('Gagal menyimpan'),
        });
    };

    return (
        <>
            <Head title={type === 'in' ? 'Sparepart Masuk' : 'Sparepart Keluar'} />

            <div className="mb-6">
                <Link href={route('part-stock-history.index')} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-3">
                    <IconArrowLeft size={16} />
                    Kembali ke History Sparepart
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {type === 'in' ? <IconArrowUp size={28} className="text-primary-500" /> : <IconArrowDown size={28} className="text-danger-500" />}
                    {type === 'in' ? 'Sparepart Masuk' : 'Sparepart Keluar'}
                </h1>
            </div>

            <form onSubmit={submit}>
                <div className="max-w-2xl">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="space-y-4">
                            <Select label="Sparepart" value={data.part_id} onChange={(e) => setData('part_id', e.target.value)} errors={errors.part_id}>
                                <option value="">Pilih sparepart</option>
                                {parts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.part_number || '-'})</option>)}
                            </Select>
                            <Input label="Jumlah" type="number" value={data.qty} onChange={(e) => setData('qty', e.target.value)} errors={errors.qty} />
                            {type === 'in' && (
                                <Input label="Harga Satuan" value={data.unit_price} onChange={(e) => setData('unit_price', e.target.value)} errors={errors.unit_price} />
                            )}
                            {type === 'in' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Supplier</label>
                                    <select value={data.supplier_id} onChange={(e) => setData('supplier_id', e.target.value)} className="w-full h-11 rounded-xl border px-3">
                                        <option value="">Pilih Supplier (opsional)</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <Input label="Catatan" value={data.notes} onChange={(e) => setData('notes', e.target.value)} errors={errors.notes} />
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <Link href={route('part-stock-history.index')} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors">Batal</Link>
                            <button type="submit" disabled={processing} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"><IconDeviceFloppy size={18} />{processing ? 'Menyimpan...' : 'Simpan'}</button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}

Create.layout = (page) => <DashboardLayout children={page} />;

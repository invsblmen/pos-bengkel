import React from 'react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Head, useForm, Link } from '@inertiajs/react';
import Input from '@/Components/Dashboard/Input';
import Textarea from '@/Components/Dashboard/TextArea';
import toast from 'react-hot-toast';
import { IconUserSquare, IconDeviceFloppy, IconArrowLeft } from '@tabler/icons-react';

export default function Create() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        phone: '',
        employee_number: '',
        notes: '',
        hourly_rate: '',
        commission_percentage: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('mechanics.store'), {
            onSuccess: () => toast.success('Mekanik berhasil dibuat'),
            onError: () => toast.error('Gagal membuat mekanik'),
        });
    };

    return (
        <>
            <Head title="Tambah Mekanik" />

            <div className="mb-6">
                <Link href={route('mechanics.index')} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-3">
                    <IconArrowLeft size={16} />
                    Kembali ke Mekanik
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconUserSquare size={28} className="text-primary-500" />
                    Tambah Mekanik Baru
                </h1>
            </div>

            <form onSubmit={submit}>
                <div className="max-w-2xl">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <div className="space-y-4">
                            <Input label="Nama Mekanik" placeholder="Masukkan nama" value={data.name} onChange={(e) => setData('name', e.target.value)} errors={errors.name} />
                            <Input label="Phone" placeholder="No. phone" value={data.phone} onChange={(e) => setData('phone', e.target.value)} errors={errors.phone} />
                            <Input label="No. Pegawai" placeholder="No. pegawai" value={data.employee_number} onChange={(e) => setData('employee_number', e.target.value)} errors={errors.employee_number} />
                            <Input label="Tarif per Jam (Rp)" type="number" placeholder="Contoh: 35000" value={data.hourly_rate} onChange={(e) => setData('hourly_rate', e.target.value)} errors={errors.hourly_rate} />
                            <Input label="Komisi Default (%)" type="number" placeholder="Contoh: 10" value={data.commission_percentage} onChange={(e) => setData('commission_percentage', e.target.value)} errors={errors.commission_percentage} />
                            <Textarea label="Catatan" placeholder="Catatan" value={data.notes} onChange={(e) => setData('notes', e.target.value)} errors={errors.notes} rows={4} />
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <Link href={route('mechanics.index')} className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors">Batal</Link>
                            <button type="submit" disabled={processing} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50"><IconDeviceFloppy size={18} />{processing ? 'Menyimpan...' : 'Simpan'}</button>
                        </div>
                    </div>
                </div>
            </form>
        </>
    );
}

Create.layout = (page) => <DashboardLayout children={page} />;
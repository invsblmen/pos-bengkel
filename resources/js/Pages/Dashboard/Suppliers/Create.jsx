import React from 'react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import toast from 'react-hot-toast';
import {
    IconTruck,
    IconDeviceFloppy,
    IconArrowLeft,
    IconInfoCircle,
    IconPhone,
    IconMapPin
} from '@tabler/icons-react';

export default function Create() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        phone: '',
        email: '',
        address: '',
        contact_person: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('suppliers.store'), {
            onSuccess: () => { toast.success('Supplier berhasil dibuat'); router.reload(); },
            onError: () => toast.error('Gagal membuat supplier'),
        });
    };

    return (
        <>
            <Head title="Tambah Supplier" />

            <div className="space-y-6">
                {/* Header with Gradient */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 p-8 shadow-lg">
                    <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/3 translate-x-1/3 rounded-full bg-white/10"></div>
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                                <IconTruck size={32} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">
                                    Tambah Supplier Baru
                                </h1>
                                <p className="mt-1 text-sm text-white/80">
                                    Lengkapi data supplier dan kontak person
                                </p>
                            </div>
                        </div>
                        <Link
                            href={route('suppliers.index')}
                            className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/30"
                        >
                            <IconArrowLeft size={18} />
                            Kembali
                        </Link>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={submit} className="space-y-6">
                    {/* Informasi Dasar */}
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                                    <IconInfoCircle size={20} className="text-primary-600 dark:text-primary-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Informasi Supplier
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Data identitas supplier
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Name */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Nama Supplier <span className="text-danger-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="Masukkan nama supplier"
                                        className={`w-full h-11 px-4 rounded-xl border ${
                                            errors.name
                                                ? 'border-danger-500'
                                                : 'border-slate-200 dark:border-slate-700'
                                        } bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all`}
                                        required
                                    />
                                    {errors.name && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.name}</p>
                                    )}
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        placeholder="email@supplier.com"
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.email && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.email}</p>
                                    )}
                                </div>

                                {/* Contact Person */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Contact Person
                                    </label>
                                    <input
                                        type="text"
                                        value={data.contact_person}
                                        onChange={(e) => setData('contact_person', e.target.value)}
                                        placeholder="Nama PIC"
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.contact_person && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.contact_person}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Kontak */}
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
                                    <IconPhone size={20} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Informasi Kontak
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Nomor telepon yang bisa dihubungi
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Nomor Telepon
                                </label>
                                <input
                                    type="text"
                                    value={data.phone}
                                    onChange={(e) => setData('phone', e.target.value)}
                                    placeholder="08123456789"
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                                {errors.phone && (
                                    <p className="mt-1.5 text-xs text-danger-500">{errors.phone}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Alamat */}
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                                    <IconMapPin size={20} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Alamat Supplier
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Lokasi atau alamat lengkap
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={data.address}
                                onChange={(e) => setData('address', e.target.value)}
                                rows="4"
                                placeholder="Masukkan alamat lengkap supplier"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                            />
                            {errors.address && (
                                <p className="mt-1.5 text-xs text-danger-500">{errors.address}</p>
                            )}
                        </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 sticky bottom-0 bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
                        <button
                            type="submit"
                            disabled={processing}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3.5 font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:shadow-xl hover:shadow-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <IconDeviceFloppy size={20} />
                            {processing ? 'Menyimpan...' : 'Simpan Supplier'}
                        </button>
                        <Link
                            href={route('suppliers.index')}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-200 px-6 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Batal
                        </Link>
                    </div>
                </form>
            </div>
        </>
    );
}

Create.layout = (page) => <DashboardLayout children={page} />;

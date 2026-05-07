import React, { useState, useEffect } from 'react';
import { Head, useForm, Link, router } from '@inertiajs/react';
import CustomerSelect from '@/Components/ServiceOrder/CustomerSelect';
import {
    IconArrowLeft,
    IconDeviceFloppy,
    IconCar,
    IconEngine,
    IconInfoCircle,
    IconLicense,
    IconNote,
    IconX,
    IconPlus
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

export default function Create({ customers }) {
    const [customersList, setCustomersList] = useState(customers);
    useEffect(() => { setCustomersList(customers || []); }, [customers]);

    const { data, setData, post, processing, errors } = useForm({
        customer_id: '',
        plate_number: '',
        brand: '',
        model: '',
        year: '',
        color: '',
        engine_type: '',
        transmission_type: '',
        cylinder_volume: '',
        features: [],
        notes: '',
        // STNK fields
        chassis_number: '',
        engine_number: '',
        manufacture_year: '',
        registration_number: '',
        registration_date: '',
        stnk_expiry_date: '',
        previous_owner: '',
    });

    const [featureInput, setFeatureInput] = useState('');

    const addFeature = () => {
        if (featureInput.trim()) {
            setData('features', [...data.features, featureInput.trim()]);
            setFeatureInput('');
        }
    };

    const removeFeature = (index) => {
        setData('features', data.features.filter((_, i) => i !== index));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        post(route('vehicles.store'), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Kendaraan berhasil ditambahkan!');
            },
            onError: () => {
                toast.error('Gagal menambahkan kendaraan!');
            },
        });
    };

    return (
        <>
            <Head title="Tambah Kendaraan" />

            <div className="space-y-6">
                {/* Header with Gradient */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 p-8 shadow-lg">
                    <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/3 translate-x-1/3 rounded-full bg-white/10"></div>
                    <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                                <IconCar size={32} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">
                                    Tambah Kendaraan Baru
                                </h1>
                                <p className="mt-1 text-sm text-white/80">
                                    Lengkapi data kendaraan pelanggan
                                </p>
                            </div>
                        </div>
                        <Link
                            href={route('vehicles.index')}
                            className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/30"
                        >
                            <IconArrowLeft size={18} />
                            Kembali
                        </Link>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Informasi Dasar */}
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                                    <IconInfoCircle size={20} className="text-primary-600 dark:text-primary-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Informasi Dasar
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Data utama kendaraan
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Customer */}
                                <div className="md:col-span-2">
                                    <CustomerSelect
                                        customers={customersList}
                                        selected={data.customer_id ? customersList.find(c => c.id === data.customer_id) : null}
                                        onSelect={(customer) => setData('customer_id', customer?.id || '')}
                                        placeholder="Pilih pelanggan..."
                                        error={errors?.customer_id}
                                        label="Pemilik Kendaraan"
                                        onCustomerAdded={(newCustomer) => {
                                            setCustomersList([...customersList, newCustomer]);
                                            setData('customer_id', newCustomer.id);
                                        }}
                                    />
                                </div>

                                {/* Plate Number */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Nomor Plat <span className="text-danger-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={data.plate_number}
                                        onChange={(e) => {
                                            const sanitized = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                            setData('plate_number', sanitized);
                                        }}
                                        placeholder="B1234XYZ"
                                        maxLength={20}
                                        className={`w-full h-11 px-4 rounded-xl border ${
                                            errors.plate_number
                                                ? 'border-danger-500 focus:ring-danger-500/20'
                                                : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500/20'
                                        } bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:border-primary-500 transition-all font-mono text-lg tracking-wider`}
                                        required
                                    />
                                    {errors.plate_number ? (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.plate_number}</p>
                                    ) : (
                                        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                                            Hanya huruf dan angka (tanpa spasi)
                                        </p>
                                    )}
                                </div>

                                {/* Brand */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Merek <span className="text-danger-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={data.brand}
                                        onChange={(e) => setData('brand', e.target.value)}
                                        placeholder="Honda, Yamaha, Suzuki..."
                                        className={`w-full h-11 px-4 rounded-xl border ${
                                            errors.brand
                                                ? 'border-danger-500'
                                                : 'border-slate-200 dark:border-slate-700'
                                        } bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all`}
                                        required
                                    />
                                    {errors.brand && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.brand}</p>
                                    )}
                                </div>

                                {/* Model */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Model <span className="text-danger-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={data.model}
                                        onChange={(e) => setData('model', e.target.value)}
                                        placeholder="Vario, Beat, Scoopy..."
                                        className={`w-full h-11 px-4 rounded-xl border ${
                                            errors.model
                                                ? 'border-danger-500'
                                                : 'border-slate-200 dark:border-slate-700'
                                        } bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all`}
                                        required
                                    />
                                    {errors.model && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.model}</p>
                                    )}
                                </div>

                                {/* Year */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Tahun
                                    </label>
                                    <input
                                        type="number"
                                        value={data.year}
                                        onChange={(e) => setData('year', e.target.value)}
                                        placeholder="2024"
                                        min="1900"
                                        max={new Date().getFullYear() + 1}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.year && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.year}</p>
                                    )}
                                </div>

                                {/* Color */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Warna
                                    </label>
                                    <input
                                        type="text"
                                        value={data.color}
                                        onChange={(e) => setData('color', e.target.value)}
                                        placeholder="Merah, Hitam, Putih..."
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.color && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.color}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Spesifikasi Teknis */}
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
                                    <IconEngine size={20} className="text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Spesifikasi Teknis
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Detail mesin dan transmisi
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid gap-6 md:grid-cols-3">
                                {/* Engine Type */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Tipe Mesin
                                    </label>
                                    <input
                                        type="text"
                                        value={data.engine_type}
                                        onChange={(e) => setData('engine_type', e.target.value)}
                                        placeholder="4-Stroke, 2-Stroke..."
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.engine_type && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.engine_type}</p>
                                    )}
                                </div>

                                {/* Transmission Type */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Tipe Transmisi
                                    </label>
                                    <select
                                        value={data.transmission_type}
                                        onChange={(e) => setData('transmission_type', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    >
                                        <option value="">Pilih Transmisi</option>
                                        <option value="manual">Manual</option>
                                        <option value="automatic">Automatic</option>
                                        <option value="semi-automatic">Semi-Automatic</option>
                                    </select>
                                    {errors.transmission_type && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.transmission_type}</p>
                                    )}
                                </div>

                                {/* Cylinder Volume */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Kapasitas Mesin (cc)
                                    </label>
                                    <input
                                        type="number"
                                        value={data.cylinder_volume}
                                        onChange={(e) => setData('cylinder_volume', e.target.value)}
                                        placeholder="150"
                                        min="50"
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.cylinder_volume && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.cylinder_volume}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data STNK */}
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50">
                                    <IconLicense size={20} className="text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Data STNK
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Surat Tanda Nomor Kendaraan
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="grid gap-6 md:grid-cols-2">{/* Chassis Number */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Nomor Rangka (VIN)
                                    </label>
                                    <input
                                        type="text"
                                        value={data.chassis_number}
                                        onChange={(e) => setData('chassis_number', e.target.value)}
                                        placeholder="Nomor rangka kendaraan"
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.chassis_number && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.chassis_number}</p>
                                    )}
                                </div>

                                {/* Engine Number */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Nomor Mesin
                                    </label>
                                    <input
                                        type="text"
                                        value={data.engine_number}
                                        onChange={(e) => setData('engine_number', e.target.value)}
                                        placeholder="Nomor mesin kendaraan"
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.engine_number && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.engine_number}</p>
                                    )}
                                </div>

                                {/* Manufacture Year */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Tahun Pembuatan
                                    </label>
                                    <input
                                        type="number"
                                        value={data.manufacture_year}
                                        onChange={(e) => setData('manufacture_year', e.target.value)}
                                        placeholder="2024"
                                        min="1900"
                                        max={new Date().getFullYear()}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.manufacture_year && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.manufacture_year}</p>
                                    )}
                                </div>

                                {/* Registration Number */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Nomor Registrasi
                                    </label>
                                    <input
                                        type="text"
                                        value={data.registration_number}
                                        onChange={(e) => setData('registration_number', e.target.value)}
                                        placeholder="Nomor registrasi STNK"
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.registration_number && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.registration_number}</p>
                                    )}
                                </div>

                                {/* Registration Date */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Tanggal Registrasi
                                    </label>
                                    <input
                                        type="date"
                                        value={data.registration_date}
                                        onChange={(e) => setData('registration_date', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.registration_date && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.registration_date}</p>
                                    )}
                                </div>

                                {/* STNK Expiry Date */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Tanggal Berakhir STNK
                                    </label>
                                    <input
                                        type="date"
                                        value={data.stnk_expiry_date}
                                        onChange={(e) => setData('stnk_expiry_date', e.target.value)}
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.stnk_expiry_date && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.stnk_expiry_date}</p>
                                    )}
                                </div>

                                {/* Previous Owner */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Pemilik Sebelumnya
                                    </label>
                                    <input
                                        type="text"
                                        value={data.previous_owner}
                                        onChange={(e) => setData('previous_owner', e.target.value)}
                                        placeholder="Nama pemilik sebelumnya (opsional)"
                                        className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                    {errors.previous_owner && (
                                        <p className="mt-1.5 text-xs text-danger-500">{errors.previous_owner}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/50">
                                    <IconInfoCircle size={20} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Fitur & Kondisi Kendaraan
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Tambahkan fitur atau kondisi khusus kendaraan
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={featureInput}
                                    onChange={(e) => setFeatureInput(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addFeature();
                                        }
                                    }}
                                    placeholder="Contoh: ABS, Smart Key System, LED Headlight..."
                                    className="flex-1 h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={addFeature}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-all duration-200 shadow-sm hover:shadow"
                                >
                                    <IconPlus size={18} />
                                    <span className="hidden sm:inline">Tambah</span>
                                </button>
                            </div>

                            {/* Features Tags */}
                            {data.features.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {data.features.map((feature, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800"
                                        >
                                            <span className="text-sm font-medium">{feature}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeFeature(index)}
                                                className="hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded p-0.5 transition-colors"
                                            >
                                                <IconX size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {data.features.length === 0 && (
                                <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                                    Belum ada fitur ditambahkan
                                </p>
                            )}

                            {errors.features && (
                                <p className="mt-2 text-xs text-danger-500">{errors.features}</p>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/50">
                                    <IconNote size={20} className="text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        Catatan Tambahan
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Informasi tambahan kendaraan
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                rows="4"
                                placeholder="Contoh: Modifikasi knalpot racing, ban belakang baru diganti, dll..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                            />
                            {errors.notes && (
                                <p className="mt-1.5 text-xs text-danger-500">{errors.notes}</p>
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
                            {processing ? 'Menyimpan...' : 'Simpan Kendaraan'}
                        </button>
                        <Link
                            href={route('vehicles.index')}
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

import React, { useState } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import {
    IconArrowLeft, IconDeviceFloppy, IconBox, IconTruck, IconTool,
    IconBolt, IconCylinder, IconGauge, IconFilter, IconLink, IconCircle,
    IconShield, IconSparkles, IconAlertTriangle, IconSettings
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

const AVAILABLE_ICONS = [
    { name: 'Box', icon: IconBox },
    { name: 'Truck', icon: IconTruck },
    { name: 'Tool', icon: IconTool },
    { name: 'Bolt', icon: IconBolt },
    { name: 'Cylinder', icon: IconCylinder },
    { name: 'Gauge', icon: IconGauge },
    { name: 'Filter', icon: IconFilter },
    { name: 'Link', icon: IconLink },
    { name: 'Circle', icon: IconCircle },
    { name: 'Shield', icon: IconShield },
    { name: 'Sparkles', icon: IconSparkles },
    { name: 'Alert', icon: IconAlertTriangle },
    { name: 'Settings', icon: IconSettings },
];

function Edit({ auth, category, parentCategories = [] }) {
    const { data, setData, put, processing, errors } = useForm({
        parent_id: category.parent_id ? String(category.parent_id) : '',
        name: category.name || '',
        description: category.description || '',
        icon: category.icon || 'Box',
    });
    const [showIconPicker, setShowIconPicker] = useState(false);
    const selectedIconDef = AVAILABLE_ICONS.find(i => i.name === data.icon);
    const SelectedIcon = selectedIconDef?.icon || IconBox;


    const handleSubmit = (e) => {
        e.preventDefault();
        put(route('part-categories.update', category.id), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Kategori sparepart berhasil diperbarui!');
            },
            onError: () => {
                toast.error('Gagal memperbarui kategori sparepart!');
            },
        });
    };

    return (
        <>
            <Head title="Edit Kategori Sparepart" />

            <div className="p-6">
                <div className="max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <Link
                            href={route('part-categories.index')}
                            className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-4 transition-colors"
                        >
                            <IconArrowLeft size={18} />
                            <span>Kembali ke Daftar</span>
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                                <SelectedIcon size={28} className="text-primary-600 dark:text-primary-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                                    Edit Kategori Sparepart
                                </h1>
                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                    Perbarui informasi kategori sparepart
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Parent Category */}
                            <div>
                                <label htmlFor="parent_id" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Kategori Induk <span className="text-slate-400 font-normal">(Opsional)</span>
                                </label>
                                <select
                                    id="parent_id"
                                    value={data.parent_id}
                                    onChange={(e) => setData('parent_id', e.target.value)}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                                        errors.parent_id
                                            ? 'border-red-500 focus:ring-red-200'
                                            : 'border-slate-200 dark:border-slate-700'
                                    } bg-white dark:bg-slate-900 text-slate-900 dark:text-white`}
                                >
                                    <option value="">Tidak ada (kategori utama)</option>
                                    {parentCategories.map((parent) => {
                                        const prefix = parent.depth > 0 ? '\u00a0'.repeat(parent.depth * 2) + '├ ' : '';
                                        return (
                                            <option key={parent.id} value={parent.id}>
                                                {prefix}{parent.name}
                                            </option>
                                        );
                                    })}
                                </select>
                                {errors.parent_id && (
                                    <p className="mt-2 text-sm text-red-500">{errors.parent_id}</p>
                                )}
                            </div>

                            {/* Nama Kategori */}
                            <div>
                                <label htmlFor="name" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Nama Kategori <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                                        errors.name
                                            ? 'border-red-500 focus:ring-red-200'
                                            : 'border-slate-200 dark:border-slate-700'
                                    } bg-white dark:bg-slate-900 text-slate-900 dark:text-white`}
                                    placeholder="Contoh: Mesin & Komponen"
                                    required
                                />
                                {errors.name && (
                                    <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                                        <IconAlertTriangle size={16} />
                                        {errors.name}
                                    </p>
                                )}
                            </div>

                            {/* Deskripsi */}
                            <div>
                                <label htmlFor="description" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Deskripsi <span className="text-slate-400 font-normal">(Opsional)</span>
                                </label>
                                <textarea
                                    id="description"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    rows={4}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all ${
                                        errors.description
                                            ? 'border-red-500 focus:ring-red-200'
                                            : 'border-slate-200 dark:border-slate-700'
                                    } bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400`}
                                    placeholder="Deskripsi singkat tentang kategori ini..."
                                />
                                {errors.description && (
                                    <p className="mt-2 text-sm text-red-500">{errors.description}</p>
                                )}
                            </div>

                            {/* Icon Picker */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                                    Pilih Icon <span className="text-slate-400 font-normal">(Opsional)</span>
                                </label>

                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowIconPicker(!showIconPicker)}
                                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex items-center justify-between hover:border-primary-500 dark:hover:border-primary-500 transition-colors"
                                    >
                                        <span className="flex items-center gap-3">
                                            <SelectedIcon size={20} className="text-primary-600 dark:text-primary-400" />
                                            <span>{data.icon}</span>
                                        </span>
                                        <svg className={`w-5 h-5 transition-transform ${showIconPicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                    </button>

                                    {/* Icon Grid */}
                                    {showIconPicker && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 z-50">
                                            <div className="grid grid-cols-4 gap-2">
                                                {AVAILABLE_ICONS.map((item) => {
                                                    const IconComponent = item.icon;
                                                    const isSelected = data.icon === item.name;
                                                    return (
                                                        <button
                                                            key={item.name}
                                                            type="button"
                                                            onClick={() => {
                                                                setData('icon', item.name);
                                                                setShowIconPicker(false);
                                                            }}
                                                            className={`p-3 rounded-lg flex flex-col items-center gap-1 transition-all ${
                                                                isSelected
                                                                    ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500'
                                                                    : 'bg-slate-100 dark:bg-slate-800 border-2 border-transparent hover:border-primary-300'
                                                            }`}
                                                            title={item.name}
                                                        >
                                                            <IconComponent size={24} className={isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400'} />
                                                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">{item.name}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Klik untuk memilih icon dari koleksi yang tersedia
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/30"
                                >
                                    <IconDeviceFloppy size={20} />
                                    {processing ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </button>
                                <Link
                                    href={route('part-categories.index')}
                                    className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-xl transition-colors"
                                >
                                    Batal
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}

Edit.layout = (page) => <DashboardLayout children={page} />;

export default Edit;

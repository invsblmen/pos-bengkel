import React from 'react';
import { Head, useForm, Link, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react';
import toast from 'react-hot-toast';

const BROKEN_ICON_PATTERN = /[\u00c2\u00c3\u00e2\u00f0]/u;

function sanitizeIconValue(value) {
    if (typeof value !== 'string') return '';
    return BROKEN_ICON_PATTERN.test(value) ? '' : value;
}

function Edit({ auth, category }) {
    const { data, setData, put, processing, errors } = useForm({
        name: category?.name || '',
        description: category?.description || '',
        icon: sanitizeIconValue(category?.icon),
        sort_order: category?.sort_order || 0,
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        put(route('service-categories.update', category.id), {
            preserveScroll: true,
            onSuccess: () => { toast.success('Kategori berhasil diperbarui'); router.reload(); },
            onError: () => toast.error('Gagal memperbarui kategori'),
        });
    };

    return (
        <>
            <Head title="Edit Kategori Layanan" />

            <div className="p-6">
                <div className="max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <Link
                            href={route('service-categories.index')}
                            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
                        >
                            <IconArrowLeft size={20} />
                            <span>Kembali ke Daftar</span>
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Edit Kategori Layanan
                        </h1>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            Perbarui informasi kategori layanan servis
                        </p>
                    </div>

                    {/* Form */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Name */}
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Nama Kategori <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500 transition-colors ${
                                        errors.name
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                                            : 'border-gray-200 dark:border-gray-700 focus:border-transparent'
                                    } bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}
                                    placeholder="Contoh: Tune Up & Maintenance"
                                    required
                                />
                                {errors.name && (
                                    <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                                )}
                            </div>

                            {/* Description */}
                            <div>
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Deskripsi
                                </label>
                                <textarea
                                    id="description"
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    rows={4}
                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500 transition-colors ${
                                        errors.description
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                                            : 'border-gray-200 dark:border-gray-700 focus:border-transparent'
                                    } bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}
                                    placeholder="Deskripsi singkat tentang kategori ini"
                                />
                                {errors.description && (
                                    <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Icon */}
                                <div>
                                    <label htmlFor="icon" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Icon (Opsional)
                                    </label>
                                    <input
                                        type="text"
                                        id="icon"
                                        value={data.icon}
                                        onChange={(e) => setData('icon', e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                        placeholder="Contoh: 🔧"
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Gunakan emoji jika ingin tampil sebagai simbol. Jika kosong, sistem akan memakai ikon default.
                                    </p>
                                </div>

                                {/* Sort Order */}
                                <div>
                                    <label htmlFor="sort_order" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Urutan Tampilan
                                    </label>
                                    <input
                                        type="number"
                                        id="sort_order"
                                        value={data.sort_order}
                                        onChange={(e) => setData('sort_order', parseInt(e.target.value) || 0)}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                        min="0"
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Urutan lebih kecil tampil lebih dulu
                                    </p>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <IconDeviceFloppy size={20} />
                                    {processing ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </button>
                                <Link
                                    href={route('service-categories.index')}
                                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-xl transition-colors"
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

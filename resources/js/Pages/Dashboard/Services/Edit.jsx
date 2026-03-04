import React from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { IconArrowLeft, IconDeviceFloppy, IconTrash } from '@tabler/icons-react';
import toast from 'react-hot-toast';

function Edit({ auth, service, categories, mechanics, services }) {
    const { data, setData, post, processing, errors } = useForm({
        service_category_id: service.service_category_id || '',
        name: service.name || '',
        description: service.description || '',
        price: service.price || '',
        duration: service.duration || '',
        complexity_level: service.complexity_level || 'simple',
        required_tools: Array.isArray(service.required_tools)
            ? service.required_tools.join(', ')
            : service.required_tools || '',
        status: service.status || 'active',
        incentive_mode: service.incentive_mode || 'same',
        default_incentive_percentage: service.default_incentive_percentage || 0,
        price_adjustments: service.price_adjustments || [],
        mechanic_incentives: service.mechanic_incentives || [],
        _method: 'PUT',
    });

    const addPriceAdjustment = () => {
        setData('price_adjustments', [
            ...data.price_adjustments,
            { trigger_service_id: '', discount_type: 'fixed', discount_value: 0 },
        ]);
    };

    const removePriceAdjustment = (index) => {
        setData('price_adjustments', data.price_adjustments.filter((_, i) => i !== index));
    };

    const updatePriceAdjustment = (index, field, value) => {
        const next = [...data.price_adjustments];
        next[index][field] = value;
        setData('price_adjustments', next);
    };

    const addMechanicIncentive = () => {
        setData('mechanic_incentives', [
            ...data.mechanic_incentives,
            { mechanic_id: '', incentive_percentage: 0 },
        ]);
    };

    const removeMechanicIncentive = (index) => {
        setData('mechanic_incentives', data.mechanic_incentives.filter((_, i) => i !== index));
    };

    const updateMechanicIncentive = (index, field, value) => {
        const next = [...data.mechanic_incentives];
        next[index][field] = value;
        setData('mechanic_incentives', next);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const toolsArray = data.required_tools
            ? (Array.isArray(data.required_tools)
                ? data.required_tools
                : data.required_tools.split(',').map(tool => tool.trim()).filter(Boolean))
            : [];

        post(route('services.update', service.id), {
            service_category_id: data.service_category_id,
            name: data.name,
            description: data.description,
            price: data.price,
            duration: data.duration,
            complexity_level: data.complexity_level,
            required_tools: toolsArray,
            status: data.status,
            incentive_mode: data.incentive_mode,
            default_incentive_percentage: data.default_incentive_percentage,
            price_adjustments: data.price_adjustments.filter((item) => item.trigger_service_id),
            mechanic_incentives: data.incentive_mode === 'by_mechanic'
                ? data.mechanic_incentives.filter((item) => item.mechanic_id)
                : [],
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Layanan berhasil diperbarui!');
            },
            onError: () => {
                toast.error('Gagal memperbarui layanan!');
            },
        });
    };

    const handleDelete = () => {
        if (confirm('Apakah Anda yakin ingin menghapus layanan ini?')) {
            post(route('services.destroy', service.id), {
                method: 'delete',
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Layanan berhasil dihapus!');
                },
                onError: () => {
                    toast.error('Gagal menghapus layanan!');
                },
            });
        }
    };

    return (
        <>
            <Head title="Edit Layanan" />

            <div className="p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <Link
                            href={route('services.index')}
                            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
                        >
                            <IconArrowLeft size={20} />
                            <span>Kembali ke Daftar</span>
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Edit Layanan
                        </h1>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            Ubah informasi layanan yang sudah ada
                        </p>
                    </div>

                    {/* Form Wrapper */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Category & Name Row */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div>
                                    <label htmlFor="service_category_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Kategori Layanan <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="service_category_id"
                                        value={data.service_category_id}
                                        onChange={(e) => setData('service_category_id', e.target.value)}
                                        className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500 transition-colors ${
                                            errors.service_category_id
                                                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                                                : 'border-gray-200 dark:border-gray-700 focus:border-transparent'
                                        } bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}
                                    >
                                        <option value="">Pilih Kategori</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.icon} {category.name}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.service_category_id && (
                                        <p className="mt-1 text-sm text-red-500">{errors.service_category_id}</p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Nama Layanan <span className="text-red-500">*</span>
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
                                        placeholder="Contoh: Ganti Oli Mesin"
                                    />
                                    {errors.name && (
                                        <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                                    )}
                                </div>
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
                                    rows={3}
                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500 transition-colors ${
                                        errors.description
                                            ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                                            : 'border-gray-200 dark:border-gray-700 focus:border-transparent'
                                    } bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}
                                    placeholder="Masukkan deskripsi layanan..."
                                />
                                {errors.description && (
                                    <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                                )}
                            </div>

                            {/* Price, Duration, Complexity Row */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                                <div>
                                    <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Harga (Rp) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        id="price"
                                        value={data.price}
                                        onChange={(e) => setData('price', e.target.value)}
                                        className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500 transition-colors ${
                                            errors.price
                                                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                                                : 'border-gray-200 dark:border-gray-700 focus:border-transparent'
                                        } bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}
                                        placeholder="50000"
                                        min="0"
                                        step="1000"
                                    />
                                    {errors.price && (
                                        <p className="mt-1 text-sm text-red-500">{errors.price}</p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Durasi (menit) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        id="duration"
                                        value={data.duration}
                                        onChange={(e) => setData('duration', e.target.value)}
                                        className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500 transition-colors ${
                                            errors.duration
                                                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                                                : 'border-gray-200 dark:border-gray-700 focus:border-transparent'
                                        } bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}
                                        placeholder="30"
                                        min="1"
                                    />
                                    {errors.duration && (
                                        <p className="mt-1 text-sm text-red-500">{errors.duration}</p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="complexity_level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Kompleksitas
                                    </label>
                                    <select
                                        id="complexity_level"
                                        value={data.complexity_level}
                                        onChange={(e) => setData('complexity_level', e.target.value)}
                                        className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500 transition-colors ${
                                            errors.complexity_level
                                                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                                                : 'border-gray-200 dark:border-gray-700 focus:border-transparent'
                                        } bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}
                                    >
                                        <option value="simple">Sederhana</option>
                                        <option value="medium">Menengah</option>
                                        <option value="complex">Kompleks</option>
                                    </select>
                                    {errors.complexity_level && (
                                        <p className="mt-1 text-sm text-red-500">{errors.complexity_level}</p>
                                    )}
                                </div>
                            </div>

                            {/* Tools & Status Row */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div>
                                    <label htmlFor="required_tools" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Alat yang Dibutuhkan
                                    </label>
                                    <input
                                        type="text"
                                        id="required_tools"
                                        value={data.required_tools}
                                        onChange={(e) => setData('required_tools', e.target.value)}
                                        className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500 transition-colors ${
                                            errors.required_tools
                                                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                                                : 'border-gray-200 dark:border-gray-700 focus:border-transparent'
                                        } bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}
                                        placeholder="Kunci pas, Kunci inggris, Dongkrak"
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Pisahkan dengan koma</p>
                                    {errors.required_tools && (
                                        <p className="mt-1 text-sm text-red-500">{errors.required_tools}</p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Status
                                    </label>
                                    <select
                                        id="status"
                                        value={data.status}
                                        onChange={(e) => setData('status', e.target.value)}
                                        className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary-500 transition-colors ${
                                            errors.status
                                                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                                                : 'border-gray-200 dark:border-gray-700 focus:border-transparent'
                                        } bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}
                                    >
                                        <option value="active">Aktif</option>
                                        <option value="inactive">Nonaktif</option>
                                    </select>
                                    {errors.status && (
                                        <p className="mt-1 text-sm text-red-500">{errors.status}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div>
                                    <label htmlFor="incentive_mode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Mode Insentif Mekanik
                                    </label>
                                    <select
                                        id="incentive_mode"
                                        value={data.incentive_mode}
                                        onChange={(e) => setData('incentive_mode', e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                    >
                                        <option value="same">Sama untuk semua mekanik</option>
                                        <option value="by_mechanic">Berbeda per mekanik</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="default_incentive_percentage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Persen Insentif Default (%)
                                    </label>
                                    <input
                                        type="number"
                                        id="default_incentive_percentage"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={data.default_incentive_percentage}
                                        onChange={(e) => setData('default_incentive_percentage', e.target.value)}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Aturan Potongan Otomatis</h3>
                                    <button type="button" onClick={addPriceAdjustment} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm">
                                        Tambah Aturan
                                    </button>
                                </div>
                                {data.price_adjustments.map((rule, index) => (
                                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                        <select
                                            value={rule.trigger_service_id}
                                            onChange={(e) => updatePriceAdjustment(index, 'trigger_service_id', e.target.value)}
                                            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
                                        >
                                            <option value="">Pilih layanan pemicu</option>
                                            {services.map((svc) => (
                                                <option key={svc.id} value={svc.id}>{svc.title}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={rule.discount_type}
                                            onChange={(e) => updatePriceAdjustment(index, 'discount_type', e.target.value)}
                                            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
                                        >
                                            <option value="fixed">Nominal</option>
                                            <option value="percent">Persen</option>
                                        </select>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={rule.discount_value}
                                            onChange={(e) => updatePriceAdjustment(index, 'discount_value', e.target.value)}
                                            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
                                            placeholder="Nilai diskon"
                                        />
                                        <button type="button" onClick={() => removePriceAdjustment(index)} className="px-3 py-2 rounded-lg bg-red-100 text-red-700">
                                            Hapus
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {data.incentive_mode === 'by_mechanic' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Insentif Per Mekanik (%)</h3>
                                        <button type="button" onClick={addMechanicIncentive} className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm">
                                            Tambah Mekanik
                                        </button>
                                    </div>
                                    {data.mechanic_incentives.map((rule, index) => (
                                        <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                            <select
                                                value={rule.mechanic_id}
                                                onChange={(e) => updateMechanicIncentive(index, 'mechanic_id', e.target.value)}
                                                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
                                            >
                                                <option value="">Pilih mekanik</option>
                                                {mechanics.map((mechanic) => (
                                                    <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={rule.incentive_percentage}
                                                onChange={(e) => updateMechanicIncentive(index, 'incentive_percentage', e.target.value)}
                                                className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900"
                                                placeholder="Persen"
                                            />
                                            <button type="button" onClick={() => removeMechanicIncentive(index)} className="px-3 py-2 rounded-lg bg-red-100 text-red-700">
                                                Hapus
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <IconDeviceFloppy size={20} />
                                    {processing ? 'Menyimpan...' : 'Simpan'}
                                </button>
                                <Link
                                    href={route('services.index')}
                                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-xl transition-colors"
                                >
                                    Batal
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={processing}
                                    className="ml-auto inline-flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <IconTrash size={20} />
                                    Hapus
                                </button>
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

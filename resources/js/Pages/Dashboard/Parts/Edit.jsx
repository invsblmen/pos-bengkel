import React, { useMemo, useState, useEffect } from 'react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import Input from '@/Components/Dashboard/Input';
import Textarea from '@/Components/Dashboard/TextArea';
import AddPartCategoryModal from '@/Components/Dashboard/AddPartCategoryModal';
import AddSupplierModal from '@/Components/Dashboard/AddSupplierModal';
import toast from 'react-hot-toast';
import {
    IconBox, IconDeviceFloppy, IconArrowLeft, IconAlertCircle, IconCheck,
    IconMapPin, IconTruck, IconCategory, IconBarcode, IconSparkles,
    IconPackage, IconExclamationCircle, IconTrendingUp, IconTrendingDown, IconPlus
} from '@tabler/icons-react';

export default function Edit({ part, suppliers: initialSuppliers, categories: initialCategories }) {
    const [categories, setCategories] = useState(initialCategories || []);
    const [suppliers, setSuppliers] = useState(initialSuppliers || []);
    useEffect(() => { setCategories(initialCategories || []); }, [initialCategories]);
    useEffect(() => { setSuppliers(initialSuppliers || []); }, [initialSuppliers]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showSupplierModal, setShowSupplierModal] = useState(false);

    const { data, setData, patch, processing, errors } = useForm({
        name: part.name || '',
        part_number: part.part_number || '',
        barcode: part.barcode || '',
        part_category_id: part.part_category_id || '',
        supplier_id: part.supplier_id || '',
        stock: part.stock || 0,
        minimal_stock: part.minimal_stock || 0,
        rack_location: part.rack_location || '',
        description: part.description || '',
        has_warranty: !!part.has_warranty,
        warranty_duration_days: part.warranty_duration_days ?? '',
        warranty_terms: part.warranty_terms || '',
    });

    // Live Preview Data
    const previewData = useMemo(() => {
        const selectedCategory = categories?.find(c => c.id == data.part_category_id);
        const selectedSupplier = suppliers?.find(s => s.id == data.supplier_id);
        const stockStatus = data.stock === 0 ? 'out' : (data.minimal_stock > 0 && data.stock <= data.minimal_stock ? 'low' : 'normal');
        const completeness = [
            data.name,
            data.part_number,
            data.part_category_id,
            data.supplier_id,
            data.rack_location
        ].filter(Boolean).length;

        // Calculate changes
        const hasChanges =
            data.name !== part.name ||
            data.part_number !== part.part_number ||
            data.barcode !== part.barcode ||
            data.part_category_id !== part.part_category_id ||
            data.supplier_id !== part.supplier_id ||
            data.minimal_stock !== part.minimal_stock ||
            data.rack_location !== part.rack_location ||
            data.description !== part.description ||
            data.has_warranty !== !!part.has_warranty ||
            data.warranty_duration_days !== (part.warranty_duration_days ?? '') ||
            data.warranty_terms !== (part.warranty_terms || '');

        return {
            category: selectedCategory,
            supplier: selectedSupplier,
            stockStatus,
            completeness,
            totalFields: 5,
            percentage: Math.round((completeness / 5) * 100),
            hasChanges
        };
    }, [data, categories, suppliers, part]);

    // Generate Part Number
    const generatePartNumber = () => {
        const category = previewData.category;
        const prefix = category ? category.name.substring(0, 3).toUpperCase() : 'PRT';
        const random = Math.floor(Math.random() * 9000) + 1000;
        setData('part_number', `${prefix}-${random}`);
        toast.success('Kode part berhasil di-generate!');
    };

    const submit = (e) => {
        e.preventDefault();
        patch(route('parts.update', part.id), {
            onSuccess: () => { toast.success('Part berhasil diperbarui'); router.reload(); },
            onError: () => toast.error('Gagal memperbarui part'),
        });
    };

    // Handle successful category creation
    const handleCategoryAdded = (newCategory) => {
        setCategories([...categories, newCategory]);
        setData('part_category_id', newCategory.id);
        toast.success(`Kategori "${newCategory.name}" berhasil ditambahkan dan dipilih!`);
    };

    // Handle successful supplier creation
    const handleSupplierAdded = (newSupplier) => {
        setSuppliers([...suppliers, newSupplier]);
        setData('supplier_id', newSupplier.id);
        toast.success(`Supplier "${newSupplier.name}" berhasil ditambahkan dan dipilih!`);
    };

    return (
        <>
            <Head title={`Edit Part - ${part.name}`} />

            <div className="mb-6">
                <Link href={route('parts.index')} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 mb-3">
                    <IconArrowLeft size={16} />
                    Kembali ke Sparepart
                </Link>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <IconBox size={28} className="text-primary-500" />
                    Edit Sparepart
                </h1>
                <p className="text-sm text-slate-500 mt-1">{part.name}</p>
            </div>

            <form onSubmit={submit} className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Informasi Part</h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Perbarui data utama sparepart.</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Input label="Nama" placeholder="Nama part" value={data.name} onChange={(e) => setData('name', e.target.value)} errors={errors.name} />
                                <div>
                                    <Input
                                        label="Kode Part"
                                        placeholder="Contoh: PRT-001"
                                        value={data.part_number}
                                        onChange={(e) => setData('part_number', e.target.value)}
                                        errors={errors.part_number}
                                    />
                                    <button
                                        type="button"
                                        onClick={generatePartNumber}
                                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors"
                                    >
                                        <IconSparkles size={14} />
                                        Generate Otomatis
                                    </button>
                                </div>
                                <div className="md:col-span-2">
                                    <Input label="Barcode" placeholder="Barcode (opsional)" value={data.barcode} onChange={(e) => setData('barcode', e.target.value)} errors={errors.barcode} />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Kosongkan jika tidak menggunakan barcode.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Kategori & Supplier</h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Pastikan informasi sumber part sudah benar.</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Kategori Part
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowCategoryModal(true)}
                                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                                            title="Tambah kategori baru"
                                        >
                                            <IconPlus size={14} />
                                            <span>Baru</span>
                                        </button>
                                    </div>
                                    <select
                                        value={data.part_category_id}
                                        onChange={(e) => setData('part_category_id', e.target.value)}
                                        className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all px-4"
                                    >
                                        <option value="">Pilih Kategori (opsional)</option>
                                        {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Supplier
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setShowSupplierModal(true)}
                                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                            title="Tambah supplier baru"
                                        >
                                            <IconPlus size={14} />
                                            <span>Baru</span>
                                        </button>
                                    </div>
                                    <select
                                        value={data.supplier_id}
                                        onChange={(e) => setData('supplier_id', e.target.value)}
                                        className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all px-4"
                                    >
                                        <option value="">Pilih Supplier (opsional)</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Inventori & Rak</h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Atur stok minimal dan lokasi penyimpanan.</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <Input
                                        label="Stok"
                                        placeholder="Stok"
                                        value={data.stock}
                                        disabled={true}
                                        errors={errors.stock}
                                    />
                                    {/* Stock comparison with original */}
                                    {data.stock !== part.stock && (
                                        <div className="flex items-center gap-1 mt-1.5 text-xs text-blue-600 dark:text-blue-400">
                                            {data.stock > part.stock ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                                            <span>{data.stock > part.stock ? 'Naik' : 'Turun'} dari {part.stock}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Stok Minimal
                                    </label>
                                    <Input
                                        type="number"
                                        placeholder="0 = tidak ada batas minimal"
                                        value={data.minimal_stock}
                                        onChange={(e) => setData('minimal_stock', parseInt(e.target.value) || 0)}
                                        errors={errors.minimal_stock}
                                    />
                                    {data.minimal_stock > 0 && (
                                        <div className="flex items-center gap-1 mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                            <IconCheck size={12} />
                                            <span>Notifikasi stok minimal aktif</span>
                                        </div>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <Input
                                        label="Lokasi Rak Gudang"
                                        placeholder="Contoh: A1, B2-3, RAK-001"
                                        value={data.rack_location}
                                        onChange={(e) => setData('rack_location', e.target.value)}
                                        errors={errors.rack_location}
                                    />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Masukkan kode lokasi rak di gudang untuk memudahkan pencarian part.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-900/40">
                                <IconExclamationCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-amber-700 dark:text-amber-300">
                                    Anda akan mendapat notifikasi jika stok mencapai atau di bawah nilai minimal. Isi 0 jika tidak ingin notifikasi stok minimal.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Kebijakan Garansi</h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Perbarui policy garansi default untuk sparepart ini.</p>
                            </div>
                            <div className="space-y-4">
                                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={data.has_warranty}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setData('has_warranty', checked);
                                            if (!checked) {
                                                setData('warranty_duration_days', '');
                                            }
                                        }}
                                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span>Part ini memiliki garansi</span>
                                </label>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <Input
                                        type="number"
                                        label="Durasi Garansi (hari)"
                                        placeholder="Contoh: 30"
                                        value={data.warranty_duration_days}
                                        onChange={(e) => setData('warranty_duration_days', e.target.value)}
                                        errors={errors.warranty_duration_days}
                                        disabled={!data.has_warranty}
                                    />
                                </div>

                                <Textarea
                                    label="Syarat Garansi"
                                    placeholder="Contoh: Garansi tidak berlaku untuk kerusakan akibat pemasangan tidak sesuai prosedur."
                                    value={data.warranty_terms}
                                    onChange={(e) => setData('warranty_terms', e.target.value)}
                                    errors={errors.warranty_terms}
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                            <div className="mb-4">
                                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Deskripsi</h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Tambahkan catatan tambahan untuk tim.</p>
                            </div>
                            <Textarea label="Deskripsi" placeholder="Deskripsi" value={data.description} onChange={(e) => setData('description', e.target.value)} errors={errors.description} rows={4} />
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Live Preview Card */}
                        <div className={`rounded-2xl p-6 text-white shadow-lg ${
                            previewData.hasChanges
                                ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                                : 'bg-gradient-to-br from-primary-500 to-primary-600'
                        }`}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <IconSparkles size={18} />
                                    Preview Part
                                </h3>
                                <div className="flex items-center gap-2">
                                    {previewData.hasChanges && (
                                        <span className="text-xs bg-white/20 px-2 py-1 rounded-full animate-pulse">
                                            Ada Perubahan
                                        </span>
                                    )}
                                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                                        {previewData.percentage}% Lengkap
                                    </span>
                                </div>
                            </div>

                            {/* Preview Content */}
                            <div className="space-y-3">
                                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                                    <div className="text-xs opacity-80 mb-1">Nama Part</div>
                                    <div className="font-semibold text-base">
                                        {data.name || <span className="opacity-50">Belum diisi</span>}
                                    </div>
                                    {data.name !== part.name && (
                                        <div className="text-xs opacity-70 mt-1 line-through">
                                            Sebelumnya: {part.name}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                                        <div className="text-xs opacity-80 mb-1 flex items-center gap-1">
                                            <IconBarcode size={12} />
                                            Kode
                                        </div>
                                        <div className="text-sm font-medium font-mono">
                                            {data.part_number || <span className="opacity-50">-</span>}
                                        </div>
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                                        <div className="text-xs opacity-80 mb-1 flex items-center gap-1">
                                            <IconMapPin size={12} />
                                            Rak
                                        </div>
                                        <div className="text-sm font-medium">
                                            {data.rack_location || <span className="opacity-50">-</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                                        <div className="text-xs opacity-80 mb-1 flex items-center gap-1">
                                            <IconCategory size={12} />
                                            Kategori
                                        </div>
                                        <div className="text-sm font-medium">
                                            {previewData.category?.name || <span className="opacity-50">-</span>}
                                        </div>
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                                        <div className="text-xs opacity-80 mb-1 flex items-center gap-1">
                                            <IconTruck size={12} />
                                            Supplier
                                        </div>
                                        <div className="text-sm font-medium truncate">
                                            {previewData.supplier?.name || <span className="opacity-50">-</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Stock Status Indicator */}
                                <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                                    <div className="text-xs opacity-80 mb-2">Status Stok Saat Ini</div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all ${
                                                        previewData.stockStatus === 'out' ? 'bg-rose-400' :
                                                        previewData.stockStatus === 'low' ? 'bg-amber-400' : 'bg-emerald-400'
                                                    }`}
                                                    style={{ width: data.minimal_stock > 0 ? `${Math.min((data.stock / data.minimal_stock) * 100, 100)}%` : '100%' }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs">
                                            <IconPackage size={14} />
                                            <span className="font-medium">{data.stock}</span>
                                            {data.minimal_stock > 0 && (
                                                <>
                                                    <span className="opacity-60">/</span>
                                                    <span className="opacity-80">{data.minimal_stock}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Completion Progress */}
                                <div className="pt-3 border-t border-white/20">
                                    <div className="flex items-center justify-between text-xs opacity-80 mb-2">
                                        <span>Kelengkapan Data</span>
                                        <span>{previewData.completeness}/{previewData.totalFields}</span>
                                    </div>
                                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-white transition-all duration-500"
                                            style={{ width: `${previewData.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3">
                                <IconAlertCircle size={18} className="text-primary-500" />
                                Catatan Penting
                            </h3>
                            <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                                <div className="flex items-start gap-2">
                                    <IconCheck size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <p>Stok tidak dapat diubah di sini. Gunakan menu "Sparepart Masuk/Keluar".</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <IconCheck size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <p>Kode part harus tetap unik setelah diubah.</p>
                                </div>
                                <div className="flex items-start gap-2">
                                    <IconCheck size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <p>Perubahan akan tercatat dalam log sistem.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit Buttons - Sticky */}
                <div className="flex flex-col sm:flex-row gap-4 sticky bottom-0 bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl shadow-lg ring-1 ring-slate-200 dark:ring-slate-700">
                    <button type="submit" disabled={processing} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-3.5 font-semibold text-white shadow-lg shadow-primary-500/30 transition hover:shadow-xl hover:shadow-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed"><IconDeviceFloppy size={20} />{processing ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
                    <Link href={route('parts.index')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-200 px-6 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">Batal</Link>
                </div>
            </form>

            {/* Modals */}
            <AddPartCategoryModal
                isOpen={showCategoryModal}
                onClose={() => setShowCategoryModal(false)}
                onSuccess={handleCategoryAdded}
            />
            <AddSupplierModal
                isOpen={showSupplierModal}
                onClose={() => setShowSupplierModal(false)}
                onSuccess={handleSupplierAdded}
            />
        </>
    );
}

Edit.layout = (page) => <DashboardLayout children={page} />;

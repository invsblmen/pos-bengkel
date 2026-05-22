import React, { useEffect, useState, useRef } from 'react';
import { IconInfoCircle, IconAlertCircle, IconCheck, IconLoader2, IconHelpCircle } from '@tabler/icons-react';

function Tooltip({ text, children }) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative inline-block">
            <button
                type="button"
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-slate-600 ml-1"
            >
                <IconHelpCircle size={14} />
            </button>
            {show && (
                <div className="absolute z-10 bottom-full mb-2 left-0 bg-slate-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap pointer-events-none">
                    {text}
                </div>
            )}
        </div>
    );
}

export default function VoucherForm({ data, setData, errors, parts = [], partCategories = [], services = [], serviceCategories = [], submitting }) {
    const [preview, setPreview] = useState(null);
    const [previewError, setPreviewError] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [sampleSubtotal, setSampleSubtotal] = useState(100000);
    const timer = useRef(null);

    const doPreview = async () => {
        setPreviewLoading(true);
        setPreviewError(null);

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(route('vouchers.preview'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ code: data.code, subtotal: Number(sampleSubtotal || 0) }),
            });

            const json = await res.json();
            if (!res.ok) {
                setPreview(null);
                setPreviewError(json?.errors ?? json?.message ?? 'Tidak bisa memproses preview');
            } else {
                setPreview(json);
            }
        } catch (err) {
            setPreviewError('Koneksi gagal saat memeriksa voucher');
            setPreview(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    useEffect(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            if ((data.code || '').trim() !== '') {
                doPreview();
            } else {
                setPreview(null);
                setPreviewError(null);
            }
        }, 500);

        return () => clearTimeout(timer.current);
    }, [data.code, sampleSubtotal]);

    const selectedPartCount = (data.eligible_parts || []).length;
    const selectedCategoryCount = (data.eligible_part_categories || []).length + (data.eligible_service_categories || []).length;
    const selectedServiceCount = (data.eligible_services || []).length;
    const hasEligibility = selectedPartCount + selectedCategoryCount + selectedServiceCount > 0;

    return (
        <div className="space-y-6">
            {/* Basic Info */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Informasi Dasar</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Kode Voucher
                            <Tooltip text="Kode unik untuk identifikasi voucher, gunakan huruf besar tanpa spasi" />
                        </label>
                        <input
                            value={data.code}
                            onChange={(e) => setData('code', e.target.value.toUpperCase())}
                            placeholder="PROMO2024"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                        {errors.code && <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1"><IconAlertCircle size={14} /> {errors.code}</p>}
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Nama Voucher
                            <Tooltip text="Nama deskriptif untuk penampilan di UI" />
                        </label>
                        <input
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="Diskon Grand Opening"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                        {errors.name && <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1"><IconAlertCircle size={14} /> {errors.name}</p>}
                    </div>
                </div>

                <div className="mt-4">
                    <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Deskripsi
                        <Tooltip text="Penjelasan tambahan tentang syarat dan ketentuan voucher" />
                    </label>
                    <textarea
                        value={data.description || ''}
                        onChange={(e) => setData('description', e.target.value)}
                        placeholder="Diskon spesial untuk pelanggan setia..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        rows={2}
                    />
                </div>
            </div>

            {/* Discount Settings */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Pengaturan Diskon</h3>
                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Scope
                            <Tooltip text="Tentukan apakah voucher berlaku untuk item spesifik atau seluruh transaksi" />
                        </label>
                        <select
                            value={data.scope}
                            onChange={(e) => setData('scope', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        >
                            <option value="transaction">Transaksi Keseluruhan</option>
                            <option value="item_part">Item: Sparepart</option>
                            <option value="item_service">Item: Service</option>
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Tipe Diskon
                            <Tooltip text="Pilih antara persentase atau nilai tetap dalam Rupiah" />
                        </label>
                        <select
                            value={data.discount_type}
                            onChange={(e) => setData('discount_type', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        >
                            <option value="percent">Persentase (%)</option>
                            <option value="fixed">Tetap (Rp)</option>
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Nilai Diskon
                            <Tooltip text="Besarnya diskon yang diberikan" />
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={data.discount_value}
                            onChange={(e) => setData('discount_value', e.target.value)}
                            placeholder="10"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                        {errors.discount_value && <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1"><IconAlertCircle size={14} /> {errors.discount_value}</p>}
                    </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Minimal Pembelian
                            <Tooltip text="Nilai minimum transaksi agar voucher dapat digunakan" />
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={data.min_purchase || 0}
                            onChange={(e) => setData('min_purchase', e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Maksimal Diskon
                            <Tooltip text="Batas maksimal potongan yang diberikan (opsional)" />
                        </label>
                        <input
                            type="number"
                            min="0"
                            value={data.max_discount || ''}
                            onChange={(e) => setData('max_discount', e.target.value)}
                            placeholder="Tidak ada batas"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                    </div>
                </div>
            </div>

            {/* Period & Quota */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Periode & Kuota</h3>
                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Mulai Berlaku
                            <Tooltip text="Tanggal dan waktu voucher mulai aktif" />
                        </label>
                        <input
                            type="datetime-local"
                            value={data.starts_at || ''}
                            onChange={(e) => setData('starts_at', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Berakhir
                            <Tooltip text="Tanggal dan waktu voucher tidak lagi aktif" />
                        </label>
                        <input
                            type="datetime-local"
                            value={data.ends_at || ''}
                            onChange={(e) => setData('ends_at', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Kuota Total
                            <Tooltip text="Jumlah total penggunaan voucher, kosongkan untuk unlimited" />
                        </label>
                        <input
                            type="number"
                            min="1"
                            value={data.quota_total || ''}
                            onChange={(e) => setData('quota_total', e.target.value)}
                            placeholder="Tidak ada batas"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Limit per Pelanggan
                        <Tooltip text="Jumlah maksimal penggunaan per pelanggan" />
                    </label>
                    <input
                        type="number"
                        min="1"
                        value={data.limit_per_customer || ''}
                        onChange={(e) => setData('limit_per_customer', e.target.value)}
                        placeholder="Tidak ada batas"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    />
                </div>
            </div>

            {/* Eligibility */}
            {(data.scope === 'item_part' || data.scope === 'item_service') && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Kelayakan Item</h3>
                        {hasEligibility && <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full"><IconCheck size={14} /> Terkonfigurasi</span>}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Kosongkan jika ingin menerapkan ke semua item sesuai scope.</p>

                    <div className="grid gap-4 md:grid-cols-2">
                        {data.scope === 'item_part' && (
                            <>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Kategori Sparepart</label>
                                    <select
                                        multiple
                                        value={data.eligible_part_categories || []}
                                        onChange={(e) => setData('eligible_part_categories', Array.from(e.target.selectedOptions).map(o => o.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white h-32"
                                    >
                                        {partCategories.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Sparepart Spesifik</label>
                                    <select
                                        multiple
                                        value={data.eligible_parts || []}
                                        onChange={(e) => setData('eligible_parts', Array.from(e.target.selectedOptions).map(o => o.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white h-32"
                                    >
                                        {parts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            </>
                        )}
                        {data.scope === 'item_service' && (
                            <>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Kategori Service</label>
                                    <select
                                        multiple
                                        value={data.eligible_service_categories || []}
                                        onChange={(e) => setData('eligible_service_categories', Array.from(e.target.selectedOptions).map(o => o.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white h-32"
                                    >
                                        {serviceCategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Service Spesifik</label>
                                    <select
                                        multiple
                                        value={data.eligible_services || []}
                                        onChange={(e) => setData('eligible_services', Array.from(e.target.selectedOptions).map(o => o.value))}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white h-32"
                                    >
                                        {services.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Live Preview */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Preview Estimasi</h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                            Contoh Subtotal
                            <Tooltip text="Gunakan nilai ini untuk melihat estimasi potongan" />
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Rp</span>
                            <input
                                type="number"
                                min="0"
                                value={sampleSubtotal}
                                onChange={(e) => setSampleSubtotal(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Hasil Preview</label>
                        <div className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700">
                            {previewLoading ? (
                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                    <IconLoader2 size={16} className="animate-spin" />
                                    Mengecek...
                                </div>
                            ) : preview ? (
                                preview.ok ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <IconCheck size={16} className="text-green-600" />
                                            <div className="font-bold text-slate-900 dark:text-white">Rp {Number(preview.discount_amount || 0).toLocaleString('id-ID')}</div>
                                        </div>
                                        {preview.voucher && (
                                            <div className="text-xs text-slate-600 dark:text-slate-400">
                                                {preview.voucher.code} — {preview.voucher.discount_type === 'percent' ? `${preview.voucher.discount_value}%` : `Rp ${Number(preview.voucher.discount_value).toLocaleString('id-ID')}`}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-sm text-red-600">
                                        <IconAlertCircle size={16} />
                                        {(preview.errors && Object.values(preview.errors).flat().join('; ')) || 'Voucher tidak valid'}
                                    </div>
                                )
                            ) : previewError ? (
                                <div className="flex items-center gap-2 text-sm text-red-600">
                                    <IconAlertCircle size={16} />
                                    {typeof previewError === 'string' ? previewError : 'Error'}
                                </div>
                            ) : (
                                <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <IconInfoCircle size={16} />
                                    Masukkan kode untuk preview
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Options */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Opsi Tambahan</h3>
                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!data.is_active}
                            onChange={(e) => setData('is_active', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Aktifkan voucher</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!data.can_combine_with_discount}
                            onChange={(e) => setData('can_combine_with_discount', e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Bisa digabung dengan diskon manual</span>
                    </label>
                </div>
            </div>
        </div>
    );
}

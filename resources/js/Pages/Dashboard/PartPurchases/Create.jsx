import React, { useMemo, useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import {
    IconArrowLeft, IconTrash, IconPlus, IconSearch,
    IconShoppingCart, IconReceipt, IconCash, IconCheck,
    IconAlertCircle, IconDiscount, IconPercentage, IconTruck
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { todayLocalDate } from '@/Utils/datetime';
import AddSupplierModal from '@/Components/Dashboard/AddSupplierModal';

export default function Create({ suppliers = [], parts = [], categories = [] }) {
    const [localSuppliers, setLocalSuppliers] = useState(suppliers);
    const [showSupplierModal, setShowSupplierModal] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        supplier_id: '',
        purchase_date: todayLocalDate(),
        expected_delivery_date: '',
        items: [],
        notes: '',
        discount_type: 'percent',
        discount_value: 0,
        tax_type: 'percent',
        tax_value: 0,
    });

    const [selectedPart, setSelectedPart] = useState(null);
    const [itemQty, setItemQty] = useState(1);
    const [itemPrice, setItemPrice] = useState(0);
    const [itemDiscountType, setItemDiscountType] = useState('percent');
    const [itemDiscountValue, setItemDiscountValue] = useState(0);
    const [searchPart, setSearchPart] = useState('');
    const [isPartDropdownOpen, setIsPartDropdownOpen] = useState(false);

    const getPartId = (part) => part?.id ?? part?.part_id ?? part?.value ?? part?.key ?? null;
    const getPartName = (part) => part?.name ?? part?.part_name ?? part?.title ?? '';
    const getPartPrice = (part) => part?.buy_price ?? part?.cost_price ?? part?.purchase_price ?? part?.price ?? part?.unit_price ?? 0;
    const getPartNumber = (part) => part?.part_number ?? part?.part_no ?? part?.code ?? '';
    const getPartStock = (part) => part?.stock ?? part?.qty ?? part?.quantity ?? 0;

    const filteredParts = useMemo(() => {
        const term = searchPart.trim().toLowerCase();
        if (!term) return parts;
        return parts.filter((p) =>
            getPartName(p).toLowerCase().includes(term) ||
            getPartNumber(p).toLowerCase().includes(term)
        );
    }, [parts, searchPart]);

    const formatCurrency = (value = 0) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

    const handleSubmit = (e) => {
        e?.preventDefault?.();
        if (!data.supplier_id) {
            toast.error('Pilih supplier terlebih dahulu');
            return;
        }
        if (data.items.length === 0) {
            toast.error('Minimal harus ada 1 item');
            return;
        }

        post(route('part-purchases.store'), {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Pembelian berhasil dibuat');
            },
            onError: (errors) => {
                if (errors.error) {
                    toast.error(errors.error);
                } else if (errors.items) {
                    toast.error('Ada kesalahan pada item pembelian');
                } else {
                    const firstError = Object.values(errors)[0];
                    toast.error(firstError || 'Gagal membuat pembelian');
                }
            },
        });
    };

    const addItem = (inputPart = null) => {
        let part = inputPart || selectedPart;
        let partId = getPartId(part);
        let partName = getPartName(part);

        if (!part) {
            toast.error('Pilih sparepart terlebih dahulu');
            return;
        }
        if (!partId) {
            const term = (partName || searchPart || '').trim().toLowerCase();
            const matchedPart = parts.find((p) => {
                const name = getPartName(p).toLowerCase();
                const number = getPartNumber(p).toLowerCase();
                return term && (name === term || number === term);
            });
            if (matchedPart) {
                part = matchedPart;
                partId = getPartId(matchedPart);
                partName = getPartName(matchedPart);
            }
        }
        if (!partId) {
            toast.error('Sparepart tidak valid');
            return;
        }
        if (itemQty < 1) {
            toast.error('Jumlah minimal 1');
            return;
        }
        if (itemPrice < 0) {
            toast.error('Harga tidak boleh negatif');
            return;
        }

        const exists = data.items.find((i) => i.part_id === partId);
        if (exists) {
            toast.error('Sparepart sudah ditambahkan');
            return;
        }

        const fallbackPrice = getPartPrice(part);
        setData('items', [
            ...data.items,
            {
                part_id: partId,
                part_name: partName || `Part #${partId}`,
                quantity: itemQty,
                unit_price: itemPrice || fallbackPrice,
                discount_type: itemDiscountType,
                discount_value: itemDiscountValue,
                margin_type: 'percent',
                margin_value: 0,
                promo_discount_type: 'none',
                promo_discount_value: 0,
            },
        ]);

        // Reset form
        setSelectedPart(null);
        setItemQty(1);
        setItemPrice(0);
        setItemDiscountType('percent');
        setItemDiscountValue(0);
        setSearchPart('');

        toast.success('Item ditambahkan');
    };

    const updateItem = (index, field, value) => {
        const items = [...data.items];
        items[index][field] = value;
        setData('items', items);
    };

    const removeItem = (index) => {
        setData('items', data.items.filter((_, i) => i !== index));
    };

    const calculateSubtotal = (item) => (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
    const calculateItemDiscount = (item) => {
        const subtotal = calculateSubtotal(item);
        const type = item.discount_type || 'none';
        const value = Number(item.discount_value) || 0;
        if (type === 'percent') {
            return Math.min(subtotal, Math.round((subtotal * value) / 100));
        }
        if (type === 'fixed') {
            return Math.min(subtotal, Math.round(value));
        }
        return 0;
    };
    const calculateItemTotal = (item) => calculateSubtotal(item) - calculateItemDiscount(item);

    const itemsSubtotal = data.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

    const calculateTransactionDiscount = () => {
        const type = data.discount_type || 'none';
        const value = Number(data.discount_value) || 0;
        if (type === 'percent') {
            return Math.min(itemsSubtotal, Math.round((itemsSubtotal * value) / 100));
        }
        if (type === 'fixed') {
            return Math.min(itemsSubtotal, Math.round(value));
        }
        return 0;
    };

    const transactionDiscount = calculateTransactionDiscount();
    const afterDiscount = Math.max(0, itemsSubtotal - transactionDiscount);

    const calculateTax = () => {
        const type = data.tax_type || 'none';
        const value = Number(data.tax_value) || 0;
        if (type === 'percent') {
            return Math.round((afterDiscount * value) / 100);
        }
        if (type === 'fixed') {
            return Math.round(value);
        }
        return 0;
    };

    const taxAmount = calculateTax();
    const totalAmount = afterDiscount + taxAmount;

    return (
        <>
            <Head title="Buat Pembelian Sparepart" />

            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 -m-6 p-4 sm:p-5 lg:p-6 space-y-6">
                {/* Hero Header */}
                <div className="bg-gradient-to-r from-amber-600 to-amber-700 dark:from-amber-700 dark:to-amber-800 rounded-2xl shadow-xl">
                    <div className="px-6 py-5">
                        <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <Link href={route('part-purchases.index')}>
                                    <button className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all duration-200 backdrop-blur-sm hover:scale-105">
                                        <IconArrowLeft size={20} />
                                    </button>
                                </Link>
                                <div>
                                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                        <IconTruck size={32} className="text-white/90" />
                                        Pembelian Sparepart Baru
                                    </h1>
                                    <p className="text-amber-100 mt-1">Buat transaksi pembelian dengan mudah dan cepat</p>
                                </div>
                            </div>
                            <div className="hidden lg:flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-amber-100 text-sm font-medium">Total Pembelian</p>
                                    <p className="text-3xl font-bold text-white">{formatCurrency(totalAmount)}</p>
                                    {data.items.length > 0 && (
                                        <p className="text-amber-200 text-xs mt-1">{data.items.length} item</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Informasi Pembelian */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
                                        <IconReceipt size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Informasi Pembelian</h2>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">Detail transaksi dan supplier</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Supplier Section */}
                                <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl border border-amber-200 dark:border-amber-700/30">
                                    <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-2 uppercase tracking-wide">
                                        🚚 Supplier
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            value={data.supplier_id}
                                            onChange={(e) => setData('supplier_id', e.target.value)}
                                            className="flex-1 h-10 px-3 rounded-lg border-2 border-amber-300 dark:border-amber-700 dark:bg-amber-900/30 text-sm font-semibold focus:ring-amber-500 focus:border-amber-500 transition-all dark:text-white"
                                        >
                                            <option value="">Pilih Supplier...</option>
                                            {localSuppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setShowSupplierModal(true)}
                                            className="px-3 h-10 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-all"
                                            title="Tambah supplier baru"
                                        >
                                            <IconPlus size={18} />
                                        </button>
                                    </div>
                                    {errors.supplier_id && (
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                                            <IconAlertCircle size={14} /> {errors.supplier_id}
                                        </p>
                                    )}
                                </div>

                                {/* Details Grid */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    {/* Tanggal Pembelian */}
                                    <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl border border-emerald-200 dark:border-emerald-700/30">
                                        <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2 uppercase tracking-wide">
                                            📅 Tanggal Pembelian
                                        </label>
                                        <input
                                            type="date"
                                            value={data.purchase_date}
                                            onChange={(e) => setData('purchase_date', e.target.value)}
                                            className="w-full h-10 px-3 rounded-lg border-2 border-emerald-300 dark:border-emerald-700 dark:bg-emerald-900/30 text-sm font-semibold focus:ring-emerald-500 focus:border-emerald-500 transition-all dark:text-white"
                                        />
                                    </div>

                                    {/* Catatan */}
                                    <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl border border-orange-200 dark:border-orange-700/30">
                                        <label className="block text-xs font-bold text-orange-700 dark:text-orange-400 mb-2 uppercase tracking-wide">
                                            📝 Catatan
                                        </label>
                                        <input
                                            type="text"
                                            value={data.notes}
                                            onChange={(e) => setData('notes', e.target.value)}
                                            placeholder="Tambahkan catatan..."
                                            className="w-full h-10 px-3 rounded-lg border-2 border-orange-300 dark:border-orange-700 dark:bg-orange-900/30 text-sm font-medium focus:ring-orange-500 focus:border-orange-500 transition-all dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-800 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300">
                                    ETA supplier tidak wajib saat buat pembelian. Anda bisa isi atau ubah tanggal perkiraan/diterima nanti dari halaman edit atau update status.
                                </div>
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 px-6 py-4 border-b border-purple-200 dark:border-purple-700/30">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500 text-white shadow-lg shadow-purple-500/30">
                                        <IconShoppingCart size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Item Pembelian</h2>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {data.items.length} item dipilih
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Inline Add Item Form */}
                            <div className="p-4 bg-gradient-to-br from-white to-purple-50/70 dark:from-slate-900/40 dark:to-purple-900/20 border-b border-slate-200 dark:border-slate-800">
                                <div className="flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-end">
                                    <div className="flex-1 min-w-[320px]">
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Cari Sparepart</label>
                                        <div className="relative">
                                            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={searchPart}
                                                onChange={(e) => {
                                                    setSearchPart(e.target.value);
                                                    setIsPartDropdownOpen(true);
                                                }}
                                                onFocus={() => setIsPartDropdownOpen(true)}
                                                onBlur={() => setTimeout(() => setIsPartDropdownOpen(false), 150)}
                                                placeholder="Cari nama atau kode part..."
                                                className="w-full h-10 pl-9 pr-9 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                            />
                                            {searchPart && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSearchPart('');
                                                        setIsPartDropdownOpen(true);
                                                    }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                    aria-label="Hapus pencarian"
                                                >
                                                    <span className="text-base leading-none">×</span>
                                                </button>
                                            )}
                                            {isPartDropdownOpen && (
                                                <div className="absolute z-20 mt-2 w-full max-h-60 overflow-y-auto rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl">
                                                    {filteredParts.length > 0 ? (
                                                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                                            {filteredParts.map((part, index) => (
                                                                <button
                                                                    key={getPartId(part) ?? `part-${index}`}
                                                                    type="button"
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault();
                                                                        const partId = getPartId(part);
                                                                        const partName = getPartName(part);
                                                                        setSelectedPart({ ...part, id: partId, name: partName });
                                                                        setItemPrice(getPartPrice(part));
                                                                        setSearchPart(partName || '');
                                                                        setIsPartDropdownOpen(false);
                                                                    }}
                                                                    className="w-full px-3 py-2 text-left hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                                                >
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                                                {getPartName(part) || 'Tanpa nama'}
                                                                            </div>
                                                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                                {getPartNumber(part) ? `Kode: ${getPartNumber(part)}` : 'Tanpa kode'} · Stok: {getPartStock(part)}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                                            {formatCurrency(getPartPrice(part))}
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                                                            Sparepart tidak ditemukan
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-20">
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Qty</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={itemQty}
                                            onChange={(e) => setItemQty(parseInt(e.target.value) || 1)}
                                            className="w-full h-10 px-2 text-center text-sm rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>
                                    <div className="w-36">
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Harga</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={itemPrice}
                                            onChange={(e) => setItemPrice(parseInt(e.target.value) || 0)}
                                            className="w-full h-10 px-3 text-right text-sm rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                        />
                                    </div>
                                    <div className="w-52">
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Diskon</label>
                                        <div className="flex items-center gap-2">
                                            <div className="inline-flex h-10 rounded-lg border-2 border-slate-300 dark:border-slate-700 overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => setItemDiscountType('percent')}
                                                    className={`px-2 text-[11px] font-bold transition-all ${
                                                        itemDiscountType === 'percent'
                                                            ? 'bg-purple-600 text-white'
                                                            : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}
                                                >
                                                    %
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setItemDiscountType('fixed')}
                                                    className={`px-2 text-[11px] font-bold transition-all ${
                                                        itemDiscountType === 'fixed'
                                                            ? 'bg-emerald-600 text-white'
                                                            : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}
                                                >
                                                    Rp
                                                </button>
                                            </div>
                                            <div className="relative flex-1">
                                                {itemDiscountType === 'fixed' && (
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
                                                )}
                                                {itemDiscountType === 'percent' && (
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">%</span>
                                                )}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={itemDiscountValue}
                                                    onChange={(e) => setItemDiscountValue(parseFloat(e.target.value) || 0)}
                                                    className={`w-full h-10 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
                                                        itemDiscountType === 'fixed' ? 'pl-9 pr-3 text-right' : 'px-3 text-right'
                                                    } ${itemDiscountType === 'percent' ? 'pr-7' : ''}`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        disabled={!selectedPart}
                                        className="h-10 px-4 min-w-[104px] rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm font-bold hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shrink-0"
                                    >
                                        <IconPlus size={16} /> Tambah
                                    </button>
                                </div>
                            </div>

                            {data.items.length > 0 ? (
                                <div className="space-y-2 p-2">
                                    <div className="hidden lg:block overflow-x-auto">
                                        <table className="w-full text-sm border-separate border-spacing-y-1">
                                            <thead>
                                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                                    <th className="px-3 py-2 text-left font-bold text-slate-700 dark:text-slate-300">Sparepart</th>
                                                    <th className="px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-300 w-20">Qty</th>
                                                    <th className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300 w-28">Harga</th>
                                                    <th className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300">Diskon</th>
                                                    <th className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-300 w-32">Total</th>
                                                    <th className="px-3 py-2 text-center font-bold text-slate-700 dark:text-slate-300 w-14">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.items.map((item, index) => {
                                                    const discountAmount = calculateItemDiscount(item);
                                                    return (
                                                    <tr key={index} className="bg-white dark:bg-slate-900/70 shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-800/60">
                                                        <td className="px-2 py-1.5 first:rounded-l-lg">
                                                            <div className="font-semibold text-slate-900 dark:text-white text-sm">{item.part_name}</div>
                                                            {item.part_number && (
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">Kode: {item.part_number}</div>
                                                            )}
                                                            {discountAmount > 0 && (
                                                                <div className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 font-medium">
                                                                    -{formatCurrency(discountAmount)}
                                                                </div>
                                                            )}
                                                            {errors[`items.${index}.part_id`] && <p className="text-xs text-red-500 mt-1">{errors[`items.${index}.part_id`]}</p>}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity}
                                                                onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                                                className="w-12 h-7 px-2 text-center text-sm rounded-md border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={item.unit_price}
                                                                onChange={(e) => updateItem(index, 'unit_price', parseInt(e.target.value) || 0)}
                                                                className="w-24 h-7 px-2 text-right text-sm rounded-md border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <div className="inline-flex h-7 rounded-md border-2 border-slate-300 dark:border-slate-700 overflow-hidden">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateItem(index, 'discount_type', 'percent')}
                                                                        className={`px-2 text-[10px] font-bold transition-all ${
                                                                            (item.discount_type || 'percent') === 'percent'
                                                                                ? 'bg-purple-600 text-white'
                                                                                : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                                        }`}
                                                                    >
                                                                        %
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateItem(index, 'discount_type', 'fixed')}
                                                                        className={`px-2 text-[10px] font-bold transition-all ${
                                                                            item.discount_type === 'fixed'
                                                                                ? 'bg-emerald-600 text-white'
                                                                                : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                                        }`}
                                                                    >
                                                                        Rp
                                                                    </button>
                                                                </div>
                                                                <div className="relative">
                                                                    {item.discount_type === 'fixed' && (
                                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">Rp</span>
                                                                    )}
                                                                    {item.discount_type !== 'fixed' && (
                                                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">%</span>
                                                                    )}
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={item.discount_value || 0}
                                                                        onChange={(e) => updateItem(index, 'discount_value', parseFloat(e.target.value) || 0)}
                                                                        className={`w-24 h-7 rounded-md border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-[11px] font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-right ${
                                                                            item.discount_type === 'fixed' ? 'pl-6 pr-2' : 'px-2 pr-6'
                                                                        }`}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                                            {formatCurrency(calculateItemTotal(item))}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center last:rounded-r-lg">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeItem(index)}
                                                                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 hover:scale-110"
                                                                title="Hapus item"
                                                            >
                                                                <IconTrash size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Card View */}
                                    <div className="lg:hidden space-y-2">
                                        {data.items.map((item, index) => {
                                            const discountAmount = calculateItemDiscount(item);
                                            return (
                                            <div key={index} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <p className="font-bold text-slate-900 dark:text-white">{item.part_name}</p>
                                                        {item.part_number && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">Kode: {item.part_number}</p>
                                                        )}
                                                        {discountAmount > 0 && (
                                                            <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 font-medium">
                                                                -{formatCurrency(discountAmount)}
                                                            </p>
                                                        )}
                                                        {errors[`items.${index}.part_id`] && <p className="text-xs text-red-500 mt-1">{errors[`items.${index}.part_id`]}</p>}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(index)}
                                                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-all"
                                                        title="Hapus item"
                                                    >
                                                        <IconTrash size={16} />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Qty</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                                            className="w-full h-8 px-2 text-center text-sm rounded-md border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Harga</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.unit_price}
                                                            onChange={(e) => updateItem(index, 'unit_price', parseInt(e.target.value) || 0)}
                                                            className="w-full h-8 px-2 text-right text-xs rounded-md border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Total</label>
                                                        <div className="h-8 px-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 flex items-center justify-end font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                                            {formatCurrency(calculateItemTotal(item))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Diskon</label>
                                                    <div className="flex items-center gap-2">
                                                        <div className="inline-flex h-8 rounded-md border-2 border-slate-300 dark:border-slate-700 overflow-hidden">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateItem(index, 'discount_type', 'percent')}
                                                                className={`px-2 text-[10px] font-bold transition-all ${
                                                                    (item.discount_type || 'percent') === 'percent'
                                                                        ? 'bg-purple-600 text-white'
                                                                        : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                                }`}
                                                            >
                                                                %
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateItem(index, 'discount_type', 'fixed')}
                                                                className={`px-2 text-[10px] font-bold transition-all ${
                                                                    item.discount_type === 'fixed'
                                                                        ? 'bg-emerald-600 text-white'
                                                                        : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                                }`}
                                                            >
                                                                Rp
                                                            </button>
                                                        </div>
                                                        <div className="relative flex-1">
                                                            {item.discount_type === 'fixed' && (
                                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">Rp</span>
                                                            )}
                                                            {item.discount_type !== 'fixed' && (
                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">%</span>
                                                            )}
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={item.discount_value || 0}
                                                                onChange={(e) => updateItem(index, 'discount_value', parseFloat(e.target.value) || 0)}
                                                                className={`w-full h-8 rounded-md border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-right ${
                                                                    item.discount_type === 'fixed' ? 'pl-6 pr-2' : 'px-2 pr-6'
                                                                }`}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>

                                    {/* Subtotal */}
                                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-900/60 border-t-2 border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-center justify-between">
                                        <span className="font-bold text-slate-700 dark:text-slate-300">Subtotal Item</span>
                                        <span className="font-bold text-xl text-slate-900 dark:text-white">{formatCurrency(itemsSubtotal)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-10 text-center">
                                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                                        <IconShoppingCart size={40} className="text-slate-400" />
                                    </div>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">Belum ada item yang ditambahkan</p>
                                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Klik tombol "Tambah Item" untuk memulai</p>
                                </div>
                            )}
                        </div>

                        {/* Summary and Discount/Tax */}
                        <div className="grid gap-6 lg:grid-cols-3">
                            {/* Discount & Tax */}
                            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 px-6 py-4 border-b border-orange-200 dark:border-orange-700/30">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/30">
                                            <IconDiscount size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Diskon & Pajak</h3>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">Potongan dan pajak transaksi</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                                <IconPercentage size={14} className="text-orange-500" />
                                                Diskon
                                            </label>
                                            <div className="flex gap-2 items-start">
                                                <div className="inline-flex h-9 rounded-lg border-2 border-slate-300 dark:border-slate-700 overflow-hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => setData('discount_type', 'percent')}
                                                        className={`px-3 text-[11px] font-bold transition-all ${
                                                            data.discount_type === 'percent'
                                                                ? 'bg-orange-600 text-white'
                                                                : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        %
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setData('discount_type', 'fixed')}
                                                        className={`px-3 text-[11px] font-bold transition-all ${
                                                            data.discount_type === 'fixed'
                                                                ? 'bg-orange-600 text-white'
                                                                : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        Rp
                                                    </button>
                                                </div>
                                                <div className="relative flex-1">
                                                    {data.discount_type === 'fixed' && (
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
                                                    )}
                                                    {data.discount_type !== 'fixed' && (
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">%</span>
                                                    )}
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={data.discount_value}
                                                        onChange={(e) => setData('discount_value', e.target.value)}
                                                        className={`w-full h-9 px-3 text-xs rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right ${
                                                            data.discount_type === 'fixed' ? 'pl-8 pr-3' : 'pl-3 pr-8'
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700/30">
                                                <p className="text-xs text-orange-700 dark:text-orange-400 font-medium">Potongan</p>
                                                <p className="text-base font-bold text-orange-600 dark:text-orange-400">{formatCurrency(transactionDiscount)}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                                                <IconReceipt size={14} className="text-green-500" />
                                                Pajak
                                            </label>
                                            <div className="flex gap-2 items-start">
                                                <div className="inline-flex h-9 rounded-lg border-2 border-slate-300 dark:border-slate-700 overflow-hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => setData('tax_type', 'percent')}
                                                        className={`px-3 text-[11px] font-bold transition-all ${
                                                            data.tax_type === 'percent'
                                                                ? 'bg-green-600 text-white'
                                                                : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        %
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setData('tax_type', 'fixed')}
                                                        className={`px-3 text-[11px] font-bold transition-all ${
                                                            data.tax_type === 'fixed'
                                                                ? 'bg-green-600 text-white'
                                                                : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        Rp
                                                    </button>
                                                </div>
                                                <div className="relative flex-1">
                                                    {data.tax_type === 'fixed' && (
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
                                                    )}
                                                    {data.tax_type !== 'fixed' && (
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">%</span>
                                                    )}
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={data.tax_value}
                                                        onChange={(e) => setData('tax_value', e.target.value)}
                                                        className={`w-full h-9 px-3 text-xs rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 text-right ${
                                                            data.tax_type === 'fixed' ? 'pl-8 pr-3' : 'pl-3 pr-8'
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700/30">
                                                <p className="text-xs text-green-700 dark:text-green-400 font-medium">Pajak</p>
                                                <p className="text-base font-bold text-green-600 dark:text-green-400">{formatCurrency(taxAmount)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Panel */}
                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-2xl shadow-xl border-2 border-emerald-200 dark:border-emerald-700/30 overflow-hidden">
                                <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
                                            <IconCash size={20} className="text-white" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white">Ringkasan</h3>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="space-y-3 text-sm">
                                        <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-700/30">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Subtotal</span>
                                            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(itemsSubtotal)}</span>
                                        </div>
                                        <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-700/30">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Diskon</span>
                                            <span className="font-bold text-red-600 dark:text-red-400">-{formatCurrency(transactionDiscount)}</span>
                                        </div>
                                        <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-700/30">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Pajak</span>
                                            <span className="font-bold text-green-600 dark:text-green-400">+{formatCurrency(taxAmount)}</span>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t-2 border-emerald-300 dark:border-emerald-600">
                                            <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
                                            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalAmount)}</span>
                                        </div>
                                    </div>

                                    <div className="pt-6">
                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold hover:from-emerald-700 hover:to-emerald-800 shadow-xl shadow-emerald-500/30 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                        >
                                            {processing ? (
                                                <>
                                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Menyimpan...
                                                </>
                                            ) : (
                                                <>
                                                    <IconCheck size={20} />
                                                    Simpan Pembelian
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {showSupplierModal && (
                <AddSupplierModal
                    isOpen={showSupplierModal}
                    onClose={() => setShowSupplierModal(false)}
                    onSupplierAdded={(newSupplier) => {
                        setLocalSuppliers([...localSuppliers, newSupplier]);
                        setData('supplier_id', newSupplier.id);
                        setShowSupplierModal(false);
                    }}
                />
            )}
        </>
    );
}

Create.layout = (page) => <DashboardLayout children={page} />;

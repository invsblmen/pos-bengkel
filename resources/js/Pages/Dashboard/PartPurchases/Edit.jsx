import React, { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import DashboardLayout from '@/Layouts/DashboardLayout';
import toast from 'react-hot-toast';
import TransactionPaymentSection from '@/Components/TransactionPaymentSection';
import PaymentReceiptModal from '@/Components/PaymentReceiptModal';
import { IconPlus, IconTrash, IconArrowLeft, IconPencil, IconTruck, IconCheck, IconAlertTriangle, IconPercentage, IconReceipt, IconShoppingCart, IconSearch, IconDiscount, IconCash } from '@tabler/icons-react';
import { todayLocalDate, extractDateFromISO } from '@/Utils/datetime';
import AddSupplierModal from '@/Components/Dashboard/AddSupplierModal';
import { roundToCashDenomination } from '@/Utils/cashRounding';

export default function Edit({ purchase, suppliers, parts, categories = [], cashDenominations = [] }) {
    const [localSuppliers, setLocalSuppliers] = useState(suppliers);
    const [localParts, setLocalParts] = useState(parts);
    useEffect(() => { setLocalSuppliers(suppliers || []); }, [suppliers]);
    useEffect(() => { setLocalParts(parts || []); }, [parts]);
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Initialize form with purchase data
    const [formData, setFormData] = useState({
        supplier_id: purchase.supplier_id || '',
        purchase_date: extractDateFromISO(purchase.purchase_date) || todayLocalDate(),
        expected_delivery_date: extractDateFromISO(purchase.expected_delivery_date) || '',
        notes: purchase.notes || '',
        items: purchase.details?.map(detail => ({
            part_id: detail.part_id,
            part_name: detail.part?.name || '',
            part_number: detail.part?.part_number || detail.part?.code || '',
            quantity: detail.quantity,
            unit_price: detail.unit_price,
            discount_type: (detail.discount_type === 'none' || !detail.discount_type) ? 'percent' : detail.discount_type,
            discount_value: detail.discount_value || 0,
            subtotal: detail.subtotal,
            margin_type: detail.margin_type || 'percent',
            margin_value: detail.margin_value || 0,
            promo_discount_type: detail.promo_discount_type || 'none',
            promo_discount_value: detail.promo_discount_value || 0,
        })) || [],
        discount_type: (purchase.discount_type === 'none' || !purchase.discount_type) ? 'percent' : purchase.discount_type,
        discount_value: purchase.discount_value || 0,
        tax_type: (purchase.tax_type === 'none' || !purchase.tax_type) ? 'percent' : purchase.tax_type,
        tax_value: purchase.tax_value || 0,
        payment_method: purchase.payment_method || 'cash',
        paid_amount: purchase.paid_amount || 0,
        payment_meta: purchase.payment_meta || {},
        transfer_destination: purchase.transfer_destination || '',
    });

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Item selection
    const [searchPart, setSearchPart] = useState('');
    const [isPartDropdownOpen, setIsPartDropdownOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [selectedPart, setSelectedPart] = useState(null);
    const [itemQty, setItemQty] = useState(1);
    const [itemPrice, setItemPrice] = useState(0);
    const [itemDiscountType, setItemDiscountType] = useState('percent');
    const [itemDiscountValue, setItemDiscountValue] = useState(0);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    const handlePaymentConfirm = (paymentData) => {
        const paymentReceivedAt = new Date().toISOString();
        handleChange('payment_method', paymentData.payment_method || 'cash');
        handleChange('paid_amount', Number(paymentData.paid_amount || 0));
        handleChange('applied_amount', Number((paymentData.applied_amount ?? paymentData.paid_amount) || 0));
        handleChange('transfer_destination', paymentData.transfer_destination || '');
        handleChange('payment_meta', {
            ...(paymentData.payment_meta || {}),
            payment_received_at: paymentReceivedAt,
        });
        setShowPaymentModal(false);
        toast.success('Data pembayaran tersimpan');
    };

    const openEditItemModal = (index) => {
        const item = formData.items[index];
        if (!item) return;
        const part = localParts.find(p => p.id === item.part_id) || {
            id: item.part_id,
            name: item.part_name,
            part_number: item.part_number,
            buy_price: item.unit_price,
        };
        setSelectedPart(part);
        setSearchPart(part?.name || '');
        setIsPartDropdownOpen(false);
        setItemQty(item.quantity || 1);
        setItemPrice(item.unit_price || 0);
        setItemDiscountType(item.discount_type || 'percent');
        setItemDiscountValue(item.discount_value || 0);
        setEditingIndex(index);
    };

    const addItem = () => {
        if (!selectedPart) {
            toast.error('Please select a part');
            return;
        }
        if (itemQty < 1) {
            toast.error('Quantity must be at least 1');
            return;
        }
        if (itemPrice < 0) {
            toast.error('Price cannot be negative');
            return;
        }

        const exists = formData.items.find((i, idx) => i.part_id === selectedPart.id && idx !== editingIndex);
        if (exists) {
            toast.error('Part already added');
            return;
        }

        const newItem = {
            part_id: selectedPart.id,
            part_name: selectedPart.name,
            part_number: selectedPart.part_number || selectedPart.code || '',
            quantity: parseInt(itemQty),
            unit_price: parseInt(itemPrice),
            discount_type: itemDiscountType,
            discount_value: parseFloat(itemDiscountValue) || 0,
            subtotal: parseInt(itemQty) * parseInt(itemPrice),
            margin_type: 'percent',
            margin_value: 0,
            promo_discount_type: 'none',
            promo_discount_value: 0,
        };

        setFormData(prev => {
            if (editingIndex !== null) {
                const newItems = [...prev.items];
                newItems[editingIndex] = newItem;
                return { ...prev, items: newItems };
            }
            return {
                ...prev,
                items: [...prev.items, newItem],
            };
        });

        setEditingIndex(null);
        setSelectedPart(null);
        setSearchPart('');
        setItemQty(1);
        setItemPrice(0);
        setItemDiscountType('percent');
        setItemDiscountValue(0);
        setIsPartDropdownOpen(false);
        toast.success(editingIndex !== null ? 'Item updated' : 'Item added');
    };

    const removeItem = (index) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
        toast.success('Item removed');
    };

    const updateItemQty = (index, qty) => {
        const newQty = parseInt(qty) || 0;
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[index].quantity = newQty;
            newItems[index].subtotal = newQty * newItems[index].unit_price;
            return { ...prev, items: newItems };
        });
    };

    const updateItemPrice = (index, price) => {
        const newPrice = parseInt(price) || 0;
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[index].unit_price = newPrice;
            newItems[index].subtotal = newItems[index].quantity * newPrice;
            return { ...prev, items: newItems };
        });
    };

    const updateItemDiscountType = (index, type) => {
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[index].discount_type = type;
            return { ...prev, items: newItems };
        });
    };

    const updateItemDiscountValue = (index, value) => {
        const newValue = parseFloat(value) || 0;
        setFormData(prev => {
            const newItems = [...prev.items];
            newItems[index].discount_value = newValue;
            return { ...prev, items: newItems };
        });
    };

    const calculateItemDiscount = (item) => {
        const subtotal = item.quantity * item.unit_price;
        if (item.discount_type === 'percent') {
            return subtotal * (item.discount_value / 100);
        } else if (item.discount_type === 'fixed') {
            return item.discount_value;
        }
        return 0;
    };

    const calculateItemTotal = (item) => {
        const subtotal = item.quantity * item.unit_price;
        const discountTotal = calculateItemDiscount(item);
        return subtotal - discountTotal;
    };

    const itemsSubtotal = formData.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

    const transactionDiscount = (() => {
        if (formData.discount_type === 'percent') {
            return itemsSubtotal * (formData.discount_value / 100);
        } else if (formData.discount_type === 'fixed') {
            return formData.discount_value;
        }
        return 0;
    })();

    const afterDiscount = itemsSubtotal - transactionDiscount;

    const taxAmount = (() => {
        if (formData.tax_type === 'percent') {
            return afterDiscount * (formData.tax_value / 100);
        } else if (formData.tax_type === 'fixed') {
            return formData.tax_value;
        }
        return 0;
    })();

    const rawGrandTotal = afterDiscount + taxAmount;
    const { roundingAdjustment, grandTotal } = roundToCashDenomination(rawGrandTotal);

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const calculateSellingPrice = (item) => {
        const itemTotal = calculateItemTotal(item);
        const costPerUnit = itemTotal / item.quantity;

        let markupAmount = 0;
        if (item.markup_type === 'percent') {
            markupAmount = costPerUnit * (item.markup_value / 100);
        } else if (item.markup_type === 'fixed') {
            markupAmount = item.markup_value;
        }

        return costPerUnit + markupAmount;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.supplier_id) {
            toast.error('Please select a supplier');
            return;
        }

        if (!formData.purchase_date) {
            toast.error('Please select purchase date');
            return;
        }

        if (formData.items.length === 0) {
            toast.error('Please add at least one item');
            return;
        }

        console.log('Submitting formData:', formData);
        setSubmitting(true);

        router.put(route('part-purchases.update', purchase.id), formData, {
            preserveScroll: true,
            onSuccess: () => {
                console.log('Update success');
                toast.success('Purchase updated successfully!');
                router.visit(route('part-purchases.show', purchase.id));
            },
            onError: (errors) => {
                console.error('Update error:', errors);
                const firstError = errors?.error || Object.values(errors || {})[0];
                if (firstError) {
                    toast.error(firstError);
                } else {
                    toast.error('Failed to update purchase');
                }
                setErrors(errors);
                setSubmitting(false);
            },
            onFinish: () => {
                console.log('Update finished');
            },
        });
    };

    const filteredParts = localParts.filter(p => {
        if (!searchPart) return true;
        const lowerSearch = searchPart.toLowerCase();
        return (
            (p.name && p.name.toLowerCase().includes(lowerSearch)) ||
            (p.part_number && p.part_number.toLowerCase().includes(lowerSearch)) ||
            (p.barcode && p.barcode.toLowerCase().includes(lowerSearch))
        );
    });

    return (
        <>
            <Head title={`Edit Pembelian ${purchase.purchase_number}`} />
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 -m-6 p-4 sm:p-5 lg:p-6">
                {/* Hero Header */}
                <div className="bg-gradient-to-r from-amber-600 to-amber-700 dark:from-amber-700 dark:to-amber-800 rounded-2xl shadow-xl mb-6">
                    <div className="px-6 py-5">
                        <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => router.visit(route('part-purchases.index'))}
                                    className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all duration-200 backdrop-blur-sm hover:scale-105"
                                >
                                    <IconArrowLeft size={20} />
                                </button>
                                <div>
                                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                        <IconPencil size={28} className="text-white/90" />
                                        Edit Pembelian Sparepart
                                    </h1>
                                    <p className="text-amber-100 mt-1">Perbarui data pembelian {purchase.purchase_number}</p>
                                </div>
                            </div>
                            <div className="hidden lg:flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-amber-100 text-sm font-medium">Total Pembelian</p>
                                    <p className="text-3xl font-bold text-white">{formatCurrency(grandTotal)}</p>
                                    {formData.items.length > 0 && (
                                        <p className="text-amber-200 text-xs mt-1">{formData.items.length} item</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                <form onSubmit={handleSubmit}>
                    {/* Warning for received purchases */}
                    {purchase.status === 'received' && (
                        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex items-start gap-3">
                            <IconAlertTriangle size={20} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <div className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Pembelian Sudah Diterima</div>
                                <div className="text-amber-700 dark:text-amber-200">Pembelian ini sudah diterima dan stok sudah diperbarui. Pengeditan tidak disarankan karena mungkin menyebabkan inkonsistensi data.</div>
                            </div>
                        </div>
                    )}

                    {/* Purchase Information Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 mb-6">
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
                                        value={formData.supplier_id}
                                        onChange={(e) => handleChange('supplier_id', e.target.value)}
                                        className="flex-1 h-10 px-3 rounded-lg border-2 border-amber-300 dark:border-amber-700 dark:bg-amber-900/30 text-sm font-semibold focus:ring-amber-500 focus:border-amber-500 transition-all dark:text-white"
                                        required
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
                                        <IconAlertTriangle size={14} /> {errors.supplier_id}
                                    </p>
                                )}
                            </div>

                            {/* Details Grid */}
                            <div className="grid gap-4 md:grid-cols-3">
                                {/* Tanggal Pembelian */}
                                <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl border border-emerald-200 dark:border-emerald-700/30">
                                    <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-2 uppercase tracking-wide">
                                        📅 Tanggal Pembelian
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.purchase_date}
                                        onChange={(e) => handleChange('purchase_date', e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border-2 border-emerald-300 dark:border-emerald-700 dark:bg-emerald-900/30 text-sm font-semibold focus:ring-emerald-500 focus:border-emerald-500 transition-all dark:text-white"
                                        required
                                    />
                                </div>

                                {/* Tanggal Pengiriman */}
                                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl border border-blue-200 dark:border-blue-700/30">
                                    <label className="block text-xs font-bold text-blue-700 dark:text-blue-400 mb-2 uppercase tracking-wide">
                                        ✈️ Pengiriman
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.expected_delivery_date}
                                        onChange={(e) => handleChange('expected_delivery_date', e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border-2 border-blue-300 dark:border-blue-700 dark:bg-blue-900/30 text-sm font-semibold focus:ring-blue-500 focus:border-blue-500 transition-all dark:text-white"
                                    />
                                </div>

                                {/* Catatan */}
                                <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl border border-orange-200 dark:border-orange-700/30">
                                    <label className="block text-xs font-bold text-orange-700 dark:text-orange-400 mb-2 uppercase tracking-wide">
                                        📝 Catatan
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.notes}
                                        onChange={(e) => handleChange('notes', e.target.value)}
                                        placeholder="Tambahkan catatan..."
                                        className="w-full h-10 px-3 rounded-lg border-2 border-orange-300 dark:border-orange-700 dark:bg-orange-900/30 text-sm font-medium focus:ring-orange-500 focus:border-orange-500 transition-all dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Items Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 mb-6">
                        <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 px-6 py-4 border-b border-purple-200 dark:border-purple-700/30">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500 text-white shadow-lg shadow-purple-500/30">
                                    <IconShoppingCart size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Item Pembelian</h2>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        {formData.items.length} item dipilih
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gradient-to-br from-white to-purple-50/70 dark:from-slate-900/40 dark:to-purple-900/20 border-b border-slate-200 dark:border-slate-800 overflow-visible">
                            {/* Inline Add Item Form */}
                            {editingIndex !== null && (
                                <div className="mb-3 flex flex-wrap items-center gap-2 relative z-0">
                                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-3 py-1 text-xs font-semibold">
                                        <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                        Sedang mengedit item #{editingIndex + 1}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditingIndex(null);
                                            setSelectedPart(null);
                                            setSearchPart('');
                                            setItemQty(1);
                                            setItemPrice(0);
                                            setItemDiscountType('percent');
                                            setItemDiscountValue(0);
                                            setIsPartDropdownOpen(false);
                                        }}
                                        className="text-xs font-semibold text-amber-700 dark:text-amber-200 hover:underline"
                                    >
                                        Batal Edit
                                    </button>
                                </div>
                            )}
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
                                                setSelectedPart(null);
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
                                                    setSelectedPart(null);
                                                    setIsPartDropdownOpen(true);
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                                                aria-label="Hapus pencarian"
                                            >
                                                <span className="text-base leading-none">×</span>
                                            </button>
                                        )}
                                        {isPartDropdownOpen && (
                                            <div className="absolute z-50 mt-2 w-full max-h-60 overflow-y-auto rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl">
                                                {filteredParts.length > 0 ? (
                                                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                                        {filteredParts.map((part) => (
                                                            <button
                                                                key={part.id}
                                                                type="button"
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    setSelectedPart(part);
                                                                    setItemPrice(part.buy_price || part.sell_price || 0);
                                                                    setSearchPart(part.name || '');
                                                                    setIsPartDropdownOpen(false);
                                                                }}
                                                                className="w-full px-3 py-2 text-left hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                                            >
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                                                            {part.name || 'Tanpa nama'}
                                                                        </div>
                                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                                            {part.part_number ? `Kode: ${part.part_number}` : 'Tanpa kode'} · Stok: {part.stock || 0}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                                        {formatCurrency(part.buy_price || part.sell_price || 0)}
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
                                        <div className="inline-flex h-10 rounded-lg border-2 border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
                                            <button
                                                type="button"
                                                onClick={() => setItemDiscountType('percent')}
                                                className={`px-3 text-xs font-bold transition-all ${
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
                                                className={`px-3 text-xs font-bold transition-all ${
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

                            {/* Items Display */}
                            {formData.items.length === 0 ? (
                                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                    <p className="text-slate-500 dark:text-slate-400 mb-3">Belum ada item yang ditambahkan</p>
                                    <p className="text-xs text-slate-400">Gunakan form di atas untuk menambahkan item pembelian</p>
                                </div>
                            ) : (
                                <>
                                    {/* Desktop Table View */}
                                    <div className="space-y-2 p-2 hidden lg:block">
                                        <div className="overflow-x-auto">
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
                                                    {formData.items.map((item, idx) => {
                                                        const discountAmount = calculateItemDiscount(item);
                                                        const itemTotal = calculateItemTotal(item);
                                                        return (
                                                        <tr key={idx} className="bg-white dark:bg-slate-900/70 shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-800/60">
                                                            <td className="px-2 py-1.5 first:rounded-l-lg">
                                                                <div className="font-semibold text-slate-900 dark:text-white text-sm">{item.part_name}</div>
                                                                {item.part_number && (
                                                                    <div className="text-xs text-slate-500 dark:text-slate-400">Kode: {item.part_number}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center">
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateItemQty(idx, e.target.value)}
                                                                    className="w-12 h-7 px-2 text-center text-sm rounded-md border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1.5 text-right">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={item.unit_price}
                                                                    onChange={(e) => updateItemPrice(idx, e.target.value)}
                                                                    className="w-24 h-7 px-2 text-right text-sm rounded-md border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1.5">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <div className="inline-flex h-7 rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateItemDiscountType(idx, 'percent')}
                                                                            className={`px-1.5 text-[10px] font-bold transition-all ${
                                                                                (item.discount_type || 'percent') === 'percent'
                                                                                    ? 'bg-purple-600 text-white'
                                                                                    : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                                            }`}
                                                                        >
                                                                            %
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateItemDiscountType(idx, 'fixed')}
                                                                            className={`px-1.5 text-[10px] font-bold transition-all ${
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
                                                                            onChange={(e) => updateItemDiscountValue(idx, e.target.value)}
                                                                            className={`w-20 h-7 rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-[11px] font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-right ${
                                                                                item.discount_type === 'fixed' ? 'pl-5 pr-1' : 'px-1 pr-5'
                                                                            }`}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-1.5 text-right">
                                                                {discountAmount > 0 && (
                                                                    <div className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                                                                        Diskon: -{formatCurrency(discountAmount)}
                                                                    </div>
                                                                )}
                                                                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                                                                    {formatCurrency(itemTotal)}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-1.5 text-center last:rounded-r-lg">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeItem(idx)}
                                                                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
                                    </div>

                                    {/* Mobile Card View */}
                                    <div className="space-y-3 lg:hidden">
                                        {formData.items.map((item, idx) => {
                                            const discountAmount = calculateItemDiscount(item);
                                            const itemTotal = calculateItemTotal(item);
                                            return (
                                                <div key={idx} className="bg-white dark:bg-slate-900/70 shadow-sm ring-1 ring-slate-200/60 dark:ring-slate-800/60 rounded-lg p-3">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-slate-900 dark:text-white text-sm">{item.part_name}</div>
                                                            {item.part_number && (
                                                                <div className="text-xs text-slate-500 dark:text-slate-400">Kode: {item.part_number}</div>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(idx)}
                                                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        >
                                                            <IconTrash size={16} />
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Qty</label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity}
                                                                onChange={(e) => updateItemQty(idx, e.target.value)}
                                                                className="w-full h-8 px-2 text-center rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Harga</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={item.unit_price}
                                                                onChange={(e) => updateItemPrice(idx, e.target.value)}
                                                                className="w-full h-8 px-2 text-right rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="mb-3">
                                                        <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Diskon</label>
                                                        <div className="flex items-center gap-1">
                                                            <div className="inline-flex h-8 rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateItemDiscountType(idx, 'percent')}
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
                                                                    onClick={() => updateItemDiscountType(idx, 'fixed')}
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
                                                                    onChange={(e) => updateItemDiscountValue(idx, e.target.value)}
                                                                    className={`w-full h-8 rounded-md border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-[11px] font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-right ${
                                                                        item.discount_type === 'fixed' ? 'pl-5 pr-2' : 'px-2 pr-5'
                                                                    }`}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                                        <div className="flex justify-between">
                                                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Total:</span>
                                                            <div className="text-right">
                                                                {discountAmount > 0 && (
                                                                    <div className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                                                                        Diskon: -{formatCurrency(discountAmount)}
                                                                    </div>
                                                                )}
                                                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(itemTotal)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Discount & Tax Section */}
                    <div className="grid gap-6 lg:grid-cols-3 mb-6">
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
                                                    onClick={() => handleChange('discount_type', 'percent')}
                                                    className={`px-3 text-[11px] font-bold transition-all ${
                                                        formData.discount_type === 'percent'
                                                            ? 'bg-orange-600 text-white'
                                                            : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}
                                                >
                                                    %
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange('discount_type', 'fixed')}
                                                    className={`px-3 text-[11px] font-bold transition-all ${
                                                        formData.discount_type === 'fixed'
                                                            ? 'bg-orange-600 text-white'
                                                            : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}
                                                >
                                                    Rp
                                                </button>
                                            </div>
                                            <div className="relative flex-1">
                                                {formData.discount_type === 'fixed' && (
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
                                                )}
                                                {formData.discount_type !== 'fixed' && (
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">%</span>
                                                )}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.discount_value}
                                                    onChange={(e) => handleChange('discount_value', e.target.value)}
                                                    className={`w-full h-9 px-3 text-xs rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-right ${
                                                        formData.discount_type === 'fixed' ? 'pl-8 pr-3' : 'pl-3 pr-8'
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
                                                    onClick={() => handleChange('tax_type', 'percent')}
                                                    className={`px-3 text-[11px] font-bold transition-all ${
                                                        formData.tax_type === 'percent'
                                                            ? 'bg-green-600 text-white'
                                                            : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}
                                                >
                                                    %
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleChange('tax_type', 'fixed')}
                                                    className={`px-3 text-[11px] font-bold transition-all ${
                                                        formData.tax_type === 'fixed'
                                                            ? 'bg-green-600 text-white'
                                                            : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                    }`}
                                                >
                                                    Rp
                                                </button>
                                            </div>
                                            <div className="relative flex-1">
                                                {formData.tax_type === 'fixed' && (
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
                                                )}
                                                {formData.tax_type !== 'fixed' && (
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">%</span>
                                                )}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.tax_value}
                                                    onChange={(e) => handleChange('tax_value', e.target.value)}
                                                    className={`w-full h-9 px-3 text-xs rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500 text-right ${
                                                        formData.tax_type === 'fixed' ? 'pl-8 pr-3' : 'pl-3 pr-8'
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
                                        <span className="text-slate-600 dark:text-slate-400 font-medium">Subtotal ({formData.items.length} items)</span>
                                        <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(itemsSubtotal)}</span>
                                    </div>
                                    {transactionDiscount > 0 && (
                                        <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-700/30">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Diskon</span>
                                            <span className="font-bold text-red-600 dark:text-red-400">-{formatCurrency(transactionDiscount)}</span>
                                        </div>
                                    )}
                                    {taxAmount > 0 && (
                                        <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-700/30">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Pajak</span>
                                            <span className="font-bold text-green-600 dark:text-green-400">+{formatCurrency(taxAmount)}</span>
                                        </div>
                                    )}
                                    {roundingAdjustment !== 0 && (
                                        <div className="flex items-center justify-between pb-3 border-b border-emerald-200 dark:border-emerald-700/30">
                                            <span className="text-slate-600 dark:text-slate-400 font-medium">Pembulatan</span>
                                            <span className={`font-bold ${roundingAdjustment > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {roundingAdjustment > 0 ? '+' : ''}{formatCurrency(roundingAdjustment)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-base font-bold text-emerald-900 dark:text-white">Grand Total</span>
                                        <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(grandTotal)}</span>
                                    </div>
                                </div>

                                <div className="mt-6">
                                    <TransactionPaymentSection
                                        title="Pembayaran Pembelian"
                                        paymentMethod={formData.payment_method}
                                        paidAmount={formData.paid_amount}
                                        totalAmount={grandTotal}
                                        transferDestination={formData.transfer_destination}
                                        onOpenPaymentModal={() => setShowPaymentModal(true)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            type="button"
                            onClick={() => router.visit(route('part-purchases.index'))}
                            disabled={submitting}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 px-6 py-3.5 font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || formData.items.length === 0}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:shadow-xl hover:shadow-amber-500/40 hover:to-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                <>
                                    <IconCheck size={20} />
                                    <span>Simpan Pembelian</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
                </div>
            </div>

            {/* Add Supplier Modal */}
            <AddSupplierModal
                isOpen={showSupplierModal}
                onClose={() => setShowSupplierModal(false)}
                onSuccess={(supplier) => {
                    setLocalSuppliers([...localSuppliers, supplier]);
                    setFormData(prev => ({ ...prev, supplier_id: supplier.id }));
                    toast.success('Supplier berhasil ditambahkan dan dipilih');
                }}
            />
            <PaymentReceiptModal
                show={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                onConfirm={handlePaymentConfirm}
                totalAmount={grandTotal}
                cashDenominations={cashDenominations}
                initialPayment={formData}
                formatCurrency={formatCurrency}
            />
        </>
    );
}

Edit.layout = (page) => <DashboardLayout children={page} />;

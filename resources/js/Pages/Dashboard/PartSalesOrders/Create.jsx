import React, { useState } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import { IconArrowLeft, IconPlus, IconX } from '@tabler/icons-react';
import { todayLocalDate } from '@/Utils/datetime';

export default function Create({ customers, parts }) {
    const { data, setData, post, errors, processing } = useForm({
        customer_id: '',
        order_date: todayLocalDate(),
        expected_delivery_date: '',
        notes: '',
        items: [{ part_id: '', quantity: 1, unit_price: 0, discount_type: 'none', discount_value: 0 }],
        discount_type: 'none',
        discount_value: 0,
        tax_type: 'none',
        tax_value: 0,
    });

    const [itemErrors, setItemErrors] = useState({});

    const handleChange = (field, value) => {
        setData(field, value);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...data.items];
        newItems[index] = { ...newItems[index], [field]: field === 'quantity' || field === 'unit_price' ? parseInt(value) || 0 : value };

        // Auto-fill unit_price when part is selected
        if (field === 'part_id' && value) {
            const selectedPart = parts.find(p => p.id == value);
            if (selectedPart) {
                newItems[index].unit_price = selectedPart.sell_price || 0;
            }
        }

        setData('items', newItems);
    };

    const addItem = () => {
        setData('items', [...data.items, { part_id: '', quantity: 1, unit_price: 0, discount_type: 'none', discount_value: 0 }]);
    };

    const removeItem = (index) => {
        if (data.items.length > 1) {
            setData('items', data.items.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('part-sales-orders.store'));
    };

    const calculateItemSubtotal = (item) => {
        return item.quantity * item.unit_price;
    };

    const calculateItemDiscount = (item) => {
        const subtotal = calculateItemSubtotal(item);
        if (item.discount_type === 'percent') {
            return subtotal * (item.discount_value / 100);
        } else if (item.discount_type === 'fixed') {
            return item.discount_value;
        }
        return 0;
    };

    const calculateItemTotal = (item) => {
        return calculateItemSubtotal(item) - calculateItemDiscount(item);
    };

    const itemsSubtotal = data.items.reduce((acc, item) => acc + calculateItemTotal(item), 0);

    const transactionDiscount = (() => {
        if (data.discount_type === 'percent') {
            return itemsSubtotal * (data.discount_value / 100);
        } else if (data.discount_type === 'fixed') {
            return data.discount_value;
        }
        return 0;
    })();

    const afterDiscount = itemsSubtotal - transactionDiscount;

    const taxAmount = (() => {
        if (data.tax_type === 'percent') {
            return afterDiscount * (data.tax_value / 100);
        } else if (data.tax_type === 'fixed') {
            return data.tax_value;
        }
        return 0;
    })();

    const grandTotal = afterDiscount + taxAmount;

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value);
    };

    return (
        <>
            <Head title="Create Sales Order" />
            <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                    <Link href={route('part-sales-orders.index')} className="text-slate-600 hover:text-slate-800">
                        <IconArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Create Sales Order</h1>
                        <p className="text-sm text-slate-500">Add a new sales order</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">Customer *</label>
                            <select
                                value={data.customer_id}
                                onChange={(e) => handleChange('customer_id', e.target.value)}
                                className={`w-full h-11 px-4 rounded-xl border ${errors.customer_id ? 'border-red-500' : ''}`}
                            >
                                <option value="">-- Select Customer --</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            {errors.customer_id && <p className="text-sm text-red-500 mt-1">{errors.customer_id}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Order Date *</label>
                            <input
                                type="date"
                                value={data.order_date}
                                onChange={(e) => handleChange('order_date', e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border"
                            />
                            {errors.order_date && <p className="text-sm text-red-500 mt-1">{errors.order_date}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Expected Delivery Date</label>
                            <input
                                type="date"
                                value={data.expected_delivery_date}
                                onChange={(e) => handleChange('expected_delivery_date', e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-2">Notes</label>
                            <textarea
                                value={data.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                placeholder="Add notes..."
                                rows="3"
                                className="w-full px-4 py-2 rounded-xl border"
                            />
                        </div>
                    </div>

                    {/* Items */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">Items</h3>
                            <button
                                type="button"
                                onClick={addItem}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                            >
                                <IconPlus size={16} />
                                <span>Add Item</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {data.items.map((item, idx) => (
                                <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3">
                                    <div className="flex gap-4 items-end">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium mb-1">Part</label>
                                            <select
                                                value={item.part_id}
                                                onChange={(e) => handleItemChange(idx, 'part_id', e.target.value)}
                                                className={`w-full h-11 px-3 rounded-lg border ${errors[`items.${idx}.part_id`] ? 'border-red-500' : ''}`}
                                            >
                                                <option value="">-- Select Part --</option>
                                                {parts.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Qty</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                                className="w-24 h-11 px-3 rounded-lg border"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Price</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={item.unit_price}
                                                onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                                                className="w-32 h-11 px-3 rounded-lg border"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeItem(idx)}
                                            disabled={data.items.length === 1}
                                            className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                        >
                                            <IconX size={18} className="text-red-600" />
                                        </button>
                                    </div>

                                    {/* Item Discount */}
                                    <div className="flex gap-4 items-end border-t border-slate-100 pt-3">
                                        <div className="flex-1">
                                            <label className="block text-sm font-medium mb-1">Tipe Diskon</label>
                                            <select
                                                value={item.discount_type}
                                                onChange={(e) => handleItemChange(idx, 'discount_type', e.target.value)}
                                                className="w-full h-10 px-3 rounded-lg border text-sm"
                                            >
                                                <option value="none">Tidak Ada</option>
                                                <option value="percent">Persen (%)</option>
                                                <option value="fixed">Nilai Tetap</option>
                                            </select>
                                        </div>
                                        {item.discount_type !== 'none' && (
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium mb-1">
                                                    {item.discount_type === 'percent' ? 'Nilai (%)' : 'Nilai (Rp)'}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.discount_value}
                                                    onChange={(e) => handleItemChange(idx, 'discount_value', e.target.value)}
                                                    placeholder={item.discount_type === 'percent' ? '0-100' : '0'}
                                                    className="w-full h-10 px-3 rounded-lg border"
                                                />
                                            </div>
                                        )}
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500">Subtotal: {formatCurrency(calculateItemSubtotal(item))}</div>
                                            {calculateItemDiscount(item) > 0 && (
                                                <div className="text-xs text-red-600">Diskon: -{formatCurrency(calculateItemDiscount(item))}</div>
                                            )}
                                            <div className="text-sm font-semibold">Total: {formatCurrency(calculateItemTotal(item))}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {errors.items && <p className="text-sm text-red-500 mt-2">{errors.items}</p>}

                        {/* Transaction Summary */}
                        {data.items.length > 0 && (
                            <div className="mt-6 bg-slate-50 rounded-xl p-4">
                                <h3 className="font-semibold text-slate-900 mb-3">Ringkasan Transaksi</h3>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Subtotal Items:</span>
                                        <span className="font-medium">{formatCurrency(itemsSubtotal)}</span>
                                    </div>

                                    {/* Transaction Discount */}
                                    <div className="border-t border-slate-200 pt-2">
                                        <div className="flex gap-3 items-end mb-2">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Diskon Transaksi</label>
                                                <select value={data.discount_type} onChange={(e) => handleChange('discount_type', e.target.value)} className="w-full h-10 rounded-lg border px-3 text-sm">
                                                    <option value="none">Tidak Ada</option>
                                                    <option value="percent">Persen (%)</option>
                                                    <option value="fixed">Nilai Tetap</option>
                                                </select>
                                            </div>
                                            {data.discount_type !== 'none' && (
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        {data.discount_type === 'percent' ? 'Nilai (%)' : 'Nilai (Rp)'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={data.discount_value}
                                                        onChange={(e) => handleChange('discount_value', e.target.value)}
                                                        placeholder={data.discount_type === 'percent' ? '0-100' : '0'}
                                                        className="w-full h-10 px-3 rounded-lg border"
                                                    />
                                                </div>
                                            )}
                                            <div className="text-right">
                                                {transactionDiscount > 0 && (
                                                    <span className="text-sm text-red-600 font-medium">-{formatCurrency(transactionDiscount)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Setelah Diskon:</span>
                                        <span className="font-medium">{formatCurrency(afterDiscount)}</span>
                                    </div>

                                    {/* Tax */}
                                    <div className="border-t border-slate-200 pt-2">
                                        <div className="flex gap-3 items-end mb-2">
                                            <div className="flex-1">
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Pajak</label>
                                                <select value={data.tax_type} onChange={(e) => handleChange('tax_type', e.target.value)} className="w-full h-10 rounded-lg border px-3 text-sm">
                                                    <option value="none">Tidak Ada</option>
                                                    <option value="percent">Persen (%)</option>
                                                    <option value="fixed">Nilai Tetap</option>
                                                </select>
                                            </div>
                                            {data.tax_type !== 'none' && (
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        {data.tax_type === 'percent' ? 'Nilai (%)' : 'Nilai (Rp)'}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={data.tax_value}
                                                        onChange={(e) => handleChange('tax_value', e.target.value)}
                                                        placeholder={data.tax_type === 'percent' ? '0-100' : '0'}
                                                        className="w-full h-10 px-3 rounded-lg border"
                                                    />
                                                </div>
                                            )}
                                            <div className="text-right">
                                                {taxAmount > 0 && (
                                                    <span className="text-sm text-green-600 font-medium">+{formatCurrency(taxAmount)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between text-lg font-bold border-t-2 border-slate-300 pt-2">
                                        <span className="text-slate-900">Total Akhir:</span>
                                        <span className="text-primary-600">{formatCurrency(grandTotal)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 justify-end">
                        <Link
                            href={route('part-sales-orders.index')}
                            className="px-6 py-2.5 rounded-xl border hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-6 py-2.5 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
                        >
                            {processing ? 'Saving...' : 'Create Order'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

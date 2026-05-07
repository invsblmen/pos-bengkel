import React from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import { IconArrowLeft, IconPlus, IconX } from '@tabler/icons-react';
import { todayLocalDate } from '@/Utils/datetime';

export default function Create({ suppliers, parts }) {
    const { data, setData, post, errors, processing } = useForm({
        supplier_id: '',
        po_date: todayLocalDate(),
        expected_delivery_date: '',
        notes: '',
        items: [{ part_id: '', quantity: 1, unit_price: 0 }],
    });

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
                newItems[index].unit_price = selectedPart.buy_price || 0;
            }
        }

        setData('items', newItems);
    };

    const addItem = () => {
        setData('items', [...data.items, { part_id: '', quantity: 1, unit_price: 0 }]);
    };

    const removeItem = (index) => {
        if (data.items.length > 1) {
            setData('items', data.items.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('part-purchase-orders.store'));
    };

    return (
        <>
            <Head title="Create Purchase Order" />
            <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                    <Link href={route('part-purchase-orders.index')} className="text-slate-600 hover:text-slate-800">
                        <IconArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Create Purchase Order</h1>
                        <p className="text-sm text-slate-500">Create a new PO to supplier</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-medium mb-2">Supplier *</label>
                            <select
                                value={data.supplier_id}
                                onChange={(e) => handleChange('supplier_id', e.target.value)}
                                className={`w-full h-11 px-4 rounded-xl border ${errors.supplier_id ? 'border-red-500' : ''}`}
                            >
                                <option value="">-- Select Supplier --</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            {errors.supplier_id && <p className="text-sm text-red-500 mt-1">{errors.supplier_id}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">PO Date *</label>
                            <input
                                type="date"
                                value={data.po_date}
                                onChange={(e) => handleChange('po_date', e.target.value)}
                                className="w-full h-11 px-4 rounded-xl border"
                            />
                            {errors.po_date && <p className="text-sm text-red-500 mt-1">{errors.po_date}</p>}
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
                                <div key={idx} className="flex gap-4 items-end">
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
                            ))}
                        </div>
                        {errors.items && <p className="text-sm text-red-500 mt-2">{errors.items}</p>}
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 justify-end">
                        <Link
                            href={route('part-purchase-orders.index')}
                            className="px-6 py-2.5 rounded-xl border hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-6 py-2.5 rounded-xl bg-primary-500 text-white hover:bg-primary-600 transition-colors disabled:opacity-50"
                        >
                            {processing ? 'Saving...' : 'Create PO'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

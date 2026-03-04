import React, { useState, useEffect } from 'react';
import { IconPlus, IconTools, IconTrash, IconEdit, IconX } from '@tabler/icons-react';
import Autocomplete from '@/Components/Dashboard/Autocomplete';
import DiscountModeToggle from '@/Components/ServiceOrder/DiscountModeToggle';
import toast from 'react-hot-toast';

const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const getPartStock = (part) => {
    return part.stock ?? part.qty ?? 0;
};

export default function ServiceGrid({
    services,
    parts,
    onAddServiceWithParts,
    onQuickCreatePart,
    onEditItem,
    editingItemIndex = null,
    editingItem = null
}) {
    const [selectedService, setSelectedService] = useState(null);
    const [serviceParts, setServiceParts] = useState([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [serviceDiscount, setServiceDiscount] = useState({ type: 'none', value: 0 });
    const [serviceDiscountMode, setServiceDiscountMode] = useState('nominal'); // 'nominal' or 'percent'

    // Load editing item data into form
    useEffect(() => {
        if (editingItem) {
            const service = services.find(s => s.id === parseInt(editingItem.service_id));
            setSelectedService(service || null);
            setServiceDiscountMode(editingItem.service_discount_type || 'nominal');
            setServiceDiscount({
                type: editingItem.service_discount_type || 'none',
                value: editingItem.service_discount_value || 0
            });
            // Map parts from data structure (discount_type) to ServiceGrid structure (discount_mode)
            const mappedParts = (editingItem.parts || []).map(p => ({
                part_id: p.part_id,
                qty: p.qty || 1,
                price: p.price || 0,
                discount_mode: p.discount_type || 'nominal',
                discount_value: p.discount_value || 0
            }));
            setServiceParts(mappedParts);
            setIsEditMode(true);
        }
    }, [editingItem, services]);

    const handleServiceSelect = (service) => {
        setSelectedService(service);
        setServiceParts([]);
        setServiceDiscount({ type: 'none', value: 0 });
        setServiceDiscountMode('nominal');
    };

    const handleAddPart = () => {
        setServiceParts([...serviceParts, {
            part_id: '',
            qty: 1,
            price: 0,
            discount_type: 'none',
            discount_value: 0,
            discount_mode: 'nominal'
        }]);
    };

    const handleRemovePart = (index) => {
        setServiceParts(serviceParts.filter((_, i) => i !== index));
    };

    const handlePartChange = (index, field, value) => {
        const newParts = [...serviceParts];
        if (field === 'part_id') {
            const part = parts.find((p) => p.id === parseInt(value));
            if (!part || getPartStock(part) === 0) {
                return;
            }
            if (part) {
                newParts[index].part_id = value;
                newParts[index].price = part.sell_price;
            }
        } else {
            newParts[index][field] = field === 'qty' ? parseInt(value) || 1 : parseFloat(value) || 0;
        }
        setServiceParts(newParts);
    };

    const handlePartDiscountChange = (index, field, value) => {
        const newParts = [...serviceParts];
        newParts[index][field] = field.includes('value') ? parseFloat(value) || 0 : value;
        setServiceParts(newParts);
    };

    const handleAddToOrder = () => {
        if (!selectedService) {
            toast.error('Pilih layanan terlebih dahulu');
            return;
        }

        const itemData = {
            service_id: selectedService.id,
            service_discount_type: serviceDiscountMode === 'nominal' ? 'fixed' : serviceDiscountMode,
            service_discount_value: serviceDiscount.value,
            parts: serviceParts.map(p => ({
                part_id: p.part_id,
                qty: p.qty,
                price: p.price,
                discount_type: p.discount_mode === 'nominal' ? 'fixed' : p.discount_mode,
                discount_value: p.discount_value
            }))
        };

        onAddServiceWithParts(itemData);
        setSelectedService(null);
        setServiceParts([]);
        setServiceDiscount({ type: 'none', value: 0 });
        setServiceDiscountMode('nominal');
        setIsEditMode(false);
        toast.success(editingItem ? 'Item diperbarui' : 'Layanan ditambahkan');
    };

    const handleCancelEdit = () => {
        setSelectedService(null);
        setServiceParts([]);
        setServiceDiscount({ type: 'none', value: 0 });
        setServiceDiscountMode('nominal');
        setIsEditMode(false);
        onEditItem(null);
    };

    // Calculate service subtotal
    const servicePrice = selectedService?.price || 0;
    const serviceDiscountAmount = serviceDiscountMode === 'percent'
        ? servicePrice * (serviceDiscount.value / 100)
        : serviceDiscount.value;
    const servicePriceAfterDiscount = Math.max(0, servicePrice - serviceDiscountAmount);

    // Calculate parts subtotal
    const partsSubtotal = serviceParts.reduce((sum, part) => {
        const partPrice = parseFloat(part.price) || 0;
        const partQty = parseInt(part.qty) || 1;
        const partDiscountAmount = part.discount_mode === 'percent'
            ? (partPrice * partQty) * (part.discount_value / 100)
            : part.discount_value;
        return sum + Math.max(0, (partPrice * partQty) - partDiscountAmount);
    }, 0);

    const totalBeforeDiscount = servicePriceAfterDiscount + partsSubtotal;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingItemIndex !== null ? 'Edit Pesanan' : 'Buat Pesanan Service'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Pilih layanan dan tambahkan sparepart
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Service Selection */}
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                    <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-3">
                        Pilih Layanan Service
                    </label>
                    <Autocomplete
                        value={selectedService?.id || ''}
                        onChange={(serviceId) => {
                            const service = services.find(s => s.id === parseInt(serviceId));
                            handleServiceSelect(service);
                        }}
                        options={services}
                        displayField={(s) => `${s.title} - ${formatCurrency(s.price)}`}
                        searchFields={['title', 'description']}
                        placeholder="Cari layanan..."
                    />

                    {selectedService && (
                        <div className="mt-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
                                    <IconTools size={20} className="text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {selectedService.title}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                                        {selectedService.description}
                                    </p>
                                    <p className="text-sm font-bold text-primary-600 dark:text-primary-400 mt-2">
                                        {formatCurrency(selectedService.price)}
                                    </p>
                                </div>
                            </div>

                            {/* Service Discount */}
                            <div className="mt-4 pt-4 border-t border-primary-200 dark:border-primary-800">
                                <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-3">
                                    Diskon Layanan
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        min="0"
                                        value={serviceDiscount.value || 0}
                                        onChange={(e) => setServiceDiscount({ ...serviceDiscount, value: parseFloat(e.target.value) || 0 })}
                                        placeholder="0"
                                        className="flex-1 h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                    />
                                    <DiscountModeToggle
                                        mode={serviceDiscountMode}
                                        onChange={setServiceDiscountMode}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Parts Section */}
                {selectedService && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                                Sparepart (Opsional)
                            </label>
                            <button
                                type="button"
                                onClick={handleAddPart}
                                className="inline-flex items-center gap-1 rounded-lg bg-primary-100 px-3 py-1.5 text-xs font-medium text-primary-700 transition hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-300"
                            >
                                <IconPlus size={14} />
                                Tambah Part
                            </button>
                        </div>

                        {serviceParts.length > 0 ? (
                            <div className="space-y-4">
                                {serviceParts.map((part, index) => {
                                    const selectedPart = parts.find(p => p.id === parseInt(part.part_id));
                                    const partPrice = parseFloat(part.price) || 0;
                                    const partQty = parseInt(part.qty) || 1;
                                    const partDiscountAmount = part.discount_mode === 'percent'
                                        ? (partPrice * partQty) * (part.discount_value / 100)
                                        : part.discount_value;
                                    const partTotal = Math.max(0, (partPrice * partQty) - partDiscountAmount);

                                    return (
                                        <div
                                            key={index}
                                            className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800 space-y-3"
                                        >
                                            {/* Part Selection Row */}
                                            <div className="grid gap-2 md:grid-cols-12">
                                                <div className="md:col-span-6">
                                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                        Part
                                                    </label>
                                                    <Autocomplete
                                                        value={part.part_id}
                                                        onChange={(partId) => handlePartChange(index, 'part_id', partId)}
                                                        options={parts}
                                                        displayField={(p) => `${p.name} - ${formatCurrency(p.sell_price)}`}
                                                        searchFields={['name', 'part_number']}
                                                        placeholder="Pilih part..."
                                                        onCreateNew={() => onQuickCreatePart(index)}
                                                        createLabel="Tambah Part"
                                                        getOptionDisabled={(p) => getPartStock(p) === 0}
                                                        renderOption={(p, isDisabled) => {
                                                            const stock = getPartStock(p);
                                                            return (
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className={isDisabled ? 'text-gray-400 dark:text-gray-500' : ''}>
                                                                        {p.name} - {formatCurrency(p.sell_price)}
                                                                    </span>
                                                                    {stock === 0 && (
                                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                                            Stok Habis
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        }}
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                        Qty
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={part.qty}
                                                            onChange={(e) => handlePartChange(index, 'qty', e.target.value)}
                                                            className="block w-full h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                                        />
                                                        {part.part_id && (
                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400">
                                                                {(() => {
                                                                    const selectedPart = parts.find(p => p.id === parseInt(part.part_id));
                                                                    return selectedPart ? `(${getPartStock(selectedPart)} ada)` : '';
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                                        Harga
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={part.price || 0}
                                                        onChange={(e) => handlePartChange(index, 'price', e.target.value)}
                                                        className="block w-full h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                                    />
                                                </div>
                                                <div className="flex items-end md:col-span-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePart(index)}
                                                        className="w-full h-10 rounded-lg bg-red-100 text-red-700 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 flex items-center justify-center"
                                                    >
                                                        <IconTrash size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Part Discount */}
                                            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                                                <label className="block text-xs font-semibold text-slate-900 dark:text-white mb-2">
                                                    Diskon Part
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <div className="inline-flex h-9 rounded-lg border-2 border-slate-300 dark:border-slate-700 overflow-hidden">
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePartDiscountChange(index, 'discount_mode', 'percent')}
                                                            className={`px-2 text-[10px] font-bold transition-all ${
                                                                (part.discount_mode || 'nominal') === 'percent'
                                                                    ? 'bg-purple-600 text-white'
                                                                    : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            %
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePartDiscountChange(index, 'discount_mode', 'nominal')}
                                                            className={`px-2 text-[10px] font-bold transition-all ${
                                                                (part.discount_mode || 'nominal') === 'nominal'
                                                                    ? 'bg-emerald-600 text-white'
                                                                    : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            Rp
                                                        </button>
                                                    </div>
                                                    <div className="relative flex-1">
                                                        {(part.discount_mode || 'nominal') === 'nominal' && (
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">Rp</span>
                                                        )}
                                                        {(part.discount_mode || 'nominal') === 'percent' && (
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">%</span>
                                                        )}
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={part.discount_value || 0}
                                                            onChange={(e) => handlePartDiscountChange(index, 'discount_value', e.target.value)}
                                                            placeholder="0"
                                                            className={`w-full h-9 rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-right ${(part.discount_mode || 'nominal') === 'nominal' ? 'pl-6 pr-2' : 'px-2 pr-6'}`}
                                                        />
                                                    </div>
                                                </div>
                                                {part.part_id && (
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                                                        Subtotal: {formatCurrency(partPrice * partQty)} → {formatCurrency(partTotal)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-3">
                                Tidak ada sparepart. Klik "Tambah Part" untuk menambahkan.
                            </p>
                        )}
                    </div>
                )}

                {/* Summary */}
                {selectedService && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Harga Layanan</span>
                            <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(servicePrice)}</span>
                        </div>
                        {serviceDiscount.value > 0 && (
                            <div className="flex items-center justify-between text-sm text-red-600 dark:text-red-400">
                                <span>Diskon {serviceDiscountMode === 'percent' ? '(%)' : '(Rp)'}</span>
                                <span>-{formatCurrency(serviceDiscountAmount)}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Harga Part</span>
                            <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(partsSubtotal)}</span>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex items-center justify-between">
                            <span className="font-semibold text-slate-900 dark:text-white">Total</span>
                            <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{formatCurrency(totalBeforeDiscount)}</span>
                        </div>
                    </div>
                )}

                {/* Add to Order Button */}
                {selectedService && (
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={handleAddToOrder}
                            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold shadow-lg shadow-primary-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            <IconPlus size={18} />
                            {editingItemIndex !== null ? 'Simpan Perubahan' : 'Tambahkan ke Pesanan'}
                        </button>
                        {editingItemIndex !== null && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="flex-1 h-12 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold transition-all flex items-center justify-center gap-2 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white"
                            >
                                <IconX size={18} />
                                Batal
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

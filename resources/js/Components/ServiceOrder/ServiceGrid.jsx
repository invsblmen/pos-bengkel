import React, { useState, useEffect } from 'react';
import { IconInfoCircle, IconPlus, IconTools, IconTrash, IconX } from '@tabler/icons-react';
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
    const [partDraft, setPartDraft] = useState({
        part_id: '',
        qty: 1,
        price: 0,
        discount_mode: 'nominal',
        discount_value: 0
    });

    // Load editing item data into form

    const focusDraftField = (field) => {
        setTimeout(() => {
            const el = document.querySelector(`[data-part-draft-field="${field}"]`);
            if (el) el.focus();
        }, 0);
    };

    const handleDraftInputEnter = (e, field) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();

        if (field === 'qty') {
            focusDraftField('price');
            return;
        }

        if (field === 'price') {
            focusDraftField('discount_value');
            return;
        }

        if (field === 'discount_value' && partDraft.part_id) {
            handleAddPart(partDraft);
        }
    };
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
        setPartDraft({ part_id: '', qty: 1, price: 0, discount_mode: 'nominal', discount_value: 0 });
    };

    const handleAddPart = (inputPart = partDraft) => {
        if (!inputPart?.part_id) {
            toast.error('Pilih sparepart terlebih dahulu');
            return;
        }

        const exists = serviceParts.some((p) => parseInt(p.part_id) === parseInt(inputPart.part_id));
        if (exists) {
            toast.error('Sparepart sudah ditambahkan');
            return;
        }

        if ((Number(inputPart.qty) || 0) < 1) {
            toast.error('Qty minimal 1');
            return;
        }

        const selectedPart = parts.find((p) => p.id === parseInt(inputPart.part_id));
        const defaultPrice = selectedPart?.sell_price || 0;

        setServiceParts([
            ...serviceParts,
            {
                part_id: inputPart.part_id,
                qty: Number(inputPart.qty) || 1,
                price: Number(inputPart.price) || defaultPrice,
                discount_mode: inputPart.discount_mode || 'nominal',
                discount_value: Number(inputPart.discount_value) || 0
            }
        ]);

        setPartDraft({ part_id: '', qty: 1, price: 0, discount_mode: 'nominal', discount_value: 0 });
        focusDraftField('qty');
    };

    const handleRemovePart = (index) => {
        setServiceParts(serviceParts.filter((_, i) => i !== index));
    };

    const handlePartChange = (index, field, value) => {
        const newParts = [...serviceParts];
        newParts[index][field] = field === 'qty' ? parseInt(value) || 1 : parseFloat(value) || 0;
        setServiceParts(newParts);
    };

    const handleDraftPartSelect = (partId) => {
        const selectedPart = parts.find((p) => p.id === parseInt(partId));
        if (!selectedPart || getPartStock(selectedPart) === 0) return;

        setPartDraft((prev) => ({
            ...prev,
            part_id: partId,
            price: selectedPart.sell_price || 0
        }));
        focusDraftField('qty');
    };

    const handlePartDiscountChange = (index, field, value) => {
        const newParts = [...serviceParts];
        newParts[index][field] = field.includes('value') ? parseFloat(value) || 0 : value;
        setServiceParts(newParts);
    };

    const focusPartField = (index, field) => {
        setTimeout(() => {
            const el = document.querySelector(`[data-part-index="${index}"][data-part-field="${field}"]`);
            if (el) el.focus();
        }, 0);
    };

    const handlePartInputEnter = (e, index, field) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();

        if (field === 'qty') {
            focusPartField(index, 'price');
            return;
        }

        if (field === 'price') {
            focusPartField(index, 'discount_value');
            return;
        }

        if (field === 'discount_value') {
            const nextIndex = index + 1;
            if (nextIndex < serviceParts.length) {
                focusPartField(nextIndex, 'qty');
                return;
            }

            const draftQty = document.querySelector('[data-part-draft-field="qty"]');
            if (draftQty) draftQty.focus();
        }
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
        setPartDraft({ part_id: '', qty: 1, price: 0, discount_mode: 'nominal', discount_value: 0 });
        setIsEditMode(false);
        toast.success(editingItem ? 'Item diperbarui' : 'Layanan ditambahkan');
    };

    const handleCancelEdit = () => {
        setSelectedService(null);
        setServiceParts([]);
        setServiceDiscount({ type: 'none', value: 0 });
        setServiceDiscountMode('nominal');
        setPartDraft({ part_id: '', qty: 1, price: 0, discount_mode: 'nominal', discount_value: 0 });
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
                        <div className="mt-3 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 dark:border-primary-800 dark:bg-primary-900/20">
                            <div className="flex items-start gap-2.5">
                                <div className="h-9 w-9 flex-shrink-0 rounded-lg bg-primary-500 flex items-center justify-center">
                                    <IconTools size={18} className="text-white" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {selectedService.title}
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                        {selectedService.description}
                                    </p>
                                    <p className="mt-1.5 text-sm font-bold text-primary-600 dark:text-primary-400">
                                        {formatCurrency(selectedService.price)}
                                    </p>
                                </div>
                            </div>

                            {/* Service Discount */}
                            <div className="mt-3 border-t border-primary-200 pt-3 dark:border-primary-800">
                                <label className="mb-2 block text-[11px] font-semibold text-slate-900 dark:text-white">
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
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/60 p-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                                    Sparepart (Opsional)
                                </label>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                    Tambahkan part jika diperlukan untuk layanan ini.
                                </p>
                            </div>
                        </div>

                        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                            <div className="grid items-end gap-2.5 lg:grid-cols-12">
                                <div className="lg:col-span-5">
                                    <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">Pilih Sparepart</label>
                                    <Autocomplete
                                        value={partDraft.part_id}
                                        onChange={handleDraftPartSelect}
                                        options={parts}
                                        displayField={(p) => `${p.name} - ${formatCurrency(p.sell_price)}`}
                                        searchFields={['name', 'part_number']}
                                        placeholder="Cari sparepart..."
                                        onCreateNew={() => onQuickCreatePart?.(null)}
                                        createLabel="Tambah Part"
                                        inputClassName="h-10 rounded-lg px-3 py-0 pr-20 text-base shadow-none focus:border-primary-500 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                        getOptionDisabled={(p) => getPartStock(p) === 0}
                                        renderOption={(p, isDisabled) => {
                                            const stock = getPartStock(p);
                                            return (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={isDisabled ? 'text-gray-400 dark:text-gray-500' : ''}>
                                                        {p.name} - {formatCurrency(p.sell_price)}
                                                    </span>
                                                    {stock === 0 && (
                                                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                            Stok Habis
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }}
                                    />
                                </div>

                                <div className="lg:col-span-1">
                                    <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">Qty</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={partDraft.qty}
                                        onChange={(e) => setPartDraft((prev) => ({ ...prev, qty: parseInt(e.target.value) || 1 }))}
                                        onKeyDown={(e) => handleDraftInputEnter(e, 'qty')}
                                        data-part-draft-field="qty"
                                        className="block h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-center text-sm tabular-nums text-slate-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                    />
                                </div>

                                <div className="lg:col-span-2">
                                    <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">Harga</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={partDraft.price}
                                        onChange={(e) => setPartDraft((prev) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                                        onKeyDown={(e) => handleDraftInputEnter(e, 'price')}
                                        data-part-draft-field="price"
                                        className="block h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-right text-sm tabular-nums text-slate-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                    />
                                </div>

                                <div className="lg:col-span-3">
                                    <label className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">Diskon</label>
                                    <div className="flex items-center gap-1.5">
                                        <div className="inline-flex h-10 min-w-[70px] shrink-0 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
                                            <button
                                                type="button"
                                                onClick={() => setPartDraft((prev) => ({ ...prev, discount_mode: 'percent' }))}
                                                className={`inline-flex w-8 items-center justify-center text-[11px] font-bold transition-all ${partDraft.discount_mode === 'percent'
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                }`}
                                            >
                                                %
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPartDraft((prev) => ({ ...prev, discount_mode: 'nominal' }))}
                                                className={`inline-flex min-w-[38px] flex-1 items-center justify-center text-[11px] font-bold transition-all ${partDraft.discount_mode === 'nominal'
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                                }`}
                                            >
                                                Rp
                                            </button>
                                        </div>
                                        <div className="relative flex-1">
                                            {partDraft.discount_mode === 'nominal' && (
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">Rp</span>
                                            )}
                                            {partDraft.discount_mode === 'percent' && (
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">%</span>
                                            )}
                                            <input
                                                type="number"
                                                min="0"
                                                value={partDraft.discount_value}
                                                onChange={(e) => setPartDraft((prev) => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
                                                onKeyDown={(e) => handleDraftInputEnter(e, 'discount_value')}
                                                data-part-draft-field="discount_value"
                                                className={`h-10 w-full rounded-lg border border-slate-300 text-xs font-semibold tabular-nums text-right focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${partDraft.discount_mode === 'nominal' ? 'pl-6 pr-2' : 'px-2 pr-6'}`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-1">
                                    <button
                                        type="button"
                                        onClick={() => handleAddPart(partDraft)}
                                        disabled={!partDraft.part_id}
                                        className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-lg bg-primary-600 px-2.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <IconPlus size={14} />
                                        Tambah
                                    </button>
                                </div>
                            </div>
                        </div>

                        {serviceParts.length > 0 ? (
                            <>
                                <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                                    <table className="w-full table-fixed text-sm border-separate border-spacing-y-1.5 px-1">
                                        <thead>
                                            <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                <th className="px-2.5 py-2 text-left font-semibold w-[32%]">Sparepart</th>
                                                <th className="px-1.5 py-2 text-center font-semibold w-[9%]">Qty</th>
                                                <th className="px-1.5 py-2 text-right font-semibold w-[16%]">Harga</th>
                                                <th className="px-1.5 py-2 text-left font-semibold w-[25%]">Diskon</th>
                                                <th className="px-1.5 py-2 text-right font-semibold w-[12%]">Total</th>
                                                <th className="px-1.5 py-2 text-center font-semibold w-[6%]">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {serviceParts.map((part, index) => {
                                                const selectedPart = parts.find((p) => p.id === parseInt(part.part_id));
                                                const selectedPartStock = selectedPart ? getPartStock(selectedPart) : null;
                                                const selectedPartName = selectedPart?.name || `Part #${part.part_id}`;
                                                const partPrice = parseFloat(part.price) || 0;
                                                const partQty = parseInt(part.qty) || 1;
                                                const partDiscountAmount = part.discount_mode === 'percent'
                                                    ? (partPrice * partQty) * (part.discount_value / 100)
                                                    : part.discount_value;
                                                const partTotal = Math.max(0, (partPrice * partQty) - partDiscountAmount);

                                                return (
                                                    <tr key={index} className="align-middle bg-slate-50 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-800/40 dark:ring-slate-700/70">
                                                        <td className="px-2.5 py-2 rounded-l-lg">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="truncate font-semibold text-slate-800 dark:text-slate-100" title={selectedPartName}>{selectedPartName}</div>
                                                                {selectedPartStock !== null && (
                                                                    <span
                                                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                                                        title={`Stok tersedia: ${selectedPartStock}`}
                                                                    >
                                                                        <IconInfoCircle size={12} />
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-1.5 py-2">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={part.qty}
                                                                onChange={(e) => handlePartChange(index, 'qty', e.target.value)}
                                                                onKeyDown={(e) => handlePartInputEnter(e, index, 'qty')}
                                                                data-part-index={index}
                                                                data-part-field="qty"
                                                                className="block h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-center text-sm tabular-nums text-slate-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                                            />
                                                        </td>
                                                        <td className="px-1.5 py-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={part.price || 0}
                                                                onChange={(e) => handlePartChange(index, 'price', e.target.value)}
                                                                onKeyDown={(e) => handlePartInputEnter(e, index, 'price')}
                                                                data-part-index={index}
                                                                data-part-field="price"
                                                                className="block h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-right text-sm tabular-nums text-slate-900 transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                                            />
                                                        </td>
                                                        <td className="px-1.5 py-2 align-middle">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="inline-flex h-9 min-w-[70px] shrink-0 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handlePartDiscountChange(index, 'discount_mode', 'percent')}
                                                                        className={`inline-flex w-8 items-center justify-center text-[11px] font-bold transition-all ${(part.discount_mode || 'nominal') === 'percent' ? 'bg-primary-600 text-white' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                                                                    >
                                                                        %
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handlePartDiscountChange(index, 'discount_mode', 'nominal')}
                                                                        className={`inline-flex min-w-[38px] flex-1 items-center justify-center text-[11px] font-bold transition-all ${(part.discount_mode || 'nominal') === 'nominal' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                                                                    >
                                                                        Rp
                                                                    </button>
                                                                </div>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={part.discount_value || 0}
                                                                    onChange={(e) => handlePartDiscountChange(index, 'discount_value', e.target.value)}
                                                                    onKeyDown={(e) => handlePartInputEnter(e, index, 'discount_value')}
                                                                    data-part-index={index}
                                                                    data-part-field="discount_value"
                                                                    placeholder={(part.discount_mode || 'nominal') === 'percent' ? '0-100' : '0'}
                                                                    className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs font-semibold tabular-nums text-right focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                                                />
                                                            </div>
                                                            {partDiscountAmount > 0 && (
                                                                <div className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">Diskon: -{formatCurrency(partDiscountAmount)}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-1.5 py-2 text-right align-middle">
                                                            <div className="inline-flex h-9 min-w-[94px] items-center justify-end rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-bold tabular-nums text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                                                                {formatCurrency(partTotal)}
                                                            </div>
                                                        </td>
                                                        <td className="px-1.5 py-2 text-center align-middle rounded-r-lg">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemovePart(index)}
                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
                                                                title="Hapus part"
                                                            >
                                                                <IconTrash size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="space-y-2 lg:hidden">
                                    {serviceParts.map((part, index) => {
                                        const selectedPart = parts.find((p) => p.id === parseInt(part.part_id));
                                        const selectedPartStock = selectedPart ? getPartStock(selectedPart) : null;
                                        const selectedPartName = selectedPart?.name || `Part #${part.part_id}`;
                                        const partPrice = parseFloat(part.price) || 0;
                                        const partQty = parseInt(part.qty) || 1;
                                        const partDiscountAmount = part.discount_mode === 'percent'
                                            ? (partPrice * partQty) * (part.discount_value / 100)
                                            : part.discount_value;
                                        const partTotal = Math.max(0, (partPrice * partQty) - partDiscountAmount);

                                        return (
                                            <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{selectedPartName}</p>
                                                        {selectedPartStock !== null && (
                                                            <span
                                                                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                                                title={`Stok tersedia: ${selectedPartStock}`}
                                                            >
                                                                <IconInfoCircle size={12} />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemovePart(index)}
                                                        className="inline-flex h-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2 text-red-600 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-400"
                                                        title="Hapus part"
                                                    >
                                                        <IconTrash size={14} />
                                                    </button>
                                                </div>

                                                <div className="mt-2 grid grid-cols-2 gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={part.qty}
                                                        onChange={(e) => handlePartChange(index, 'qty', e.target.value)}
                                                        onKeyDown={(e) => handlePartInputEnter(e, index, 'qty')}
                                                        data-part-index={index}
                                                        data-part-field="qty"
                                                        className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-center text-sm tabular-nums dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={part.price || 0}
                                                        onChange={(e) => handlePartChange(index, 'price', e.target.value)}
                                                        onKeyDown={(e) => handlePartInputEnter(e, index, 'price')}
                                                        data-part-index={index}
                                                        data-part-field="price"
                                                        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-right text-sm tabular-nums dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                                    />
                                                </div>

                                                <div className="mt-2 flex items-center gap-1.5">
                                                    <div className="inline-flex h-9 min-w-[70px] shrink-0 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePartDiscountChange(index, 'discount_mode', 'percent')}
                                                            className={`inline-flex w-8 items-center justify-center text-[11px] font-bold ${(part.discount_mode || 'nominal') === 'percent' ? 'bg-primary-600 text-white' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                                                        >
                                                            %
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePartDiscountChange(index, 'discount_mode', 'nominal')}
                                                            className={`inline-flex min-w-[38px] flex-1 items-center justify-center text-[11px] font-bold ${(part.discount_mode || 'nominal') === 'nominal' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                                                        >
                                                            Rp
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={part.discount_value || 0}
                                                        onChange={(e) => handlePartDiscountChange(index, 'discount_value', e.target.value)}
                                                        onKeyDown={(e) => handlePartInputEnter(e, index, 'discount_value')}
                                                        data-part-index={index}
                                                        data-part-field="discount_value"
                                                        className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-right text-xs tabular-nums dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                                    />
                                                </div>

                                                <div className="mt-2 flex items-center justify-between text-xs">
                                                    <span className="text-slate-500 dark:text-slate-400">
                                                        {partDiscountAmount > 0 ? `Diskon: -${formatCurrency(partDiscountAmount)}` : 'Tanpa diskon'}
                                                    </span>
                                                    <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(partTotal)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <p className="rounded-lg border border-dashed border-slate-300 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                Belum ada sparepart. Gunakan form input di atas untuk menambahkan.
                            </p>
                        )}
                    </div>
                )}

                {/* Summary */}
                {selectedService && (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Harga Layanan</span>
                            <span className="font-medium tabular-nums text-slate-900 dark:text-white">{formatCurrency(servicePrice)}</span>
                        </div>
                        {serviceDiscount.value > 0 && (
                            <div className="flex items-center justify-between text-sm text-red-600 dark:text-red-400">
                                <span>Diskon {serviceDiscountMode === 'percent' ? '(%)' : '(Rp)'}</span>
                                <span className="tabular-nums">-{formatCurrency(serviceDiscountAmount)}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-400">Harga Part</span>
                            <span className="font-medium tabular-nums text-slate-900 dark:text-white">{formatCurrency(partsSubtotal)}</span>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex items-center justify-between">
                            <span className="font-semibold text-slate-900 dark:text-white">Total</span>
                            <span className="text-lg font-bold tabular-nums text-primary-600 dark:text-primary-400">{formatCurrency(totalBeforeDiscount)}</span>
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

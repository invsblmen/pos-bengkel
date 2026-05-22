import React, { useMemo, useState } from 'react';
import { IconX } from '@tabler/icons-react';

export default function VoucherInput({ value = '', onChange, availableVouchers = [], itemsSubtotal = 0, transactionDiscount = 0, taxAmount = 0, errors = null }) {
    const [query, setQuery] = useState(value || '');
    const [isFocused, setIsFocused] = useState(false);
    const normalized = (s) => (s || '').toString().trim().toUpperCase();

    const suggestions = useMemo(() => {
        const q = normalized(query);
        if (!q) return availableVouchers.slice(0, 6);
        return availableVouchers.filter(v => v.code?.toUpperCase().includes(q) || (v.name || '').toUpperCase().includes(q)).slice(0, 8);
    }, [availableVouchers, query]);

    const selectedVoucher = useMemo(() => {
        const code = normalized(value || query);
        return availableVouchers.find(v => (v.code || '').toUpperCase() === code) || null;
    }, [availableVouchers, value, query]);

    const preview = useMemo(() => {
        if (!selectedVoucher) return null;
        const subtotal = Math.max(0, Number(itemsSubtotal || 0));
        const type = selectedVoucher.discount_type || 'percent';
        const val = Number(selectedVoucher.discount_value || 0);
        let discount = 0;
        if (type === 'percent') {
            discount = Math.round((subtotal * val) / 100);
        } else if (type === 'fixed') {
            discount = Math.round(val);
        }
        if (selectedVoucher.max_discount) {
            discount = Math.min(discount, Number(selectedVoucher.max_discount || 0));
        }
        const afterVoucher = Math.max(0, subtotal - discount - transactionDiscount + Number(taxAmount || 0));
        return { discount, afterVoucher };
    }, [selectedVoucher, itemsSubtotal, transactionDiscount, taxAmount]);

    const apply = (code) => {
        const newCode = normalized(code);
        setQuery(newCode);
        onChange?.(newCode);
    };

    return (
        <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">Kode Voucher</label>
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value.toUpperCase()); onChange?.(e.target.value.toUpperCase()); }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder="Contoh: RAMADAN2026"
                    className="w-full h-9 px-3 text-xs rounded-lg border-2 border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    aria-autocomplete="list"
                />
                {isFocused && suggestions.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-48 overflow-auto">
                        {suggestions.map(v => (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => apply(v.code)}
                                className="text-left w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="font-semibold text-sm">{v.code} — {v.name}</div>
                                        <div className="text-xs text-slate-500">{v.scope || '-'} • {v.starts_at ? new Date(v.starts_at).toLocaleDateString() : '-'} → {v.ends_at ? new Date(v.ends_at).toLocaleDateString() : '-'}</div>
                                    </div>
                                    <div className="text-sm font-bold text-emerald-600">{v.discount_type === 'percent' ? `${v.discount_value}%` : `Rp ${Number(v.discount_value || 0).toLocaleString()}`}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {errors && <p className="mt-1 text-xs text-red-600">{errors}</p>}

            {selectedVoucher && preview && (
                <div className="mt-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold">{selectedVoucher.name} <span className="text-xs text-slate-500">({selectedVoucher.code})</span></div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Perkiraan potongan: <span className="font-semibold">Rp {preview.discount.toLocaleString()}</span></div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-500">Subtotal</div>
                            <div className="font-bold">Rp {Number(itemsSubtotal || 0).toLocaleString()}</div>
                        </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                        <button type="button" onClick={() => { setQuery(''); onChange?.(''); }} className="px-3 py-1 text-sm bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center gap-1">
                            <IconX size={16} /> Batal
                        </button>
                        <button type="button" onClick={() => apply(selectedVoucher.code)} className="px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Pakai voucher</button>
                    </div>
                </div>
            )}
        </div>
    );
}

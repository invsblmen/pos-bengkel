import React, { useEffect, useMemo, useState } from 'react';
import { IconAdjustmentsHorizontal, IconCash, IconCheck, IconCreditCard, IconMinus, IconPlus, IconReceipt, IconRefresh, IconX } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import Modal from '@/Components/Dashboard/Modal';

const nonCashMethods = [
    { value: 'qris', label: 'QRIS' },
    { value: 'transfer_bni', label: 'Transfer BNI' },
    { value: 'transfer_bca', label: 'Transfer BCA' },
    { value: 'transfer_bri', label: 'Transfer BRI' },
    { value: 'edc_bri', label: 'EDC BRI' },
];

const moneyFormat = (value = 0) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

const toInt = (value) => Number.parseInt(value || 0, 10) || 0;
const MANUAL_ROUNDING_DENOMINATION = 500;

const roundDownToDenomination = (amount = 0, denomination = MANUAL_ROUNDING_DENOMINATION) => {
    const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
    const safeDenomination = Math.max(1, Number(denomination) || MANUAL_ROUNDING_DENOMINATION);

    return Math.floor(safeAmount / safeDenomination) * safeDenomination;
};

export default function PaymentReceiptModal({
    show = false,
    onClose = () => {},
    onConfirm = () => {},
    totalAmount = 0,
    cashDenominations = [],
    initialPayment = {},
    formatCurrency = moneyFormat,
}) {
    const [paymentMethod, setPaymentMethod] = useState(initialPayment.payment_method || 'cash');
    const [transferDestination, setTransferDestination] = useState(initialPayment.transfer_destination || '');
    const [nonCashAmount, setNonCashAmount] = useState(Number(initialPayment.non_cash_amount || 0));
    const [cashQuantities, setCashQuantities] = useState({});
    const [cashSuggestion, setCashSuggestion] = useState(null);
    const [suggestionAccepted, setSuggestionAccepted] = useState(false);
    const [manualRoundingEnabled, setManualRoundingEnabled] = useState(false);
    const [cashNote, setCashNote] = useState('');
    const [loadingSuggestion, setLoadingSuggestion] = useState(false);

    const denominationList = useMemo(() => {
        return [...(cashDenominations || [])].sort((left, right) => Number(right.value) - Number(left.value));
    }, [cashDenominations]);

    useEffect(() => {
        if (!show) return;

        const meta = initialPayment.payment_meta || {};
        const breakdown = Array.isArray(meta.cash_breakdown) ? meta.cash_breakdown : [];
        const nextQuantities = {};

        denominationList.forEach((denomination) => {
            const match = breakdown.find((item) => Number(item.denomination_id) === Number(denomination.id));
            nextQuantities[denomination.id] = Number(match?.quantity || 0);
        });

        setPaymentMethod(initialPayment.payment_method || 'cash');
        setTransferDestination(initialPayment.transfer_destination || meta.non_cash_method || '');
        const initialNonCashAmount = Number(meta.non_cash_amount ?? initialPayment.non_cash_amount ?? 0);
        setNonCashAmount(
            (initialPayment.payment_method || 'cash') === 'credit' && initialNonCashAmount <= 0
                ? Number(totalAmount || 0)
                : initialNonCashAmount
        );
        setCashQuantities(nextQuantities);
        setCashSuggestion(meta.cash_change_suggestion || null);
        setSuggestionAccepted(Boolean(meta.cash_change_suggestion_accepted));
        setManualRoundingEnabled(Boolean(meta.manual_rounding_enabled));
        setCashNote('');
    }, [show, initialPayment, denominationList, totalAmount]);

    useEffect(() => {
        if (paymentMethod === 'credit' && Number(nonCashAmount || 0) <= 0) {
            setNonCashAmount(Number(totalAmount || 0));
        }
    }, [paymentMethod, totalAmount, nonCashAmount]);

    const roundedPayableAmount = useMemo(() => {
        if (!manualRoundingEnabled || paymentMethod === 'credit') {
            return Number(totalAmount || 0);
        }

        return roundDownToDenomination(totalAmount, MANUAL_ROUNDING_DENOMINATION);
    }, [manualRoundingEnabled, paymentMethod, totalAmount]);

    const manualRoundingAdjustment = roundedPayableAmount - Number(totalAmount || 0);
    const manualRoundingDiscount = Math.max(0, Number(totalAmount || 0) - roundedPayableAmount);

    const cashBreakdown = useMemo(() => {
        return denominationList
            .map((denomination) => ({
                denomination_id: denomination.id,
                value: Number(denomination.value || 0),
                quantity: toInt(cashQuantities[denomination.id]),
            }))
            .filter((row) => row.quantity > 0);
    }, [cashQuantities, denominationList]);

    const cashReceivedTotal = useMemo(() => {
        return cashBreakdown.reduce((total, row) => total + row.value * row.quantity, 0);
    }, [cashBreakdown]);

    const cashDueAmount = useMemo(() => {
        if (paymentMethod === 'cash') {
            return Number(roundedPayableAmount || 0);
        }

        if (paymentMethod === 'mixed') {
            return Math.max(0, Number(roundedPayableAmount || 0) - Number(nonCashAmount || 0));
        }

        return 0;
    }, [nonCashAmount, paymentMethod, roundedPayableAmount]);

    const totalPaidAmount = useMemo(() => {
        if (paymentMethod === 'cash') {
            return Math.min(cashReceivedTotal, Number(roundedPayableAmount || 0));
        }

        if (paymentMethod === 'credit') {
            return Math.min(Number(nonCashAmount || totalAmount || 0), Number(roundedPayableAmount || 0));
        }

        return Math.min(
            Number(nonCashAmount || 0) + Math.min(cashReceivedTotal, cashDueAmount),
            Number(roundedPayableAmount || 0)
        );
    }, [cashDueAmount, cashReceivedTotal, nonCashAmount, paymentMethod, roundedPayableAmount, totalAmount]);

    const cashChangeAmount = Math.max(0, cashReceivedTotal - cashDueAmount);
    const remainingAmount = Math.max(0, Number(roundedPayableAmount || 0) - totalPaidAmount);
    const balanceLabel = paymentMethod === 'cash'
        ? (cashChangeAmount > 0 ? 'Kembalian' : 'Sisa / Kembalian')
        : 'Sisa Tagihan';
    const balanceDescription = paymentMethod === 'cash'
        ? (cashChangeAmount > 0
            ? `Kembalian cash: ${formatCurrency(cashChangeAmount)}`
            : 'Tidak ada kembalian.')
        : paymentMethod === 'mixed'
            ? `Cash yang harus diterima: ${formatCurrency(cashDueAmount)}`
            : 'Tidak ada sisa tagihan.';

    const toggleManualRounding = () => {
        setManualRoundingEnabled((previous) => !previous);
        setSuggestionAccepted(false);
    };

    const updateCashQuantity = (denominationId, delta) => {
        setSuggestionAccepted(false);
        setCashQuantities((previous) => {
            const currentValue = toInt(previous[denominationId]);
            return {
                ...previous,
                [denominationId]: Math.max(0, currentValue + delta),
            };
        });
    };

    const loadCashSuggestion = async () => {
        if (paymentMethod === 'credit' || cashDueAmount <= 0 || cashReceivedTotal <= 0) {
            setCashSuggestion(null);
            setSuggestionAccepted(false);
            setCashNote('');
            return;
        }

        if (cashReceivedTotal < cashDueAmount) {
            setCashSuggestion(null);
            setSuggestionAccepted(false);
            setCashNote(`Masih kurang ${formatCurrency(cashDueAmount - cashReceivedTotal)} untuk cash.`);
            return;
        }

        if (!window.axios) {
            return;
        }

        setLoadingSuggestion(true);
        try {
            const response = await window.axios.post(route('cash-management.change.suggest'), {
                total_due: cashDueAmount,
                received: cashBreakdown.map((row) => ({
                    denomination_id: row.denomination_id,
                    quantity: row.quantity,
                })),
            });

            setCashSuggestion(response.data?.suggestion || null);
            setSuggestionAccepted(false);
            setCashNote(response.data?.suggestion?.exact ? 'Kembalian bisa disiapkan pas.' : 'Kembalian pas tidak cukup, gunakan saran terdekat.');
        } catch (error) {
            setCashSuggestion(null);
            setSuggestionAccepted(false);
            setCashNote(error?.response?.data?.message || 'Gagal menghitung saran kembalian.');
        } finally {
            setLoadingSuggestion(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            loadCashSuggestion();
        }, 250);

        return () => clearTimeout(timer);
    }, [cashBreakdown, cashDueAmount, cashReceivedTotal, paymentMethod]);

    const handleConfirm = () => {
        if (paymentMethod === 'credit' && !transferDestination) {
            toast.error('Pilih metode non-tunai terlebih dahulu.');
            return;
        }

        if ((paymentMethod === 'cash' || paymentMethod === 'mixed') && cashBreakdown.length === 0 && cashReceivedTotal <= 0) {
            toast.error('Isi pecahan uang cash terlebih dahulu.');
            return;
        }

        onConfirm({
            payment_method: paymentMethod,
            transfer_destination: paymentMethod === 'cash' ? '' : transferDestination,
            paid_amount: totalPaidAmount,
            payment_meta: {
                payment_method: paymentMethod,
                cash_breakdown: cashBreakdown,
                cash_received_total: cashReceivedTotal,
                cash_due_amount: cashDueAmount,
                cash_change_amount: cashChangeAmount,
                cash_change_suggestion: cashSuggestion,
                cash_change_suggestion_accepted: suggestionAccepted,
                manual_rounding_enabled: manualRoundingEnabled,
                manual_rounding_denomination: manualRoundingEnabled ? MANUAL_ROUNDING_DENOMINATION : null,
                manual_rounding_adjustment: manualRoundingAdjustment,
                payable_total_after_manual_rounding: roundedPayableAmount,
                non_cash_method: paymentMethod === 'cash' ? '' : transferDestination,
                non_cash_amount: paymentMethod === 'credit' ? Number(nonCashAmount || totalAmount || 0) : Number(nonCashAmount || 0),
                total_due: Number(totalAmount || 0),
                total_paid: totalPaidAmount,
            },
        });
    };

    const applySuggestion = () => {
        if (!cashSuggestion?.items?.length) {
            return;
        }

        setSuggestionAccepted(true);
        setCashNote('Saran kembalian ditandai. Uang diterima tidak berubah.');
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="5xl" scrollable={false}>
            <div className="flex max-h-[calc(100vh-5rem)] flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                    <div>
                        <div className="flex items-center gap-2">
                            <IconReceipt size={18} className="text-emerald-600" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Terima Pembayaran</h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Isi pecahan cash atau pilih metode non-tunai, lalu simpan ke transaksi.</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800">
                        <IconX size={18} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
                    <div className="space-y-5">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Metode Pembayaran</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Pilih cara bayar sebelum mengisi nominal.</p>
                                </div>
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                    {paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'credit' ? 'Non-Tunai' : 'Campuran'}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { value: 'cash', label: 'Cash', description: 'Terima uang fisik', icon: IconCash },
                                    { value: 'credit', label: 'Non-Tunai', description: 'QRIS / transfer / EDC', icon: IconCreditCard },
                                    { value: 'mixed', label: 'Campuran', description: 'Cash + non-tunai', icon: IconRefresh },
                                ].map((option) => {
                                    const Icon = option.icon;
                                    const active = paymentMethod === option.value;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                setSuggestionAccepted(false);
                                                if (option.value === 'credit') {
                                                    setManualRoundingEnabled(false);
                                                }
                                                setPaymentMethod(option.value);
                                            }}
                                            className={`rounded-2xl border p-4 text-left transition ${
                                                active
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm dark:bg-emerald-950/30 dark:text-emerald-100'
                                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`rounded-xl p-2 ${active ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-300'}`}>
                                                    <Icon size={18} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold">{option.label}</p>
                                                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{option.description}</p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {(paymentMethod === 'cash' || paymentMethod === 'mixed') && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className={`rounded-xl p-2 ${manualRoundingEnabled ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                                            <IconAdjustmentsHorizontal size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Pembulatan Manual</p>
                                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                                                Bulatkan turun ke kelipatan {formatCurrency(MANUAL_ROUNDING_DENOMINATION)} saat pecahan kecil tidak tersedia.
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={toggleManualRounding}
                                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                            manualRoundingEnabled
                                                ? 'border-amber-500 bg-amber-500 text-white'
                                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                                        }`}
                                    >
                                        {manualRoundingEnabled ? <IconCheck size={14} /> : null}
                                        {manualRoundingEnabled ? 'Pembulatan aktif' : 'Bulatkan'}
                                    </button>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
                                        <p className="text-[11px] font-semibold uppercase text-slate-500">Tagihan Asli</p>
                                        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(totalAmount)}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
                                        <p className="text-[11px] font-semibold uppercase text-slate-500">Dipakai Bayar</p>
                                        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(roundedPayableAmount)}</p>
                                    </div>
                                    <div className="rounded-xl bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
                                        <p className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-300">Penyesuaian</p>
                                        <p className="mt-1 text-sm font-bold text-amber-700 dark:text-amber-200">
                                            {manualRoundingDiscount > 0 ? `-${formatCurrency(manualRoundingDiscount)}` : formatCurrency(0)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(paymentMethod === 'cash' || paymentMethod === 'mixed') && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Pecahan Uang Diterima</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Klik tombol plus/minus untuk mengisi lembar yang diterima.</p>
                                    </div>
                                    <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right dark:bg-emerald-950/30">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Total Cash</p>
                                        <p className="text-base font-bold text-emerald-700 dark:text-emerald-200">{formatCurrency(cashReceivedTotal)}</p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {denominationList.map((denomination) => {
                                        const quantity = toInt(cashQuantities[denomination.id]);

                                        return (
                                            <div key={denomination.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(denomination.value)}</p>
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Stok tersedia {toInt(denomination.quantity)}</p>
                                                    </div>
                                                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                                                        Klik untuk mengubah
                                                    </span>
                                                </div>

                                                <div className="mt-4 flex items-center justify-between gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateCashQuantity(denomination.id, -1)}
                                                        disabled={quantity <= 0}
                                                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                                        aria-label={`Kurangi ${formatCurrency(denomination.value)}`}
                                                    >
                                                        <IconMinus size={16} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => updateCashQuantity(denomination.id, 1)}
                                                        className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-lg font-bold text-slate-900 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-emerald-950/20"
                                                    >
                                                        {quantity}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => updateCashQuantity(denomination.id, 1)}
                                                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                                        aria-label={`Tambah ${formatCurrency(denomination.value)}`}
                                                    >
                                                        <IconPlus size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {cashSuggestion && (
                                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Saran Kembalian</p>
                                                <p className="text-xs leading-5 text-emerald-700/80 dark:text-emerald-200/80">
                                                    Ini hanya referensi uang yang perlu dikeluarkan. Uang diterima tetap tidak berubah.
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={applySuggestion}
                                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                                                    suggestionAccepted
                                                        ? 'border-emerald-500 bg-emerald-600 text-white'
                                                        : 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300'
                                                }`}
                                            >
                                                {suggestionAccepted ? <IconCheck size={14} /> : null}
                                                {suggestionAccepted ? 'Saran dipakai' : 'Pakai untuk kembalian'}
                                            </button>
                                        </div>

                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            {(cashSuggestion.items || []).map((item) => (
                                                <div key={`${item.denomination_id}-${item.value}`} className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-900">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="font-medium text-slate-700 dark:text-slate-200">
                                                            {formatCurrency(item.value)} x {item.quantity}
                                                        </span>
                                                        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(item.line_total)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <p className="mt-3 text-xs text-emerald-700/80 dark:text-emerald-200/80">
                                            {cashNote || 'Saran dihitung dari kas pecahan yang tersedia.'}
                                        </p>
                                    </div>
                                )}

                                {loadingSuggestion && (
                                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Menghitung saran kembalian...</p>
                                )}
                            </div>
                        )}

                        {(paymentMethod === 'credit' || paymentMethod === 'mixed') && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                <div className="mb-4">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Pembayaran Non-Tunai</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Pilih metode yang digunakan pelanggan.</p>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Metode Non-Tunai</label>
                                        <select
                                            value={transferDestination}
                                            onChange={(event) => setTransferDestination(event.target.value)}
                                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                                        >
                                            <option value="">Pilih metode</option>
                                            {nonCashMethods.map((method) => (
                                                <option key={method.value} value={method.value}>
                                                    {method.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {paymentMethod === 'mixed' ? (
                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Nominal Non-Tunai</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max={totalAmount}
                                                value={nonCashAmount}
                                                onChange={(event) => setNonCashAmount(toInt(event.target.value))}
                                                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                                            />
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                            Nominal non-tunai otomatis mengikuti total tagihan.
                                        </div>
                                    )}
                                </div>
                                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                    Untuk pembayaran campuran, isi nominal non-tunai dan sisa cash dihitung otomatis.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 lg:sticky lg:top-5 self-start">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total Tagihan</p>
                            <p className="mt-2 text-3xl font-black tabular-nums text-slate-900 dark:text-white">{formatCurrency(roundedPayableAmount)}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {manualRoundingDiscount > 0
                                    ? `Asli ${formatCurrency(totalAmount)}, pembulatan -${formatCurrency(manualRoundingDiscount)}.`
                                    : 'Nilai transaksi sebelum pembayaran.'}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total Dibayar</p>
                            <p className="mt-2 text-3xl font-black tabular-nums text-slate-900 dark:text-white">{formatCurrency(totalPaidAmount)}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                {paymentMethod === 'mixed'
                                    ? 'Gabungan cash dan non-tunai.'
                                    : paymentMethod === 'credit'
                                        ? 'Sepenuhnya non-tunai.'
                                        : 'Berdasarkan pecahan cash yang diisi.'}
                            </p>
                        </div>

                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">{balanceLabel}</p>
                            <p className="mt-2 text-3xl font-black tabular-nums text-emerald-700 dark:text-emerald-200">{formatCurrency(remainingAmount || cashChangeAmount)}</p>
                            <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-200/80">{balanceDescription}</p>
                        </div>

                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Catatan Singkat</p>
                            <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                                <li>• Cash diisi lewat klik + / - per pecahan.</li>
                                <li>• Saran kembalian hanya referensi uang keluar.</li>
                                <li>• Pembayaran campuran tetap menyimpan cash dan non-tunai.</li>
                            </ul>
                        </div>
                    </div>
                    </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                    >
                        <IconReceipt size={16} />
                        Simpan Pembayaran
                    </button>
                </div>
            </div>
        </Modal>
    );
}

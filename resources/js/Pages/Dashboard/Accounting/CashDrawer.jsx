import React, { useMemo, useState } from "react";
import { Head, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconCash,
    IconCalculator,
    IconDeviceFloppy,
    IconMinus,
    IconPlus,
    IconRefresh,
} from "@tabler/icons-react";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value);

const transactionLabel = {
    income: "Pemasukan",
    expense: "Pengeluaran",
    adjustment: "Penyesuaian",
    change_given: "Kembalian Diberikan",
};

export default function CashDrawer({ denominations = [], summary = {}, recentTransactions = [] }) {
    const [stockInputs, setStockInputs] = useState(() => {
        const map = {};
        denominations.forEach((d) => {
            map[d.id] = d.quantity;
        });
        return map;
    });

    const [transactionType, setTransactionType] = useState("income");
    const [transactionDescription, setTransactionDescription] = useState("");
    const [transactionDenoms, setTransactionDenoms] = useState(() => {
        const map = {};
        denominations.forEach((d) => {
            map[d.id] = 0;
        });
        return map;
    });

    const [dueAmount, setDueAmount] = useState(0);
    const [receivedDenoms, setReceivedDenoms] = useState(() => {
        const map = {};
        denominations.forEach((d) => {
            map[d.id] = 0;
        });
        return map;
    });
    const [changeSuggestion, setChangeSuggestion] = useState(null);
    const [changeMessage, setChangeMessage] = useState("");
    const [loadingSuggest, setLoadingSuggest] = useState(false);
    const [loadingSettle, setLoadingSettle] = useState(false);

    const denomById = useMemo(() => {
        const map = {};
        denominations.forEach((d) => {
            map[d.id] = d;
        });
        return map;
    }, [denominations]);

    const calculateTotalFromInput = (source) => {
        return Object.entries(source).reduce((total, [denominationId, qty]) => {
            const denomination = denomById[Number(denominationId)];
            if (!denomination) return total;
            return total + denomination.value * Number(qty || 0);
        }, 0);
    };

    const transactionTotal = calculateTotalFromInput(transactionDenoms);
    const receivedTotal = calculateTotalFromInput(receivedDenoms);
    const expectedChange = Math.max(0, receivedTotal - Number(dueAmount || 0));

    const buildDenominationPayload = (source) => {
        return Object.entries(source)
            .map(([denomination_id, quantity]) => ({
                denomination_id: Number(denomination_id),
                quantity: Number(quantity || 0),
            }));
    };

    const submitStockUpdate = (e) => {
        e.preventDefault();

        router.post(
            route("cash-management.stock.update"),
            {
                denominations: buildDenominationPayload(stockInputs),
                description: "Update stok pecahan dari dashboard akuntansi kas",
            },
            {
                preserveScroll: true,
            }
        );
    };

    const submitTransaction = (e) => {
        e.preventDefault();

        router.post(
            route("cash-management.transactions.store"),
            {
                transaction_type: transactionType,
                description: transactionDescription,
                denominations: buildDenominationPayload(transactionDenoms),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setTransactionDescription("");
                    const reset = {};
                    denominations.forEach((d) => {
                        reset[d.id] = 0;
                    });
                    setTransactionDenoms(reset);
                },
            }
        );
    };

    const suggestChange = async () => {
        setLoadingSuggest(true);
        setChangeMessage("");

        try {
            const response = await window.axios.post(route("cash-management.change.suggest"), {
                total_due: Number(dueAmount || 0),
                received: buildDenominationPayload(receivedDenoms),
            });

            setChangeSuggestion(response.data?.suggestion || null);
            if (!response.data?.suggestion?.exact) {
                setChangeMessage("Kembalian pas tidak bisa dipenuhi penuh oleh stok saat ini.");
            }
        } catch (error) {
            setChangeSuggestion(null);
            setChangeMessage(error?.response?.data?.message || "Gagal menghitung saran kembalian.");
        } finally {
            setLoadingSuggest(false);
        }
    };

    const settleSale = async () => {
        setLoadingSettle(true);
        setChangeMessage("");

        try {
            const response = await window.axios.post(route("cash-management.sale.settle"), {
                total_due: Number(dueAmount || 0),
                description: "Pencatatan transaksi cash pelanggan",
                received: buildDenominationPayload(receivedDenoms),
            });

            setChangeMessage(response.data?.message || "Transaksi cash berhasil disimpan.");
            setChangeSuggestion(null);
            const reset = {};
            denominations.forEach((d) => {
                reset[d.id] = 0;
            });
            setReceivedDenoms(reset);
            setDueAmount(0);
            router.reload({ only: ["denominations", "summary", "recentTransactions"] });
        } catch (error) {
            setChangeMessage(error?.response?.data?.message || "Gagal menyimpan transaksi cash.");
        } finally {
            setLoadingSettle(false);
        }
    };

    return (
        <DashboardLayout>
            <Head title="Akuntansi Kas" />

            <div className="space-y-6">
                <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white shadow-lg">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-bold">Akuntansi Kas Bengkel</h1>
                            <p className="text-sm text-white/90 mt-1">
                                Monitoring pecahan uang, transaksi cash, dan saran kembalian otomatis berbasis stok.
                            </p>
                        </div>
                        <IconCash size={38} strokeWidth={1.5} className="opacity-90" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <p className="text-xs text-slate-500">Total Kas Saat Ini</p>
                        <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrency(summary.total_cash || 0)}
                        </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs text-emerald-700">Pemasukan Bulan Ini</p>
                        <p className="text-xl font-semibold text-emerald-800">
                            {formatCurrency(summary.month_income || 0)}
                        </p>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                        <p className="text-xs text-rose-700">Pengeluaran Bulan Ini</p>
                        <p className="text-xl font-semibold text-rose-800">
                            {formatCurrency(summary.month_expense || 0)}
                        </p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <p className="text-xs text-blue-700">Neto Bulan Ini</p>
                        <p className="text-xl font-semibold text-blue-800">
                            {formatCurrency(summary.month_net || 0)}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                    <div className="xl:col-span-2 space-y-5">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <h2 className="text-sm font-semibold mb-3">Stok Pecahan Kas</h2>
                            <form onSubmit={submitStockUpdate}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {denominations.map((denomination) => (
                                        <div key={denomination.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                {formatCurrency(denomination.value)}
                                            </p>
                                            <p className="text-xs text-slate-500 mb-2">
                                                Subtotal: {formatCurrency(denomination.subtotal)}
                                            </p>
                                            <input
                                                type="number"
                                                min={0}
                                                value={stockInputs[denomination.id] ?? 0}
                                                onChange={(e) =>
                                                    setStockInputs((prev) => ({
                                                        ...prev,
                                                        [denomination.id]: Number(e.target.value || 0),
                                                    }))
                                                }
                                                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                                    >
                                        <IconDeviceFloppy size={16} />
                                        Simpan Stok Pecahan
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <h2 className="text-sm font-semibold mb-3">Catat Pemasukan/Pengeluaran Kas</h2>
                            <form onSubmit={submitTransaction} className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <select
                                        value={transactionType}
                                        onChange={(e) => setTransactionType(e.target.value)}
                                        className="px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                    >
                                        <option value="income">Pemasukan</option>
                                        <option value="expense">Pengeluaran</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={transactionDescription}
                                        onChange={(e) => setTransactionDescription(e.target.value)}
                                        placeholder="Keterangan transaksi"
                                        className="md:col-span-2 px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                    />
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    {denominations.map((denomination) => (
                                        <div key={`tx-${denomination.id}`} className="border rounded-lg p-2 dark:border-slate-700">
                                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                                {formatCurrency(denomination.value)}
                                            </p>
                                            <input
                                                type="number"
                                                min={0}
                                                value={transactionDenoms[denomination.id] ?? 0}
                                                onChange={(e) =>
                                                    setTransactionDenoms((prev) => ({
                                                        ...prev,
                                                        [denomination.id]: Number(e.target.value || 0),
                                                    }))
                                                }
                                                className="mt-1 w-full px-2 py-1 border rounded dark:bg-slate-900 dark:border-slate-700"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-slate-600 dark:text-slate-300">
                                        Total transaksi: <span className="font-semibold">{formatCurrency(transactionTotal)}</span>
                                    </p>
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                        <IconPlus size={16} />
                                        Simpan Transaksi Kas
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <h2 className="text-sm font-semibold mb-3">Simulasi Pembayaran Cash & Saran Kembalian</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="block text-xs mb-1 text-slate-500">Total Tagihan</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={dueAmount}
                                        onChange={(e) => setDueAmount(Number(e.target.value || 0))}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                                    />
                                </div>
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <p className="text-xs text-slate-500">Uang diterima</p>
                                    <p className="text-lg font-semibold">{formatCurrency(receivedTotal)}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Perkiraan kembalian: {formatCurrency(expectedChange)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                                {denominations.map((denomination) => (
                                    <div key={`recv-${denomination.id}`} className="border rounded-lg p-2 dark:border-slate-700">
                                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                            {formatCurrency(denomination.value)}
                                        </p>
                                        <input
                                            type="number"
                                            min={0}
                                            value={receivedDenoms[denomination.id] ?? 0}
                                            onChange={(e) =>
                                                setReceivedDenoms((prev) => ({
                                                    ...prev,
                                                    [denomination.id]: Number(e.target.value || 0),
                                                }))
                                            }
                                            className="mt-1 w-full px-2 py-1 border rounded dark:bg-slate-900 dark:border-slate-700"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={suggestChange}
                                    disabled={loadingSuggest}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                                >
                                    <IconCalculator size={16} />
                                    {loadingSuggest ? "Menghitung..." : "Saran Kembalian"}
                                </button>
                                <button
                                    type="button"
                                    onClick={settleSale}
                                    disabled={loadingSettle}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    <IconCash size={16} />
                                    {loadingSettle ? "Menyimpan..." : "Simpan Transaksi Cash"}
                                </button>
                            </div>

                            {changeMessage && (
                                <div className="mt-3 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm">
                                    {changeMessage}
                                </div>
                            )}

                            {changeSuggestion && (
                                <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <p className="text-sm font-semibold">
                                        Saran Kembalian ({changeSuggestion.exact ? "Pas" : "Tidak Pas"})
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Dialokasikan: {formatCurrency(changeSuggestion.allocated_amount)}
                                        {changeSuggestion.remaining > 0 && (
                                            <> | Sisa belum terpenuhi: {formatCurrency(changeSuggestion.remaining)}</>
                                        )}
                                    </p>
                                    <div className="mt-2 space-y-1">
                                        {(changeSuggestion.items || []).map((item) => (
                                            <div
                                                key={`sug-${item.denomination_id}-${item.value}`}
                                                className="text-sm flex items-center justify-between"
                                            >
                                                <span>{formatCurrency(item.value)} x {item.quantity}</span>
                                                <span>{formatCurrency(item.line_total)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                            <h2 className="text-sm font-semibold mb-3">Riwayat Transaksi Kas</h2>
                            <div className="space-y-2 max-h-[880px] overflow-y-auto pr-1">
                                {recentTransactions.length === 0 ? (
                                    <p className="text-sm text-slate-500">Belum ada transaksi kas.</p>
                                ) : (
                                    recentTransactions.map((tx) => (
                                        <div key={tx.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold">
                                                    {transactionLabel[tx.transaction_type] || tx.transaction_type}
                                                </p>
                                                <p className="text-sm font-semibold">{formatCurrency(tx.amount)}</p>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {tx.happened_at || "-"}
                                                {tx.created_by ? ` | ${tx.created_by}` : ""}
                                            </p>
                                            {tx.description && (
                                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{tx.description}</p>
                                            )}
                                            {(tx.items || []).length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    {tx.items.map((item, idx) => (
                                                        <div key={`${tx.id}-${idx}`} className="text-xs flex items-center justify-between">
                                                            <span>
                                                                {item.direction === "in" ? "+" : "-"} {formatCurrency(item.denomination_value)} x {item.quantity}
                                                            </span>
                                                            <span>{formatCurrency(item.line_total)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

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
import toast from "react-hot-toast";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value || 0);

const transactionLabel = {
    income: "Pemasukan",
    expense: "Pengeluaran",
    adjustment: "Penyesuaian",
    change_given: "Kembalian Diberikan",
};

const modeOptions = [
    {
        id: "stock",
        title: "Kelola Stok",
        description: "Atur pecahan kas dengan input cepat dan kontrol per nominal.",
    },
    {
        id: "transaction",
        title: "Catat Transaksi",
        description: "Masukkan nominal, lalu pecah otomatis agar input lebih cepat.",
    },
    {
        id: "settlement",
        title: "Pembayaran Cash",
        description: "Hitung penerimaan, saran kembalian, dan simpan transaksi pelanggan.",
    },
];

const quickNominals = [50000, 100000, 250000, 500000, 1000000];

export default function CashDrawer({ denominations = [], summary = {}, recentTransactions = [] }) {
    const createDenominationMap = (valueFactory) => {
        const map = {};

        denominations.forEach((denomination) => {
            map[denomination.id] = typeof valueFactory === "function" ? valueFactory(denomination) : valueFactory;
        });

        return map;
    };

    const [activeMode, setActiveMode] = useState("stock");
    const [stockInputs, setStockInputs] = useState(() => createDenominationMap((denomination) => denomination.quantity));
    const [transactionType, setTransactionType] = useState("income");
    const [transactionDescription, setTransactionDescription] = useState("");
    const [transactionAmount, setTransactionAmount] = useState(0);
    const [transactionDenoms, setTransactionDenoms] = useState(() => createDenominationMap(0));
    const [dueAmount, setDueAmount] = useState(0);
    const [receivedAmount, setReceivedAmount] = useState(0);
    const [receivedDenoms, setReceivedDenoms] = useState(() => createDenominationMap(0));
    const [changeSuggestion, setChangeSuggestion] = useState(null);
    const [changeMessage, setChangeMessage] = useState("");
    const [loadingSuggest, setLoadingSuggest] = useState(false);
    const [loadingSettle, setLoadingSettle] = useState(false);

    const denomById = useMemo(() => {
        const map = {};

        denominations.forEach((denomination) => {
            map[denomination.id] = denomination;
        });

        return map;
    }, [denominations]);

    const denominationsDesc = useMemo(() => {
        return [...denominations].sort((left, right) => right.value - left.value);
    }, [denominations]);

    const calculateTotalFromInput = (source) => {
        return Object.entries(source).reduce((total, [denominationId, quantity]) => {
            const denomination = denomById[Number(denominationId)];

            if (!denomination) {
                return total;
            }

            return total + denomination.value * Number(quantity || 0);
        }, 0);
    };

    const buildDenominationPayload = (source) => {
        return Object.entries(source).map(([denomination_id, quantity]) => ({
            denomination_id: Number(denomination_id),
            quantity: Number(quantity || 0),
        }));
    };

    const transactionTotal = calculateTotalFromInput(transactionDenoms);
    const receivedTotal = calculateTotalFromInput(receivedDenoms);
    const stockTotal = calculateTotalFromInput(stockInputs);
    const expectedChange = Math.max(0, receivedTotal - Number(dueAmount || 0));

    const recentTotals = useMemo(() => {
        return recentTransactions.reduce(
            (accumulator, transaction) => {
                const amount = Number(transaction.amount || 0);

                if (transaction.transaction_type === "income") {
                    accumulator.income += amount;
                }

                if (transaction.transaction_type === "expense") {
                    accumulator.expense += amount;
                }

                if (transaction.transaction_type === "change_given") {
                    accumulator.changeGiven += amount;
                }

                if (transaction.transaction_type === "adjustment") {
                    accumulator.adjustment += amount;
                }

                return accumulator;
            },
            {
                income: 0,
                expense: 0,
                adjustment: 0,
                changeGiven: 0,
            }
        );
    }, [recentTransactions]);

    const resetMap = (factory) => createDenominationMap(factory);

    const applyBreakdownToState = (setter, breakdown) => {
        setter(resetMap((denomination) => breakdown[denomination.id] || 0));
    };

    const splitAmount = (amount, useStockLimit = false) => {
        let remaining = Math.max(0, Number(amount || 0));
        const breakdown = {};

        denominationsDesc.forEach((denomination) => {
            const maxQuantity = Math.floor(remaining / denomination.value);
            const availableQuantity = useStockLimit ? Number(denomById[denomination.id]?.quantity || 0) : maxQuantity;
            const quantity = Math.min(maxQuantity, availableQuantity);

            breakdown[denomination.id] = quantity;
            remaining -= quantity * denomination.value;
        });

        return { breakdown, remaining };
    };

    const resetAllForms = () => {
        setActiveMode("stock");
        setStockInputs(resetMap((denomination) => denomination.quantity));
        setTransactionType("income");
        setTransactionDescription("");
        setTransactionAmount(0);
        setTransactionDenoms(resetMap(0));
        setDueAmount(0);
        setReceivedAmount(0);
        setReceivedDenoms(resetMap(0));
        setChangeSuggestion(null);
        setChangeMessage("");
    };

    const setQuickAmount = (setAmount) => (amount) => {
        setAmount(amount);
    };

    const adjustStockQuantity = (denominationId, delta) => {
        setStockInputs((previous) => ({
            ...previous,
            [denominationId]: Math.max(0, Number(previous[denominationId] || 0) + delta),
        }));
    };

    const submitStockUpdate = (event) => {
        event.preventDefault();

        router.post(
            route("cash-management.stock.update"),
            {
                denominations: buildDenominationPayload(stockInputs),
                description: "Update stok pecahan dari dashboard akuntansi kas",
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Stok pecahan kas berhasil diperbarui.");
                },
                onError: (errors) => {
                    const message = errors?.denominations || errors?.error || "Gagal memperbarui stok pecahan kas.";
                    toast.error(message);
                },
            }
        );
    };

    const autoFillTransaction = () => {
        if (Number(transactionAmount || 0) <= 0) {
            toast.error("Masukkan nominal transaksi terlebih dahulu.");
            return;
        }

        const { breakdown, remaining } = splitAmount(transactionAmount, transactionType === "expense");

        if (remaining > 0) {
            toast.error(`Nominal belum bisa dipecah penuh. Sisa ${formatCurrency(remaining)}.`);
            return;
        }

        applyBreakdownToState(setTransactionDenoms, breakdown);
        toast.success("Nominal transaksi diisi otomatis.");
    };

    const submitTransaction = (event) => {
        event.preventDefault();

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
                    toast.success("Transaksi kas berhasil dicatat.");
                    setTransactionDescription("");
                    setTransactionAmount(0);
                    setTransactionDenoms(resetMap(0));
                },
                onError: (errors) => {
                    const message = errors?.denominations || errors?.error || "Gagal mencatat transaksi kas.";
                    toast.error(message);
                },
            }
        );
    };

    const autoFillReceivedCash = () => {
        if (Number(receivedAmount || 0) <= 0) {
            toast.error("Masukkan nominal uang diterima terlebih dahulu.");
            return;
        }

        const { breakdown, remaining } = splitAmount(receivedAmount, false);

        if (remaining > 0) {
            toast.error(`Nominal diterima belum bisa dipecah penuh. Sisa ${formatCurrency(remaining)}.`);
            return;
        }

        applyBreakdownToState(setReceivedDenoms, breakdown);
        toast.success("Nominal diterima diisi otomatis.");
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
            setDueAmount(0);
            setReceivedAmount(0);
            setReceivedDenoms(resetMap(0));
            router.reload({ only: ["denominations", "summary", "recentTransactions"] });
        } catch (error) {
            setChangeMessage(error?.response?.data?.message || "Gagal menyimpan transaksi cash.");
        } finally {
            setLoadingSettle(false);
        }
    };

    const renderAmountChips = (setAmount, currentAmount, onAutoFill) => {
        return (
            <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                    {quickNominals.map((amount) => (
                        <button
                            key={amount}
                            type="button"
                            onClick={() => setAmount(amount)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                Number(currentAmount || 0) === amount
                                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            }`}
                        >
                            {formatCurrency(amount)}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={onAutoFill}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    <IconCalculator size={16} />
                    Isi otomatis dari nominal
                </button>
            </div>
        );
    };

    return (
        <DashboardLayout>
            <Head title="Akuntansi Kas" />

            <div className="space-y-6">
                <div className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 p-6 text-white shadow-xl">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                                Akuntansi Kas
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold leading-tight md:text-4xl">Kas yang lebih cepat dicatat, lebih jelas dibaca.</h1>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                                    Kelola pecahan, input transaksi, dan simulasi pembayaran dalam satu alur yang lebih ringkas.
                                    Nominal bisa diisi otomatis, sehingga user tidak perlu menghitung manual dari awal.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-white/80">
                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Input nominal otomatis</span>
                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Saran kembalian langsung</span>
                                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Ringkasan laporan lebih jelas</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => router.get(route("reports.overall.index"))}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                            >
                                <IconCash size={16} />
                                Buka Laporan
                            </button>
                            <button
                                type="button"
                                onClick={resetAllForms}
                                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                            >
                                <IconRefresh size={16} />
                                Reset Form
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Kas Saat Ini</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(summary.total_cash || 0)}</p>
                        <p className="mt-1 text-sm text-slate-500">Akumulasi saldo pecahan di drawer kas.</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
                        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Pemasukan Bulan Ini</p>
                        <p className="mt-2 text-2xl font-semibold text-emerald-800 dark:text-emerald-200">{formatCurrency(summary.month_income || 0)}</p>
                        <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-200/70">Semua penerimaan kas terhitung di periode berjalan.</p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/30">
                        <p className="text-xs font-medium uppercase tracking-wide text-rose-700 dark:text-rose-300">Pengeluaran Bulan Ini</p>
                        <p className="mt-2 text-2xl font-semibold text-rose-800 dark:text-rose-200">{formatCurrency(summary.month_expense || 0)}</p>
                        <p className="mt-1 text-sm text-rose-700/80 dark:text-rose-200/70">Keluar untuk operasional dan kembalian pelanggan.</p>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/30">
                        <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">Neto Bulan Ini</p>
                        <p className="mt-2 text-2xl font-semibold text-blue-800 dark:text-blue-200">{formatCurrency(summary.month_net || 0)}</p>
                        <p className="mt-1 text-sm text-blue-700/80 dark:text-blue-200/70">Gambaran cepat performa arus kas.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
                    <div className="space-y-6">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Mode Kerja</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Pilih satu fokus kerja agar input lebih cepat dan tidak bercampur.</p>
                                </div>
                                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
                                    {modeOptions.map((mode) => (
                                        <button
                                            key={mode.id}
                                            type="button"
                                            onClick={() => setActiveMode(mode.id)}
                                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                                activeMode === mode.id
                                                    ? "bg-emerald-600 text-white shadow-sm"
                                                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                                            }`}
                                        >
                                            {mode.title}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            {activeMode === "stock" && (
                                <div className="space-y-5">
                                    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Kelola Stok Pecahan</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Update stok bisa dilakukan per nominal. Input cepat memakai tombol plus/minus dan angka langsung.
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                            Total dari input saat ini: <span className="font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(stockTotal)}</span>
                                        </div>
                                    </div>

                                    <form onSubmit={submitStockUpdate} className="space-y-5">
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                            {denominations.map((denomination) => {
                                                const quantity = Number(stockInputs[denomination.id] || 0);
                                                const subtotal = denomination.value * quantity;

                                                return (
                                                    <div
                                                        key={denomination.id}
                                                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(denomination.value)}</p>
                                                                <p className="mt-1 text-xs text-slate-500">Nominal pecahan</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(subtotal)}</p>
                                                                <p className="text-xs text-slate-500">Subtotal dari stok</p>
                                                            </div>
                                                        </div>

                                                        <div className="mt-4 grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => adjustStockQuantity(denomination.id, -1)}
                                                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                                            >
                                                                <IconMinus size={16} />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={stockInputs[denomination.id] ?? 0}
                                                                onChange={(event) =>
                                                                    setStockInputs((previous) => ({
                                                                        ...previous,
                                                                        [denomination.id]: Number(event.target.value || 0),
                                                                    }))
                                                                }
                                                                className="h-10 min-w-0 w-full rounded-xl border border-slate-200 bg-white px-2 text-center text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => adjustStockQuantity(denomination.id, 1)}
                                                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                                            >
                                                                <IconPlus size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
                                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                                Gunakan tombol plus/minus untuk input cepat, lalu simpan ketika sudah sesuai.
                                            </p>
                                            <button
                                                type="submit"
                                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                                            >
                                                <IconDeviceFloppy size={16} />
                                                Simpan Stok Pecahan
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {activeMode === "transaction" && (
                                <div className="space-y-5">
                                    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Catat Transaksi Kas</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Masukkan nominal total terlebih dahulu, lalu pecah otomatis supaya input tidak berulang.
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                            Pecahan terisi: <span className="font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(transactionTotal)}</span>
                                        </div>
                                    </div>

                                    <form onSubmit={submitTransaction} className="space-y-5">
                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[180px_minmax(0,1fr)_180px]">
                                            <select
                                                value={transactionType}
                                                onChange={(event) => setTransactionType(event.target.value)}
                                                className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                            >
                                                <option value="income">Pemasukan</option>
                                                <option value="expense">Pengeluaran</option>
                                            </select>
                                            <input
                                                type="text"
                                                value={transactionDescription}
                                                onChange={(event) => setTransactionDescription(event.target.value)}
                                                placeholder="Contoh: setoran harian, biaya operasional, uang masuk non-penjualan"
                                                className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                value={transactionAmount}
                                                onChange={(event) => setTransactionAmount(Number(event.target.value || 0))}
                                                placeholder="Nominal total"
                                                className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                                            />
                                        </div>

                                        {renderAmountChips(setQuickAmount(setTransactionAmount), transactionAmount, autoFillTransaction)}

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                            {denominations.map((denomination) => (
                                                <div
                                                    key={`tx-${denomination.id}`}
                                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(denomination.value)}</p>
                                                            <p className="text-xs text-slate-500">Pecahan transaksi</p>
                                                        </div>
                                                        <p className="text-xs text-slate-500">Input manual tetap tersedia</p>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={transactionDenoms[denomination.id] ?? 0}
                                                        onChange={(event) =>
                                                            setTransactionDenoms((previous) => ({
                                                                ...previous,
                                                                [denomination.id]: Number(event.target.value || 0),
                                                            }))
                                                        }
                                                        className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-center text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                                <p>
                                                    Nominal target: <span className="font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(transactionAmount)}</span>
                                                </p>
                                                <p>
                                                    Hasil pecahan: <span className="font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(transactionTotal)}</span>
                                                </p>
                                                {transactionAmount > 0 && transactionAmount !== transactionTotal && (
                                                    <p className="text-rose-600 dark:text-rose-300">
                                                        Selisih: {formatCurrency(Math.abs(transactionAmount - transactionTotal))}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="submit"
                                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                                            >
                                                <IconPlus size={16} />
                                                Simpan Transaksi Kas
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {activeMode === "settlement" && (
                                <div className="space-y-5">
                                    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Pembayaran Cash dan Kembalian</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Input nominal tagihan dan uang diterima, lalu minta saran kembalian berdasarkan stok pecahan yang tersedia.
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                            Kembalian estimasi: <span className="font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(expectedChange)}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Tagihan</label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={dueAmount}
                                                onChange={(event) => setDueAmount(Number(event.target.value || 0))}
                                                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                                            />
                                        </div>
                                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nominal Diterima</label>
                                            <input
                                                type="number"
                                                min={0}
                                                value={receivedAmount}
                                                onChange={(event) => setReceivedAmount(Number(event.target.value || 0))}
                                                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                                            />
                                        </div>
                                    </div>

                                    {renderAmountChips(setQuickAmount(setReceivedAmount), receivedAmount, autoFillReceivedCash)}

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uang diterima terhitung</p>
                                            <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(receivedTotal)}</p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Dihitung dari pecahan yang diisi.</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kembalian estimasi</p>
                                            <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(expectedChange)}</p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Berguna sebelum menekan simpan.</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status input</p>
                                            <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">
                                                {receivedTotal >= Number(dueAmount || 0) ? "Siap diproses" : "Perlu nominal tambahan"}
                                            </p>
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gunakan tombol saran jika kembalian perlu dirinci.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        {denominations.map((denomination) => (
                                            <div
                                                key={`recv-${denomination.id}`}
                                                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"
                                            >
                                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(denomination.value)}</p>
                                                <p className="mt-1 text-xs text-slate-500">Pecahan uang diterima</p>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={receivedDenoms[denomination.id] ?? 0}
                                                    onChange={(event) =>
                                                        setReceivedDenoms((previous) => ({
                                                            ...previous,
                                                            [denomination.id]: Number(event.target.value || 0),
                                                        }))
                                                    }
                                                    className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-center text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950 lg:flex-row lg:items-center lg:justify-between">
                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                            Gunakan saran kembalian jika ingin alokasi pecahan yang lebih rapi sebelum transaksi disimpan.
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={suggestChange}
                                                disabled={loadingSuggest}
                                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                            >
                                                <IconCalculator size={16} />
                                                {loadingSuggest ? "Menghitung..." : "Saran Kembalian"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={settleSale}
                                                disabled={loadingSettle}
                                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <IconCash size={16} />
                                                {loadingSettle ? "Menyimpan..." : "Simpan Transaksi Cash"}
                                            </button>
                                        </div>
                                    </div>

                                    {changeMessage && (
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                                            {changeMessage}
                                        </div>
                                    )}

                                    {changeSuggestion && (
                                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                                    Saran Kembalian ({changeSuggestion.exact ? "Pas" : "Tidak Pas"})
                                                </p>
                                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${changeSuggestion.exact ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                                    {formatCurrency(changeSuggestion.allocated_amount)} dialokasikan
                                                </span>
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                {changeSuggestion.remaining > 0
                                                    ? `Sisa belum terpenuhi: ${formatCurrency(changeSuggestion.remaining)}`
                                                    : "Semua kembalian berhasil dialokasikan."}
                                            </p>
                                            <div className="mt-3 space-y-2">
                                                {(changeSuggestion.items || []).map((item) => (
                                                    <div key={`sug-${item.denomination_id}-${item.value}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
                                                        <span>
                                                            {formatCurrency(item.value)} x {item.quantity}
                                                        </span>
                                                        <span className="font-semibold">{formatCurrency(item.line_total)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Ringkasan Operasional</h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ringkasan cepat untuk membantu membaca kondisi kas tanpa membuka laporan penuh.</p>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Pemasukan</p>
                                    <p className="mt-1 text-sm font-semibold text-emerald-800 dark:text-emerald-200">{formatCurrency(recentTotals.income)}</p>
                                </div>
                                <div className="rounded-2xl bg-rose-50 px-4 py-3 dark:bg-rose-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Pengeluaran</p>
                                    <p className="mt-1 text-sm font-semibold text-rose-800 dark:text-rose-200">{formatCurrency(recentTotals.expense)}</p>
                                </div>
                                <div className="rounded-2xl bg-blue-50 px-4 py-3 dark:bg-blue-950/30">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Kembalian</p>
                                    <p className="mt-1 text-sm font-semibold text-blue-800 dark:text-blue-200">{formatCurrency(recentTotals.changeGiven)}</p>
                                </div>
                                <div className="rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Penyesuaian</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(recentTotals.adjustment)}</p>
                                </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                                Total transaksi terbaru: <span className="font-semibold text-slate-900 dark:text-slate-50">{recentTransactions.length}</span>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Riwayat Transaksi Kas</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Susunan terbaru agar pengguna dapat mengecek jejak transaksi lebih cepat.</p>
                                </div>
                            </div>

                            <div className="mt-4 max-h-[760px] space-y-3 overflow-y-auto pr-1">
                                {recentTransactions.length === 0 ? (
                                    <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                        Belum ada transaksi kas.
                                    </p>
                                ) : (
                                    recentTransactions.map((transaction) => (
                                        <div key={transaction.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                                        {transactionLabel[transaction.transaction_type] || transaction.transaction_type}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        {transaction.happened_at || "-"}
                                                        {transaction.created_by ? ` | ${transaction.created_by}` : ""}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(transaction.amount)}</p>
                                                    <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                                        {transaction.transaction_type}
                                                    </span>
                                                </div>
                                            </div>

                                            {transaction.description && (
                                                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{transaction.description}</p>
                                            )}

                                            {(transaction.items || []).length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    {transaction.items.map((item, index) => (
                                                        <div key={`${transaction.id}-${index}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs dark:bg-slate-900">
                                                            <span className="text-slate-600 dark:text-slate-300">
                                                                {item.direction === "in" ? "+" : "-"} {formatCurrency(item.denomination_value)} x {item.quantity}
                                                            </span>
                                                            <span className="font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(item.line_total)}</span>
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

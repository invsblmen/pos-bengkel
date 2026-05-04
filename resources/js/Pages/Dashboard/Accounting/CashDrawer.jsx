import React, { useMemo, useState } from "react";
import { Head, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    IconCash,
    IconCalculator,
    IconDeviceFloppy,
    IconArrowUp,
    IconArrowDown,
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

const getTransactionLabel = (transaction) => {
    if (transaction.source === "cash-denomination-exchange") {
        return "Tukar Pecahan";
    }

    return transactionLabel[transaction.transaction_type] || transaction.transaction_type;
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
        id: "exchange",
        title: "Tukar Pecahan",
        description: "Catat uang keluar dan masuk dengan nilai sama tanpa mengubah saldo total kas.",
    },
];

const quickNominals = [50000, 100000, 250000, 500000, 1000000];

const transactionToneMeta = {
    income: {
        card: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/20",
        header: "from-emerald-50 via-white to-emerald-50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-emerald-950/20",
        chip: "bg-emerald-600 text-white shadow-emerald-600/20",
        chipInactive: "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-emerald-950/30",
        input: "focus:border-emerald-500 focus:ring-emerald-500/15",
        helper: "text-emerald-700 dark:text-emerald-300",
        panel: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20",
        title: "text-emerald-800 dark:text-emerald-200",
        accent: "bg-emerald-600",
        icon: IconArrowUp,
        label: "Pemasukan",
    },
    expense: {
        card: "border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/20",
        header: "from-rose-50 via-white to-rose-50 dark:from-rose-950/30 dark:via-slate-900 dark:to-rose-950/20",
        chip: "bg-rose-600 text-white shadow-rose-600/20",
        chipInactive: "border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950/30",
        input: "focus:border-rose-500 focus:ring-rose-500/15",
        helper: "text-rose-700 dark:text-rose-300",
        panel: "border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20",
        title: "text-rose-800 dark:text-rose-200",
        accent: "bg-rose-600",
        icon: IconArrowDown,
        label: "Pengeluaran",
    },
};

const transactionHistoryTone = {
    income: {
        card: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20",
        title: "text-emerald-800 dark:text-emerald-200",
        subtitle: "text-emerald-700/80 dark:text-emerald-200/70",
        amount: "text-emerald-700 dark:text-emerald-300",
        badge: "bg-emerald-600 text-white",
    },
    expense: {
        card: "border-rose-200 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-950/20",
        title: "text-rose-800 dark:text-rose-200",
        subtitle: "text-rose-700/80 dark:text-rose-200/70",
        amount: "text-rose-700 dark:text-rose-300",
        badge: "bg-rose-600 text-white",
    },
    adjustment: {
        card: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950",
        title: "text-slate-900 dark:text-slate-50",
        subtitle: "text-slate-500 dark:text-slate-400",
        amount: "text-slate-900 dark:text-slate-50",
        badge: "bg-slate-700 text-white",
    },
    change_given: {
        card: "border-blue-200 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/20",
        title: "text-blue-800 dark:text-blue-200",
        subtitle: "text-blue-700/80 dark:text-blue-200/70",
        amount: "text-blue-700 dark:text-blue-300",
        badge: "bg-blue-600 text-white",
    },
};

const transactionFocus = {
    income: "focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1",
    expense: "focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-1",
};

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
    const [exchangeDescription, setExchangeDescription] = useState("");
    const [exchangeOutDenoms, setExchangeOutDenoms] = useState(() => createDenominationMap(0));
    const [exchangeInDenoms, setExchangeInDenoms] = useState(() => createDenominationMap(0));
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
    const exchangeOutTotal = calculateTotalFromInput(exchangeOutDenoms);
    const exchangeInTotal = calculateTotalFromInput(exchangeInDenoms);
    const receivedTotal = calculateTotalFromInput(receivedDenoms);
    const stockTotal = calculateTotalFromInput(stockInputs);
    const expectedChange = Math.max(0, receivedTotal - Number(dueAmount || 0));
    const transactionTone = transactionToneMeta[transactionType] || transactionToneMeta.income;
    const TransactionToneIcon = transactionTone.icon;

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
        setExchangeDescription("");
        setExchangeOutDenoms(resetMap(0));
        setExchangeInDenoms(resetMap(0));
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
                    router.reload({ only: ["denominations", "summary", "recentTransactions"], preserveScroll: true });
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
                    router.reload({ only: ["denominations", "summary", "recentTransactions"], preserveScroll: true });
                },
                onError: (errors) => {
                    const message = errors?.denominations || errors?.error || "Gagal mencatat transaksi kas.";
                    toast.error(message);
                },
            }
        );
    };

    const submitExchange = (event) => {
        event.preventDefault();

        if (exchangeOutTotal <= 0 || exchangeInTotal <= 0) {
            toast.error("Isi pecahan keluar dan pecahan masuk terlebih dahulu.");
            return;
        }

        if (exchangeOutTotal !== exchangeInTotal) {
            toast.error("Total pecahan keluar dan masuk harus sama.");
            return;
        }

        router.post(
            route("cash-management.exchange"),
            {
                description: exchangeDescription,
                cash_out: buildDenominationPayload(exchangeOutDenoms),
                cash_in: buildDenominationPayload(exchangeInDenoms),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Tukar pecahan kas berhasil dicatat.");
                    setExchangeDescription("");
                    setExchangeOutDenoms(resetMap(0));
                    setExchangeInDenoms(resetMap(0));
                    router.reload({ only: ["denominations", "summary", "recentTransactions"], preserveScroll: true });
                },
                onError: (errors) => {
                    const message = errors?.cash_out || errors?.cash_in || errors?.error || "Gagal mencatat tukar pecahan kas.";
                    toast.error(Array.isArray(message) ? message[0] : message);
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
                                <div className="flex flex-wrap rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
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
                                            {denominationsDesc.map((denomination) => {
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
                                <div className={`space-y-5 rounded-3xl border p-5 shadow-sm transition-colors duration-300 ${transactionTone.card}`}>
                                    <div className={`flex flex-col gap-2 rounded-2xl bg-gradient-to-r px-4 py-4 lg:flex-row lg:items-end lg:justify-between ${transactionTone.header}`}>
                                        <div className="space-y-2">
                                            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm" style={{ backgroundColor: transactionType === "income" ? "#059669" : "#e11d48" }}>
                                                <TransactionToneIcon size={14} />
                                                {transactionTone.label}
                                            </div>
                                            <div>
                                                <h2 className={`text-lg font-semibold ${transactionTone.title}`}>Catat Transaksi Kas</h2>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    Pilih jenis transaksi lewat toggle, lalu isi nominal agar warna formulir langsung menegaskan arah transaksi.
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`rounded-2xl px-4 py-3 text-sm ${transactionTone.helper} bg-white/80 dark:bg-slate-950/70`}>
                                            Pecahan terisi: <span className={`font-semibold ${transactionTone.title}`}>{formatCurrency(transactionTotal)}</span>
                                        </div>
                                    </div>

                                    <form onSubmit={submitTransaction} className="space-y-5">
                                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)_180px]">
                                            <div className="grid grid-cols-2 gap-2 rounded-2xl p-1">
                                                <button
                                                    type="button"
                                                    aria-label="Pemasukan"
                                                    title="Pemasukan"
                                                    aria-pressed={transactionType === "income"}
                                                    onClick={() => setTransactionType("income")}
                                                    className={`inline-flex items-center justify-center rounded-xl p-2 transition transform hover:scale-105 active:scale-95 ${
                                                        transactionType === "income" ? transactionTone.chip : transactionTone.chipInactive
                                                    } ${transactionFocus.income}`}
                                                >
                                                    <IconArrowUp size={18} />
                                                </button>
                                                <button
                                                    type="button"
                                                    aria-label="Pengeluaran"
                                                    title="Pengeluaran"
                                                    aria-pressed={transactionType === "expense"}
                                                    onClick={() => setTransactionType("expense")}
                                                    className={`inline-flex items-center justify-center rounded-xl p-2 transition transform hover:scale-105 active:scale-95 ${
                                                        transactionType === "expense" ? transactionTone.chip : transactionTone.chipInactive
                                                    } ${transactionFocus.expense}`}
                                                >
                                                    <IconArrowDown size={18} />
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={transactionDescription}
                                                onChange={(event) => setTransactionDescription(event.target.value)}
                                                placeholder="Contoh: setoran harian, biaya operasional, uang masuk non-penjualan"
                                                className={`h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 ${transactionTone.input}`}
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                value={transactionAmount}
                                                onChange={(event) => setTransactionAmount(Number(event.target.value || 0))}
                                                placeholder="Nominal total"
                                                className={`h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 ${transactionTone.input}`}
                                            />
                                        </div>

                                        {renderAmountChips(setQuickAmount(setTransactionAmount), transactionAmount, autoFillTransaction)}

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                            {denominationsDesc.map((denomination) => (
                                                <div
                                                    key={`tx-${denomination.id}`}
                                                    className={`rounded-2xl border p-4 transition-colors duration-300 ${transactionTone.panel}`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className={`text-sm font-semibold ${transactionTone.title}`}>{formatCurrency(denomination.value)}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">Pecahan transaksi</p>
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">Input manual tetap tersedia</p>
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
                                                        className={`mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-center text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 ${transactionTone.input}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className={`flex flex-col gap-3 rounded-2xl border border-dashed px-4 py-4 lg:flex-row lg:items-center lg:justify-between ${transactionTone.panel}`}>
                                            <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                                <p>
                                                    Nominal target: <span className={`font-semibold ${transactionTone.title}`}>{formatCurrency(transactionAmount)}</span>
                                                </p>
                                                <p>
                                                    Hasil pecahan: <span className={`font-semibold ${transactionTone.title}`}>{formatCurrency(transactionTotal)}</span>
                                                </p>
                                                {transactionAmount > 0 && transactionAmount !== transactionTotal && (
                                                    <p className="text-rose-600 dark:text-rose-300">
                                                        Selisih: {formatCurrency(Math.abs(transactionAmount - transactionTotal))}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                type="submit"
                                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 ${transactionTone.accent}`}
                                            >
                                                <IconPlus size={16} />
                                                Simpan Transaksi Kas
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {activeMode === "exchange" && (
                                <div className="space-y-5">
                                    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                                        <div>
                                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Tukar Pecahan Kas</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                Gunakan saat saldo total tetap sama, tetapi komposisi uang berubah. Contoh: keluar 1 x Rp2.000, masuk 2 x Rp1.000.
                                            </p>
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                            Selisih: <span className={`font-semibold ${exchangeOutTotal === exchangeInTotal ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>
                                                {formatCurrency(Math.abs(exchangeOutTotal - exchangeInTotal))}
                                            </span>
                                        </div>
                                    </div>

                                    <form onSubmit={submitExchange} className="space-y-5">
                                        <input
                                            type="text"
                                            value={exchangeDescription}
                                            onChange={(event) => setExchangeDescription(event.target.value)}
                                            placeholder="Catatan opsional, misal: Tukar Rp2.000 menjadi 2 x Rp1.000 untuk kembalian"
                                            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                                        />

                                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                                            <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-200">Pecahan Keluar</h3>
                                                        <p className="text-xs text-rose-700/80 dark:text-rose-200/70">Uang yang diambil dari drawer.</p>
                                                    </div>
                                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-slate-900 dark:text-rose-200">
                                                        {formatCurrency(exchangeOutTotal)}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    {denominationsDesc.map((denomination) => (
                                                        <div key={`exchange-out-${denomination.id}`} className="rounded-xl border border-rose-100 bg-white p-3 dark:border-rose-900/40 dark:bg-slate-900">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(denomination.value)}</p>
                                                                <p className="text-[11px] text-slate-500">Stok {denomination.quantity}</p>
                                                            </div>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={denomination.quantity}
                                                                value={exchangeOutDenoms[denomination.id] ?? 0}
                                                                onChange={(event) =>
                                                                    setExchangeOutDenoms((previous) => ({
                                                                        ...previous,
                                                                        [denomination.id]: Number(event.target.value || 0),
                                                                    }))
                                                                }
                                                                className="mt-3 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-center text-sm font-semibold text-slate-900 outline-none transition focus:border-rose-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Pecahan Masuk</h3>
                                                        <p className="text-xs text-emerald-700/80 dark:text-emerald-200/70">Uang pengganti yang masuk ke drawer.</p>
                                                    </div>
                                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-slate-900 dark:text-emerald-200">
                                                        {formatCurrency(exchangeInTotal)}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    {denominationsDesc.map((denomination) => (
                                                        <div key={`exchange-in-${denomination.id}`} className="rounded-xl border border-emerald-100 bg-white p-3 dark:border-emerald-900/40 dark:bg-slate-900">
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(denomination.value)}</p>
                                                            <p className="text-[11px] text-slate-500">Jumlah masuk</p>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={exchangeInDenoms[denomination.id] ?? 0}
                                                                onChange={(event) =>
                                                                    setExchangeInDenoms((previous) => ({
                                                                        ...previous,
                                                                        [denomination.id]: Number(event.target.value || 0),
                                                                    }))
                                                                }
                                                                className="mt-3 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-center text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                                <p>Keluar: <span className="font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(exchangeOutTotal)}</span></p>
                                                <p>Masuk: <span className="font-semibold text-slate-900 dark:text-slate-50">{formatCurrency(exchangeInTotal)}</span></p>
                                                <p className={exchangeOutTotal === exchangeInTotal ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}>
                                                    {exchangeOutTotal === exchangeInTotal ? "Saldo kas tetap seimbang." : "Total keluar dan masuk harus sama sebelum disimpan."}
                                                </p>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={exchangeOutTotal <= 0 || exchangeOutTotal !== exchangeInTotal}
                                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <IconRefresh size={16} />
                                                Simpan Tukar Pecahan
                                            </button>
                                        </div>
                                    </form>
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
                                    recentTransactions.map((transaction) => {
                                        const historyTone = transactionHistoryTone[transaction.transaction_type] || transactionHistoryTone.adjustment;

                                        return (
                                        <div key={transaction.id} className={`rounded-2xl border p-4 transition-colors duration-300 ${historyTone.card}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className={`text-sm font-semibold ${historyTone.title}`}>
                                                        {getTransactionLabel(transaction)}
                                                    </p>
                                                    <p className={`mt-1 text-xs ${historyTone.subtitle}`}>
                                                        {transaction.happened_at || "-"}
                                                        {transaction.created_by ? ` | ${transaction.created_by}` : ""}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-sm font-semibold ${historyTone.amount}`}>{formatCurrency(transaction.amount)}</p>
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${historyTone.badge}`}>
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
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

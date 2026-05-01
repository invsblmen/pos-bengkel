import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router } from "@inertiajs/react";
import { Card, CardBody, CardHeader, CardTitle } from "@/Components/Card";
import {
    IconArrowDownRight,
    IconArrowUpRight,
    IconCalendar,
    IconExternalLink,
    IconFilter,
    IconReportMoney,
    IconWallet,
} from "@tabler/icons-react";
import { useRealtimeReportHistoryReload } from "@/Hooks/useRealtimeReportHistoryReload";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value || 0);

const sourceBadgeClass = {
    service_order: "bg-blue-100 text-blue-700 border-blue-200",
    part_sale: "bg-cyan-100 text-cyan-700 border-cyan-200",
    part_purchase: "bg-orange-100 text-orange-700 border-orange-200",
    cash_transaction: "bg-violet-100 text-violet-700 border-violet-200",
};

const flowBadgeClass = {
    in: "bg-emerald-100 text-emerald-700 border-emerald-200",
    out: "bg-rose-100 text-rose-700 border-rose-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
};

const flowLabel = {
    in: "Masuk",
    out: "Keluar",
    neutral: "Netral",
};

const statusBadgeClass = {
    unpaid: "bg-slate-100 text-slate-700 border-slate-200",
    partial: "bg-amber-100 text-amber-700 border-amber-200",
    paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
    income: "bg-emerald-100 text-emerald-700 border-emerald-200",
    expense: "bg-rose-100 text-rose-700 border-rose-200",
    change_given: "bg-orange-100 text-orange-700 border-orange-200",
    adjustment: "bg-violet-100 text-violet-700 border-violet-200",
};

const toDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

export default function DailyFinanceReport({ filters, summary, sourceSummary = [], transactions }) {
    useRealtimeReportHistoryReload();

    const [formData, setFormData] = useState({
        date: filters.date,
        per_page: Number(filters.per_page || 50),
    });

    const transactionData = Array.isArray(transactions)
        ? transactions
        : transactions?.data || [];

    const submitFilter = (event) => {
        event.preventDefault();
        router.get(route("reports.daily-finance.index"), formData);
    };

    const applyDate = (date) => {
        const next = { ...formData, date };
        setFormData(next);
        router.get(route("reports.daily-finance.index"), next);
    };

    const handlePaginate = (page) => {
        router.get(route("reports.daily-finance.index"), {
            ...formData,
            page,
        });
    };

    const today = toDateInput(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = toDateInput(yesterdayDate);

    return (
        <DashboardLayout>
            <Head title="Monitoring Keuangan Harian" />

            <div className="space-y-6">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 p-6 text-white shadow-xl">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                                Monitoring Harian
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold leading-tight md:text-4xl">Neraca keluar masuk uang per hari.</h1>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                                    Pantau saldo awal, uang masuk, uang keluar, dan saldo akhir dari seluruh transaksi bengkel pada tanggal yang dipilih.
                                </p>
                            </div>
                        </div>

                        <form onSubmit={submitFilter} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/70">Tanggal</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                                        className="w-full rounded-xl border-white/20 bg-white px-3 py-2 text-sm text-slate-900"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        type="submit"
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
                                    >
                                        <IconFilter size={16} />
                                        Tampilkan
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => applyDate(today)}
                                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10"
                                >
                                    Hari Ini
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyDate(yesterday)}
                                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10"
                                >
                                    Kemarin
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <Card>
                        <CardBody>
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                                    <IconWallet size={22} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Saldo Awal</p>
                                    <p className="text-xl font-bold">{formatCurrency(summary.opening_balance)}</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                                    <IconArrowUpRight size={22} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Uang Masuk</p>
                                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.money_in)}</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
                                    <IconArrowDownRight size={22} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Uang Keluar</p>
                                    <p className="text-xl font-bold text-rose-600">{formatCurrency(summary.money_out)}</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                                    <IconReportMoney size={22} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Neto Hari Ini</p>
                                    <p className={`text-xl font-bold ${summary.net_movement >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                                        {formatCurrency(summary.net_movement)}
                                    </p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <div className="flex items-center gap-3">
                                <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                                    <IconCalendar size={22} />
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Saldo Akhir</p>
                                    <p className="text-xl font-bold">{formatCurrency(summary.closing_balance)}</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Neraca Per Sumber Transaksi</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                            {sourceSummary.length === 0 ? (
                                <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500 lg:col-span-4">
                                    Belum ada arus uang pada tanggal ini.
                                </div>
                            ) : (
                                sourceSummary.map((item) => (
                                    <div key={item.source} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                        <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${sourceBadgeClass[item.source] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                            {item.source_label}
                                        </span>
                                        <p className="mt-3 text-sm text-slate-500">{item.transaction_count} transaksi</p>
                                        <div className="mt-3 space-y-1 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Masuk</span>
                                                <span className="font-semibold text-emerald-600">{formatCurrency(item.money_in)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Keluar</span>
                                                <span className="font-semibold text-rose-600">{formatCurrency(item.money_out)}</span>
                                            </div>
                                            <div className="flex justify-between border-t pt-2">
                                                <span className="text-slate-500">Neto</span>
                                                <span className={`font-bold ${item.net_amount >= 0 ? "text-slate-900" : "text-rose-600"}`}>
                                                    {formatCurrency(item.net_amount)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Detail Arus Uang Harian</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr>
                                        <th className="px-3 py-3 text-left font-semibold">Waktu</th>
                                        <th className="px-3 py-3 text-left font-semibold">Sumber</th>
                                        <th className="px-3 py-3 text-left font-semibold">Referensi</th>
                                        <th className="px-3 py-3 text-left font-semibold">Keterangan</th>
                                        <th className="px-3 py-3 text-center font-semibold">Arus</th>
                                        <th className="px-3 py-3 text-right font-semibold">Nominal</th>
                                        <th className="px-3 py-3 text-left font-semibold">Status</th>
                                        <th className="px-3 py-3 text-right font-semibold">Saldo</th>
                                        <th className="px-3 py-3 text-right font-semibold">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {transactionData.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-slate-500">
                                                Tidak ada transaksi pada tanggal ini.
                                            </td>
                                        </tr>
                                    ) : (
                                        transactionData.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="whitespace-nowrap px-3 py-3">{item.date || "-"}</td>
                                                <td className="px-3 py-3">
                                                    <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${sourceBadgeClass[item.source] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                                        {item.source_label}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 font-medium">{item.reference || "-"}</td>
                                                <td className="px-3 py-3">{item.description || "-"}</td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${flowBadgeClass[item.flow] || flowBadgeClass.neutral}`}>
                                                        {flowLabel[item.flow] || item.flow}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-semibold">{formatCurrency(item.amount)}</td>
                                                <td className="px-3 py-3">
                                                    <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${statusBadgeClass[item.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                                                        {item.status_label || item.status || "-"}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-semibold">{formatCurrency(item.running_balance)}</td>
                                                <td className="px-3 py-3 text-right">
                                                    {item.detail_url ? (
                                                        <a
                                                            href={item.detail_url}
                                                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                                        >
                                                            <IconExternalLink size={14} />
                                                            Buka
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">Tidak tersedia</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {!Array.isArray(transactions) && transactions?.last_page > 1 && (
                            <div className="mt-4 flex items-center justify-between">
                                <p className="text-sm text-slate-500">
                                    Halaman {transactions.current_page} dari {transactions.last_page}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handlePaginate(transactions.current_page - 1)}
                                        disabled={transactions.current_page <= 1}
                                        className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
                                    >
                                        Sebelumnya
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePaginate(transactions.current_page + 1)}
                                        disabled={transactions.current_page >= transactions.last_page}
                                        className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-50"
                                    >
                                        Berikutnya
                                    </button>
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </DashboardLayout>
    );
}

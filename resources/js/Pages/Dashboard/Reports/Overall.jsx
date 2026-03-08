import React, { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router } from "@inertiajs/react";
import { Card, CardBody, CardHeader, CardTitle } from "@/Components/Card";
import { IconChartInfographic, IconDownload, IconFilter } from "@tabler/icons-react";
import { useRealtimeReportHistoryReload } from "@/Hooks/useRealtimeReportHistoryReload";

const formatCurrency = (value = 0) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(value || 0);

const sourceLabel = {
    service_order: "Service Order",
    part_sale: "Penjualan Part",
    cash_transaction: "Transaksi Kas",
};

const sourceBadgeClass = {
    service_order: "bg-blue-100 text-blue-700 border-blue-200",
    part_sale: "bg-cyan-100 text-cyan-700 border-cyan-200",
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
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    paid: "bg-green-100 text-green-700 border-green-200",
    draft: "bg-slate-100 text-slate-700 border-slate-200",
    confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    waiting_stock: "bg-amber-100 text-amber-700 border-amber-200",
    ready_to_notify: "bg-indigo-100 text-indigo-700 border-indigo-200",
    waiting_pickup: "bg-cyan-100 text-cyan-700 border-cyan-200",
    cancelled: "bg-rose-100 text-rose-700 border-rose-200",
    income: "bg-emerald-100 text-emerald-700 border-emerald-200",
    expense: "bg-rose-100 text-rose-700 border-rose-200",
    change_given: "bg-orange-100 text-orange-700 border-orange-200",
    adjustment: "bg-violet-100 text-violet-700 border-violet-200",
};

const FILTER_STORAGE_KEY = "overall-report-filters-v1";

const toDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const getDefaultFilterValues = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
        start_date: toDateInput(startOfMonth),
        end_date: toDateInput(now),
        source: "all",
        status: "all",
        per_page: 20,
    };
};

const normalizeFilterValues = (values) => ({
    start_date: values?.start_date || "",
    end_date: values?.end_date || "",
    source: values?.source || "all",
    status: values?.status || "all",
    per_page: Number(values?.per_page || 20),
});

const isSameFilters = (left, right) => {
    const a = normalizeFilterValues(left);
    const b = normalizeFilterValues(right);

    return (
        a.start_date === b.start_date &&
        a.end_date === b.end_date &&
        a.source === b.source &&
        a.status === b.status &&
        a.per_page === b.per_page
    );
};

export default function OverallReport({ summary, filters, transactions, statusOptions = [], statusSummary = [] }) {
    useRealtimeReportHistoryReload();
    const startDateInputRef = useRef(null);
    const [savedFilterActive, setSavedFilterActive] = useState(false);

    const transactionData = Array.isArray(transactions)
        ? transactions
        : transactions?.data || [];

    const [formData, setFormData] = useState(() => {
        if (typeof window === "undefined") {
            return {
                start_date: filters.start_date,
                end_date: filters.end_date,
                source: filters.source || "all",
                status: filters.status || "all",
                per_page: Number(filters.per_page || 20),
            };
        }

        try {
            const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
            if (!raw) {
                return {
                    start_date: filters.start_date,
                    end_date: filters.end_date,
                    source: filters.source || "all",
                    status: filters.status || "all",
                    per_page: Number(filters.per_page || 20),
                };
            }

            const parsed = JSON.parse(raw);
            return {
                start_date: parsed.start_date || filters.start_date,
                end_date: parsed.end_date || filters.end_date,
                source: parsed.source || filters.source || "all",
                status: parsed.status || filters.status || "all",
                per_page: Number(parsed.per_page || filters.per_page || 20),
            };
        } catch {
            return {
                start_date: filters.start_date,
                end_date: filters.end_date,
                source: filters.source || "all",
                status: filters.status || "all",
                per_page: Number(filters.per_page || 20),
            };
        }
    });

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const defaultFilters = getDefaultFilterValues();
        if (isSameFilters(formData, defaultFilters)) {
            window.localStorage.removeItem(FILTER_STORAGE_KEY);
            setSavedFilterActive(false);
            return;
        }

        window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(formData));
        setSavedFilterActive(true);
    }, [formData]);

    const handleFilterSubmit = (e) => {
        e.preventDefault();
        router.get(route("reports.overall.index"), formData);
    };

    const handleResetFilter = () => {
        const reset = {
            start_date: filters.start_date,
            end_date: filters.end_date,
            source: "all",
            status: "all",
            per_page: Number(filters.per_page || 20),
        };

        setFormData(reset);
        router.get(route("reports.overall.index"), reset);
    };

    const handleClearSavedFilter = () => {
        if (typeof window !== "undefined") {
            window.localStorage.removeItem(FILTER_STORAGE_KEY);
        }

        const reset = getDefaultFilterValues();
        setFormData(reset);
        router.get(route("reports.overall.index"), reset);
    };

    const handleExport = () => {
        router.get(route("reports.export"), {
            type: "overall",
            start_date: formData.start_date,
            end_date: formData.end_date,
            source: formData.source,
            status: formData.status,
        });
    };

    const handlePaginate = (page) => {
        router.get(route("reports.overall.index"), {
            ...formData,
            page,
        });
    };

    const applyRange = (range) => {
        if (range === "custom") {
            if (startDateInputRef.current?.focus) {
                startDateInputRef.current.focus();
            }
            if (startDateInputRef.current?.showPicker) {
                startDateInputRef.current.showPicker();
            }
            return;
        }

        const today = new Date();
        const endDate = toDateInput(today);
        let startDate = endDate;

        if (range === "last7") {
            const start = new Date(today);
            start.setDate(start.getDate() - 6);
            startDate = toDateInput(start);
        }

        if (range === "month") {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            startDate = toDateInput(start);
        }

        const next = {
            ...formData,
            start_date: startDate,
            end_date: endDate,
        };

        setFormData(next);
        router.get(route("reports.overall.index"), next);
    };

    return (
        <DashboardLayout>
            <Head title="Laporan Keseluruhan" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Laporan Keseluruhan</h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Ringkasan performa bengkel dan detail transaksi gabungan.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExport}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                            <IconDownload size={16} />
                            Export CSV
                        </button>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                            <IconChartInfographic size={18} />
                            <span className="text-sm font-semibold">Semua Sumber Data</span>
                        </div>
                    </div>
                </div>

                <Card>
                    <CardBody>
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs text-slate-500">Filter laporan keseluruhan</p>
                            <span
                                className={`inline-flex px-2 py-1 rounded-lg text-xs border ${
                                    savedFilterActive
                                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                        : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                            >
                                {savedFilterActive ? "Filter tersimpan aktif" : "Filter default"}
                            </span>
                        </div>

                        <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Tanggal Mulai</label>
                                <input
                                    ref={startDateInputRef}
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Tanggal Akhir</label>
                                <input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Sumber</label>
                                <select
                                    value={formData.source}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, source: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="all">Semua</option>
                                    <option value="service_order">Service Order</option>
                                    <option value="part_sale">Penjualan Part</option>
                                    <option value="cash_transaction">Transaksi Kas</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="all">Semua Status</option>
                                    {statusOptions.map((status) => (
                                        <option key={status.value} value={status.value}>
                                            {status.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Per Halaman</label>
                                <select
                                    value={formData.per_page}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, per_page: Number(e.target.value) }))}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <div className="w-full grid grid-cols-2 gap-2">
                                    <button
                                        type="submit"
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        <IconFilter size={16} />
                                        Terapkan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleResetFilter}
                                        className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>
                        </form>

                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => applyRange("today")}
                                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 hover:bg-slate-50"
                            >
                                Hari Ini
                            </button>
                            <button
                                type="button"
                                onClick={() => applyRange("last7")}
                                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 hover:bg-slate-50"
                            >
                                7 Hari
                            </button>
                            <button
                                type="button"
                                onClick={() => applyRange("month")}
                                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 hover:bg-slate-50"
                            >
                                Bulan Ini
                            </button>
                            <button
                                type="button"
                                onClick={() => applyRange("custom")}
                                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 hover:bg-slate-50"
                            >
                                Custom
                            </button>
                            <button
                                type="button"
                                onClick={handleClearSavedFilter}
                                className="px-3 py-1.5 text-xs rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50"
                            >
                                Clear Saved Filter
                            </button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div className="rounded-lg border border-slate-200 p-3">
                                <p className="text-xs font-semibold text-slate-500 mb-2">Legenda Sumber</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.keys(sourceLabel).map((sourceKey) => (
                                        <span
                                            key={sourceKey}
                                            title={sourceLabel[sourceKey]}
                                            className={`inline-flex px-2 py-1 rounded-lg text-xs border ${sourceBadgeClass[sourceKey] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                                        >
                                            {sourceLabel[sourceKey]}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 p-3">
                                <p className="text-xs font-semibold text-slate-500 mb-2">Legenda Status</p>
                                <div className="flex flex-wrap gap-2">
                                    {statusOptions.map((status) => (
                                        <span
                                            key={status.value}
                                            title={status.label}
                                            className={`inline-flex px-2 py-1 rounded-lg text-xs border ${statusBadgeClass[status.value] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                                        >
                                            {status.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                {statusSummary.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {statusSummary.map((item) => (
                            <Card key={item.value}>
                                <CardBody>
                                    <span
                                        title={item.label}
                                        className={`inline-flex px-2 py-1 rounded-lg text-xs border ${statusBadgeClass[item.value] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                                    >
                                        {item.label}
                                    </span>
                                    <p className="text-lg font-bold">{item.count} transaksi</p>
                                    <p className={`text-sm font-semibold ${item.net_amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                        {formatCurrency(item.net_amount)}
                                    </p>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardBody>
                            <p className="text-sm text-slate-500">Revenue Service</p>
                            <p className="text-xl font-bold">{formatCurrency(summary.service_revenue)}</p>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <p className="text-sm text-slate-500">Revenue Part</p>
                            <p className="text-xl font-bold">{formatCurrency(summary.part_revenue)}</p>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <p className="text-sm text-slate-500">Total Revenue</p>
                            <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.total_revenue)}</p>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <p className="text-sm text-slate-500">Jumlah Transaksi</p>
                            <p className="text-xl font-bold">{summary.transaction_count}</p>
                        </CardBody>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardBody>
                            <p className="text-sm text-slate-500">Kas Masuk</p>
                            <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.cash_in)}</p>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <p className="text-sm text-slate-500">Kas Keluar</p>
                            <p className="text-xl font-bold text-rose-600">{formatCurrency(summary.cash_out)}</p>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody>
                            <p className="text-sm text-slate-500">Arus Kas Bersih</p>
                            <p className={`text-xl font-bold ${summary.net_cash_flow >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                                {formatCurrency(summary.net_cash_flow)}
                            </p>
                        </CardBody>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Detail Transaksi Keseluruhan</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr>
                                        <th className="text-left py-3 px-3 font-semibold">Tanggal</th>
                                        <th className="text-left py-3 px-3 font-semibold">Sumber</th>
                                        <th className="text-left py-3 px-3 font-semibold">Referensi</th>
                                        <th className="text-left py-3 px-3 font-semibold">Keterangan</th>
                                        <th className="text-center py-3 px-3 font-semibold">Arus</th>
                                        <th className="text-right py-3 px-3 font-semibold">Nominal</th>
                                        <th className="text-left py-3 px-3 font-semibold">Status</th>
                                        <th className="text-right py-3 px-3 font-semibold">Saldo Berjalan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {transactionData.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-8 text-center text-slate-500">
                                                Tidak ada data transaksi pada rentang tanggal ini.
                                            </td>
                                        </tr>
                                    ) : (
                                        transactionData.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                                <td className="py-3 px-3 whitespace-nowrap">{item.date || "-"}</td>
                                                <td className="py-3 px-3">
                                                    <span
                                                        title={sourceLabel[item.source] || item.source}
                                                        className={`inline-flex px-2 py-1 rounded-lg text-xs border ${sourceBadgeClass[item.source] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                                                    >
                                                        {sourceLabel[item.source] || item.source}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 font-medium">{item.reference || "-"}</td>
                                                <td className="py-3 px-3">{item.description || "-"}</td>
                                                <td className="py-3 px-3 text-center">
                                                    <span className={`inline-flex px-2 py-1 rounded-lg text-xs border ${flowBadgeClass[item.flow] || flowBadgeClass.neutral}`}>
                                                        {flowLabel[item.flow] || item.flow}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right font-semibold">{formatCurrency(item.amount)}</td>
                                                <td className="py-3 px-3">
                                                    <span
                                                        title={item.status_label || item.status || "-"}
                                                        className={`inline-flex px-2 py-1 rounded-lg text-xs border ${statusBadgeClass[item.status] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                                                    >
                                                        {item.status_label || item.status || "-"}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 text-right font-semibold">{formatCurrency(item.running_balance || 0)}</td>
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
                                        className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-50"
                                    >
                                        Sebelumnya
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handlePaginate(transactions.current_page + 1)}
                                        disabled={transactions.current_page >= transactions.last_page}
                                        className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-50"
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

import React, { useState } from "react";
import { Head, router } from "@inertiajs/react";
import {
    IconCalendar,
    IconDownload,
    IconTrendingUp,
} from "@tabler/icons-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/Components/Card";
import { toDisplayDate } from "@/Utils/datetime";
import { useRealtimeReportHistoryReload } from "@/Hooks/useRealtimeReportHistoryReload";

export default function ServiceRevenueReport({
    report_data,
    filters,
    summary,
}) {
    useRealtimeReportHistoryReload();
    const [formData, setFormData] = useState({
        start_date: filters.start_date,
        end_date: filters.end_date,
        period: filters.period,
    });

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleFilterSubmit = (e) => {
        e.preventDefault();
        router.get(route("reports.service-revenue.index"), formData);
    };

    const handleExport = () => {
        router.get(route("reports.export"), {
            type: "revenue",
            start_date: formData.start_date,
            end_date: formData.end_date,
        });
    };

    const periodLabels = {
        daily: "Harian",
        weekly: "Mingguan",
        monthly: "Bulanan",
    };

    return (
        <>
            <Head title="Laporan Pendapatan Service" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">
                            Laporan Pendapatan Service
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Analisis pendapatan layanan service dan komponen biaya
                        </p>
                    </div>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                        <IconDownload size={18} />
                        Export CSV
                    </button>
                </div>

                {/* Filters */}
                <Card>
                    <CardBody>
                        <form onSubmit={handleFilterSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Tanggal Mulai
                                    </label>
                                    <input
                                        type="date"
                                        name="start_date"
                                        value={formData.start_date}
                                        onChange={handleFilterChange}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Tanggal Akhir
                                    </label>
                                    <input
                                        type="date"
                                        name="end_date"
                                        value={formData.end_date}
                                        onChange={handleFilterChange}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Periode
                                    </label>
                                    <select
                                        name="period"
                                        value={formData.period}
                                        onChange={handleFilterChange}
                                        className="w-full px-3 py-2 border rounded-lg"
                                    >
                                        <option value="daily">Harian</option>
                                        <option value="weekly">Mingguan</option>
                                        <option value="monthly">Bulanan</option>
                                    </select>
                                </div>

                                <div className="flex items-end">
                                    <button
                                        type="submit"
                                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                    >
                                        Terapkan
                                    </button>
                                </div>
                            </div>
                        </form>
                    </CardBody>
                </Card>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <Card>
                        <CardBody>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Total Pendapatan
                            </p>
                            <p className="text-2xl font-bold">
                                Rp {summary.total_revenue.toLocaleString("id-ID")}
                            </p>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Total Pesanan
                            </p>
                            <p className="text-2xl font-bold">
                                {summary.total_orders}
                            </p>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Biaya Tenaga Kerja
                            </p>
                            <p className="text-2xl font-bold">
                                Rp {summary.total_labor_cost.toLocaleString("id-ID")}
                            </p>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Biaya Material
                            </p>
                            <p className="text-2xl font-bold">
                                Rp {summary.total_material_cost.toLocaleString("id-ID")}
                            </p>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Nilai Rata-rata
                            </p>
                            <p className="text-2xl font-bold">
                                Rp {summary.average_order_value.toLocaleString("id-ID")}
                            </p>
                        </CardBody>
                    </Card>
                </div>

                {/* Revenue Chart / Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Detail Pendapatan ({periodLabels[formData.period]})
                        </CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            {formData.period === "daily"
                                                ? "Tanggal"
                                                : formData.period === "weekly"
                                                ? "Minggu"
                                                : "Bulan"}
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Jumlah Pesanan
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Total Pendapatan
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Biaya Tenaga Kerja
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Biaya Material
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Laba Kotor
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {report_data.length > 0 ? (
                                        report_data.map((row, index) => {
                                            const profit =
                                                (row.revenue || 0) -
                                                (row.labor_cost || 0) -
                                                (row.material_cost || 0);

                                            let dateLabel = "";
                                            if (formData.period === "daily") {
                                                dateLabel = toDisplayDate(row.date);
                                            } else if (formData.period === "weekly") {
                                                dateLabel = `Week ${row.week}, ${row.year}`;
                                            } else {
                                                const months = [
                                                    "Jan",
                                                    "Feb",
                                                    "Mar",
                                                    "Apr",
                                                    "May",
                                                    "Jun",
                                                    "Jul",
                                                    "Aug",
                                                    "Sep",
                                                    "Oct",
                                                    "Nov",
                                                    "Dec",
                                                ];
                                                dateLabel = `${months[row.month - 1]} ${row.year}`;
                                            }

                                            return (
                                                <tr
                                                    key={index}
                                                    className="hover:bg-gray-50 dark:hover:bg-gray-900"
                                                >
                                                    <td className="py-3 px-4 font-medium">
                                                        {dateLabel}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        {row.count}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-semibold">
                                                        Rp{" "}
                                                        {(row.revenue || 0).toLocaleString(
                                                            "id-ID"
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        Rp{" "}
                                                        {(row.labor_cost || 0).toLocaleString(
                                                            "id-ID"
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        Rp{" "}
                                                        {(row.material_cost || 0).toLocaleString(
                                                            "id-ID"
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-semibold text-green-600">
                                                        Rp{" "}
                                                        {profit.toLocaleString("id-ID")}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan="6"
                                                className="py-6 text-center text-gray-500"
                                            >
                                                Tidak ada data
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </>
    );
}


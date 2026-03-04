import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router } from "@inertiajs/react";
import { IconDownload } from "@tabler/icons-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/Components/Card";

export default function MechanicProductivityReport({
    mechanics,
    filters,
    summary,
}) {
    const [formData, setFormData] = useState({
        start_date: filters.start_date,
        end_date: filters.end_date,
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
        router.get(route("reports.mechanic-productivity.index"), formData);
    };

    const handleExport = () => {
        router.get(route("reports.export"), {
            type: "mechanic_productivity",
            start_date: formData.start_date,
            end_date: formData.end_date,
        });
    };

    return (
        <DashboardLayout>
            <Head title="Laporan Produktivitas Mekanik" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">
                            Laporan Produktivitas Mekanik
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Analisis performa dan produktivitas per mekanik
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardBody>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Total Mekanik
                            </p>
                            <p className="text-2xl font-bold">
                                {summary.total_mechanics}
                            </p>
                        </CardBody>
                    </Card>

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
                                Total Service Orders
                            </p>
                            <p className="text-2xl font-bold">
                                {summary.total_orders}
                            </p>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Total Insentif
                            </p>
                            <p className="text-2xl font-bold">
                                Rp {(summary.total_incentive || 0).toLocaleString("id-ID")}
                            </p>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Total Gaji (Estimasi)
                            </p>
                            <p className="text-2xl font-bold">
                                Rp {(summary.total_salary || 0).toLocaleString("id-ID")}
                            </p>
                        </CardBody>
                    </Card>
                </div>

                {/* Mechanics Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Performa Per Mekanik</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            Nama
                                        </th>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            Spesialisasi
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Total Pesanan
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Total Pendapatan
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Rata-rata Pesanan
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Auto Diskon
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Insentif
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Gaji Estimasi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {mechanics.length > 0 ? (
                                        mechanics.map((mechanic) => (
                                            <tr
                                                key={mechanic.id}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-900"
                                            >
                                                <td className="py-3 px-4 font-medium">
                                                    {mechanic.name}
                                                </td>
                                                <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                                                    {mechanic.specialty || "-"}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {mechanic.total_orders}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold">
                                                    Rp{" "}
                                                    {mechanic.total_revenue.toLocaleString(
                                                        "id-ID"
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    Rp{" "}
                                                    {mechanic.average_order_value.toLocaleString(
                                                        "id-ID"
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right text-amber-600">
                                                    Rp {(mechanic.total_auto_discount || 0).toLocaleString("id-ID")}
                                                </td>
                                                <td className="py-3 px-4 text-right text-green-600 font-semibold">
                                                    Rp {(mechanic.total_incentive || 0).toLocaleString("id-ID")}
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold">
                                                    Rp {(mechanic.total_salary || 0).toLocaleString("id-ID")}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan="8"
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
        </DashboardLayout>
    );
}

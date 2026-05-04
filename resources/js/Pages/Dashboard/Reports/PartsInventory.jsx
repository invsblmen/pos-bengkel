import React, { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, router } from "@inertiajs/react";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/Components/Card";
import { useRealtimeReportHistoryReload } from "@/Hooks/useRealtimeReportHistoryReload";

export default function PartsInventoryReport({ parts, filters, summary }) {
    useRealtimeReportHistoryReload();
    const [selectedStatus, setSelectedStatus] = useState(filters.status);

    const handleStatusChange = (status) => {
        setSelectedStatus(status);
        router.get(route("reports.parts-inventory.index"), {
            status: status === "all" ? "" : status,
        });
    };

    return (
        <DashboardLayout>
            <Head title="Laporan Inventori Sparepart" />

            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold">
                        Laporan Inventori Sparepart
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Analisis stok dan nilai inventori sparepart
                    </p>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardBody>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Total Sparepart
                            </p>
                            <p className="text-2xl font-bold">
                                {summary.total_parts}
                            </p>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                Total Nilai Stok
                            </p>
                            <p className="text-2xl font-bold">
                                Rp {summary.total_stock_value.toLocaleString("id-ID")}
                            </p>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                    Stok Rendah
                                </p>
                                <p className="text-2xl font-bold">
                                    {summary.low_stock_items}
                                </p>
                            </div>
                            <IconAlertTriangle
                                size={32}
                                strokeWidth={1.5}
                                className="text-red-500"
                            />
                        </CardBody>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardBody>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleStatusChange("all")}
                                className={`px-4 py-2 rounded-lg transition ${
                                    selectedStatus === "all"
                                        ? "bg-blue-500 text-white"
                                        : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200"
                                }`}
                            >
                                Semua
                            </button>
                            <button
                                onClick={() => handleStatusChange("low")}
                                className={`px-4 py-2 rounded-lg transition ${
                                    selectedStatus === "low"
                                        ? "bg-red-500 text-white"
                                        : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200"
                                }`}
                            >
                                Stok Rendah
                            </button>
                        </div>
                    </CardBody>
                </Card>

                {/* Parts Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Sparepart</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            Nama Sparepart
                                        </th>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            Kategori
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Stok
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Level Reorder
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Harga Satuan
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Nilai Stok
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {parts.length > 0 ? (
                                        parts.map((part) => (
                                            <tr
                                                key={part.id}
                                                className={`hover:bg-gray-50 dark:hover:bg-gray-900 ${
                                                    part.status === "low"
                                                        ? "bg-red-50 dark:bg-red-900/20"
                                                        : ""
                                                }`}
                                            >
                                                <td className="py-3 px-4 font-medium">
                                                    {part.name}
                                                </td>
                                                <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                                                    {part.category || "-"}
                                                </td>
                                                <td className="py-3 px-4 text-center font-semibold">
                                                    {part.stock}
                                                </td>
                                                <td className="py-3 px-4 text-center text-gray-600">
                                                    {part.reorder_level}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    Rp{" "}
                                                    {(part.price || 0).toLocaleString("id-ID")}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold">
                                                    Rp{" "}
                                                    {(part.stock_value || 0).toLocaleString(
                                                        "id-ID"
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {part.status === "low" ? (
                                                        <span className="inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                                            Rendah
                                                        </span>
                                                    ) : (
                                                        <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                            Normal
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan="7"
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


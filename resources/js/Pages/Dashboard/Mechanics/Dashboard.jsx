import React from "react";
import { Head } from "@inertiajs/react";
import {
    IconUsers,
    IconFileDescription,
    IconTrendingUp,
    IconAward,
} from "@tabler/icons-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/Components/Card";

export default function MechanicDashboard({ mechanics, summary }) {
    return (
        <>
            <Head title="Dashboard Performa Mekanik" />

            <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <Card>
                        <CardBody className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Total Mekanik
                                </p>
                                <p className="text-2xl font-bold">
                                    {summary.total_mechanics}
                                </p>
                            </div>
                            <IconUsers
                                size={32}
                                strokeWidth={1.5}
                                className="text-blue-500"
                            />
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Total Service Orders
                                </p>
                                <p className="text-2xl font-bold">
                                    {summary.total_service_orders}
                                </p>
                            </div>
                            <IconFileDescription
                                size={32}
                                strokeWidth={1.5}
                                className="text-green-500"
                            />
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Total Penghasilan
                                </p>
                                <p className="text-2xl font-bold">
                                    Rp {summary.total_earnings.toLocaleString('id-ID')}
                                </p>
                            </div>
                            <IconTrendingUp
                                size={32}
                                strokeWidth={1.5}
                                className="text-purple-500"
                            />
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Rata-rata Per Mekanik
                                </p>
                                <p className="text-2xl font-bold">
                                    Rp {summary.average_earnings_per_mechanic.toLocaleString('id-ID')}
                                </p>
                            </div>
                            <IconAward
                                size={32}
                                strokeWidth={1.5}
                                className="text-yellow-500"
                            />
                        </CardBody>
                    </Card>
                </div>

                {/* Mechanics Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Performa Mekanik</CardTitle>
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
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Selesai
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Menunggu
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Sedang Berjalan
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Penghasilan
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Tingkat Selesai
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Aksi
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
                                                    {mechanic.total_service_orders}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                        {mechanic.completed_orders}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                                        {mechanic.pending_orders}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                        {mechanic.in_progress_orders}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold">
                                                    Rp{" "}
                                                    {mechanic.total_earnings.toLocaleString(
                                                        "id-ID"
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center">
                                                        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                                            <span className="text-sm font-semibold">
                                                                {mechanic.completion_rate}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <a
                                                        href={route(
                                                            "mechanics.performance.show",
                                                            mechanic.id
                                                        )}
                                                        className="text-blue-500 hover:text-blue-700 font-medium text-sm"
                                                    >
                                                        Detail
                                                    </a>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan="9"
                                                className="py-6 text-center text-gray-500"
                                            >
                                                Tidak ada data mekanik
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

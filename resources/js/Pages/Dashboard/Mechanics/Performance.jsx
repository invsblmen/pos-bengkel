import React from "react";
import { Head, Link } from "@inertiajs/react";
import {
    IconArrowLeft,
    IconFileDescription,
    IconCircleCheck,
    IconClock,
    IconAlertCircle,
    IconTrendingUp,
} from "@tabler/icons-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/Components/Card";
import { toDisplayDate } from "@/Utils/datetime";

export default function MechanicPerformance({ mechanic, service_orders, stats, monthly_earnings }) {
    const statusColors = {
        pending: "bg-yellow-100 text-yellow-700",
        in_progress: "bg-blue-100 text-blue-700",
        completed: "bg-green-100 text-green-700",
        cancelled: "bg-red-100 text-red-700",
    };

    const statusLabels = {
        pending: "Menunggu",
        in_progress: "Sedang Berjalan",
        completed: "Selesai",
        cancelled: "Dibatalkan",
    };

    return (
        <>
            <Head title={`Performa ${mechanic.name}`} />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href={route("mechanics.performance.dashboard")}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                        >
                            <IconArrowLeft
                                size={20}
                                strokeWidth={1.5}
                            />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold">{mechanic.name}</h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                {mechanic.specialty || "Mekanik"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card>
                        <CardBody className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Total Service Orders
                                </p>
                                <p className="text-3xl font-bold">
                                    {stats.total_orders}
                                </p>
                            </div>
                            <IconFileDescription
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
                                    Total Penghasilan
                                </p>
                                <p className="text-3xl font-bold">
                                    Rp {stats.total_earnings.toLocaleString('id-ID')}
                                </p>
                            </div>
                            <IconTrendingUp
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
                                    Tingkat Penyelesaian
                                </p>
                                <p className="text-3xl font-bold">
                                    {stats.completion_rate}%
                                </p>
                            </div>
                            <IconCircleCheck
                                size={32}
                                strokeWidth={1.5}
                                className="text-purple-500"
                            />
                        </CardBody>
                    </Card>
                </div>

                {/* Detailed Stats */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <Card>
                        <CardBody>
                            <div className="flex items-center gap-3">
                                <IconCircleCheck
                                    size={24}
                                    strokeWidth={1.5}
                                    className="text-green-500"
                                />
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Selesai
                                    </p>
                                    <p className="text-xl font-bold">
                                        {stats.completed_orders}
                                    </p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <div className="flex items-center gap-3">
                                <IconClock
                                    size={24}
                                    strokeWidth={1.5}
                                    className="text-yellow-500"
                                />
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Menunggu
                                    </p>
                                    <p className="text-xl font-bold">
                                        {stats.pending_orders}
                                    </p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <div className="flex items-center gap-3">
                                <IconAlertCircle
                                    size={24}
                                    strokeWidth={1.5}
                                    className="text-blue-500"
                                />
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Sedang Berjalan
                                    </p>
                                    <p className="text-xl font-bold">
                                        {stats.in_progress_orders}
                                    </p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody>
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Nilai Rata-rata Pesanan
                                </p>
                                <p className="text-lg font-bold">
                                    Rp {stats.average_order_value.toLocaleString('id-ID')}
                                </p>
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {/* Service Orders Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Service Orders</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            Nomor SO
                                        </th>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            Pelanggan
                                        </th>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            Kendaraan
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Status
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Total
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Tgl Dibuat
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {service_orders.data.length > 0 ? (
                                        service_orders.data.map((order) => (
                                            <tr
                                                key={order.id}
                                                className="hover:bg-gray-50 dark:hover:bg-gray-900"
                                            >
                                                <td className="py-3 px-4 font-medium">
                                                    <Link
                                                        href={route(
                                                            "service-orders.show",
                                                            order.id
                                                        )}
                                                        className="text-blue-500 hover:underline"
                                                    >
                                                        {order.order_number}
                                                    </Link>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {order.customer?.name || "-"}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {order.vehicle?.plate_number ||
                                                        "-"}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span
                                                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                                                            statusColors[order.status]
                                                        }`}
                                                    >
                                                        {statusLabels[order.status]}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold">
                                                    Rp{" "}
                                                    {order.total.toLocaleString(
                                                        "id-ID"
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-center text-sm text-gray-500">
                                                    {toDisplayDate(order.created_at)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan="6"
                                                className="py-6 text-center text-gray-500"
                                            >
                                                Tidak ada service orders
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {service_orders.links.length > 0 && (
                            <div className="flex justify-center mt-6 gap-2">
                                {service_orders.links.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={link.url || "#"}
                                        className={`px-3 py-2 text-sm rounded ${
                                            link.active
                                                ? "bg-blue-500 text-white"
                                                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
                                        }`}
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>
        </>
    );
}

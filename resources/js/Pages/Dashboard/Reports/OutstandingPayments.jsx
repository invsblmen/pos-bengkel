import React from "react";
import { Head, Link } from "@inertiajs/react";
import { IconClock, IconAlertCircle } from "@tabler/icons-react";
import { toDisplayDate } from "@/Utils/datetime";
import { Card, CardBody, CardHeader, CardTitle } from "@/Components/Card";
import { useRealtimeReportHistoryReload } from "@/Hooks/useRealtimeReportHistoryReload";

export default function OutstandingPaymentsReport({ orders, summary }) {
    useRealtimeReportHistoryReload();
    const paidStatusColors = {
        unpaid: "bg-yellow-100 text-yellow-700",
        partial: "bg-orange-100 text-orange-700",
        unknown: "bg-gray-100 text-gray-700",
    };

    const paidStatusLabels = {
        unpaid: "Belum Bayar",
        partial: "Sebagian",
        unknown: "Tertunda",
    };

    return (
        <>
            <Head title="Laporan Pembayaran Tertunda" />

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">
                            Laporan Pembayaran Tertunda
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Service orders yang belum dibayarkan
                        </p>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardBody className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                    Total Tertunda
                                </p>
                                <p className="text-2xl font-bold">
                                    Rp{" "}
                                    {summary.total_outstanding.toLocaleString(
                                        "id-ID"
                                    )}
                                </p>
                            </div>
                            <IconAlertCircle
                                size={32}
                                strokeWidth={1.5}
                                className="text-red-500"
                            />
                        </CardBody>
                    </Card>

                    <Card>
                        <CardBody className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                    Jumlah Pembayaran Tertunda
                                </p>
                                <p className="text-2xl font-bold">
                                    {summary.count_outstanding}
                                </p>
                            </div>
                            <IconClock
                                size={32}
                                strokeWidth={1.5}
                                className="text-orange-500"
                            />
                        </CardBody>
                    </Card>
                </div>

                {/* Outstanding Payments Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Daftar Pembayaran Tertunda</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            No. SO
                                        </th>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            Pelanggan
                                        </th>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            Kendaraan
                                        </th>
                                        <th className="text-right py-3 px-4 font-semibold">
                                            Sisa Tagihan
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Status Pembayaran
                                        </th>
                                        <th className="text-center py-3 px-4 font-semibold">
                                            Umur Tunggakan
                                        </th>
                                        <th className="text-left py-3 px-4 font-semibold">
                                            Tanggal
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {orders.data.length > 0 ? (
                                        orders.data.map((order) => {
                                            const paymentStatus =
                                                order.payment_status === "unpaid" ||
                                                order.payment_status === "partial"
                                                    ? order.payment_status
                                                    : "unknown";
                                            const statusClass =
                                                paidStatusColors[paymentStatus] ||
                                                paidStatusColors.unknown;
                                            const statusLabel =
                                                paidStatusLabels[paymentStatus] ||
                                                paidStatusLabels.unknown;

                                            return (
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
                                                        {order.customer_name}
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                                                        {order.vehicle_plate || "-"}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-semibold">
                                                        Rp{" "}
                                                        {order.outstanding_amount.toLocaleString(
                                                            "id-ID"
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span
                                                            className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusClass}`}
                                                        >
                                                            {statusLabel}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-semibold">
                                                        {order.days_outstanding} hari
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-500">
                                                         {toDisplayDate(order.created_at)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan="7"
                                                className="py-6 text-center text-gray-500"
                                            >
                                                Semua pembayaran sudah terselesaikan!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {orders.links && orders.links.length > 0 && (
                            <div className="flex justify-center mt-6 gap-2">
                                {orders.links.map((link, index) => (
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


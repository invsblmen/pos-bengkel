import React, { useState, useEffect } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Head, Link } from "@inertiajs/react";
import {
    IconArrowLeft,
    IconPencilCog,
    IconUser,
    IconPhone,
    IconMail,
    IconMapPin,
    IconCar,
    IconTool,
    IconCalendar,
    IconReceipt,
} from "@tabler/icons-react";
import { toDisplayDateTime } from "@/Utils/datetime";

export default function Show({ customer }) {
    const [liveCustomer, setLiveCustomer] = useState(customer);

    useEffect(() => setLiveCustomer(customer), [customer]);
    const currentData = liveCustomer || customer;
    const vehicles = currentData?.vehicles || [];
    const serviceOrders = currentData?.service_orders || [];

    const statusLabel = (status) => {
        const map = {
            pending: "Menunggu",
            in_progress: "Dikerjakan",
            completed: "Selesai",
            paid: "Dibayar",
            cancelled: "Dibatalkan",
        };

        return map[status] || status || "-";
    };

    return (
        <>
            <Head title={`Detail Pelanggan - ${currentData?.name || "-"}`} />

            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link
                            href={route("customers.index")}
                            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600"
                        >
                            <IconArrowLeft size={16} />
                            Kembali ke Pelanggan
                        </Link>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                            <IconUser size={26} className="text-primary-500" />
                            Detail Pelanggan
                        </h1>
                    </div>

                    <Link
                        href={route("customers.edit", customer.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-600"
                    >
                        <IconPencilCog size={18} />
                        Edit Pelanggan
                    </Link>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-center gap-2">
                        <IconUser size={20} className="text-primary-500" />
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Informasi Utama</h2>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Nama</p>
                            <p className="font-medium text-slate-900 dark:text-white">{customer?.name || "-"}</p>
                        </div>
                        <div>
                            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Telepon</p>
                            <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                                <IconPhone size={16} className="text-slate-400" />
                                {customer?.phone || "-"}
                            </p>
                        </div>
                        <div>
                            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Email</p>
                            <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                                <IconMail size={16} className="text-slate-400" />
                                {customer?.email || "-"}
                            </p>
                        </div>
                        <div>
                            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Alamat</p>
                            <p className="flex items-start gap-2 font-medium text-slate-900 dark:text-white">
                                <IconMapPin size={16} className="mt-0.5 text-slate-400" />
                                <span>{customer?.address || "-"}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                            <IconCar size={20} className="text-primary-500" />
                            Kendaraan
                        </h2>
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {vehicles.length} unit
                        </span>
                    </div>

                    {vehicles.length === 0 ? (
                        <p className="text-sm text-slate-500">Belum ada kendaraan terdaftar.</p>
                    ) : (
                        <div className="space-y-3">
                            {vehicles.map((vehicle) => (
                                <div
                                    key={vehicle.id}
                                    className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-white">
                                                {vehicle.plate_number || "-"}
                                            </p>
                                            <p className="text-sm text-slate-500">
                                                {[vehicle.brand, vehicle.model, vehicle.year]
                                                    .filter(Boolean)
                                                    .join(" â€¢ ") || "-"}
                                            </p>
                                        </div>
                                        <Link
                                            href={route("vehicles.show", vehicle.id)}
                                            className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
                                        >
                                            Lihat detail
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                            <IconReceipt size={20} className="text-primary-500" />
                            Riwayat Service Order
                        </h2>
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {serviceOrders.length} terbaru
                        </span>
                    </div>

                    {serviceOrders.length === 0 ? (
                        <p className="text-sm text-slate-500">Belum ada service order untuk pelanggan ini.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                                        <th className="py-3 pr-4">No. Order</th>
                                        <th className="py-3 pr-4">Kendaraan</th>
                                        <th className="py-3 pr-4">Mekanik</th>
                                        <th className="py-3 pr-4">Status</th>
                                        <th className="py-3 pr-4">Tanggal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {serviceOrders.map((order) => (
                                        <tr key={order.id} className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="py-3 pr-4">
                                                <Link
                                                    href={route("service-orders.show", order.id)}
                                                    className="font-semibold text-primary-600 hover:underline dark:text-primary-400"
                                                >
                                                    {order.order_number}
                                                </Link>
                                            </td>
                                            <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <IconCar size={14} className="text-slate-400" />
                                                    {order.vehicle?.plate_number || "-"}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <IconTool size={14} className="text-slate-400" />
                                                    {order.mechanic?.name || "-"}
                                                </span>
                                            </td>
                                            <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                                                {statusLabel(order.status)}
                                            </td>
                                            <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <IconCalendar size={14} className="text-slate-400" />
                                                    {toDisplayDateTime(order.created_at)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

Show.layout = (page) => <DashboardLayout children={page} />;


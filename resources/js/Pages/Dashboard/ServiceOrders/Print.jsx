import React, { useMemo, useState } from "react";
import { Head, Link } from "@inertiajs/react";
import {
    IconArrowLeft,
    IconClipboardList,
    IconPrinter,
    IconReceipt,
    IconFileInvoice,
    IconCar,
    IconUser,
    IconTool,
    IconCalendar,
} from "@tabler/icons-react";
import ThermalReceipt, { ThermalReceipt58mm } from "@/Components/Receipt/ThermalReceipt";
import { toDisplayDateTime } from "@/Utils/datetime";
import {
    formatBusinessSocials,
    getCompactBusinessSocialDisplay,
    getGoogleBusinessQrUrl,
} from "@/Utils/socialMediaFormatter";

export default function Print({ order, businessProfile, printMode: initialPrintMode = "invoice" }) {
    const [printMode, setPrintMode] = useState(initialPrintMode);

    const formatPrice = (price = 0) =>
        Number(price || 0).toLocaleString("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        });

    const formatDateTime = (value) => (value ? toDisplayDateTime(value) : "-");

    const statusMeta = {
        pending: {
            label: "Menunggu",
            color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        },
        in_progress: {
            label: "Dikerjakan",
            color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        },
        completed: {
            label: "Selesai",
            color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
        },
        cancelled: {
            label: "Dibatalkan",
            color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
        },
    };

    const paymentMeta = {
        unpaid: {
            label: "Belum Dibayar",
            color: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
        },
        partial: {
            label: "Sebagian",
            color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        },
        paid: {
            label: "Lunas",
            color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
        },
    };

    const printModeMeta = {
        invoice: {
            title: "Invoice",
            buttonLabel: "Invoice",
        },
        work_order: {
            title: "Work Order",
            buttonLabel: "WO",
        },
        thermal80: {
            title: "Struk 80mm",
            buttonLabel: "Struk 80mm",
        },
        thermal58: {
            title: "Struk 58mm",
            buttonLabel: "Struk 58mm",
        },
    };

    const statusBadge = statusMeta[order?.status] || statusMeta.pending;
    const paymentBadge = paymentMeta[order?.payment_status] || paymentMeta.unpaid;

    const items = order?.details || [];
    const subtotal = Number(order?.total) || 0;
    const discount = Number(order?.discount_amount) || 0;
    const tax = Number(order?.tax_amount) || 0;
    const roundingAdjustment = Number(order?.rounding_adjustment) || 0;
    const grandTotal = Number(order?.grand_total ?? order?.total ?? 0);
    const businessName = businessProfile?.business_name || "SERVICE";
    const businessPhone = businessProfile?.business_phone || "";
    const businessAddress = businessProfile?.business_address || "";
    const consumerNote =
        businessProfile?.receipt_note_service_order ||
        "Simpan nota ini sebagai bukti service. Klaim garansi service wajib menunjukkan nota ini.";
    const businessSocials = formatBusinessSocials(businessProfile);
    const compactSocialInfo = getCompactBusinessSocialDisplay(businessProfile);
    const googleBusinessQrUrl = getGoogleBusinessQrUrl(
        businessProfile?.google_my_business,
        108
    );

    const workOrderItems = useMemo(() => {
        return (order?.details || []).map((detail, index) => {
            const jobName = detail.service?.title || detail.part?.name || "Item kerja";
            const notes = [
                detail.notes,
                detail.service?.description,
                detail.auto_discount_notes,
                detail.part?.part_number ? `Kode part: ${detail.part.part_number}` : null,
            ].filter(Boolean);

            return {
                key: detail.id || `${index}-${jobName}`,
                jobName,
                qty: Number(detail.qty) || 1,
                hasService: Boolean(detail.service_id),
                hasPart: Boolean(detail.part_id),
                notes,
            };
        });
    }, [order?.details]);
    const serviceWorkOrderItems = workOrderItems.filter((item) => item.hasService || (!item.hasService && !item.hasPart));
    const partWorkOrderItems = workOrderItems.filter((item) => item.hasPart);

    const activePrintMode = printModeMeta[printMode] ? printMode : "invoice";
    const activePrintTitle = printModeMeta[activePrintMode].title;
    const workOrderNote =
        businessProfile?.receipt_note_service_order ||
        "Work order ini dipakai sebagai panduan pengerjaan mekanik berdasarkan keluhan dan permintaan konsumen.";
    const hasWorkOrderSideInfo = Boolean(order?.maintenance_type || order?.next_service_km);

    const thermalPayload = useMemo(() => {
        return {
            invoice: order?.order_number,
            created_at: order?.created_at,
            cashier: order?.mechanic ? { name: order.mechanic.name } : null,
            customer: order?.customer ? { name: order.customer.name } : null,
            details: (order?.details || []).map((detail) => {
                const qty = Number(detail.qty) || 1;
                const totalPrice = (Number(detail.price) || 0) * qty;
                return {
                    ...detail,
                    qty,
                    price: totalPrice,
                    product: {
                        title: detail.service?.title || detail.part?.name || "Item",
                    },
                };
            }),
            subtotal,
            discount: discount,
            rounding_adjustment: roundingAdjustment,
            grand_total: grandTotal,
            cash: grandTotal,
            change: 0,
        };
    }, [order, subtotal, discount, roundingAdjustment, grandTotal]);

    const handlePrint = () => window.print();

    return (
        <>
            <Head title={`Cetak ${activePrintTitle} ${order?.order_number || ""}`} />

            <div className={`service-order-print-page service-order-print-${activePrintMode} min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 print:min-h-0 print:bg-white print:p-0 print:text-[11px] print:leading-tight`}>
                <div className="max-w-5xl mx-auto space-y-6 print:max-w-none print:mx-0 print:space-y-0">
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                        <Link
                            href={route("service-orders.show", order?.id)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <IconArrowLeft size={18} />
                            Kembali ke detail
                        </Link>

                        <div className="flex items-center gap-2">
                            <div className="flex bg-slate-200 dark:bg-slate-800 rounded-xl p-1">
                                <button
                                    type="button"
                                    onClick={() => setPrintMode("invoice")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        activePrintMode === "invoice"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconFileInvoice size={16} className="inline mr-1" />
                                    Invoice
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrintMode("work_order")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        activePrintMode === "work_order"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconClipboardList size={16} className="inline mr-1" />
                                    WO
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrintMode("thermal80")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        activePrintMode === "thermal80"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconReceipt size={16} className="inline mr-1" />
                                    Struk 80mm
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrintMode("thermal58")}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                        activePrintMode === "thermal58"
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                                    }`}
                                >
                                    <IconReceipt size={16} className="inline mr-1" />
                                    Struk 58mm
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={handlePrint}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-sm font-semibold text-white shadow-lg shadow-primary-500/30 transition-colors"
                            >
                                <IconPrinter size={18} />
                                Cetak
                            </button>
                        </div>
                    </div>

                    {(activePrintMode === "thermal80" || activePrintMode === "thermal58") && (
                        <div className="flex justify-center print:block">
                            <div className="bg-white rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-4 print:shadow-none print:border-0 print:p-0 print:rounded-none">
                                {activePrintMode === "thermal80" ? (
                                    <ThermalReceipt
                                        transaction={thermalPayload}
                                        storeName={businessName}
                                        storeAddress={businessAddress}
                                        storePhone={businessPhone}
                                        businessSocials={businessSocials}
                                        businessSocialInfo={compactSocialInfo}
                                        googleBusinessQrUrl={googleBusinessQrUrl}
                                        consumerNote={consumerNote}
                                    />
                                ) : (
                                    <ThermalReceipt58mm
                                        transaction={thermalPayload}
                                        storeName={businessName}
                                        storePhone={businessPhone}
                                        businessSocials={businessSocials}
                                        businessSocialInfo={compactSocialInfo}
                                        googleBusinessQrUrl={googleBusinessQrUrl}
                                        consumerNote={consumerNote}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {activePrintMode === "work_order" && (
                        <div
                            className="service-order-print-sheet work-order-sheet mx-auto max-w-5xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl print:shadow-none print:border-0 print:rounded-none print:max-w-none"
                        >
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-6 text-white print:bg-transparent print:text-slate-900 print:px-0 print:py-0">
                                <div className="flex flex-wrap items-start justify-between gap-4 print:flex-nowrap print:gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-2 print:mb-1">
                                            <IconClipboardList size={20} className="shrink-0 print:w-3.5 print:h-3.5 print:opacity-70" />
                                            <span className="text-sm font-semibold tracking-wide opacity-90 print:text-xs">WORK ORDER</span>
                                        </div>
                                        <p className="text-2xl font-bold leading-tight print:text-lg">{order?.order_number}</p>
                                        <p className="text-sm opacity-80 mt-1 print:opacity-100 print:mt-0.5 print:text-xs">{formatDateTime(order?.created_at)}</p>
                                    </div>
                                    <div className="text-right max-w-[240px] shrink-0 print:max-w-[220px]">
                                        <p className="text-sm font-semibold print:text-slate-700 print:text-xs">{businessName}</p>
                                        {businessPhone && <p className="text-[11px] opacity-80 mt-1 print:mt-0.5">{businessPhone}</p>}
                                        {businessAddress && <p className="text-[11px] opacity-80 mt-1 print:mt-0.5 line-clamp-2">{businessAddress}</p>}
                                        <div className="mt-3 flex flex-wrap justify-end gap-2 print:mt-1">
                                            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${statusBadge.color} print:px-2 print:py-0.5 print:text-[10px]`}>
                                                {statusBadge.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 px-6 py-6 border-b border-slate-100 dark:border-slate-800 print:gap-2 print:px-0 print:py-2.5 print:grid-cols-[1fr_1fr_1fr_1.2fr] md:grid-cols-[1fr_1fr_1fr_1.2fr]">
                                <div className="space-y-3 print:space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <IconUser size={16} className="print:w-3.5 print:h-3.5" />
                                        <span>Pelanggan</span>
                                    </div>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white print:text-sm">{order?.customer?.name || "Umum"}</p>
                                    {order?.customer?.phone && <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">{order.customer.phone}</p>}
                                    {order?.customer?.address && <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs line-clamp-2">{order.customer.address}</p>}
                                </div>

                                <div className="space-y-3 print:space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <IconCar size={16} className="print:w-3.5 print:h-3.5" />
                                        <span>Kendaraan</span>
                                    </div>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white print:text-sm">
                                        {order?.vehicle ? `${order.vehicle.brand || ""} ${order.vehicle.model || ""}`.trim() || "-" : "-"}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">Plat: {order?.vehicle?.plate_number || "-"}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">KM: {order?.odometer_km ? `${Number(order.odometer_km).toLocaleString("id-ID")} km` : "-"}</p>
                                </div>

                                <div className="space-y-3 print:space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <IconTool size={16} className="print:w-3.5 print:h-3.5" />
                                        <span>Mekanik</span>
                                    </div>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white print:text-sm">{order?.mechanic?.name || "-"}</p>
                                    {order?.mechanic?.specialty && <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">{order.mechanic.specialty}</p>}
                                    <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">Mulai: {formatDateTime(order?.estimated_start_at)}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">Selesai: {formatDateTime(order?.estimated_finish_at)}</p>
                                </div>

                                <div className="space-y-3 print:space-y-1.5">
                                    <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <span>Permintaan Konsumen</span>
                                    </div>
                                    <p className="whitespace-pre-line text-sm leading-5 text-slate-700 dark:text-slate-300 print:text-xs print:leading-tight">
                                        {order?.notes || "Tidak ada catatan keluhan."}
                                    </p>
                                </div>
                            </div>

                            <div className={`grid gap-4 ${hasWorkOrderSideInfo ? "md:grid-cols-[1fr_0.98fr] print:grid-cols-[1fr_0.98fr]" : ""} px-6 py-6 print:px-0 print:py-2.5`}>
                                {hasWorkOrderSideInfo && (
                                <div className="space-y-4 print:space-y-2">
                                    {order?.maintenance_type && (
                                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 print:p-2.5">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Jenis Pekerjaan</p>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 print:text-xs">{order.maintenance_type}</p>
                                        </div>
                                    )}

                                    {order?.next_service_km && (
                                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 print:p-2.5">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Tindak Lanjut</p>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 print:text-xs">Servis berikutnya di {Number(order.next_service_km).toLocaleString("id-ID")} km</p>
                                        </div>
                                    )}
                                </div>
                                )}

                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 print:p-2.5">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Daftar Pekerjaan</p>
                                    <div className="grid gap-3 md:grid-cols-2 print:grid-cols-2 print:gap-2">
                                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 print:p-2">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 print:text-[10px]">Layanan</p>
                                            <div className="space-y-2 print:space-y-1.5">
                                                {serviceWorkOrderItems.length > 0 ? (
                                                    serviceWorkOrderItems.map((item, index) => (
                                                        <div key={item.key} className="rounded-md bg-white dark:bg-slate-900/40 p-2 print:p-1.5">
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white print:text-xs">
                                                                {index + 1}. {item.jobName}
                                                            </p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 print:text-[10px]">Qty {item.qty}</p>
                                                            {item.notes.length > 0 && (
                                                                <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300 print:text-[10px]">
                                                                    {item.notes.map((note) => (
                                                                        <li key={note} className="whitespace-pre-line">- {note}</li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 print:text-xs">Belum ada layanan.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 print:p-2">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 print:text-[10px]">Sparepart</p>
                                            <div className="space-y-2 print:space-y-1.5">
                                                {partWorkOrderItems.length > 0 ? (
                                                    partWorkOrderItems.map((item, index) => (
                                                        <div key={item.key} className="rounded-md bg-white dark:bg-slate-900/40 p-2 print:p-1.5">
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white print:text-xs">
                                                                {index + 1}. {item.jobName}
                                                            </p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 print:text-[10px]">Qty {item.qty}</p>
                                                            {item.notes.length > 0 && (
                                                                <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300 print:text-[10px]">
                                                                    {item.notes.map((note) => (
                                                                        <li key={note} className="whitespace-pre-line">- {note}</li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-slate-500 dark:text-slate-400 print:text-xs">Belum ada sparepart.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-slate-800 px-6 py-4 print:px-0 print:py-2.5">
                                <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr] print:grid-cols-[1.2fr_0.8fr] print:gap-2">
                                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 print:text-[10px]">
                                        <p className="font-semibold text-slate-700 dark:text-slate-200 print:text-[10px]">Catatan untuk Mekanik</p>
                                        <p className="whitespace-pre-line leading-6 print:leading-tight">{workOrderNote}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 print:gap-2">
                                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center print:p-2.5">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 print:text-[10px]">Diterima Konsumen</p>
                                            <div className="mt-8 h-10 border-t border-slate-300 dark:border-slate-700 pt-2 text-xs text-slate-500 print:mt-6 print:h-8 print:text-[10px]">Tanda tangan</div>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center print:p-2.5">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 print:text-[10px]">Dikerjakan Mekanik</p>
                                            <div className="mt-8 h-10 border-t border-slate-300 dark:border-slate-700 pt-2 text-xs text-slate-500 print:mt-6 print:h-8 print:text-[10px]">Tanda tangan</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activePrintMode === "invoice" && (
                        <div className="service-order-print-sheet service-order-invoice bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl print:shadow-none print:border-slate-300 print:rounded-none">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-primary-500 to-primary-700 px-6 py-6 text-white print:bg-slate-100 print:text-slate-900 print:px-3 print:py-2">
                                <div className="flex flex-wrap items-start justify-between gap-4 print:flex-nowrap print:gap-2">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 print:mb-1">
                                            <IconReceipt size={24} className="print:w-5 print:h-5" />
                                            <span className="text-sm font-medium opacity-90 print:opacity-100 print:text-xs">SERVICE ORDER</span>
                                        </div>
                                        <p className="text-2xl font-bold print:text-lg">{order?.order_number}</p>
                                        <p className="text-sm opacity-80 print:opacity-100 mt-1 print:mt-0.5 print:text-xs">{formatDateTime(order?.created_at)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold print:text-slate-700 print:text-xs">
                                            {businessName}
                                        </p>
                                        {businessPhone && (
                                            <p className="text-xs opacity-80 print:opacity-100 mt-1 print:mt-0.5">
                                                {businessPhone}
                                            </p>
                                        )}
                                        {businessAddress && (
                                            <p className="text-xs opacity-80 print:opacity-100 mt-1 print:mt-0.5 max-w-xs print:max-w-[260px]">
                                                {businessAddress}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap justify-end gap-2">
                                            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${statusBadge.color} print:px-2 print:py-0.5 print:text-[10px]`}>
                                                {statusBadge.label}
                                            </span>
                                            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${paymentBadge.color} print:px-2 print:py-0.5 print:text-[10px]`}>
                                                {paymentBadge.label}
                                            </span>
                                        </div>
                                        {order?.maintenance_type && (
                                            <p className="text-sm opacity-80 print:opacity-100 mt-2 print:mt-1 print:text-xs">
                                                {order.maintenance_type}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Info Grid */}
                            <div className="grid md:grid-cols-[1fr_1fr_1.05fr_1.2fr] print:grid-cols-[1fr_1fr_1.05fr_1.2fr] gap-6 px-6 py-6 border-b border-slate-100 dark:border-slate-800 print:gap-2 print:px-3 print:py-2.5">
                                <div className="space-y-3 print:space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <IconUser size={16} className="print:w-3.5 print:h-3.5" />
                                        <span>Pelanggan</span>
                                    </div>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white print:text-sm">{order?.customer?.name || "Umum"}</p>
                                    {order?.customer?.phone && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">{order.customer.phone}</p>
                                    )}
                                    {order?.customer?.address && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">{order.customer.address}</p>
                                    )}
                                </div>
                                <div className="space-y-3 print:space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <IconCar size={16} className="print:w-3.5 print:h-3.5" />
                                        <span>Kendaraan</span>
                                    </div>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white print:text-sm">
                                        {order?.vehicle ? `${order.vehicle.brand} ${order.vehicle.model}` : "-"}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">{order?.vehicle?.plate_number || "-"}</p>
                                    {order?.odometer_km && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">KM: {Number(order.odometer_km).toLocaleString("id-ID")} km</p>
                                    )}
                                </div>

                                <div className="space-y-3 print:space-y-1.5">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <IconTool size={16} className="print:w-3.5 print:h-3.5" />
                                        <span>Mekanik</span>
                                    </div>
                                    <p className="text-base font-semibold text-slate-900 dark:text-white print:text-sm">{order?.mechanic?.name || "-"}</p>
                                    {order?.mechanic?.specialty && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">{order.mechanic.specialty}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <IconCalendar size={16} className="print:w-3.5 print:h-3.5" />
                                        <span>Jadwal</span>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">Estimasi Mulai: {formatDateTime(order?.estimated_start_at)}</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 print:text-xs">Estimasi Selesai: {formatDateTime(order?.estimated_finish_at)}</p>
                                    {order?.actual_start_at && (
                                        <p className="text-sm text-blue-600 dark:text-blue-400 print:text-xs">Mulai: {formatDateTime(order.actual_start_at)}</p>
                                    )}
                                    {order?.actual_finish_at && (
                                        <p className="text-sm text-emerald-600 dark:text-emerald-400 print:text-xs">Selesai: {formatDateTime(order.actual_finish_at)}</p>
                                    )}
                                </div>

                                <div className="space-y-3 print:space-y-1.5">
                                    <div className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                        <span>Permintaan Konsumen</span>
                                    </div>
                                    <p className="whitespace-pre-line text-sm leading-5 text-slate-700 dark:text-slate-300 print:text-xs print:leading-tight">
                                        {order?.notes || "Tidak ada catatan keluhan."}
                                    </p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="px-6 py-6 print:px-3 print:py-2.5">
                                <table className="w-full text-sm print:text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800">
                                            <th className="pb-3 print:pb-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Item</th>
                                            <th className="pb-3 print:pb-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Qty</th>
                                            <th className="pb-3 print:pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Harga</th>
                                            <th className="pb-3 print:pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Diskon</th>
                                            <th className="pb-3 print:pb-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {items.map((detail) => {
                                            const qty = Number(detail.qty) || 1;
                                            const grossSubtotalItem = Number(detail.amount ?? ((Number(detail.price) || 0) * qty)) || 0;
                                            const itemDiscount = (Number(detail.discount_amount) || 0) + (Number(detail.auto_discount_amount) || 0);
                                            const subtotalItem = Number(detail.final_amount ?? (grossSubtotalItem - itemDiscount)) || 0;
                                            return (
                                                <tr key={detail.id}>
                                                    <td className="py-3 print:py-1.5">
                                                        <p className="font-medium text-slate-900 dark:text-white print:text-xs">{detail.service?.title || detail.part?.name || "Item"}</p>
                                                        {detail.service?.description && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 print:hidden">{detail.service.description}</p>
                                                        )}
                                                        {detail.part?.part_number && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 print:text-[10px]">Kode: {detail.part.part_number}</p>
                                                        )}
                                                        {detail.auto_discount_notes && (
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 print:text-[10px]">Diskon otomatis: {detail.auto_discount_notes}</p>
                                                        )}
                                                    </td>
                                                    <td className="py-3 print:py-1.5 text-center text-slate-600 dark:text-slate-400">{qty}</td>
                                                    <td className="py-3 print:py-1.5 text-right text-slate-600 dark:text-slate-400">{formatPrice(Number(detail.price) || 0)}</td>
                                                    <td className="py-3 print:py-1.5 text-right text-slate-600 dark:text-slate-400">
                                                        {itemDiscount > 0 ? `- ${formatPrice(itemDiscount)}` : "-"}
                                                    </td>
                                                    <td className="py-3 print:py-1.5 text-right font-semibold text-slate-900 dark:text-white">{formatPrice(subtotalItem)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-6 print:px-3 print:py-2.5 border-t border-slate-100 dark:border-slate-800">
                                <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-[1fr_280px] gap-4 print:gap-2 items-start">
                                    <div className="space-y-2 print:space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                                        {(compactSocialInfo.mergedLine || compactSocialInfo.socials.length > 0 || businessProfile?.google_my_business) && (
                                            <div className="flex items-start justify-between gap-3 print:gap-2">
                                                <div className="space-y-1">
                                                    {compactSocialInfo.mergedLine && <p>{compactSocialInfo.mergedLine}</p>}
                                                    {compactSocialInfo.socials.map((social) => (
                                                        <p key={social.label}>{social.label}: {social.value}</p>
                                                    ))}
                                                </div>
                                                {googleBusinessQrUrl && (
                                                    <div className="text-center shrink-0">
                                                        <img src={googleBusinessQrUrl} alt="QR Google Business" className="w-[70px] h-[70px] print:w-[58px] print:h-[58px]" />
                                                        <p className="text-[10px] text-slate-500 mt-0.5">Yuk review {businessName} di Google</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div>
                                            <p className="font-semibold">Catatan untuk Konsumen</p>
                                            <p>{consumerNote}</p>
                                        </div>
                                    </div>

                                    <div className="w-full max-w-xs ml-auto space-y-1 text-sm print:text-xs">
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Subtotal</span>
                                            <span>{formatPrice(subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                            <span>Diskon</span>
                                            <span>- {formatPrice(discount)}</span>
                                        </div>
                                        {tax > 0 && (
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                                <span>Pajak</span>
                                                <span>+ {formatPrice(tax)}</span>
                                            </div>
                                        )}
                                        {roundingAdjustment !== 0 && (
                                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                                <span>Pembulatan</span>
                                                <span>{roundingAdjustment > 0 ? '+ ' : ''}{formatPrice(roundingAdjustment)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700 print:text-sm">
                                            <span>Total</span>
                                            <span>{formatPrice(grandTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 6mm;
                    }

                    .service-order-work-order,
                    .work-order-sheet {
                        background: #fff !important;
                        color: #111827 !important;
                        font-family: Arial, Helvetica, sans-serif !important;
                        font-size: 10.5pt !important;
                        line-height: 1.35 !important;
                        letter-spacing: 0 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .service-order-work-order .text-2xl {
                        font-size: 16.5pt !important;
                        line-height: 1.12 !important;
                    }

                    .service-order-work-order .text-lg {
                        font-size: 12pt !important;
                        line-height: 1.18 !important;
                    }

                    .service-order-work-order .text-base {
                        font-size: 10.5pt !important;
                        line-height: 1.32 !important;
                    }

                    .service-order-work-order .font-bold {
                        font-weight: 600 !important;
                    }

                    .service-order-work-order .font-semibold {
                        font-weight: 500 !important;
                    }

                    .service-order-work-order .font-medium {
                        font-weight: 400 !important;
                    }

                    .service-order-work-order .tracking-wide,
                    .service-order-work-order .tracking-wider {
                        letter-spacing: 0.015em !important;
                    }

                    .service-order-work-order .text-sm,
                    .service-order-work-order .text-xs,
                    .service-order-work-order .text-[10px] {
                        color: #4b5563 !important;
                    }

                    .service-order-work-order .text-2xl {
                        font-weight: 600 !important;
                    }

                    .service-order-work-order .text-lg {
                        font-weight: 500 !important;
                    }

                    .service-order-work-order .text-base {
                        font-weight: 500 !important;
                    }

                    .service-order-work-order .grid {
                        gap: 2.5mm !important;
                    }

                    .service-order-work-order .space-y-4 {
                        gap: 2.5mm !important;
                    }

                    .service-order-work-order .space-y-3 {
                        gap: 1.75mm !important;
                    }

                    .service-order-work-order .space-y-2 {
                        gap: 1.25mm !important;
                    }

                    .service-order-work-order h1,
                    .service-order-work-order h2,
                    .service-order-work-order h3,
                    .service-order-work-order p,
                    .service-order-work-order span,
                    .service-order-work-order td,
                    .service-order-work-order th,
                    .service-order-work-order li {
                        color: #111827 !important;
                    }

                    .service-order-work-order .rounded-full {
                        background: #fff !important;
                        border: 0.35mm solid #d1d5db !important;
                        color: #374151 !important;
                    }

                    .service-order-work-order .shadow-xl,
                    .service-order-work-order .shadow-lg,
                    .service-order-work-order .shadow-sm {
                        box-shadow: none !important;
                    }

                    .service-order-work-order .flex.items-center.gap-2.mb-2 svg,
                    .service-order-work-order .flex.items-center.gap-2.text-slate-500 svg {
                        width: 3.2mm !important;
                        height: 3.2mm !important;
                    }

                    .service-order-work-order .work-order-sheet > div:first-child {
                        padding-top: 0 !important;
                        padding-bottom: 3.5mm !important;
                    }

                    .service-order-work-order .work-order-sheet > div:nth-child(2),
                    .service-order-work-order .work-order-sheet > div:nth-child(3),
                    .service-order-work-order .work-order-sheet > div:nth-child(4) {
                        padding-top: 3.5mm !important;
                        padding-bottom: 3.5mm !important;
                    }

                    .service-order-work-order .work-order-sheet > div:nth-child(4) {
                        padding-top: 4mm !important;
                    }

                    .service-order-work-order .bg-gradient-to-r {
                        background: #fff !important;
                    }

                    .service-order-work-order .px-6 {
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                    }

                    .service-order-work-order .py-6 {
                        padding-top: 4mm !important;
                        padding-bottom: 4mm !important;
                    }

                    .service-order-work-order .py-4 {
                        padding-top: 3mm !important;
                        padding-bottom: 3mm !important;
                    }

                    .service-order-work-order .py-3 {
                        padding-top: 2.5mm !important;
                        padding-bottom: 2.5mm !important;
                    }

                    .service-order-work-order .bg-slate-50,
                    .service-order-work-order .bg-slate-100,
                    .service-order-work-order .bg-slate-200,
                    .service-order-work-order .bg-slate-800,
                    .service-order-work-order .bg-slate-800\/50,
                    .service-order-work-order .bg-slate-800\/60,
                    .service-order-work-order .bg-slate-900,
                    .service-order-work-order .bg-slate-900\/40,
                    .service-order-work-order .bg-emerald-50,
                    .service-order-work-order .bg-emerald-900\/20 {
                        background: #fff !important;
                    }

                    .service-order-work-order .border-slate-100,
                    .service-order-work-order .border-slate-200,
                    .service-order-work-order .border-slate-300,
                    .service-order-work-order .border-slate-700,
                    .service-order-work-order .border-slate-800 {
                        border-color: #d1d5db !important;
                    }

                    .service-order-work-order svg {
                        color: #111827 !important;
                        fill: currentColor !important;
                    }

                    .work-order-sheet {
                        max-width: none !important;
                        width: 100% !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                        overflow: visible !important;
                        background: #fff !important;
                        color: #111 !important;
                    }

                    .work-order-print-header {
                        padding: 0 0 3.5mm 0 !important;
                        border-bottom: 0.25mm solid #d1d5db !important;
                    }

                    .work-order-print-meta {
                        display: grid !important;
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                        gap: 2.5mm !important;
                        padding: 3.5mm 0 !important;
                    }

                    .work-order-sheet .bg-gradient-to-r {
                        background: #fff !important;
                        color: #111827 !important;
                    }

                    .work-order-sheet .text-white,
                    .work-order-sheet .text-slate-900,
                    .work-order-sheet .text-slate-700,
                    .work-order-sheet .text-slate-600,
                    .work-order-sheet .text-slate-500,
                    .work-order-sheet .text-emerald-700,
                    .work-order-sheet .text-blue-600,
                    .work-order-sheet .text-emerald-600 {
                        color: #111827 !important;
                    }

                    .work-order-sheet .border-slate-100,
                    .work-order-sheet .border-slate-200,
                    .work-order-sheet .border-slate-300,
                    .work-order-sheet .border-slate-700,
                    .work-order-sheet .border-slate-800 {
                        border-color: #d1d5db !important;
                    }

                    .work-order-sheet .bg-slate-50,
                    .work-order-sheet .bg-slate-100,

                    .work-order-sheet .rounded-xl,
                    .work-order-sheet .rounded-lg {
                        border-radius: 1.8mm !important;
                    }

                    .work-order-sheet .p-4,
                    .work-order-sheet .print\:p-2\.5,
                    .work-order-sheet .print\:p-2,
                    .work-order-sheet .print\:p-1\.5 {
                        padding-left: 2.2mm !important;
                        padding-right: 2.2mm !important;
                        padding-top: 2.2mm !important;
                        padding-bottom: 2.2mm !important;
                    }
                    .work-order-sheet .bg-slate-200,
                    .work-order-sheet .bg-slate-800,
                    .work-order-sheet .bg-slate-800\/50,
                    .work-order-sheet .bg-slate-800\/60,
                    .work-order-sheet .bg-slate-900,
                    .work-order-sheet .bg-slate-900\/40,
                    .work-order-sheet .bg-emerald-50,
                    .work-order-sheet .bg-emerald-900\/20 {
                        background: #fff !important;
                    }

                    .work-order-sheet [class*="text-"] svg,
                    .work-order-sheet svg {
                        color: #111827 !important;
                        fill: currentColor !important;
                    }

                    .service-order-work-order tr {
                        break-inside: avoid;
                    }

                    .service-order-work-order table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }

                    .service-order-work-order td,
                    .service-order-work-order th {
                        padding-top: 2mm !important;
                        padding-bottom: 2mm !important;
                    }

                    .service-order-print-page,
                    .service-order-print-page * {
                        background: transparent !important;
                        background-image: none !important;
                        box-shadow: none !important;
                        text-shadow: none !important;
                        color: #111 !important;
                        -webkit-print-color-adjust: economy !important;
                        print-color-adjust: economy !important;
                    }

                    .service-order-print-page {
                        background: #fff !important;
                        font-family: Arial, Helvetica, sans-serif !important;
                        font-size: 10pt !important;
                        line-height: 1.22 !important;
                    }

                    .service-order-print-page svg {
                        display: none !important;
                    }

                    .service-order-print-sheet {
                        width: 100% !important;
                        max-width: none !important;
                        border: 0 !important;
                        border-radius: 0 !important;
                        overflow: visible !important;
                    }

                    .service-order-print-sheet > div {
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                    }

                    .service-order-print-sheet > div:not(:last-child) {
                        border-bottom: 0.25mm solid #777 !important;
                    }

                    .service-order-print-sheet .px-6,
                    .service-order-print-sheet .px-4,
                    .service-order-print-sheet .px-3 {
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                    }

                    .service-order-print-sheet .py-6,
                    .service-order-print-sheet .py-4 {
                        padding-top: 3mm !important;
                        padding-bottom: 3mm !important;
                    }

                    .service-order-print-sheet .py-3,
                    .service-order-print-sheet .py-2,
                    .service-order-print-sheet .py-1\.5 {
                        padding-top: 1.4mm !important;
                        padding-bottom: 1.4mm !important;
                    }

                    .service-order-print-sheet .p-6,
                    .service-order-print-sheet .p-4,
                    .service-order-print-sheet .p-3,
                    .service-order-print-sheet .p-2,
                    .service-order-print-sheet .print\:p-2\.5,
                    .service-order-print-sheet .print\:p-2 {
                        padding: 2mm !important;
                    }

                    .service-order-print-sheet .gap-6,
                    .service-order-print-sheet .gap-4,
                    .service-order-print-sheet .gap-3 {
                        gap: 2.2mm !important;
                    }

                    .service-order-print-sheet .space-y-4 > :not([hidden]) ~ :not([hidden]),
                    .service-order-print-sheet .space-y-3 > :not([hidden]) ~ :not([hidden]),
                    .service-order-print-sheet .space-y-2 > :not([hidden]) ~ :not([hidden]),
                    .service-order-print-sheet .space-y-1 > :not([hidden]) ~ :not([hidden]) {
                        margin-top: 1.4mm !important;
                    }

                    .service-order-print-sheet .rounded-2xl,
                    .service-order-print-sheet .rounded-xl,
                    .service-order-print-sheet .rounded-lg,
                    .service-order-print-sheet .rounded-full {
                        border-radius: 0 !important;
                    }

                    .service-order-print-sheet .rounded-full,
                    .service-order-print-sheet [class*="bg-"][class*="text-"] {
                        border: 0.25mm solid #777 !important;
                        padding: 0.6mm 1.5mm !important;
                    }

                    .service-order-print-sheet table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        font-size: 9.2pt !important;
                    }

                    .service-order-print-sheet th,
                    .service-order-print-sheet td {
                        border-bottom: 0.2mm solid #cfcfcf !important;
                        padding: 1.3mm 1.5mm !important;
                        vertical-align: top !important;
                    }

                    .service-order-print-sheet thead th {
                        border-bottom: 0.25mm solid #777 !important;
                        font-size: 8.2pt !important;
                        letter-spacing: 0.02em !important;
                    }

                    .service-order-print-sheet tfoot td {
                        padding-top: 1mm !important;
                        padding-bottom: 1mm !important;
                    }

                    .service-order-print-sheet .text-2xl {
                        font-size: 15pt !important;
                        line-height: 1.1 !important;
                    }

                    .service-order-print-sheet .text-xl,
                    .service-order-print-sheet .text-lg {
                        font-size: 11pt !important;
                        line-height: 1.15 !important;
                    }

                    .service-order-print-sheet .text-base,
                    .service-order-print-sheet .text-sm,
                    .service-order-print-sheet .text-xs,
                    .service-order-print-sheet .text-\[10px\] {
                        font-size: 9pt !important;
                        line-height: 1.2 !important;
                    }

                    .service-order-print-sheet .mb-4,
                    .service-order-print-sheet .mb-3,
                    .service-order-print-sheet .mb-2,
                    .service-order-print-sheet .mt-4,
                    .service-order-print-sheet .mt-3,
                    .service-order-print-sheet .mt-2 {
                        margin-top: 1.2mm !important;
                        margin-bottom: 1.2mm !important;
                    }

                    .service-order-print-sheet img {
                        filter: grayscale(1) contrast(1.15) !important;
                    }

                    .service-order-print-thermal80,
                    .service-order-print-thermal58 {
                        width: auto !important;
                    }

                    .service-order-print-thermal80 .thermal-receipt,
                    .service-order-print-thermal58 .thermal-receipt,
                    .service-order-print-thermal80 .thermal-receipt *,
                    .service-order-print-thermal58 .thermal-receipt * {
                        color: #000 !important;
                        background: #fff !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>
        </>
    );
}
